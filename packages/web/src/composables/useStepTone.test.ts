import { describe, expect, test } from 'bun:test'
import type { Finding } from './useDiff'
import { findingTone, stepTone } from './useStepTone'

function finding(partial: Partial<Finding>): Finding {
  return { file: 'src/a.ts', severity: 'minor', message: 'm', ...partial }
}

describe('findingTone', () => {
  test('critical and major map to high', () => {
    expect(findingTone(finding({ severity: 'critical' }))).toBe('high')
    expect(findingTone(finding({ severity: 'major' }))).toBe('high')
  })

  test('minor maps to medium', () => {
    expect(findingTone(finding({ severity: 'minor' }))).toBe('medium')
  })

  test('info carries no tone', () => {
    expect(findingTone(finding({ severity: 'info' }))).toBeNull()
  })

  test('praise and why carry no tone regardless of severity', () => {
    expect(findingTone(finding({ severity: 'major', kind: 'praise' }))).toBeNull()
    expect(findingTone(finding({ severity: 'critical', kind: 'why' }))).toBeNull()
  })
})

describe('stepTone', () => {
  const findings: Finding[] = [
    finding({ severity: 'critical' }),
    finding({ severity: 'minor' }),
    finding({ severity: 'info' }),
    finding({ severity: 'major', kind: 'praise' }),
  ]

  test('worst referenced finding wins', () => {
    expect(stepTone({ finding_refs: [1, 0] }, findings)).toBe('high')
    expect(stepTone({ finding_refs: [1] }, findings)).toBe('medium')
  })

  test('non-actionable findings fall back to the step risk', () => {
    expect(stepTone({ finding_refs: [2, 3], risk: 'high' }, findings)).toBe('high')
    expect(stepTone({ finding_refs: [2, 3], risk: 'medium' }, findings)).toBe('medium')
  })

  test('no findings and no risk means low', () => {
    expect(stepTone({ finding_refs: [] }, findings)).toBe('low')
    expect(stepTone({ finding_refs: [], risk: 'low' }, findings)).toBe('low')
  })

  test('out-of-range refs are ignored', () => {
    expect(stepTone({ finding_refs: [99, -1] }, findings)).toBe('low')
  })
})
