# TypeScript Strict Rewrite Playbook

Read this file only for TypeScript or JavaScript targets. Use it as a reference
map and decision guide, not as a checklist that requires every linked document to
be fetched.

## Target

Produce strict TypeScript-compatible code with explicit nullability, narrowed
`unknown` boundary data, safe indexed access, and runtime validation for untrusted
inputs when validation is clearer than assertions.

## Rewrite Rules

- Replace broad `any` with `unknown` at boundaries, then narrow before use.
- Prefer discriminated unions when they make control flow and exhaustiveness
  clearer.
- Use `readonly` or immutable input types when mutation is not part of the
  contract.
- Keep type assertions local and replace them with narrowing, guards, or runtime
  schemas when feasible.
- Model absence intentionally: distinguish omitted optional properties from
  properties whose value may be `undefined`.
- Guard object and array lookups when project settings or runtime behavior make
  missing values possible.
- Avoid deep generic machinery unless it removes real duplication or represents a
  stable public contract.

## Boundary Validation

Use the project's existing validator when present. Prefer Zod for untrusted JSON,
API responses, webhooks, form payloads, config, and tool/LLM outputs only when the
project already uses it or adding it is acceptable.

Parse once at the boundary with `.parse`, `.safeParse`, or the project's
equivalent. Pass inferred or explicitly typed validated values through internal
code instead of raw unvalidated objects.

## Reference Links

- TypeScript everyday types: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
- TypeScript narrowing: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- TSConfig `strict`: https://www.typescriptlang.org/tsconfig/#strict
- TSConfig `noUncheckedIndexedAccess`: https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess
- TSConfig `exactOptionalPropertyTypes`: https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes
- typescript-eslint `no-explicit-any`: https://typescript-eslint.io/rules/no-explicit-any/
- Zod basics: https://zod.dev/basics
- Zod API: https://zod.dev/api
- Effective TypeScript on unsoundness: https://effectivetypescript.com/2021/05/06/unsoundness/

## Validation

Prefer the project's configured checks. Common useful commands include project
tests, `tsc --noEmit`, ESLint, and the configured formatter.

## Quality Bar

The final TypeScript should make unsafe runtime states hard to express, validate
untrusted input once, and keep the type layer readable enough to maintain.
