# Python Strict Rewrite Playbook

Read this file only for Python targets. Use it as a reference map and decision
guide, not as a checklist that requires every linked document to be fetched.

## Target

Produce strict, maintainable Python with explicit annotations, clear `None`
handling, precise containers, and validated external boundaries.

## Rewrite Rules

- Add explicit parameter and return types to functions that participate in the
  rewritten code path.
- Use parameterized built-in containers such as `list[T]`, `dict[K, V]`,
  `tuple[...]`, and `set[T]`.
- Use `T | None` explicitly when `None` is valid.
- Prefer `Sequence[T]`, `Mapping[K, V]`, `Iterable[T]`, or other abstract
  collection types when mutation is not required.
- Use `Literal`, `Final`, `NewType`, `TypeAlias`, `Protocol`, `TypedDict`,
  `dataclass`, or `NamedTuple` only when they clarify the code.
- Treat untrusted external data as `object` until validation or narrowing proves
  the shape.
- Keep `Any`, `cast`, `type: ignore`, and checker-specific ignores local and
  justified when there is no safer alternative.

## Boundary Validation

Use Pydantic when runtime validation is clearer than complex static types and the
project already uses Pydantic or adding it is acceptable. Good boundary candidates
include JSON payloads, API responses, webhooks, LLM/tool responses, config values,
environment variables, database rows, and other external records.

When using Pydantic, validate at the boundary, convert to a model or clear typed
internal structure, and avoid passing raw dictionaries through the code after
validation. Prefer strict mode and forbidden extra fields when those constraints
match the boundary contract.

## Reference Links

- Python `typing`: https://docs.python.org/3/library/typing.html
- Python type system concepts: https://typing.python.org/en/latest/spec/concepts.html
- mypy configuration: https://mypy.readthedocs.io/en/stable/config_file.html
- mypy strictness flags: https://mypy.readthedocs.io/en/stable/command_line.html
- Pyright configuration: https://github.com/microsoft/pyright/blob/main/docs/configuration.md
- Pydantic models: https://docs.pydantic.dev/latest/concepts/models/
- Pydantic strict mode: https://docs.pydantic.dev/latest/concepts/strict_mode/
- Implicit optional types: https://adamj.eu/tech/2022/10/18/python-type-hints-implicit-optional-types/

## Validation

Prefer the project's configured checks. Common useful commands include `mypy`,
`pyright`, project tests, and the configured formatter or linter.

## Quality Bar

The final Python should feel explicit, boring, precise, validated at boundaries,
and readable without forcing readers to decode unnecessary type machinery.
