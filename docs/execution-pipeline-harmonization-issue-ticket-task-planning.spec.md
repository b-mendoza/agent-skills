# Execution Pipeline Harmonization Spec - Issue/Ticket Task Planning

> Canonical reference for the final harmonized baseline between
> `skills/planning-github-issue-tasks` and `skills/planning-jira-tasks`.
>
> This document is audit and change-control guidance only. The coordinator
> skills, subagents, references, and bundled templates remain self-contained
> and must not depend on this file at runtime.

---

## Scope

This spec applies only to `planning-github-issue-tasks` and
`planning-jira-tasks`.

- Record the shared contract definitions, shared pipeline stages, dispatch
  boundaries, intentional platform divergences, and change-control decisions
  established in this harmonization pass.
- Cover these runtime artifacts:
  - `skills/planning-github-issue-tasks/SKILL.md`
  - `skills/planning-github-issue-tasks/subagents/task-planner.md`
  - `skills/planning-github-issue-tasks/subagents/dependency-prioritizer.md`
  - `skills/planning-github-issue-tasks/subagents/task-validator.md`
  - `skills/planning-github-issue-tasks/subagents/stage-validator.md`
  - `skills/planning-github-issue-tasks/subagents/task-planner-template.md`
  - `skills/planning-github-issue-tasks/subagents/dependency-prioritizer-template.md`
  - `skills/planning-github-issue-tasks/references/re-plan-cycle.md`
  - `skills/planning-jira-tasks/SKILL.md`
  - `skills/planning-jira-tasks/subagents/task-planner.md`
  - `skills/planning-jira-tasks/subagents/dependency-prioritizer.md`
  - `skills/planning-jira-tasks/subagents/task-validator.md`
  - `skills/planning-jira-tasks/subagents/stage-validator.md`
  - `skills/planning-jira-tasks/subagents/task-planner-template.md`
  - `skills/planning-jira-tasks/subagents/dependency-prioritizer-template.md`
  - `skills/planning-jira-tasks/references/re-plan-cycle.md`
- Preserve the rule that runtime truth stays in the skill-local files above.
  This spec documents the harmonized state; it does not replace skill-local
  contracts.

---

## Skills Covered

| Platform | Coordinator skill | Stage 1 | Stage 2 | Stage 3 | Gate validator | Re-plan reference | Templates | Primary artifacts |
| -------- | ----------------- | ------- | ------- | ------- | -------------- | ----------------- | --------- | ----------------- |
| GitHub | `skills/planning-github-issue-tasks/SKILL.md` | `task-planner` | `dependency-prioritizer` | `task-validator` | `stage-validator` | `references/re-plan-cycle.md` | `task-planner-template.md`, `dependency-prioritizer-template.md` | `docs/<ISSUE_SLUG>-stage-1-detailed.md`, `docs/<ISSUE_SLUG>-stage-2-prioritized.md`, `docs/<ISSUE_SLUG>-tasks.md` |
| Jira | `skills/planning-jira-tasks/SKILL.md` | `task-planner` | `dependency-prioritizer` | `task-validator` | `stage-validator` | `references/re-plan-cycle.md` | `task-planner-template.md`, `dependency-prioritizer-template.md` | `docs/<TICKET_KEY>-stage-1-detailed.md`, `docs/<TICKET_KEY>-stage-2-prioritized.md`, `docs/<TICKET_KEY>-tasks.md` |

---

## Final Harmonized Baseline

| Area | Authoritative baseline |
| ---- | ---------------------- |
| Structural alignment | Both coordinator skills already shared the same five-gate planning pipeline and the same three-stage artifact lifecycle before this pass. |
| Confirmed contract gap | Both `stage-validator` subagents allowed `STAGE_VALIDATION: ERROR`, but the parent coordinator `SKILL.md` files previously handled validator `FAIL` only and left `ERROR` implicit. |
| Approved behavioral fix | Both coordinators now make `STAGE_VALIDATION: ERROR` explicit and terminal at the current gate. |
| Failure-category enum | The shared enum remains `PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE`. |
| Retry boundary | Targeted retry loops remain limited to `STAGE_VALIDATION: FAIL`. |
| Lower-layer audit result | The subagent/reference/template layer was re-audited and required no harmonization edits. |
| Autonomous runtime edit surface | The approved autonomous runtime edit surface for this pass was the two coordinator `SKILL.md` files only. The full file set touched in this pass was those two runtime files plus this spec. |
| Platform behavior | All platform-native identifiers, headings, metadata sections, and downstream skill names remain intentionally different where recorded below. |
| Wording clarifications | Supporting wording updates were limited to keeping the coordinator contracts internally coherent and render-safe; no runtime behavior changed beyond explicit validator `ERROR` handling. |

