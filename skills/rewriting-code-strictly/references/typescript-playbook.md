# TypeScript Strict Rewrite Playbook

> Read this file only when the target is TypeScript or JavaScript. Use it as a
> fetch map: load the smallest external URL needed to settle a concrete
> decision, then return a concise plan to the orchestrator. Do not paraphrase
> external docs back into the report.

## Skill-Specific Defaults

- Preserve observable behavior and treat existing `tsconfig`, lint, and validator conventions as the authority.
- Replace broad `any` at untrusted boundaries with `unknown`, then narrow before use.
- Keep assertions local; replace them with narrowing, guards, or runtime schemas when feasible.
- Avoid deep generic machinery unless it removes real duplication or captures a stable public contract.

Anything not listed above defers to the linked external sources below.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| Basic annotations and the `unknown`/`any` tradeoff | https://www.typescriptlang.org/docs/handbook/2/everyday-types.html | Choosing concise function, object, array, union, or `unknown` annotations |
| Narrowing strategy | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | Replacing assertions with guards, discriminants, `in`, equality, or control-flow narrowing |
| `strict` behavior | https://www.typescriptlang.org/tsconfig/#strict | Interpreting current strictness or selecting a checker command |
| Indexed access safety | https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess | Handling array or object lookup diagnostics or runtime-missing values |
| Optional property semantics | https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes | Distinguishing omitted properties from explicit `undefined` |
| Avoiding explicit `any` | https://typescript-eslint.io/rules/no-explicit-any/ | Lint expectations for replacing `any` without weakening behavior |
| Unsafe value linting | https://typescript-eslint.io/rules/no-unsafe-assignment/ | Diagnosing assignments from unsafe values |
| Unsafe member access | https://typescript-eslint.io/rules/no-unsafe-member-access/ | Diagnosing property reads before narrowing or validation |
| Zod basics | https://zod.dev/basics | Boundary parsing matters and the project already uses Zod |
| Zod API | https://zod.dev/api | Choosing between `.parse`, `.safeParse`, or related schema APIs |
| TypeScript unsoundness | https://effectivetypescript.com/2021/05/06/unsoundness/ | Explaining why a type-only rewrite is insufficient for untrusted data |

Fetch a URL only when the decision changes based on its content. Record the URL and the specific point used in the strategist report.

## Boundary Validation

For untrusted JSON, API responses, webhooks, form payloads, config, and tool or LLM outputs: parse once at the boundary with the project's validator (commonly Zod via `.parse` or `.safeParse`), then pass inferred or explicitly typed validated values internally. Add Zod only when the project already uses it or the user explicitly permits the dependency.

## Validation Commands

Prefer the user's `VALIDATION_COMMAND`. Otherwise the smallest relevant existing project check: project tests, `tsc --noEmit`, ESLint, or the configured formatter.
