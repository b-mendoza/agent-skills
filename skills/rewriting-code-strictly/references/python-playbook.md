# Python Strict Rewrite Playbook

> Read this file only when the target is Python. Use it as a fetch map: load
> the smallest external URL needed to settle a concrete decision, then return
> a concise plan to the orchestrator. Do not paraphrase external docs back
> into the report.

## Skill-Specific Defaults

- Preserve observable behavior and treat existing project checker, linter, formatter, and validation settings as the authority.
- Add or tighten annotations on the rewritten path only when they clarify a caller contract or change a checker diagnostic.
- Treat untrusted external data as `object` or a validated model before internal use; do not pass raw boundary dictionaries deeper.
- Keep `Any`, `cast`, `# type: ignore`, and checker-specific ignores local and justified when an external API or language limit forces them.

Anything not listed above defers to the linked external sources below.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| Annotation syntax, generics, unions, protocols, `TypedDict`, narrowing helpers | https://docs.python.org/3/library/typing.html | Selecting concrete annotation forms for the rewrite |
| Type system concepts (assignability, gradual typing, `Any` vs `object`) | https://typing.python.org/en/latest/spec/concepts.html | Explaining a tradeoff or strictness rationale |
| Compact type-hint patterns | https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html | Choosing a concise pattern for functions, containers, callables, or classes |
| mypy configuration | https://mypy.readthedocs.io/en/stable/config_file.html | Interpreting project settings or proposing the smallest relevant mypy command |
| mypy strictness flags | https://mypy.readthedocs.io/en/stable/command_line.html | Understanding what a strict flag enables or why a diagnostic appears |
| Pyright configuration and strict mode | https://github.com/microsoft/pyright/blob/main/docs/configuration.md | Interpreting `pyrightconfig.json` or rule severities |
| Pydantic models | https://docs.pydantic.dev/latest/concepts/models/ | A boundary model is clearer than ad hoc checks and Pydantic is already in the project |
| Pydantic strict mode | https://docs.pydantic.dev/latest/concepts/strict_mode/ | Deciding whether coercion is acceptable at a boundary |
| Implicit-optional cleanup | https://adamj.eu/tech/2022/10/18/python-type-hints-implicit-optional-types/ | Updating legacy `x: T = None` patterns without behavior drift |

Fetch a URL only when the decision changes based on its content. Record the URL and the specific point used in the strategist report.

## Boundary Validation

For JSON payloads, API responses, webhooks, LLM/tool outputs, config, environment variables, database rows, and other untrusted records: validate near the boundary, convert to a typed internal value, and use the project's existing validator. Add Pydantic only when the project already uses it or the user explicitly permits the dependency.

## Validation Commands

Prefer the user's `VALIDATION_COMMAND`. Otherwise the smallest relevant existing project check: `mypy`, `pyright`, targeted tests, or the configured formatter or linter.
