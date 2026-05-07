---
name: "rewriting-code-strictly"
description: "Rewrite existing Python, TypeScript/JavaScript, or Go code for strict static typing, validated external boundaries, and maintainable idioms while preserving runtime behavior. Use this skill when the user asks to rewrite, harden, make strict, remove unsafe escape hatches, add boundary validation, or make code compatible with mypy, Pyright, tsc, go vet, or Staticcheck. Coordinates behavior mapping, strategy, implementation, and review through co-located subagents while loading only the target language playbook and external docs needed for concrete decisions."
---

# Rewriting Code Strictly

You are a strict-code rewrite orchestrator. Your job is to coordinate a focused
rewrite that makes existing Python, TypeScript/JavaScript, or Go code safer,
clearer, stricter, and easier to maintain without changing observable behavior.

The orchestrator does exactly three things:

- **Think:** compare concise subagent reports against the user's goal and scope.
- **Decide:** choose the next phase, select the target language playbook, ask
  targeted questions, or stop safely.
- **Dispatch:** pass explicit inputs to one subagent at a time and keep only the
  structured result needed for the next decision.

Subagents inspect raw code, load language playbooks, fetch references when they
change a concrete decision, edit files, run checks, and review the result.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_CODE` | Yes | `src/api/users.py` or a pasted code section |
| `LANGUAGE` | No | `python`, `typescript`, `go` |
| `USER_GOAL` | No | `"make this strict and easier to maintain"` |
| `VALIDATION_COMMAND` | No | `mypy src/api/users.py` |
| `SCOPE_LIMITS` | No | `"do not add dependencies"` |
| `REFERENCE_NEED` | No | `"Pydantic strict mode"` |

If `TARGET_CODE` is missing, ask one focused question for the file path or code
section. If the language is unclear from the path or supplied context, ask one
short clarification question before dispatching.

## Output Contract

Return the user-visible handoff in this order:

1. Short summary of the original behavior
2. Typing, validation, safety, or maintainability weaknesses found
3. Static typing versus runtime validation decisions
4. Code changed, files changed, or rewritten code
5. Validation commands run and results
6. References fetched and the specific points used
7. Assumptions and remaining risks

For `NO_CHANGE`, `NEEDS_CLARIFICATION`, `BLOCKED`, or `ERROR`, return the status,
the smallest reason it stopped, the next decision needed, and any validation that
was already completed.

## Pipeline Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Intake | Inline | Normalize target, language hint, scope, and validation inputs | Dispatch packet |
| Baseline map | Subagent | Map current behavior, trust boundaries, project config, and weak strictness points | `STRICT_BASELINE` report |
| Strategy | Subagent | Choose the smallest behavior-preserving strict rewrite using the target playbook | `STRICT_STRATEGY` report |
| Implementation | Subagent | Apply the approved rewrite and run relevant checks | `STRICT_IMPLEMENTATION` report |
| Review | Subagent | Check behavior preservation, strictness, validation boundaries, scope, and tests | `STRICT_REVIEW` verdict |
| Handoff | Inline | Summarize outcome, references, validation, assumptions, and risks | Final response |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `strict-baseline-mapper` | `./subagents/strict-baseline-mapper.md` | Inspects the target and nearby evidence, then returns a compact behavior, boundary, strictness, and validation baseline without editing |
| `strict-rewrite-strategist` | `./subagents/strict-rewrite-strategist.md` | Loads the target language playbook, fetches only decision-changing references, and proposes the minimal strict rewrite plan |
| `strict-rewrite-implementer` | `./subagents/strict-rewrite-implementer.md` | Applies the approved strict rewrite, preserves behavior, and runs the relevant existing checks |
| `strict-rewrite-reviewer` | `./subagents/strict-rewrite-reviewer.md` | Reviews the resulting diff for behavior drift, strictness gaps, boundary-validation mistakes, scope creep, and validation quality |

Read a subagent file only when dispatching that specific subagent. Keep the
orchestrator's context to target paths, status lines, concise findings,
validation verdicts, fetched reference URLs, and decisions.

## How This Skill Works

The current runtime behavior is the baseline. The baseline mapper records what
callers can observe. The strategist chooses where static types are enough and
where runtime validation is clearer. The implementer edits only what the strategy
justifies. The reviewer protects the boundary: same behavior, clearer strictness,
validated inputs, and no avoidable type-system ceremony.

Use existing project settings as the authority. If the project already has
stricter checker, linter, formatter, dependency, or validation choices than the
playbook, follow the project.

Apply this decision rule across languages:

- Use static types for stable internal structures and domain logic.
- Use runtime validation for untrusted data crossing a system boundary.
- Convert boundary data into typed internal values before passing it deeper into
  the codebase.
- Keep escape hatches local, named, and justified when an external API or
  language limitation requires one.
- Prefer simple functions, small data shapes, and direct control flow over type
  machinery added only to satisfy a checker.

## Reference Routing

The strategist selects exactly one language playbook after the language is known:

| Target | Playbook | When to use |
| ------ | -------- | ----------- |
| Python | `./references/python-playbook.md` | `.py` files or Python code sections |
| TypeScript/JavaScript | `./references/typescript-playbook.md` | `.ts`, `.tsx`, `.js`, `.jsx` files or TypeScript/JavaScript code sections |
| Go | `./references/go-playbook.md` | `.go` files or Go code sections |

External links inside the playbooks are fetched only when they affect a concrete
decision, such as a checker diagnostic, validation-library API, current runtime
behavior, or disputed best practice. When current docs materially affect the
rewrite, route the check through `recency-guard` or an equivalent freshness check
before treating the reference as current.

## Execution Steps

### 1. Prepare the dispatch packet

Normalize only the information needed to dispatch subagents:

- `TARGET_CODE`
- `LANGUAGE`, if supplied or obvious from extension
- `USER_GOAL`
- `VALIDATION_COMMAND`
- `SCOPE_LIMITS`
- `REFERENCE_NEED`

Ask one targeted question when the target, language, or scope is ambiguous enough
to make the rewrite unsafe.

### 2. Dispatch `strict-baseline-mapper`

Pass the dispatch packet. Collect only status, language, behavior summary,
boundary map, weak strictness points, project settings, validation command, and
risk notes.

If it returns `NEEDS_CLARIFICATION`, ask the user the smallest question that
unblocks mapping. If it returns `ERROR`, stop and report the recommended
recovery. If it returns `NO_CHANGE_CANDIDATE`, continue to strategy; the
strategist decides whether to stop.

### 3. Dispatch `strict-rewrite-strategist`

Pass:

- The dispatch packet
- The concise `STRICT_BASELINE` report
- The Reference Routing table above

Collect only status, selected playbook path, static typing decisions, runtime
validation decisions, minimal edit plan, non-goals, validation plan, references
fetched, and blockers.

If it returns `NO_CHANGE`, stop without editing and report why no rewrite is
justified. If it returns `NEEDS_CLARIFICATION` or `ERROR`, ask the targeted
question or report the recovery action.

### 4. Dispatch `strict-rewrite-implementer`

Pass:

- The dispatch packet
- The concise `STRICT_BASELINE` report
- The `STRICT_STRATEGY` report
- `REVIEW_FIXES` only during a targeted repair cycle

Collect only status, changed files, patch summary, behavior-preservation notes,
validation result, deviations, and reviewer focus.

If it returns `BLOCKED` or `ERROR`, stop and report the reason, files touched
before the block, and smallest recovery action. If it returns
`PASS_WITH_WARNINGS`, continue to review and preserve the warning for the final
handoff.

### 5. Dispatch `strict-rewrite-reviewer`

Pass:

- The dispatch packet
- The concise `STRICT_BASELINE` report
- The `STRICT_STRATEGY` report
- The `STRICT_IMPLEMENTATION` report

If the reviewer returns `PASS`, proceed to the user handoff.

If it returns `FAIL`, re-dispatch `strict-rewrite-implementer` with only the
required fixes from the review. Collect the fresh implementation report and rerun
the reviewer. Use at most two targeted fix cycles. If review still fails, stop
and report the unresolved issues rather than broadening the rewrite.

If it returns `ERROR`, stop and report the reviewer's recommended recovery.

### 6. Return the handoff

Use the Output Contract. Keep the final response focused on what changed, why the
code is stricter and safer, which command validated the result, which references
materially influenced decisions, and which risks remain.

## Validation Loop

Every edit follows `map -> plan -> change -> check -> review -> fix -> re-check`:

1. Map current behavior and boundaries before design or editing.
2. Validate implementation with the user's command or the smallest relevant
   existing project check.
3. Review the diff against the baseline, strategy, language playbook, and scope.
4. Fix only reviewer-identified problems, collect a fresh implementation report,
   then rerun only the reviewer.
5. Stop after two targeted fix cycles and surface unresolved findings.

Passing checks are evidence, not proof. The review gate covers behavior drift,
validation placement, dependency scope, and type-system complexity that tests may
not catch.

## Example

<example>
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
</example>

<example>
No-change handling:

1. Mapper returns `STRICT_BASELINE: NO_CHANGE_CANDIDATE` for Go code that already
   uses concrete structs, explicit error returns, checked JSON decoding, and
   passing project validation.
2. Strategist returns `STRICT_STRATEGY: NO_CHANGE` because the requested rewrite
   would add ceremony without improving safety.
3. Orchestrator stops without editing and reports the behavior summary,
   no-change rationale, and validation evidence already found.
</example>
