# TypeScript Strict Rewrite Playbook

Read this file only for TypeScript or JavaScript targets. Use it as a compact
decision map and fetch linked docs only when a concrete rewrite decision, checker
diagnostic, lint rule, or validator API question depends on them.

## Local Defaults

- Preserve observable behavior and follow project `tsconfig`, lint, and validator
  conventions first.
- Replace broad `any` with `unknown` at untrusted boundaries, then narrow before
  use.
- Model absence intentionally and guard object or array lookups when missing
  values are possible.
- Prefer discriminated unions when they simplify control flow and exhaustiveness.
- Keep assertions local and replace them with narrowing, guards, or runtime
  schemas when feasible.
- Avoid deep generic machinery unless it removes real duplication or captures a
  stable public contract.

## External Fetch Map

| Decision | Fetch first | Use when |
| -------- | ----------- | -------- |
| Basic annotation or `unknown`/`any` tradeoff | https://www.typescriptlang.org/docs/handbook/2/everyday-types.html | Choosing concise function, object, array, union, or `unknown` annotations |
| Narrowing strategy | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | Replacing assertions with guards, discriminants, `in`, equality, or control-flow narrowing |
| `strict` behavior | https://www.typescriptlang.org/tsconfig/#strict | Interpreting existing strictness or deciding which checker command matters |
| Indexed access safety | https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess | Handling array/object lookup diagnostics or runtime-missing values |
| Optional property semantics | https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes | Distinguishing omitted properties from explicit `undefined` |
| Avoiding explicit `any` | https://typescript-eslint.io/rules/no-explicit-any/ | Understanding lint expectations or replacing `any` without weakening behavior |
| Unsafe value linting | https://typescript-eslint.io/rules/no-unsafe-assignment/ | Diagnosing assignments from unsafe values |
| Unsafe member access | https://typescript-eslint.io/rules/no-unsafe-member-access/ | Diagnosing property reads before narrowing or validation |
| Zod basics | https://zod.dev/basics | Project already uses Zod and boundary parsing behavior matters |
| Zod API | https://zod.dev/api | Selecting a schema API or checking `.parse`/`.safeParse` behavior |
| TypeScript unsoundness | https://effectivetypescript.com/2021/05/06/unsoundness/ | Explaining why a type-only rewrite is insufficient for untrusted data |

## Boundary Decisions

Use the project's existing validator when present. Prefer Zod for untrusted JSON,
API responses, webhooks, form payloads, config, and tool/LLM outputs only when the
project already uses it or adding it is acceptable.

Parse once at the boundary with `.parse`, `.safeParse`, or the project's
equivalent. Pass inferred or explicitly typed validated values through internal
code instead of raw unvalidated objects.

## Validation

Prefer the project's configured checks. Common useful commands include project
tests, `tsc --noEmit`, ESLint, and the configured formatter.

## Quality Gate

The final TypeScript should make unsafe runtime states hard to express, validate
untrusted input once, and keep the type layer readable enough to maintain.
