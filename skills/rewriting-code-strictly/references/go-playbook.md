# Go Strict Rewrite Playbook

Read this file only for Go targets. Use it as a reference map and decision guide,
not as a checklist that requires every linked document to be fetched.

## Target

Produce idiomatic Go with concrete data shapes, explicit error handling, useful
zero values, clear ownership, and simple validation at I/O boundaries.

## Rewrite Rules

- Prefer concrete structs for stable data shapes.
- Use `map[string]T` when the key space is dynamic, not as a substitute for a
  known record shape.
- Use `any` or `interface{}` only at unavoidable generic, decoding, or adapter
  boundaries; convert to concrete values promptly.
- Return errors explicitly and keep `error` as the final return value.
- Keep the normal path minimally indented by handling errors early.
- Prefer interfaces at the consumer boundary and concrete types from producers.
- Pass `context.Context` explicitly, usually as the first parameter, for
  request-scoped work.
- Avoid `panic` for normal error handling.
- Keep goroutine lifetimes clear and cancellation-aware when concurrency appears.

## Boundary Validation

Prefer standard-library decoding plus explicit validation unless the project
already uses a validation package. For JSON APIs, decode into structs when the
shape is known, consider `Decoder.DisallowUnknownFields()` when unexpected fields
should be rejected, and validate required semantic constraints after decoding.

Avoid passing `map[string]any` deeper into internal code after decoding. Convert
external records into concrete structs or narrow domain values near the boundary.

## Reference Links

- Effective Go: https://go.dev/doc/effective_go
- Go Code Review Comments: https://go.dev/wiki/CodeReviewComments
- Go doc comments: https://go.dev/doc/comment
- Errors are values: https://go.dev/blog/errors-are-values
- Package names: https://go.dev/blog/package-names
- `encoding/json`: https://pkg.go.dev/encoding/json
- `go vet`: https://pkg.go.dev/cmd/vet
- Staticcheck checks: https://staticcheck.dev/docs/checks/

## Validation

Prefer the project's configured checks. Common useful commands include
`go test ./...`, `go vet ./...`, `staticcheck ./...`, `gofmt`, and `goimports`.

## Quality Bar

The final Go should read as simple Go, not a translation of another language's
type system. Data shapes should be concrete, errors checked, and boundary data
validated before internal use.
