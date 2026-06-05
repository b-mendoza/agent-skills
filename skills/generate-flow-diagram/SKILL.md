---
name: "generate-flow-diagram"
description: "Create or refine Markdown plus Mermaid flow diagrams for AI-agent workflows. Use when the user asks for a process flow, workflow diagram, Mermaid flowchart, agent operating procedure, human-in-the-loop gate map, or refinement of an existing flow or process description."
---

# Generate Flow Diagram

Generate Flow Diagram turns workflow descriptions into auditable Markdown
documents with Mermaid flowcharts. The orchestrator is a routing layer: it keeps
normalized inputs, approvals, verdicts, and the final passing candidate in
context while subagents handle analysis, building, and review.

Bundled references are the offline execution contract. External links are
optional just-in-time sources for current Mermaid syntax or design rationale.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROCESS_SPEC` | Yes for new diagrams; optional for refinements | `Create a deployment-review flow: the deployment reviewer decides whether a release candidate is safe; inputs are PRs, CI, changelogs, and rollback plans; outputs are readiness comments; allowed actions are reading artifacts, summarizing risks, and posting comments; boundaries are no deploy or CI bypass; sensitive actions are deploy and rollback; HUMAN_CONFIRMATION_REQUIREMENTS is approval before recommending deploy; evidence comes from CI, runbooks, and incident history; completion states are ready, blocked, needs validation, or escalated.` |
| `EXISTING_FLOW_OR_DIAGRAM` | Yes for refinements | Existing Mermaid block, file, or process description |
| `REFINEMENT_REQUEST` | No | `Improve the current diagram without changing scope` |
| `APPROVED_REFINEMENT_GAPS` | No | `G1 and G3 only` or `none` |
| `DIAGRAM_SCOPE` | No | `orchestrator`, `subagent`, or `whole` (default) |
| `SCOPE_SUBAGENT_NAME` | Conditional | Required when `DIAGRAM_SCOPE=subagent` |
| `PACKAGE_PATH` | Yes for `RUN_MODE=decompose` | `skills/example-skill` |
| `SUBAGENT_REGISTRY` | Yes for `RUN_MODE=decompose` | Name plus path per subagent |

`DIAGRAM_SCOPE` defaults to `whole` and reproduces current whole-diagram
behavior; `orchestrator` and `subagent` constrain a generated diagram to one
scope and activate the scope checks. `RUN_MODE=decompose` is a package-level
operation over `PACKAGE_PATH` and `SUBAGENT_REGISTRY`. Load
`./references/input-contract.md` for the scope and decompose-mode field details.

**Mutation boundary.** `RUN_MODE=decompose` is the only mutating mode: after a
candidate passes the quality gate, the orchestrator writes localized diagram
files and edits load wiring inside `PACKAGE_PATH` (Claude Code: Write and Edit
tools; OpenCode: `edit` permission). All other modes are read-only and emit
content only.

Every run produces `PROCESS_INPUTS` before `RUN_MODE` routing. For new diagrams,
normalize `PROCESS_SPEC`. For refinements, derive `PROCESS_INPUTS` from
`EXISTING_FLOW_OR_DIAGRAM`, `REFINEMENT_REQUEST`, any supplied `PROCESS_SPEC`,
and explicit assumptions. For `RUN_MODE=decompose`, derive `PROCESS_INPUTS` from
the package-level inputs and mutation boundary: `PACKAGE_PATH`,
`SUBAGENT_REGISTRY`, the resolved `ROOT_DIAGRAM_PATH`, allowed write targets,
and explicit assumptions. Load `./references/input-contract.md` only when
field-level checks, missing-field handling, or a clarification question are
needed. Ask one concise question only when a missing value would change the
diagram contract; otherwise mark safe assumptions explicitly.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Missing-field checks or clarification policy | `./references/input-contract.md` |
| Refinement gap inventory and confirmation gate | Dispatch `./subagents/refinement-analyst.md`; load `./references/output-templates.md` only to format the user-facing confirmation request |
| Package decomposition plan (bloat map, earned decision, coverage audit) | Dispatch `./subagents/decomposition-planner.md`; it loads `./references/flow-design-playbook.md` for the classification test |
| Candidate diagram creation or repair | Dispatch `./subagents/diagram-builder.md`; it loads `./references/flow-design-playbook.md`, `./references/mermaid-style-guide.md`, and `./references/output-templates.md` only as needed, including the scoped templates for `orchestrator` and `subagent` scopes |
| Quality gate and fix loop | Dispatch `./subagents/diagram-quality-reviewer.md`; it loads `./references/quality-gate-checklist.md`, including the scope checks for scoped or decompose runs |
| Source-backed rationale or current Mermaid guidance | `./references/external-sources.md`, then fetch the smallest relevant URL |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `refinement-analyst` | `./subagents/refinement-analyst.md` | Inspects an existing flow and returns proposed improvement gaps plus a confirmation question |
| `decomposition-planner` | `./subagents/decomposition-planner.md` | Inspects a whole package and returns a bloat map, an earned-or-no-op decision per subagent, and a localized-diagram coverage audit |
| `diagram-builder` | `./subagents/diagram-builder.md` | Creates or revises the Markdown plus Mermaid candidate from approved scope and bundled references |
| `diagram-quality-reviewer` | `./subagents/diagram-quality-reviewer.md` | Reviews the candidate for Mermaid validity, prompt compliance, approved refinement scope, and scope separation |

Read a subagent file only when dispatching that subagent. Keep raw diagrams,
candidate drafts, and detailed findings inside subagents except for the final
candidate that must be returned to the user.

## Execution

1. Capture all inputs, default `DIAGRAM_SCOPE` to `whole` when absent, and normalize the available source into `PROCESS_INPUTS` before `RUN_MODE` classification. Use `PROCESS_SPEC` for new diagrams; use `EXISTING_FLOW_OR_DIAGRAM`, `REFINEMENT_REQUEST`, any supplied `PROCESS_SPEC`, and explicit assumptions for refinements; use `PACKAGE_PATH`, `SUBAGENT_REGISTRY`, the resolved `ROOT_DIAGRAM_PATH`, allowed write targets, and mutation-boundary assumptions for decompose runs. Load `./references/input-contract.md` when the field checklist, path checks, or missing-field policy is needed.
2. Classify the current pass as `RUN_MODE=new`, `RUN_MODE=refinement`, `RUN_MODE=repair`, or `RUN_MODE=decompose`. For `RUN_MODE=decompose`, follow the Decompose Mode steps below; steps 3-9 cover `new`, `refinement`, and `repair` and are unchanged.
3. For `RUN_MODE=refinement`, dispatch `refinement-analyst` before generating a revised diagram, including `EXISTING_FLOW_OR_DIAGRAM`, `PROCESS_INPUTS`, `REFINEMENT_REQUEST`, and `APPROVED_REFINEMENT_GAPS` when supplied. Consume its return as `PREFLIGHT_VERDICT`: continue only on `PREFLIGHT: PASS`; on `PREFLIGHT: NEEDS_CONFIRMATION`, ask the confirmation question and stop at needs confirmation; on `PREFLIGHT: BLOCKED` or `PREFLIGHT: ERROR`, stop with the reported recovery action. Treat `APPROVED_REFINEMENT_GAPS=none` as explicit approval to keep the candidate and refinement scope unchanged; when preflight passes because there are no meaningful gaps, use `none` as the downstream approval scope.
4. Load orchestration-level references only when formatting a user-facing confirmation, normalizing inputs, or fetching external rationale. Design, Mermaid, template, and quality references are loaded by the dispatched subagent.
5. Dispatch `diagram-builder` with `PROCESS_INPUTS`, `RUN_MODE`, and the inputs required for that mode: `RUN_MODE=new` uses the normalized scope, `RUN_MODE=refinement` includes `EXISTING_FLOW_OR_DIAGRAM` and `APPROVED_REFINEMENT_GAPS`, and `RUN_MODE=repair` includes `CANDIDATE_MARKDOWN` plus targeted `REVIEW_FEEDBACK`. Pass `none` through unchanged when the approved refinement scope is an explicit no-op; if repair inputs are missing, stop at needs input.
6. Consume every builder return as `BUILD_VERDICT`. Continue only on `BUILD: PASS`; on `BUILD: NEEDS_INPUT` stop at needs input with `Failure Details`; on `BUILD: ERROR`, stop at error with `Failure Details` and the reported recovery action.
7. Dispatch `diagram-quality-reviewer` with `CANDIDATE_MARKDOWN`, `PROCESS_INPUTS`, `RUN_MODE`, `EXISTING_FLOW_OR_DIAGRAM` for refinements, and `APPROVED_REFINEMENT_GAPS` when refinement scope applies, including explicit `none` approvals.
8. Consume every reviewer return as `REVIEW_VERDICT`. On `REVIEW: BLOCKED`, stop at blocked with the validation blocker; on `REVIEW: ERROR`, stop at error with the recovery action. If `REVIEW: FAIL` and the run is a refinement with `APPROVED_REFINEMENT_GAPS=none`, stop at needs confirmation and ask the user whether to approve the specific failed-check repairs before changing the candidate. For other `REVIEW: FAIL` results, dispatch `diagram-builder` with `PROCESS_INPUTS`, `EXISTING_FLOW_OR_DIAGRAM` when repairing a refinement, the current candidate, `RUN_MODE=repair`, the original `APPROVED_REFINEMENT_GAPS` when refinement scope applies, and `REVIEW_FEEDBACK` containing only the failed checks. For scoped or decompose repairs, preserve the original scoped payload in every repair dispatch and reviewer rerun: `DIAGRAM_SCOPE`, `SCOPE_SUBAGENT_NAME`, `SCOPE_CONTEXT`, and `OTHER_DIAGRAM_DIGEST`. Route that repair through `BUILD_VERDICT`; if it returns `BUILD: PASS`, re-run the full reviewer with the same refinement baseline, approval inputs, and scoped payload. Stop after three fix cycles at repair limit reached and ask the user how to proceed.
9. Return the final Markdown only after `diagram-quality-reviewer` returns `REVIEW: PASS`.

### Decompose Mode

For `RUN_MODE=decompose`, route the package-level operation:

1. Stop at needs input when `PACKAGE_PATH` or `SUBAGENT_REGISTRY` is missing.
2. Dispatch `decomposition-planner` with `PACKAGE_PATH`, `SUBAGENT_REGISTRY`, and `ROOT_DIAGRAM_PATH` when supplied. Consume its return as `PLAN_VERDICT`: continue only on `PLAN: PASS`; on `PLAN: NEEDS_INPUT` stop at needs input; on `PLAN: BLOCKED` stop at blocked; on `PLAN: ERROR` stop at error with the recovery action. Keep the bloat map, earned decisions, coverage audit, planner-resolved `ROOT_DIAGRAM_PATH` (default `<PACKAGE_PATH>/flow-diagram.md`), and root before-size from the plan.
3. For each subagent the plan marks EARNED with action `create` or `re-scope`, dispatch `diagram-builder` with `PROCESS_INPUTS`, `RUN_MODE=decompose`, `DIAGRAM_SCOPE=subagent`, `SCOPE_SUBAGENT_NAME`, and a `SCOPE_CONTEXT` slice naming the nodes that subagent owns and the root cross-link. Route each build through `BUILD_VERDICT`, then dispatch `diagram-quality-reviewer` with `CANDIDATE_MARKDOWN`, `PROCESS_INPUTS`, `RUN_MODE=decompose`, `DIAGRAM_SCOPE=subagent`, `SCOPE_SUBAGENT_NAME`, and `OTHER_DIAGRAM_DIGEST` (labels and statuses already owned by the root and sibling localized diagrams). Run the same bounded repair loop as steps 6-8 (at most three cycles), preserving `PROCESS_INPUTS`, `DIAGRAM_SCOPE`, `SCOPE_SUBAGENT_NAME`, `SCOPE_CONTEXT`, and `OTHER_DIAGRAM_DIGEST` on repair. EARNED subagents marked `keep` need no regeneration.
4. Re-author the root: dispatch `diagram-builder` with `PROCESS_INPUTS`, `RUN_MODE=decompose`, `DIAGRAM_SCOPE=orchestrator`, and a `SCOPE_CONTEXT` that lists every dispatch and its localized-diagram cross-link. Route through `BUILD_VERDICT`, then `diagram-quality-reviewer` with `CANDIDATE_MARKDOWN`, `PROCESS_INPUTS`, `RUN_MODE=decompose`, `DIAGRAM_SCOPE=orchestrator`, and the `OTHER_DIAGRAM_DIGEST` of the localized diagrams. Apply the same bounded repair loop, preserving `PROCESS_INPUTS`, `DIAGRAM_SCOPE`, `SCOPE_CONTEXT`, and `OTHER_DIAGRAM_DIGEST` on repair.
5. After each diagram passes `REVIEW: PASS`, enforce the `PACKAGE_PATH` mutation boundary from `./references/input-contract.md`, then write it into `PACKAGE_PATH`: localized diagrams at `subagents/<name>-flow-diagram.md`, the slim root at the planner-resolved `ROOT_DIAGRAM_PATH` (default `<PACKAGE_PATH>/flow-diagram.md`), and one load-instruction line per owner so `SKILL.md` loads only the root and each EARNED subagent loads only its own diagram. NO_OP_EVIDENCED subagents get no localized diagram and no load line.
6. Return the decompose result: per-owner decision and action, files written, the scope-separation and no-duplication outcomes, and the root before/after node count, using the decompose-result template.

## Output Contract

If refinement approval is required, return the pre-check table and confirmation
question from `refinement-analyst`.

After the quality gate passes, return a Markdown document with:

- A short title using `PROCESS_NAME`.
- A short boundary paragraph covering role, authority, trust model, and mutation limits.
- Exactly one fenced `mermaid` diagram unless the user explicitly asks for more.
- Optional output, report, or comment template when useful.
- Optional readiness, completion, or sensitive-action rule when it clarifies completion.

For `RUN_MODE=decompose`, return the decompose-result instead: the per-owner
decision and action, the files written into `PACKAGE_PATH`, the scope-separation
and no-duplication outcomes, and the root before/after node count, formatted with
the decompose-result template in `./references/output-templates.md`.

## Validation

A valid run satisfies these checks:

- `SKILL.md` stays a routing layer; detailed templates, style guidance, quality checks, and external links live in `references/`.
- Local paths referenced by this skill exist inside this package.
- `PROCESS_INPUTS` is produced for every run before `RUN_MODE` routing and follows the bundled input contract; load `./references/input-contract.md` only when field-level or path checks are needed.
- Refinements include only user-approved gap fixes.
- The final Mermaid candidate passes the quality gate after at most three builder repair cycles; each repair uses targeted `REVIEW_FEEDBACK`, preserves the original refinement approval scope, then the full reviewer gate reruns.
- `DIAGRAM_SCOPE` defaults to `whole`; whole-diagram generation and refinement behavior is unchanged. Scoped (`orchestrator` or `subagent`) and `decompose` runs additionally pass the scope-separation, no-duplication, and dispatch-collapse checks.
- `RUN_MODE=decompose` slims the root (each subagent dispatch is one cross-linked node), creates a localized diagram for every EARNED subagent, records a NO_OP_EVIDENCED subagent with quoted evidence, and wires each owner to load only its own diagram. It is the only mode that writes files, scoped to a path-checked `PACKAGE_PATH`.
- External URLs are optional just-in-time sources, not required runtime dependencies.
- Completion states are final passed, decomposition complete, needs confirmation, blocked, error, needs input, or repair limit reached.

## Example

Input: `Refine this Mermaid deployment-review diagram so the approval gates are
clearer, but do not add new scope.`

1. Derive `PROCESS_INPUTS` from the supplied diagram plus the refinement request, then classify the run as `RUN_MODE=refinement`.
2. Dispatch `refinement-analyst`; it returns `PREFLIGHT: NEEDS_CONFIRMATION` with gaps `G1` and `G2`.
3. Ask which gap IDs are approved. If the user replies `G1`, dispatch `diagram-builder` with the baseline, `PROCESS_INPUTS`, and `APPROVED_REFINEMENT_GAPS=G1`.
4. Dispatch `diagram-quality-reviewer` with the candidate, `PROCESS_INPUTS`, and the original approval scope.
5. If review fails, send only failed checks and the original approval scope back to `diagram-builder` for repair, then rerun the full review.
6. Return the final Markdown only after `REVIEW: PASS`.
