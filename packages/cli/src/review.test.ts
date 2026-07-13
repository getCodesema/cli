import { describe, expect, test } from 'bun:test'
import type { Finding, SanitizedReview, Verdict } from './contract.js'
import { extractReviewJson, reviewGateReason } from './review.js'

const REVIEW = '{"verdict":"approve","summary":"ok","findings":[]}'

function reviewWith(verdict: Verdict, severities: Finding['severity'][]): SanitizedReview {
  return {
    verdict,
    summary: '',
    findings: severities.map((severity) => ({ file: 'a.ts', message: 'm', severity })),
    narrative: null,
  }
}

describe('extractReviewJson', () => {
  test('plain JSON', () => {
    expect(extractReviewJson(REVIEW)).toBe(REVIEW)
  })

  test('prose around the JSON', () => {
    expect(extractReviewJson(`Here is the review:\n${REVIEW}\nHope this helps!`)).toBe(REVIEW)
  })

  test('markdown fence', () => {
    expect(extractReviewJson('Sure!\n```json\n' + REVIEW + '\n```\ndone')).toBe(REVIEW)
  })

  test('prefers the object with verdict when multiple valid objects exist', () => {
    const raw = `Example input: {"branch":"x"} and the result ${REVIEW} end`
    expect(extractReviewJson(raw)).toBe(REVIEW)
  })

  test('braces inside strings respected', () => {
    const tricky = '{"verdict":"comment","summary":"code: if (a) { b() }","findings":[]}'
    expect(extractReviewJson(`note ${tricky} bye`)).toBe(tricky)
  })

  test('object without verdict accepted as last resort', () => {
    expect(extractReviewJson('x {"summary":"only"} y')).toBe('{"summary":"only"}')
  })

  test('no JSON: error', () => {
    expect(() => extractReviewJson('no json here')).toThrow(/did not return a JSON review/)
    expect(() => extractReviewJson('[1,2,3]')).toThrow(/did not return a JSON review/)
  })
})

describe('reviewGateReason', () => {
  test('request_changes gate trips only on a request_changes verdict', () => {
    expect(reviewGateReason(reviewWith('request_changes', []), 'request_changes')).not.toBeNull()
    expect(reviewGateReason(reviewWith('approve', ['critical']), 'request_changes')).toBeNull()
  })

  test('severity gate trips at or above the threshold, not below', () => {
    expect(reviewGateReason(reviewWith('comment', ['major']), 'major')).not.toBeNull()
    expect(reviewGateReason(reviewWith('comment', ['critical']), 'major')).not.toBeNull()
    expect(reviewGateReason(reviewWith('comment', ['minor']), 'major')).toBeNull()
  })

  test('a clean review passes every gate', () => {
    const clean = reviewWith('approve', ['info'])
    expect(reviewGateReason(clean, 'critical')).toBeNull()
    expect(reviewGateReason(clean, 'request_changes')).toBeNull()
  })
})
