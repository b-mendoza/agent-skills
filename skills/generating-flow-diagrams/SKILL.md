---
name: "generating-flow-diagrams"
description: "Create or refine Markdown plus Mermaid flow diagrams for AI-agent workflows. Use when the user asks for a process flow, workflow diagram, Mermaid flowchart, agent operating procedure, human-in-the-loop gate map, or refinement of an existing flow or process description."
---

# Generating Flow Diagrams

Generating Flow Diagrams turns workflow descriptions into auditable Markdown
documents with Mermaid flowcharts. The orchestrator is a routing layer: it keeps
normalized inputs, approvals, verdicts, and the final passing candidate in
context while subagents handle analysis, building, and review.

Bundled references are the offline execution contract. External links are
optional just-in-time sources for current Mermaid syntax or design rationale.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROCESS_SPEC` | Yes | `Create a deployment-review flow: the deployment reviewer decides whether a release candidate is safe; inputs are PRs, CI, changelogs, and rollback plans; outputs are readiness comments; allowed actions are reading artifacts, summarizing risks, and posting comments; boundaries are no deploy or CI bypass; sensitive actions are deploy and rollback; HUMAN_CONFIRMATION_REQUIREMENTS is approval before recommending deploy; evidence comes from CI, runbooks, and incident history; completion states are ready, blocked, needs validation, or escalated.` |
| `EXISTING_FLOW_OR_DIAGRAM` | No | Existing Mermaid block, file, or process description |
| `REFINEMENT_REQUEST` | No | `Improve the current diagram without changing scope` |
| `APPROVED_REFINEMENT_GAPS` | No | `G1 and G3 only` or `none` |

Normalize `PROCESS_SPEC` into `PROCESS_INPUTS` for every run. Load
`./references/input-contract.md` only when field-level checks, missing-field
handling, or a clarification question are needed. Ask one concise question only
when a missing value would change the diagram contract; otherwise mark safe
assumptions explicitly.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Input normalization or missing-field checks | `./references/input-contract.md` |
| Refinement gap inventory and confirmation gate | Dispatch `./subagents/refinement-analyst.md`; load `./references/output-templates.md` only to format the user-facing confirmation request |
| Candidate diagram creation or repair | Dispatch `./subagents/diagram-builder.md`; it loads `./references/flow-design-playbook.md`, `./references/mermaid-style-guide.md`, and `./references/output-templates.md` only as needed |
| Quality gate and fix loop | Dispatch `./subagents/diagram-quality-reviewer.md`; it loads `./references/quality-gate-checklist.md` |
| Source-backed rationale or current Mermaid guidance | `./references/external-sources.md`, then fetch the smallest relevant URL |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `refinement-analyst` | `./subagents/refinement-analyst.md` | Inspects an existing flow and returns proposed improvement gaps plus a confirmation question |
| `diagram-builder` | `./subagents/diagram-builder.md` | Creates or revises the Markdown plus Mermaid candidate from approved scope and bundled references |
| `diagram-quality-reviewer` | `./subagents/diagram-quality-reviewer.md` | Reviews the candidate for Mermaid validity, prompt compliance, and approved refinement scope |

Read a subagent file only when dispatching that subagent. Keep raw diagrams,
candidate drafts, and detailed findings inside subagents except for the final
candidate that must be returned to the user.

## Execution

1. Capture all inputs and classify the run as `new` or `refinement`.
2. Normalize `PROCESS_SPEC` into `PROCESS_INPUTS`; load `./references/input-contract.md` when the field checklist or missing-field policy is needed.
3. For `refinement`, dispatch `refinement-analyst` before generating a revised diagram, including `EXISTING_FLOW_OR_DIAGRAM`, `PROCESS_INPUTS`, `REFINEMENT_REQUEST`, and `APPROVED_REFINEMENT_GAPS` when supplied. Treat `APPROVED_REFINEMENT_GAPS=none` as explicit approval to keep the candidate and refinement scope unchanged; when preflight passes because there are no meaningful gaps, use `none` as the downstream approval scope. Continue only on `PREFLIGHT: PASS`; on `PREFLIGHT: NEEDS_CONFIRMATION`, ask the confirmation question and stop; on `PREFLIGHT: BLOCKED` or `PREFLIGHT: ERROR`, stop with the reported recovery action.
4. Load orchestration-level references only when formatting a user-facing confirmation, normalizing inputs, or fetching external rationale. Design, Mermaid, template, and quality references are loaded by the dispatched subagent.
5. Dispatch `diagram-builder` with `PROCESS_INPUTS`, `RUN_MODE=new` or `RUN_MODE=refinement`, `EXISTING_FLOW_OR_DIAGRAM` for refinements, `APPROVED_REFINEMENT_GAPS` when refinement scope applies, and any concise constraints from prior phases. Pass `none` through unchanged when the approved refinement scope is an explicit no-op.
6. Continue only on `BUILD: PASS`; on `BUILD: NEEDS_INPUT` or `BUILD: ERROR`, stop with `Failure Details` and the reported recovery action.
7. Dispatch `diagram-quality-reviewer` with `CANDIDATE_MARKDOWN`, `PROCESS_INPUTS`, `RUN_MODE`, `EXISTING_FLOW_OR_DIAGRAM` for refinements, and `APPROVED_REFINEMENT_GAPS` when refinement scope applies, including explicit `none` approvals.
8. On `REVIEW: BLOCKED` or `REVIEW: ERROR`, stop with the validation blocker and recovery action. If `REVIEW: FAIL` and the run is a refinement with `APPROVED_REFINEMENT_GAPS=none`, stop and ask the user whether to approve the specific failed-check repairs before changing the candidate. For other `REVIEW: FAIL` results, dispatch `diagram-builder` with `PROCESS_INPUTS`, `EXISTING_FLOW_OR_DIAGRAM` when repairing a refinement, the current candidate, `RUN_MODE=repair`, the original `APPROVED_REFINEMENT_GAPS` when refinement scope applies, and `REVIEW_FEEDBACK` containing only the failed checks; if repair returns `BUILD: NEEDS_INPUT` or `BUILD: ERROR`, stop with `Failure Details`; otherwise re-run the full reviewer with the same refinement baseline and approval inputs. Stop after three fix cycles and ask the user how to proceed.
9. Return the final Markdown only after `diagram-quality-reviewer` returns `REVIEW: PASS`.

## Output Contract

If refinement approval is required, return the pre-check table and confirmation
question from `refinement-analyst`.

After the quality gate passes, return a Markdown document with:

- A short title using `PROCESS_NAME`.
- A short boundary paragraph covering role, authority, trust model, and mutation limits.
- Exactly one fenced `mermaid` diagram unless the user explicitly asks for more.
- Optional output, report, or comment template when useful.
- Optional readiness, completion, or sensitive-action rule when it clarifies completion.

## Validation

A valid run satisfies these checks:

- `SKILL.md` stays a routing layer; detailed templates, style guidance, quality checks, and external links live in `references/`.
- Local paths referenced by this skill exist inside this package.
- `PROCESS_INPUTS` is produced for every run and always follows the bundled input contract; load `./references/input-contract.md` only when field-level checks are needed.
- Refinements include only user-approved gap fixes.
- The final Mermaid candidate passes the quality gate after at most three builder repair cycles; each repair uses targeted `REVIEW_FEEDBACK`, preserves the original refinement approval scope, then the full reviewer gate reruns.
- External URLs are optional just-in-time sources, not required runtime dependencies.

## Example

Input: `Create a deployment-review flow. The agent reads release artifacts and
posts readiness comments. Deploy and rollback require human approval.`

1. Normalize the process into `PROCESS_INPUTS` and dispatch `diagram-builder`.
2. Dispatch `diagram-quality-reviewer` with the candidate.
3. If review fails, send only failed checks and the original approval scope back
   to `diagram-builder` for repair, then rerun the full review.
4. Return the final Markdown only after `REVIEW: PASS`.