---

## Shared Pipeline Stages

1. **Preflight gate**
   - Dispatch `stage-validator` against the Phase 1 snapshot at
     `docs/<ISSUE_SLUG>.md` or `docs/<TICKET_KEY>.md`.
   - Confirm the snapshot exists and contains the minimum heading set required
     for planning entry.
2. **Stage 1 - Plan**
   - Dispatch `task-planner`.
   - Write the stage 1 artifact at
     `docs/<ISSUE_SLUG>-stage-1-detailed.md` or
     `docs/<TICKET_KEY>-stage-1-detailed.md`.
   - Re-dispatch `stage-validator` for the Stage 1 structural gate.
3. **Stage 2 - Prioritize**
   - Dispatch `dependency-prioritizer`.
   - Write the stage 2 artifact at
     `docs/<ISSUE_SLUG>-stage-2-prioritized.md` or
     `docs/<TICKET_KEY>-stage-2-prioritized.md`.
   - Re-dispatch `stage-validator` for the Stage 2 structural gate.
4. **Stage 3 - Validate**
   - Dispatch `task-validator`.
   - On `TASK_VALIDATION: PASS` or `FAIL`, `task-validator` writes the final
     planning artifact at `docs/<ISSUE_SLUG>-tasks.md` or
     `docs/<TICKET_KEY>-tasks.md`. On `TASK_VALIDATION: BLOCKED` or `ERROR`, it
     does not write the final artifact.
   - Continue to the minimal Stage 3 `stage-validator` gate only when
     `TASK_VALIDATION: PASS`; that gate confirms the final artifact and
     `## Validation Report` exist.
   - If `TASK_VALIDATION: FAIL`, `BLOCKED`, or `ERROR`, stop the run before the
     Stage 3 `stage-validator` gate and before `postpipeline`.
5. **Postpipeline gate**
   - Run this gate only after the Stage 3 `stage-validator` gate passes.
   - Dispatch `stage-validator` for the full downstream contract of the final
     `-tasks.md` artifact.
6. **Targeted retry path**
   - Applies only to `STAGE_VALIDATION: FAIL` at Stage 1, Stage 2, Stage 3, or
     `postpipeline`.
   - Re-dispatch only the stage that produced the failing artifact.
   - Pass only `VALIDATION_ISSUES` plus the original stage inputs.
   - Re-run only the failing gate. If the failing gate is `postpipeline`,
     re-dispatch Stage 3 and then re-run `STAGE=3` plus `STAGE=postpipeline`.
7. **Re-plan path**
   - On `RE_PLAN=true`, load `references/re-plan-cycle.md`.
   - Restart from the earliest affected stage, preserve existing stage
     artifacts, rerun downstream stages whose inputs are no longer valid, and
     finish with `postpipeline`.
   - Skip `preflight` on re-plan unless the Phase 1 snapshot changed or
     otherwise must be revalidated.
   - The re-plan budget (3 iterations) remains separate from the per-gate retry
     budget (3 failed cycles per gate).

---

## Shared Contracts and Semantics

### Shared entry and artifact contract

