# Strict Rewrite Orchestration Examples

> Read this file only when a concrete dispatch round-trip, a no-change case,
> or an unavailable-reference case would clarify execution. Language details
> live in the language playbooks and optional external source map.

## Boundary Rewrite Round Trip

Input:

- `TARGET_CODE`: `src/payments/webhook.ts`
- `USER_GOAL`: `"remove unsafe any and validate the webhook payload"`
- `VALIDATION_COMMAND`: `npm test -- payments && npx tsc --noEmit`

Flow:

1. Orchestrator dispatches `strict-baseline-mapper`.
2. Mapper returns `STRICT_BASELINE: PASS`: TypeScript, untrusted webhook body, `any` at the boundary, existing payment tests.
3. Orchestrator dispatches `strict-rewrite-strategist`.
4. Strategist reads `./typescript-playbook.md`, loads `./external-sources.md` only because the Zod API choice affects implementation, fetches the smallest relevant Zod URL, and returns a minimal plan: accept `unknown`, parse once at the webhook boundary, pass the inferred payload type internally, leave persistence code alone.
5. Orchestrator dispatches `strict-rewrite-implementer`.
6. Implementer edits the webhook file, runs the supplied command, and returns `STRICT_IMPLEMENTATION: PASS`.
7. Orchestrator dispatches `strict-rewrite-reviewer`.
8. Reviewer returns `STRICT_REVIEW: PASS`: behavior, scope, validation placement, and TypeScript strictness all match the strategy.
9. Orchestrator returns the handoff with changed files, checks, references, assumptions, and remaining risks.

## No-Change Handling

1. Mapper returns `STRICT_BASELINE: NO_CHANGE_CANDIDATE` for Go code that already uses concrete structs, explicit error returns, checked JSON decoding, and passing project validation.
2. Strategist returns `STRICT_STRATEGY: NO_CHANGE` because the requested rewrite would add ceremony without improving safety.
3. Orchestrator stops without editing and reports the behavior summary, no-change rationale, validation evidence, and any assumptions.

## Unavailable External Reference

1. Strategist needs current validator API behavior to choose between `.parse` and `.safeParse`, but the linked docs are unavailable.
2. If project code already demonstrates the API safely, strategist proceeds from project evidence and records `unavailable: <url> (used project usage as evidence)`.
3. If project evidence is insufficient, strategist returns `NEEDS_CLARIFICATION` or `ERROR` with the smallest recovery action instead of guessing current docs.
