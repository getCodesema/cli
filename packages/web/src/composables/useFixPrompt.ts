// Prompt de fix : findings actionnables du record -> JSON prêt à coller dans Claude Code CLI.

import type { Finding } from './useDiff'
import type { ReviewRecord } from '../types'

const INSTRUCTION =
  'Corrige les points suivants relevés en code review. Ne modifie que ce qui est nécessaire pour chaque point.'

export function isActionable(f: Finding): boolean {
  if (f.kind === 'praise' || f.kind === 'why') return false
  return f.severity !== 'info'
}

export function buildFixPrompt(record: ReviewRecord): string {
  const findings = record.review.findings.filter(isActionable).map((f) => ({
    file: f.file,
    ...(f.line !== undefined ? { line: f.line } : {}),
    ...(f.endLine !== undefined ? { endLine: f.endLine } : {}),
    severity: f.severity,
    ...(f.kind !== undefined ? { kind: f.kind } : {}),
    ...(f.title !== undefined ? { title: f.title } : {}),
    message: f.message,
    ...(f.suggestion !== undefined ? { suggestion: f.suggestion } : {}),
  }))
  return JSON.stringify(
    {
      instruction: INSTRUCTION,
      branch: record.meta.branch,
      target: record.meta.target,
      findings,
    },
    null,
    2,
  )
}
