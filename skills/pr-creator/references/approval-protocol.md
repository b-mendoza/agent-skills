# Approval protocol

Current-state reference. Update this file when the shipped validator or approval fields change.

## One digest implementation

Use `python3 -I "${SKILL_DIR}/scripts/validate-output.py"` for all producers and consumers. The helper is deterministic, stdlib-only and read-only. It reads UTF-8 stdin and writes a result to stdout. No shell/Python capability means stop at `TerminalBlocked`, explain the missing tool, and do not interpret or route unchecked specialist fields.

- `digest push|scope|preview < values.json` validates the exact fields below and emits `valuesDigest` and `bodyDigest`.
- `verify push|scope|preview < approval.json` checks `{ "values": <values object>, "approval": <record> }`; exit 0 is the only valid approval predicate.
- `body < body.txt` emits SHA-256 of exact UTF-8 body bytes. Use it on both the approved body file and the decoded platform-returned body. Do not use shell command substitution to transport a body: it removes trailing newlines.
- `envelope <specialist-name> < output.txt` validates each specialist block's field order, completeness and status enum before routing.
- `-h` prints usage. Exit 0 means valid; 1 means invalid input, so repair the envelope or renew approval; 2 means invalid invocation, so fix the call. A failed envelope may be redispatched once with findings (`validation` counter); another failure stops at `TerminalBlocked`. These repairs do not grant any permission to create or push.

The canonical serialization is Python `json.dumps(values, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)` encoded as UTF-8, no BOM and no appended newline. Object keys sort lexicographically; all list fields are sets, deduplicated by the producer and sorted by Unicode code point by the helper. Duplicate entries, unknown/missing fields, noninteger counts and nonlowercase/full Git SHAs are rejected. Strings are otherwise byte-preserved: no trimming, Unicode normalization, newline conversion or final-newline insertion. Body digest is SHA-256 of the body's UTF-8 bytes, not its JSON representation. Digests are 64 lowercase hexadecimal characters. Never independently reimplement this serialization in a specialist.

## Values and records

`push` values have exactly `headRemote`, `currentBranch`, `action`. The action must equal `git push <headRemote> <currentBranch>`.

`scope` values have exactly `baseSha`, `headSha`, `adjustedChangedLines`, `changedFiles`, `excludedTotals`, `areas`, `rules`, `changedPaths`. Counts are nonnegative integers; the last three fields are string lists. `excludedTotals` is the displayed excluded accounting string. The gate shows both full SHAs, counts, exclusions, grouped areas, fired rules and paths. A scope record approves only continuing analysis for that evidence, never push or create. Recompute evidence and run `verify scope` on redispatch. Changed pins return `STALE_PINS` to refresh preflight; changed evidence or a missing/stale scope record returns `LARGE_PR_CONFIRMATION_REQUIRED` with a fresh proposal.

`preview` values have exactly `baseRemote`, `targetBranch`, `headRemote`, `currentBranch`, `baseSha`, `headSha`, `title`, `body`, `reviewers`, `labels`, `assignees`, `state`, `effectiveState`. Metadata fields are string lists, empty for none. States are `draft` or `ready`. These are the literal fields shown in the preview; base SHA binds the diff as well as head SHA. No environment-dependent display text enters the digest.

An approval record has exactly `valuesDigest`, `bodyDigest`, `wording`, `action`. Non-preview `bodyDigest` is `n/a`. Preserve the user's actual answer in `wording` and the shown action in `action`; the helper checks shape and equality, not whether a human actually approved. The orchestrator must establish that independently from the current conversation.

## Human checkpoint

Before asking, compute the proposal's digest and show `Approval token: <valuesDigest>` after the full push/scope proposal or PR preview. Ask for `APPROVED <token>`, `REVISE: <edits>`, or `ABORT`. Only the current token, from a subsequent user turn, permits freezing a record. Plain preapproval, a wrong token, or earlier-version consent does not count. Ask once for a usable answer, then suspend at `TerminalAwaitingUser` without mutation. Revisions invalidate approval and follow the relevant existing edit cycle; abort follows the gate's decline route.

The orchestrator and receiving specialist both run `verify` against their actual inputs before any gated action. Store the exact approved body as UTF-8, display it without rewriting, and submit that same file. A content change requires a new token and preview. Confirm remote base/head pins again before create; any movement invalidates the scope and preview records and returns to preflight.