| Artifact / boundary | Harmonized baseline |
| ------------------- | ------------------- |
| Snapshot entry file | Phase 2 begins from the Phase 1 snapshot at `docs/<ISSUE_SLUG>.md` on GitHub or `docs/<TICKET_KEY>.md` on Jira. |
| Shared snapshot headings | Both pipelines require `## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`, and `## Linked Issues` before planning can start. |
| Platform snapshot headings | GitHub also requires `## Child Issues`, `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, and `## Attachments`. Jira also requires `## Subtasks`, `## Attachments`, and `## Custom Fields`. |
| Stage 1 artifact | `docs/<ISSUE_SLUG>-stage-1-detailed.md` or `docs/<TICKET_KEY>-stage-1-detailed.md` contains the platform summary heading, `## Problem Framing` with six required subsections, `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, `## Tasks`, `## Notes`, and lettered task sections with six required subsections plus `Traces to`. |
| Stage 2 artifact | `docs/<ISSUE_SLUG>-stage-2-prioritized.md` or `docs/<TICKET_KEY>-stage-2-prioritized.md` preserves Stage 1 task content, inserts `## Execution Order Summary`, keeps `## Tasks` as a marker section, renumbers tasks to `## Task N: <Title>`, and adds `**Priority:**`, `**Dependencies / prerequisites:**`, `**Dependency rationale:**` where needed, and `## Dependency Graph`. |
| Final artifact | `docs/<ISSUE_SLUG>-tasks.md` or `docs/<TICKET_KEY>-tasks.md` preserves the validated plan structure and appends `## Validation Report`. |
| Final downstream sections | The final artifact must expose the platform summary heading, `## Execution Order Summary`, `## Problem Framing`, `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, `## Tasks` plus numbered `## Task N` sections, `## Dependency Graph`, and `## Validation Report`. |
| Decisions log | Phase 2 does not add `## Decisions Log`; that section is appended later by Phase 3. |
| Preservation | All planning artifacts are Category A orchestration artifacts. They stay on disk for resume, critique, and recovery and are not part of implementation history. |

### Structured result contract

| Field | Canonical meaning |
| ----- | ----------------- |
| `PLAN: PASS | FAIL | BLOCKED | ERROR` | Stage 1 planner verdict. `BLOCKED` means a prerequisite such as the input snapshot is missing. `FAIL` means the snapshot cannot support a fully actionable plan without human judgment. `ERROR` means an unexpected failure. |
| `PRIORITIZATION: PASS | FAIL | BLOCKED | ERROR` | Stage 2 prioritizer verdict. `FAIL` includes unresolved dependency issues that require judgment. |
| `TASK_VALIDATION: PASS | FAIL | BLOCKED | ERROR` | Stage 3 validator verdict. On `PASS` or `FAIL`, the final artifact is written with `## Validation Report`; on `BLOCKED` or `ERROR`, it is not. The validator's `PASS`, `WARN`, and `FAIL` counts still total 19 checks. |
| `STAGE_VALIDATION: PASS | FAIL | ERROR` | Structural gate verdict. `FAIL` covers missing files, headings, or required fields. `ERROR` is reserved for unexpected failures unrelated to artifact contents. |
| `PLANNING: PASS | FAIL` | Coordinator handoff verdict. `PASS` requires `PLAN: PASS`, `PRIORITIZATION: PASS`, `TASK_VALIDATION: PASS`, and `PASS` from every validator gate. |
| `Failure category` | Shared enum `PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE`. This enum was not changed in this pass. |

### Coordinator return handoff

| Field | Harmonized baseline |
| ----- | ------------------- |
| Identifier line | `ISSUE_SLUG: <ISSUE_SLUG>` on GitHub or `TICKET_KEY: <TICKET_KEY>` on Jira |
| `File` | `<final file path or "not written">`, matching the coordinator runtime handoff template exactly. Earlier failures naturally yield `not written`, while later failures may occur after a final artifact was written, but that timing note is explanatory only and does not add a stricter runtime rule. |
| `Tasks` | Final task count from the validated plan |
| `Cross-cutting questions` | Count from the final validated plan |
| `Validation warnings` | Warning count from the Stage 3 validator summary |
| `Failure category` | One of `PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE` |
| `Reason` | Single-line explanation. On validator `ERROR`, it must explicitly state that the validator errored. |
| `Artifacts preserved` | Comma-separated list of the on-disk planning artifacts kept for resume, critique, and recovery |

### Gate-handling semantics after this pass

