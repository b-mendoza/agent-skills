# Go Strict Rewrite Playbook

Read this file only for Go targets. Use it as a compact decision map and fetch
linked docs only when a concrete rewrite decision, tool diagnostic, or API
question depends on them.

## Local Defaults

- Preserve observable behavior and follow existing module, lint, and formatting
  conventions first.
- Prefer concrete structs for stable data shapes.
- Use `map[string]T` for dynamic key spaces, not as a substitute for known record
  shapes.
- Keep `any` or `interface{}` at unavoidable generic, decoding, or adapter
  boundaries; convert to concrete values promptly.
- Return errors explicitly, usually as the final return value, and handle errors
  near where they occur.
- Pass `context.Context` explicitly for request-scoped work when the surrounding
  code already follows that convention.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| General Go idiom | https://go.dev/doc/effective_go | Idiom, naming, control flow, allocation, or interface decisions are disputed |
| Review conventions | https://go.dev/wiki/CodeReviewComments | Checking common Go review expectations and style tradeoffs |
| Doc comments | https://go.dev/doc/comment | Public API docs change because of the rewrite |
| Error handling | https://go.dev/blog/errors-are-values | Error flow, sentinel/wrapped error behavior, or early-return structure is unclear |
| Package naming | https://go.dev/blog/package-names | Package name or exported API changes are in scope |
| Context usage | https://go.dev/blog/context | Request-scoped cancellation, deadlines, or values affect the target path |
| JSON decoding | https://pkg.go.dev/encoding/json | Decoding into structs, unknown fields, custom unmarshalling, or `map[string]any` conversion matters |
| `go vet` | https://pkg.go.dev/cmd/vet | Understanding vet diagnostics or choosing a relevant command |
| Staticcheck checks | https://staticcheck.dev/docs/checks/ | Understanding Staticcheck diagnostics or avoiding a known lint issue |

## Boundary Decisions

Prefer standard-library decoding plus explicit validation unless the project
already uses a validation package. For JSON APIs, decode into structs when the
shape is known, consider `Decoder.DisallowUnknownFields()` when unexpected fields
should be rejected, and validate required semantic constraints after decoding.

Avoid passing `map[string]any` deeper into internal code after decoding. Convert
external records into concrete structs or narrow domain values near the boundary.

## Validation

Prefer the project's configured checks. Common useful commands include
`go test ./...`, `go vet ./...`, `staticcheck ./...`, `gofmt`, and `goimports`.

## Quality Gate

The final Go should read as simple Go, not a translation of another language's
type system. Data shapes should be concrete, errors checked, and boundary data
validated before internal use.
