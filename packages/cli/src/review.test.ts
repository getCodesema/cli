import { describe, expect, test } from 'bun:test'
import { extractReviewJson } from './review.js'

const REVIEW = '{"verdict":"approve","summary":"ok","findings":[]}'

describe('extractReviewJson', () => {
  test('JSON pur', () => {
    expect(extractReviewJson(REVIEW)).toBe(REVIEW)
  })

  test('prose autour du JSON', () => {
    expect(extractReviewJson(`Here is the review:\n${REVIEW}\nHope this helps!`)).toBe(REVIEW)
  })

  test('fence markdown', () => {
    expect(extractReviewJson('Sure!\n```json\n' + REVIEW + '\n```\ndone')).toBe(REVIEW)
  })

  test('préfère l\'objet avec verdict quand plusieurs objets valides', () => {
    const raw = `Example input: {"branch":"x"} and the result ${REVIEW} end`
    expect(extractReviewJson(raw)).toBe(REVIEW)
  })

  test('accolades dans les strings respectées', () => {
    const tricky = '{"verdict":"comment","summary":"code: if (a) { b() }","findings":[]}'
    expect(extractReviewJson(`note ${tricky} bye`)).toBe(tricky)
  })

  test('objet sans verdict accepté en dernier recours', () => {
    expect(extractReviewJson('x {"summary":"only"} y')).toBe('{"summary":"only"}')
  })

  test('aucun JSON → erreur', () => {
    expect(() => extractReviewJson('no json here')).toThrow(/did not return a JSON review/)
    expect(() => extractReviewJson('[1,2,3]')).toThrow(/did not return a JSON review/)
  })
})