| Outcome | Coordinator behavior |
| ------- | -------------------- |
| Stage subagent returns `FAIL`, `BLOCKED`, or `ERROR` | Stop immediately and return `PLANNING: FAIL` with the current stage's failure category. |
| Validator returns `FAIL` at `preflight` | Stop immediately and return `PLANNING: FAIL` with `Failure category: PREFLIGHT`. |
| Validator returns `FAIL` at Stage 1, Stage 2, or Stage 3 | Enter the targeted retry loop for the current stage only. |
| Validator returns `FAIL` at `postpipeline` | Re-dispatch Stage 3 with `VALIDATION_ISSUES`, then re-run `STAGE=3` and `STAGE=postpipeline` only. |
| Validator returns `ERROR` at any gate | Stop at the current gate, return `PLANNING: FAIL`, keep the existing stage-specific `Failure category`, require `Reason` to state that the validator errored, and do not enter the targeted retry loop. |
| Retry budgets | Maximum 3 targeted fix cycles per gate and maximum 3 critique-driven re-plan cycles. These budgets are tracked separately. |

The explicit `STAGE_VALIDATION: ERROR` row above is the only approved runtime
behavior change recorded in this pass. The `File` clarification above is
explanatory only and does not introduce an additional runtime behavior change.

---

## Subagent Dispatch Conventions and Orchestrator Boundaries

- The coordinator reads a subagent definition only when it is about to dispatch
  that subagent.
- `references/re-plan-cycle.md` is read only for re-plan or recovery paths.
- The templates are loaded only by `task-planner` or
  `dependency-prioritizer` at document-assembly time.
- The coordinator's direct responsibilities are limited to choosing the
  execution path, deriving the correct identifier and file-path form for its
  platform, dispatching the correct subagent, enforcing the gate policy, and
  relaying concise summaries upward.
- The coordinator does not decompose work, prioritize dependencies, validate
  plan quality, or rewrite plan content inline.
- `task-planner` owns problem framing, task decomposition, and stage 1 assembly.
- `dependency-prioritizer` owns renumbering, dependency annotations, execution
  ordering, and dependency graph construction.
- `task-validator` owns the 19-check quality pass, mechanical fixes with one
  correct structural answer, and appending `## Validation Report`.
- `stage-validator` owns structural gate checks only. Missing files, headings,
  or required fields are `FAIL`, not `ERROR`.
- The orchestrator retains only decision-relevant handoff data: stage status,
  validator verdict, output file path, validator issues list, retry count for
  the current gate, and preserved artifact paths.
- This spec file is not a runtime input and must never be added as a read step
  in either planning workflow.

---

## Platform-Specific Divergence Boundaries

| Area | GitHub baseline to preserve | Jira baseline to preserve |
| ---- | --------------------------- | ------------------------- |
| Primary identifier and paths | `ISSUE_SLUG` drives `docs/<ISSUE_SLUG>...` paths | `TICKET_KEY` drives `docs/<TICKET_KEY>...` paths |
| Downstream compatibility note | Downstream phases use `TICKET_KEY`-oriented handoffs; in the GitHub workflow `TICKET_KEY` and `ISSUE_SLUG` are the same string | No alias mapping is required |
| Stage 1 / Stage 2 / final summary heading | `## Issue Summary` | `## Ticket Summary` |
| Preflight work-item heading | `## Child Issues` | `## Subtasks` |
| Additional preflight stable-context headings | `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, `## Attachments` | `## Attachments`, `## Custom Fields` |
| Stage 1 decomposition guidance | Respect existing GitHub child issues and avoid duplicate planning of tracked child issues | Respect existing Jira subtasks and avoid duplicate planning of tracked subtasks |
| Stage 3 coverage wording | Account for every retrieved child issue in `## Child Issues` | Account for every retrieved subtask in `## Subtasks` |
| Downstream creation skill | `creating-github-child-issues` consumes `## Execution Order Summary` and numbered tasks | `creating-jira-subtasks` consumes `## Execution Order Summary` and numbered tasks |
| Vocabulary | Issue-oriented wording throughout outputs and examples | Ticket-oriented wording throughout outputs and examples |

