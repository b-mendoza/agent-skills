# Strict Rewrite Orchestration Examples

Read this file only when a concrete example is useful for routing, no-change
handling, or unavailable external references. Language details live in the
language playbooks and their linked websites.

## Boundary Rewrite Round Trip

Input:

- `TARGET_CODE`: `src/payments/webhook.ts`
- `USER_GOAL`: `"remove unsafe any and validate the webhook payload"`
- `VALIDATION_COMMAND`: `npm test -- payments && npx tsc --noEmit`

Flow:

1. Orchestrator dispatches `strict-baseline-mapper`.
2. Mapper returns `STRICT_BASELINE: PASS`, identifying TypeScript, an untrusted
   webhook body, `any` use at the boundary, and existing payment tests.
3. Orchestrator dispatches `strict-rewrite-strategist`.
4. Strategist reads `./references/typescript-playbook.md`, fetches Zod docs only
   because the project already uses Zod, and returns a minimal plan: accept
   `unknown`, parse once at the webhook boundary, pass the inferred payload type
   internally, and avoid changing persistence code.
5. Orchestrator dispatches `strict-rewrite-implementer`.
6. Implementer edits the webhook file, runs the supplied command, and returns
   `STRICT_IMPLEMENTATION: PASS`.
7. Orchestrator dispatches `strict-rewrite-reviewer`.
8. Reviewer returns `STRICT_REVIEW: PASS` because behavior, scope, validation
   placement, and TypeScript strictness all match the strategy.
9. Orchestrator returns the final handoff with changed files, checks, references,
   assumptions, and remaining risks.

## No-Change Handling

1. Mapper returns `STRICT_BASELINE: NO_CHANGE_CANDIDATE` for Go code that already
   uses concrete structs, explicit error returns, checked JSON decoding, and
   passing project validation.
2. Strategist returns `STRICT_STRATEGY: NO_CHANGE` because the requested rewrite
   would add ceremony without improving safety.
3. Orchestrator stops without editing and reports the behavior summary,
   no-change rationale, validation evidence, and any assumptions.

## Unavailable External Reference

1. Strategist needs current validator API behavior to decide between `.parse` and
   `.safeParse` but the linked docs are unavailable.
2. If project code already demonstrates the API safely, strategist may proceed
   from project evidence and records `unavailable: <url> (used project usage as
   evidence)`.
3. If project evidence is insufficient, strategist returns `NEEDS_CLARIFICATION`
   or `ERROR` with the smallest recovery action instead of guessing.
