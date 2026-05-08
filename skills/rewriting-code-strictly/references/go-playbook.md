# Go Strict Rewrite Playbook

> Read this file only when the target is Go. Use it as a fetch map: load the
> smallest external URL needed to settle a concrete decision, then return a
> concise plan to the orchestrator. Do not paraphrase external docs back into
> the report.

## Skill-Specific Defaults

- Preserve observable behavior and treat existing module, lint, and formatting conventions as the authority.
- Prefer concrete structs for stable shapes; use `map[string]T` only for genuinely dynamic key spaces.
- Keep `any` or `interface{}` at unavoidable generic, decoding, or adapter boundaries; convert to concrete values promptly.
- Return errors explicitly and handle them near where they occur. Pass `context.Context` when the surrounding code already follows that convention.

Anything not listed above defers to the linked external sources below.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| General Go idiom (naming, control flow, allocation, interfaces) | https://go.dev/doc/effective_go | An idiom or style decision is disputed |
| Review conventions | https://go.dev/wiki/CodeReviewComments | Checking common Go review expectations and tradeoffs |
| Doc comments | https://go.dev/doc/comment | Public API docs change because of the rewrite |
| Error handling | https://go.dev/blog/errors-are-values | Error flow, sentinel or wrapped errors, or early-return structure is unclear |
| Package naming | https://go.dev/blog/package-names | Package or exported API naming changes are in scope |
| Context usage | https://go.dev/blog/context | Request-scoped cancellation, deadlines, or values affect the target |
| JSON decoding | https://pkg.go.dev/encoding/json | Decoding into structs, unknown fields, custom unmarshalling, or `map[string]any` conversion |
| `go vet` | https://pkg.go.dev/cmd/vet | Understanding vet diagnostics or selecting a relevant command |
| Staticcheck checks | https://staticcheck.dev/docs/checks/ | Understanding Staticcheck diagnostics or avoiding a known lint issue |

Fetch a URL only when the decision changes based on its content. Record the URL and the specific point used in the strategist report.

## Boundary Validation

For untrusted JSON and external records: prefer the standard library plus explicit validation unless the project already uses a validation package. Decode known shapes into structs, consider `Decoder.DisallowUnknownFields()` when unexpected fields should be rejected, and validate required semantic constraints after decoding. Convert to concrete structs or domain values near the boundary instead of passing `map[string]any` deeper.

## Validation Commands

Prefer the user's `VALIDATION_COMMAND`. Otherwise the smallest relevant existing project check: `go test ./...`, `go vet ./...`, `staticcheck ./...`, `gofmt`, or `goimports`.
