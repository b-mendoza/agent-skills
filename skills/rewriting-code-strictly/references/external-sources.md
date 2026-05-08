# Strict Rewrite External Sources

> Read this file only when project evidence and the language playbook are not
> enough. Fetch the smallest relevant URL, use it for the decision at hand, and
> record the URL plus the specific point used.

External sources are optional just-in-time material. The rewrite still follows
the local skill contract, user scope, and project configuration when network
access is unavailable.

## Fetch Policy

| Need | Fetch first |
| ---- | ----------- |
| Why boundary data should be parsed into typed values | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
| Why TypeScript types alone do not validate untrusted runtime data | https://effectivetypescript.com/2021/05/06/unsoundness/ |
| Skill-level progressive disclosure rationale | https://skills.sh/flpbalada/fb-skills/progressive-disclosure |
| UX origin of progressive disclosure and staged complexity | https://www.nngroup.com/articles/progressive-disclosure/ |

## Python Sources

| Need | Fetch first |
| ---- | ----------- |
| Annotation syntax, generics, unions, protocols, `TypedDict`, narrowing helpers | https://docs.python.org/3/library/typing.html |
| Type system concepts, assignability, gradual typing, `Any` vs `object` | https://typing.python.org/en/latest/spec/concepts.html |
| Compact type-hint patterns | https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html |
| mypy configuration | https://mypy.readthedocs.io/en/stable/config_file.html |
| mypy strictness flags or diagnostics | https://mypy.readthedocs.io/en/stable/command_line.html |
| Pyright configuration and strict mode | https://github.com/microsoft/pyright/blob/main/docs/configuration.md |
| Pydantic model behavior | https://docs.pydantic.dev/latest/concepts/models/ |
| Pydantic strict mode and coercion decisions | https://docs.pydantic.dev/latest/concepts/strict_mode/ |
| Legacy implicit optional cleanup | https://adamj.eu/tech/2022/10/18/python-type-hints-implicit-optional-types/ |

## TypeScript And JavaScript Sources

| Need | Fetch first |
| ---- | ----------- |
| Basic annotations and the `unknown`/`any` tradeoff | https://www.typescriptlang.org/docs/handbook/2/everyday-types.html |
| Narrowing strategy | https://www.typescriptlang.org/docs/handbook/2/narrowing.html |
| `strict` behavior | https://www.typescriptlang.org/tsconfig/#strict |
| Indexed access safety | https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess |
| Optional property semantics | https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes |
| Avoiding explicit `any` | https://typescript-eslint.io/rules/no-explicit-any/ |
| Unsafe value assignment diagnostics | https://typescript-eslint.io/rules/no-unsafe-assignment/ |
| Unsafe member access diagnostics | https://typescript-eslint.io/rules/no-unsafe-member-access/ |
| Zod parsing basics | https://zod.dev/basics |
| Zod schema API details | https://zod.dev/api |

## Go Sources

| Need | Fetch first |
| ---- | ----------- |
| General Go idiom: naming, control flow, allocation, interfaces | https://go.dev/doc/effective_go |
| Common Go review conventions | https://go.dev/wiki/CodeReviewComments |
| Public API doc comments | https://go.dev/doc/comment |
| Error handling structure | https://go.dev/blog/errors-are-values |
| Package naming | https://go.dev/blog/package-names |
| Request-scoped context usage | https://go.dev/blog/context |
| JSON decoding, structs, unknown fields, custom unmarshalling | https://pkg.go.dev/encoding/json |
| `go vet` diagnostics | https://pkg.go.dev/cmd/vet |
| Staticcheck diagnostics | https://staticcheck.dev/docs/checks/ |

## When A Source Is Unavailable

Proceed from local project evidence when it is enough for a safe rewrite. In the
strategy report, write `unavailable: <url> (<risk or fallback evidence>)`. If
the missing source blocks a checker, validator, or public API decision, return
`NEEDS_CLARIFICATION` instead of guessing.
