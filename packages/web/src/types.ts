// Mirrors the CLI contract types by hand (packages/cli/src/contract.ts).

import type { Finding } from './composables/useDiff'

export type NarrativeStep = {
  title: string
  rationale: string
  files: string[]
  finding_refs: number[]
  risk?: 'high' | 'medium' | 'low'
  take?: string
  check?: string | null
}

/** Step normalized for display (check: null becomes undefined; see ReviewShell). */
export type StepView = Omit<NarrativeStep, 'check'> & { check?: string }

export type ReviewFirstItem = {
  point: string
  risk: 'high' | 'medium' | 'low'
  step_ref: number | null
  file: string | null
}

export type ReviewNarrative = {
  intent: string
  confidence: 'high' | 'medium' | 'low'
  prologue?: {
    why: string
    what: string
    key_changes: { title: string; detail: string }[]
  }
  steps: NarrativeStep[]
  review_first: ReviewFirstItem[]
}

export type ReviewRecord = {
  version: 1
  meta: {
    title: string
    branch: string
    target: string
    merge_base: string
    /** HEAD at review time (absent on older archives). */
    head_sha?: string
    repo_root: string
    created_at: string
  }
  commits: string[]
  diff: string
  review: {
    verdict: 'approve' | 'request_changes' | 'comment'
    summary: string
    findings: Finding[]
    narrative: ReviewNarrative | null
  }
}

// Mirrors packages/cli/src/serve.ts and partial.ts.

export type LiveInput = {
  branch: string
  target: string
  commits: string[]
  files: { path: string; additions: number; deletions: number }[]
  additions: number
  deletions: number
  incremental: boolean
}

export type LiveStatus = {
  phase: 'reviewing' | 'done' | 'error'
  started_at: string
  agent?: string
  input?: LiveInput
  error?: string
}

// Mirrors packages/cli/src/fix.ts (FixStatus) and the /api/fix endpoints.

export type FixStatus =
  | { available: false }
  | {
      available: true
      phase: 'idle' | 'running' | 'done' | 'error'
      selected: number[]
      started_at?: string
      summary?: string
      error?: string
      head_moved: boolean
    }

export type PartialFinding = {
  file: string
  message: string
  title?: string
  severity?: string
  kind?: string
  line?: number
}

export type PartialReview = {
  verdict?: 'approve' | 'request_changes' | 'comment'
  summary?: string
  intent?: string
  findings: PartialFinding[]
  stepTitles: string[]
}
