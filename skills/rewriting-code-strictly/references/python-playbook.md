# Python Strict Rewrite Playbook

Read this file only for Python targets. Use it as a compact decision map and
fetch linked docs only when a concrete rewrite decision, checker diagnostic, or
library API question depends on them.

## Local Defaults

- Preserve observable behavior and follow project checker settings first.
- Add or tighten annotations on the rewritten code path when they clarify caller
  contracts or checker behavior.
- Model `None` explicitly and use precise containers where the shape is stable.
- Treat untrusted external data as `object` or a validated model before internal
  use.
- Keep `Any`, `cast`, `type: ignore`, and checker-specific ignores local and
  justified when no safer alternative is practical.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| Annotation syntax or typing constructs | https://docs.python.org/3/library/typing.html | Choosing built-in generics, unions, protocols, `TypedDict`, aliases, or narrowing helpers |
| Type system concepts | https://typing.python.org/en/latest/spec/concepts.html | Explaining assignability, gradual typing, `Any`, or `object` tradeoffs |
| Practical type hint patterns | https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html | Selecting a concise annotation pattern for common functions, containers, callables, or classes |
| mypy configuration | https://mypy.readthedocs.io/en/stable/config_file.html | Interpreting existing project settings or proposing the smallest relevant mypy command |
| mypy strictness flags | https://mypy.readthedocs.io/en/stable/command_line.html | Understanding what a strict flag enables or why a diagnostic appears |
| Pyright configuration | https://github.com/microsoft/pyright/blob/main/docs/configuration.md | Interpreting `pyrightconfig.json`, strict mode, or diagnostic rule settings |
| Pydantic models | https://docs.pydantic.dev/latest/concepts/models/ | Project already uses Pydantic and a boundary model is clearer than ad hoc checks |
| Pydantic strict mode | https://docs.pydantic.dev/latest/concepts/strict_mode/ | Deciding whether coercion is acceptable at a boundary |
| Implicit optional cleanup | https://adamj.eu/tech/2022/10/18/python-type-hints-implicit-optional-types/ | Updating legacy `x: T = None` patterns while preserving behavior |

## Boundary Decisions

Use runtime validation for JSON payloads, API responses, webhooks, LLM/tool
responses, config values, environment variables, database rows, and other
external records. Prefer the project's existing validation approach. Consider
Pydantic only when it is already used or the user permits adding it.

Validate near the boundary, convert to a model or typed internal structure, and
avoid passing raw dictionaries deeper after validation.

## Validation

Prefer project-configured checks. Common useful commands include `mypy`,
`pyright`, targeted project tests, and the configured formatter or linter.

## Quality Gate

The final Python should be explicit, boring, precise, validated at boundaries,
and readable without unnecessary type machinery.
