import { describe, expect, test } from 'bun:test'
import { isNewerVersion } from './version.js'

describe('isNewerVersion', () => {
  test('detects newer patch, minor and major', () => {
    expect(isNewerVersion('0.3.0', '0.3.1')).toBe(true)
    expect(isNewerVersion('0.3.0', '0.4.0')).toBe(true)
    expect(isNewerVersion('0.3.0', '1.0.0')).toBe(true)
  })

  test('same or older is not newer', () => {
    expect(isNewerVersion('0.3.0', '0.3.0')).toBe(false)
    expect(isNewerVersion('0.3.1', '0.3.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false)
  })

  test('ignores a leading v and prerelease suffixes', () => {
    expect(isNewerVersion('v0.3.0', '0.3.1')).toBe(true)
    expect(isNewerVersion('0.3.0', 'v0.3.1')).toBe(true)
    expect(isNewerVersion('0.3.0-dev', '0.3.0')).toBe(false)
    expect(isNewerVersion('0.3.0', '0.3.1-beta.1')).toBe(true)
  })

  test('tolerates garbage without throwing', () => {
    expect(isNewerVersion('0.0.0-dev', 'not-a-version')).toBe(false)
    expect(isNewerVersion('garbage', '0.3.0')).toBe(true)
  })
})