These differences are platform-native and were explicitly preserved during this
harmonization pass.

---

## Decisions From This Harmonization Pass

### Phase 0 findings

- The paired planning workflows were already structurally aligned at the stage
  and artifact level.
- The subagent, reference, and template layer was already internally coherent
  and did not show a separate harmonization gap.
- The confirmed gap was limited to how the two coordinator `SKILL.md` files
  documented and handled validator `ERROR` outcomes at the gate level.

### Phase 1 authoritative decisions

- This spec is audit and change-control guidance only; runtime authority stays
  in the self-contained skill-local files.
- Preserve platform-specific differences, including:
  - `ISSUE_SLUG` vs `TICKET_KEY`
  - `## Issue Summary` vs `## Ticket Summary`
  - GitHub `## Child Issues` plus GitHub metadata sections vs Jira `## Subtasks`
    plus Jira `## Custom Fields`
  - Downstream skill names `creating-github-child-issues` vs
    `creating-jira-subtasks`
- The autonomous fix boundary for this pass was limited to the two coordinator
  `SKILL.md` files plus this spec file.
- Explicit non-goals for this pass were no platform-behavior changes, no
  subagent edits, and no style or cosmetic cleanup.

### Phase 2 approved change and rationale

- Both `stage-validator` subagents already documented `STAGE_VALIDATION: ERROR`
  as a valid outcome for unexpected failures.
- Leaving `ERROR` implicit in the coordinator contracts created a real contract
  gap: the child schema allowed a terminal state that the parent contract did
  not name explicitly.
- The approved fix made validator `ERROR` explicit at every gate in both
  coordinators and kept it terminal at the current gate.
- On validator `ERROR`, coordinators now stop immediately, return
  `PLANNING: FAIL`, use the existing stage-specific `Failure category`, and
  require `Reason` to say that the validator errored.
- Targeted retry loops remain reserved for `STAGE_VALIDATION: FAIL`, preserving
  the existing distinction between expected structural failures and unexpected
  execution failures.
- Supporting wording clarifications were applied only where needed to keep the
  coordinator contracts internally coherent and render-safe. No other runtime
  behavior changed.

---

## Lower-Layer Re-Audit Result

- The paired `task-planner`, `dependency-prioritizer`, `task-validator`, and
  `stage-validator` subagents were re-audited after the coordinator fix.
- The paired `task-planner-template.md`,
  `dependency-prioritizer-template.md`, and `references/re-plan-cycle.md` files
  were also re-audited.
- No harmonization edits were required in that subagent/reference/template
  layer.
- Runtime authority for those files remains local to each skill directory.

---

## Non-goals / Change-Control Boundaries

- Do not make either planning skill, any subagent, any template, or any
  reference file depend on this spec at runtime.
- Do not change platform-specific identifiers, headings, metadata sections, or
  downstream skill names without new approval.
- Do not change the shared `Failure category` enum.
- Do not broaden targeted retry loops to include `STAGE_VALIDATION: ERROR`.
- Do not change stage artifact paths, required headings, task subsection names,
  or final handoff fields without updating the paired skill-local contracts in
  lockstep and getting explicit approval when semantics change.
- Do not edit the subagent/reference/template layer for this harmonization pair
  unless a new audited gap is identified and approved.
- Do not change re-plan semantics, artifact-preservation behavior, or retry
  budgets without explicit approval.
- Do not use symmetry alone as a reason to remove platform-native terminology
  or structure.
- Do not perform style-only or cosmetic cleanup as part of this pass.

---

## Future Harmonization Checklist

- If a validator outcome changes, update both coordinator `SKILL.md` files and
  both `stage-validator` subagents together.
- If a section heading, task-field name, or artifact path changes, update the
  paired templates, validators, and downstream consumer contracts in lockstep.
- If retry semantics are touched, keep `FAIL` and `ERROR` distinct and confirm
  whether the change is behavioral or documentation-only.
- Re-audit the subagent/reference/template layer before editing it; do not
  assume coordinator drift implies lower-layer drift.
- Preserve runtime self-containment: this spec records the baseline but is never
  part of execution.
