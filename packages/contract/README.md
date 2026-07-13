# @codesema/contract

The review contract shared between the [codesema CLI](https://www.npmjs.com/package/codesema) and codesema.com: the types describing a review record, and the sanitizers that validate and bound any raw input into that shape.

This package is intentionally tiny and dependency-free. It contains no I/O, no network calls and no configuration: only pure functions and types.

## What it provides

- **Types**: `ReviewRecord` (a versioned, self-contained review of a merge request: metadata, commits, diff, and the review itself), `SanitizedReview`, `Finding`, `ReviewNarrative` and their building blocks.
- **Sanitizers**: `sanitizeRecord`, `sanitizeReview`, `sanitizeFindings`, `sanitizeNarrative`. They whitelist fields, truncate oversized values and never throw, turning any untrusted input into a well-formed object (or `null` when unusable).

## Usage

```ts
import { sanitizeRecord, type ReviewRecord } from '@codesema/contract'

const record: ReviewRecord | null = sanitizeRecord(untrustedJson)
if (!record) throw new Error('unusable review record')
```

The codesema CLI uses these functions to validate agent output before archiving a review; codesema.com uses the very same functions to validate reviews synced from the CLI. One source of truth on both sides of the wire.

## Versioning

`ReviewRecord.version` identifies the record schema (currently `1`). The package follows semver: a breaking change to the record shape bumps the major version.

## License

MIT
