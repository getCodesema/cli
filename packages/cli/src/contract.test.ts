import { describe, expect, test } from 'bun:test'
import { sanitizeFindings, sanitizeNarrative, sanitizeReview } from './contract.js'

describe('sanitizeReview', () => {
  test('entrée vide : défauts sûrs', () => {
    expect(sanitizeReview({})).toEqual({ verdict: 'comment', summary: '', findings: [], narrative: null })
    expect(sanitizeReview(null)).toEqual({ verdict: 'comment', summary: '', findings: [], narrative: null })
    expect(sanitizeReview('junk')).toEqual({ verdict: 'comment', summary: '', findings: [], narrative: null })
  })

  test('verdicts valides conservés, inconnus → comment', () => {
    expect(sanitizeReview({ verdict: 'approve' }).verdict).toBe('approve')
    expect(sanitizeReview({ verdict: 'request_changes' }).verdict).toBe('request_changes')
    expect(sanitizeReview({ verdict: 'LGTM!!' }).verdict).toBe('comment')
  })

  test('summary : trim + troncature à 2000', () => {
    expect(sanitizeReview({ summary: '  ok  ' }).summary).toBe('ok')
    expect(sanitizeReview({ summary: 'x'.repeat(3000) }).summary.length).toBe(2000)
  })
})

describe('sanitizeFindings', () => {
  test('items invalides ignorés, file+message requis', () => {
    expect(sanitizeFindings('nope')).toEqual([])
    expect(sanitizeFindings([null, 42, { file: 'a.ts' }, { message: 'm' }])).toEqual([])
  })

  test('severity inconnue → info, kind inconnu → absent', () => {
    const [f] = sanitizeFindings([{ file: 'a.ts', message: 'm', severity: 'blocker', kind: 'typo' }])
    expect(f?.severity).toBe('info')
    expect(f?.kind).toBeUndefined()
  })

  test('line invalide ignorée, endLine < line ignorée', () => {
    const [f] = sanitizeFindings([{ file: 'a.ts', message: 'm', severity: 'minor', line: -3, endLine: 9 }])
    expect(f?.line).toBeUndefined()
    expect(f?.endLine).toBeUndefined()
    const [g] = sanitizeFindings([{ file: 'a.ts', message: 'm', severity: 'minor', line: 10, endLine: 4 }])
    expect(g?.line).toBe(10)
    expect(g?.endLine).toBeUndefined()
  })

  test('title/suggestion tronqués', () => {
    const [f] = sanitizeFindings([
      { file: 'a.ts', message: 'm', severity: 'minor', title: 't'.repeat(500), suggestion: 's'.repeat(9000) },
    ])
    expect(f?.title?.length).toBe(200)
    expect(f?.suggestion?.length).toBe(4000)
  })
})

describe('sanitizeNarrative', () => {
  test('non-objet ou vide → null', () => {
    expect(sanitizeNarrative(null, 0)).toBeNull()
    expect(sanitizeNarrative({ chapters: [], intent: '' }, 0)).toBeNull()
  })

  test('chapitre sans titre ignoré, finding_refs bornés et dédupliqués', () => {
    const n = sanitizeNarrative(
      {
        intent: 'i',
        chapters: [
          { title: '', files: [] },
          { title: 'Ch', files: ['a.ts', 7], finding_refs: [0, 0, 2, -1, 99] },
        ],
      },
      3,
    )
    expect(n?.chapters).toHaveLength(1)
    expect(n?.chapters[0]?.files).toEqual(['a.ts'])
    expect(n?.chapters[0]?.finding_refs).toEqual([0, 2])
  })

  test('risk invalide absent, check null conservé', () => {
    const n = sanitizeNarrative({ chapters: [{ title: 'Ch', risk: 'extreme', check: null }] }, 0)
    expect(n?.chapters[0]?.risk).toBeUndefined()
    expect(n?.chapters[0]?.check).toBeNull()
  })

  test('review_first : cap à 4, risk défaut medium, chapter_ref borné', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ point: `p${i}`, risk: 'weird', chapter_ref: i }))
    const n = sanitizeNarrative({ chapters: [{ title: 'Ch' }], review_first: items }, 0)
    expect(n?.review_first).toHaveLength(4)
    expect(n?.review_first[0]).toEqual({ point: 'p0', risk: 'medium', chapter_ref: 0, file: null })
    expect(n?.review_first[1]?.chapter_ref).toBeNull()
  })

  test('prologue sans why/what absent, key_changes cap à 5 et title requis', () => {
    expect(sanitizeNarrative({ chapters: [{ title: 'Ch' }], prologue: {} }, 0)?.prologue).toBeUndefined()
    const kcs = Array.from({ length: 7 }, (_, i) => ({ title: `t${i}`, detail: 'd' }))
    const n = sanitizeNarrative({ chapters: [{ title: 'Ch' }], prologue: { why: 'w', key_changes: [...kcs, { detail: 'orphan' }] } }, 0)
    expect(n?.prologue?.key_changes).toHaveLength(5)
  })
})
