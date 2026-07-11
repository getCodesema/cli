import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { request } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeRecord } from './contract.js'
import { parsePartialReview } from './partial.js'
import { createSession, isLoopbackHost, resolveStaticPath, startServer, type LiveSession } from './serve.js'

describe('isLoopbackHost', () => {
  test('accepts loopback hosts, with and without a port', () => {
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('localhost:4400')).toBe(true)
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('127.0.0.1:4400')).toBe(true)
    expect(isLoopbackHost('[::1]')).toBe(true)
    expect(isLoopbackHost('[::1]:4400')).toBe(true)
  })

  test('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isLoopbackHost('LOCALHOST:4400')).toBe(true)
    expect(isLoopbackHost(' localhost ')).toBe(true)
  })

  test('rejects a missing or empty header', () => {
    expect(isLoopbackHost(undefined)).toBe(false)
    expect(isLoopbackHost('')).toBe(false)
  })

  test('rejects external and loopback-lookalike domains', () => {
    expect(isLoopbackHost('evil.com')).toBe(false)
    expect(isLoopbackHost('evil.com:4400')).toBe(false)
    expect(isLoopbackHost('127.0.0.1.evil.com')).toBe(false)
    expect(isLoopbackHost('localhost.evil.com')).toBe(false)
  })

  test('rejects non-loopback ipv6 hosts', () => {
    expect(isLoopbackHost('[2001:db8::1]')).toBe(false)
    expect(isLoopbackHost('[2001:db8::1]:4400')).toBe(false)
  })
})

describe('resolveStaticPath', () => {
  const root = '/srv/web-dist'

  test('maps a pathname to a file inside the root', () => {
    expect(resolveStaticPath(root, '/assets/app.js')).toBe('/srv/web-dist/assets/app.js')
    expect(resolveStaticPath(root, '/index.html')).toBe('/srv/web-dist/index.html')
  })

  test('decodes percent-encoded segments', () => {
    expect(resolveStaticPath(root, '/assets/app%20v2.js')).toBe('/srv/web-dist/assets/app v2.js')
  })

  test('rejects traversal, raw and encoded', () => {
    expect(resolveStaticPath(root, '/../secrets.txt')).toBeNull()
    expect(resolveStaticPath(root, '/assets/../../secrets.txt')).toBeNull()
    expect(resolveStaticPath(root, '/%2e%2e/secrets.txt')).toBeNull()
    expect(resolveStaticPath(root, '/assets/%2e%2e/%2e%2e/secrets.txt')).toBeNull()
  })

  test('rejects a sibling directory sharing the root prefix', () => {
    expect(resolveStaticPath(root, '/../web-dist-evil/app.js')).toBeNull()
  })

  test('rejects null bytes and undecodable paths', () => {
    expect(resolveStaticPath(root, '/app%00.js')).toBeNull()
    expect(resolveStaticPath(root, '/%zz')).toBeNull()
  })
})

const WEB_DIST = fileURLToPath(new URL('../web-dist', import.meta.url))

type RawResponse = { status: number; contentType: string; nosniff: string; body: string }

function rawRequest(
  port: number,
  path: string,
  opts: { method?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> {
  return new Promise((resolveResponse, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, method: opts.method ?? 'GET', headers: opts.headers },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () =>
          resolveResponse({
            status: res.statusCode ?? 0,
            contentType: res.headers['content-type'] ?? '',
            nosniff: (res.headers['x-content-type-options'] as string | undefined) ?? '',
            body,
          }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('startServer', () => {
  let session: LiveSession
  let port: number
  let stop: () => Promise<void>

  beforeAll(async () => {
    session = createSession()
    const started = await startServer(session, { port: 4901 })
    port = started.port
    stop = started.stop
  })

  afterAll(async () => {
    await stop()
  })

  test('serves the embedded index at the root', async () => {
    const res = await rawRequest(port, '/')
    expect(res.status).toBe(200)
    expect(res.contentType).toBe('text/html; charset=utf-8')
    expect(res.body.toLowerCase()).toContain('<!doctype html>')
  })

  test('serves bundled assets with their MIME type', async () => {
    const assets = readdirSync(join(WEB_DIST, 'assets'))
    const script = assets.find((f) => f.endsWith('.js'))
    const stylesheet = assets.find((f) => f.endsWith('.css'))
    expect(script).toBeDefined()
    expect(stylesheet).toBeDefined()

    const scriptRes = await rawRequest(port, `/assets/${script}`)
    expect(scriptRes.status).toBe(200)
    expect(scriptRes.contentType).toBe('text/javascript; charset=utf-8')

    const styleRes = await rawRequest(port, `/assets/${stylesheet}`)
    expect(styleRes.status).toBe(200)
    expect(styleRes.contentType).toBe('text/css; charset=utf-8')
  })

  test('returns 404 for unknown static paths', async () => {
    const res = await rawRequest(port, '/nope.txt')
    expect(res.status).toBe(404)
  })

  test('returns 404 for traversal attempts, raw and encoded', async () => {
    expect((await rawRequest(port, '/../package.json')).status).toBe(404)
    expect((await rawRequest(port, '/%2e%2e/package.json')).status).toBe(404)
    expect((await rawRequest(port, '/assets/%2e%2e/%2e%2e/package.json')).status).toBe(404)
  })

  test('rejects non-GET methods', async () => {
    const res = await rawRequest(port, '/api/status', { method: 'POST' })
    expect(res.status).toBe(405)
  })

  test('rejects any request whose Host is not loopback', async () => {
    expect((await rawRequest(port, '/api/status', { headers: { host: 'evil.com' } })).status).toBe(403)
    expect((await rawRequest(port, '/', { headers: { host: 'evil.com' } })).status).toBe(403)
  })

  test('sends nosniff on every response', async () => {
    const html = await rawRequest(port, '/')
    const json = await rawRequest(port, '/api/status')
    expect(html.nosniff).toBe('nosniff')
    expect(json.nosniff).toBe('nosniff')
  })

  test('reports the live status as json', async () => {
    const res = await rawRequest(port, '/api/status')
    expect(res.status).toBe(200)
    expect(res.contentType).toBe('application/json; charset=utf-8')
    const status = JSON.parse(res.body) as { phase: string; partial: unknown }
    expect(status.phase).toBe('reviewing')
    expect(status.partial).toBeNull()
  })

  test('answers 202 before the record exists, 200 after', async () => {
    const before = await rawRequest(port, '/api/review')
    expect(before.status).toBe(202)

    const record = sanitizeRecord({
      meta: { title: 'test', branch: 'feature/x', target: 'develop' },
      review: { verdict: 'approve', summary: 'looks good' },
    })
    expect(record).not.toBeNull()
    session.setDone(record!)

    const after = await rawRequest(port, '/api/review')
    expect(after.status).toBe(200)
    const body = JSON.parse(after.body) as { review: { verdict: string } }
    expect(body.review.verdict).toBe('approve')
  })

  test('streams session events over SSE', async () => {
    const chunks: string[] = []
    const req = request({ host: '127.0.0.1', port, path: '/api/events' }, (res) => {
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        chunks.push(chunk)
      })
    })
    req.end()

    await waitFor(() => chunks.join('').includes('event: status'))

    const partial = parsePartialReview('{"summary":"streaming"}')
    expect(partial).not.toBeNull()
    session.setPartial(partial!)

    await waitFor(() => chunks.join('').includes('event: partial'))
    const stream = chunks.join('')
    expect(stream).toContain('data: {"summary":"streaming"')
    req.destroy()
  })
})
