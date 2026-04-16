# Execution Pipeline Harmonization Spec - Issue/Ticket Task Creation

> Canonical reference for the final harmonized baseline between
> `skills/creating-github-child-issues` and `skills/creating-jira-subtasks`.
>
> This document is audit and change-control guidance only. The coordinator
> skills, `references/phase-4-io-contracts.md` files, subagents, and templates
> remain self-contained and must not depend on this file at runtime.

---

## Scope

This spec applies only to `creating-github-child-issues` and
`creating-jira-subtasks`.

- Record the shared contract definitions, shared Phase 4 execution flow,
  dispatch boundaries, intentional platform divergences, documentation-model
  consolidation, and change-control decisions established in this
  harmonization pass.
- Cover these runtime artifacts:
  - `skills/creating-github-child-issues/SKILL.md`
  - `skills/creating-github-child-issues/references/phase-4-io-contracts.md`
  - `skills/creating-github-child-issues/subagents/task-issue-creator.md`
  - `skills/creating-github-child-issues/subagents/task-issue-creator-templates.md`
  - `skills/creating-jira-subtasks/SKILL.md`
  - `skills/creating-jira-subtasks/references/phase-4-io-contracts.md`
  - `skills/creating-jira-subtasks/subagents/subtask-creator.md`
  - `skills/creating-jira-subtasks/subagents/subtask-creator-templates.md`
- Preserve the rule that runtime truth stays in the skill-local files above.
  This spec documents the harmonized state; it does not replace skill-local
  contracts.

---

## Skills Covered

| Platform | Coordinator skill | Normative Phase 4 contract | Creator subagent | Templates | Primary artifact | Top-level verdict family |
| -------- | ----------------- | -------------------------- | ---------------- | --------- | ---------------- | ------------------------ |
| GitHub | `skills/creating-github-child-issues/SKILL.md` | `skills/creating-github-child-issues/references/phase-4-io-contracts.md` | `task-issue-creator` | `task-issue-creator-templates.md` | `docs/<ISSUE_SLUG>-tasks.md` | `TASK_ISSUES` |
| Jira | `skills/creating-jira-subtasks/SKILL.md` | `skills/creating-jira-subtasks/references/phase-4-io-contracts.md` | `subtask-creator` | `subtask-creator-templates.md` | `docs/<TICKET_KEY>-tasks.md` | `SUBTASKS` |

---

## Final Harmonized Baseline

| Area | Authoritative baseline |
| ---- | ---------------------- |
| Structural alignment | Both runtime Phase 4 skills now share the same coordinator shape: read bundled files, derive identifiers from the parent URL, dispatch one creation specialist, and relay only its structured summary. |
| Shared workflow goal | Both runtime Phase 4 workflows reconcile clarified plan tasks into stable linkage, update the local `-tasks.md` artifact in place, validate it, and return a concise routing summary. |
| Documentation model | Each skill's `references/phase-4-io-contracts.md` file is the only normative Phase 4 contract source. `SKILL.md`, the creator subagent, and the templates are role-specific derivatives and must not redefine the contract independently. |
| Orchestrator boundary | Coordinators own dispatch, routing, and caller-facing reporting only. Plan parsing, parent verification, platform writes, plan-file edits, and post-write validation stay inside the creator subagent. |
| Top-level verdict family | GitHub preserves `TASK_ISSUES`; Jira preserves `SUBTASKS`. No cross-platform consumer normalization is required for this pair. |
| GitHub-native divergence | Preserve `gh` as the primary transport, explicit capability detection, multi-path write behavior, and the HTML machine handoff comment in the plan artifact. |
| Jira-native divergence | Preserve Jira's single native subtask path and the absence of GitHub-style `Write model:` and `Capability:` lines in Jira Phase 4 reporting. |
| Stable identifier reporting | GitHub summaries always include `ISSUE_SLUG:`. Jira summaries now explicitly include `TICKET_KEY:` on every structured summary, including early exits. |
| Scope of pass Phase 2 | Harmonization pass Phase 2 was a documentation and contract consolidation pass only. No workflow behavior, status semantics, repair or validation logic, or tool or harness assumptions were changed. |
| Pass-approved runtime edit surface | The harmonization pass Phase 2 runtime edit surface for this pair was the eight skill-local files listed in `## Scope`. This spec file is the pass Phase 3 artifact. |

---

## Runtime Phase 4 Flow

1. The parent workflow enters Phase 4 only after the clarified plan exists and
   the user has explicitly approved platform writes.
2. The coordinator receives the platform-specific parent URL (`ISSUE_URL` or
   `JIRA_URL`) and derives the stable identifier it needs for reporting and
   artifact-path references.
3. The coordinator reads the bundled creator subagent definition only when it
   is about to dispatch it.
4. The coordinator dispatches exactly one creation specialist and passes the
   full parent URL downstream rather than a reduced identifier-only payload.
5. The creator subagent loads `docs/<ISSUE_SLUG>-tasks.md` or
   `docs/<TICKET_KEY>-tasks.md`, treats numbered `## Task <N>:` sections as the
   Phase 4 parse boundary, preserves `## Execution Order Summary` when present,
   and records whether `## Decisions Log` is present.
6. The creator verifies the parent issue or ticket before creating any child
   work item.
7. The creator captures existing linkage already present in the plan,
   re-verifies that it is safe to reuse, and treats unsafe or mismatched
   existing refs as terminal `BLOCKED` conditions rather than silently
   replacing them.
8. The creator creates only missing work items sequentially and continues past
   individual create failures when the platform contract allows partial
   visibility.
9. The creator updates only the local `-tasks.md` artifact in place, inserting
   or refreshing the platform-specific Phase 4 section or table plus the
   required per-task inline reference lines.
10. The creator re-reads the updated artifact, validates it against the
   skill-local Phase 4 contract reference, and performs a targeted local repair
   pass if needed. Repair is local-file-only and does not create new issues or
   subtasks.
11. The creator returns only the structured summary defined by its
   `references/phase-4-io-contracts.md` file.
12. The coordinator routes only on the structured result fields and relays only
   the caller-facing rollup. It does not parse the plan, inspect raw tracker
   payloads, or reconstruct the contract schema inline.

---

## Shared Contracts and Semantics

### Documentation model and contract authority

| Layer | Harmonized rule |
| ----- | --------------- |
| `references/phase-4-io-contracts.md` | Sole normative Phase 4 source for the standalone input contract, output artifact contract, structured summary contract, and status or validation semantics. |
| `SKILL.md` | Dispatch, routing, and caller-facing reporting only. It points readers to `references/phase-4-io-contracts.md` for the complete contract and must not fork that contract locally. |
| Creator subagent | Operational instructions for satisfying the contract. It may require re-opening the reference file before validation or final reporting, but it does not replace the contract source. |
| Templates | Literal fragments and examples only. They show artifact shapes and text fragments but explicitly defer contract semantics to `references/phase-4-io-contracts.md`. |
| This spec | Audit and change-control guidance only. It records the baseline after harmonization and is never a runtime dependency. |

This documentation-model consolidation is a first-class output of this pass.
The harmonization goal was to remove contract-source ambiguity while preserving
the self-contained runtime behavior of each skill.

The rows below summarize the shared contract families for maintenance and
change-control review. They intentionally do not restate the field-level
schemas owned by each skill's `references/phase-4-io-contracts.md`.

### Runtime Phase 4 contract families

| Contract family | Paired baseline |
| --------------- | --------------- |
| Entry boundary | The coordinator receives the full parent URL (`ISSUE_URL` or `JIRA_URL`), and the creator operates on the existing local `docs/<ISSUE_SLUG>-tasks.md` or `docs/<TICKET_KEY>-tasks.md` artifact for that parent. |
| Normal precondition shape | The runtime Phase 4 plan is expected to contain `## Tasks`, numbered `## Task <N>:` sections, `## Execution Order Summary`, and `## Decisions Log`. |
| Parse and reuse boundary | Numbered task sections are the unit of work. Existing child refs or keys must be re-verified before reuse, and unsafe or mismatched linkage remains a terminal `BLOCKED` condition. |
| Local artifact postcondition | The creator updates only the local `-tasks.md` artifact and leaves it with exactly one platform-specific Phase 4 workflow section or table plus exactly one inline linkage line immediately after every numbered task heading. |
| Artifact table shape | The plan-file workflow table has exactly one row per parsed task. `Dependencies` and `Priority` mirror the plan, and the artifact table records current platform `Status` rather than Phase 4 `Outcome`. |
| Structured summary family | Both skills emit a stable structured handoff that includes the top-level verdict family, validation state, parent and stable identifier lines, plan-file path, creation counts, decisions-log presence, reason, created or linked item table, and explicit `Warnings:` / `Failures:` sections. |
| Platform-specific summary extension | GitHub additionally carries `Write model:` and `Capability:` lines plus the HTML handoff comment in the artifact. Jira intentionally does not. |
| Early-exit stability | Stable identifier lines remain present on every summary, including early exits. Header-only created or linked tables are valid only when the run stops before plan updates or create attempts complete. |
| Validation and repair boundary | Each creator validates against its local Phase 4 contract reference and may repair the local markdown artifact once. The repair pass does not create new issues or subtasks. |
| Status family alignment | Both skills preserve the same high-level status family shape: `PASS | WARN | BLOCKED | FAIL | ERROR` with `Validation: PASS | FAIL | NOT_RUN`. Exact field meanings remain authoritative only in the local Phase 4 contract reference files. |

### Runtime precondition scan

| Condition | Runtime Phase 4 handling |
| --------- | ------------------------ |
| `## Tasks` or numbered `## Task <N>:` sections missing | Terminal `BLOCKED` precondition failure |
| `## Decisions Log` missing | Continue, but downgrade the run to warn-eligible rather than blocking it |
| `## Execution Order Summary` missing | Unexpected relative to the normal upstream precondition shape; follow the local contract and parent-workflow expectations |

- At the paired level, `PASS` and `WARN` are the validated-output family,
  `BLOCKED` and `FAIL` are deterministic non-success exits, `ERROR` is the
  unexpected-failure path, and `Validation: NOT_RUN` is reserved for exits
  before plan-file update or post-write validation.
- Harmonization pass Phase 2 preserved those semantics; it did not change
  runtime Phase 4 behavior.

---

## Subagent Dispatch Conventions and Orchestrator Boundaries

- The parent workflow owns Phase 4 gating and explicit user approval for
  writes. The Phase 4 coordinator skill assumes those preconditions already
  hold.
- The coordinator's direct responsibilities are limited to reading bundled
  files, deriving identifiers from the parent URL, dispatching the creator
  subagent, and relaying the creator's structured summary.
- The coordinator does not parse the clarified plan, verify the parent item,
  perform platform writes, repair the plan artifact, or infer outcomes from raw
  tracker payloads.
- The creator subagent owns plan parsing, parent verification, existing-link
  safety checks, child create attempts, plan-file updates, post-write
  validation, and final structured reporting.
- The creator reads the templates only when it reaches description construction
  or plan-update steps.
- The creator re-opens `references/phase-4-io-contracts.md` before validation
  and final reporting so the emitted summary matches the normative contract.
- The orchestrator retains only decision-relevant handoff data: top-level
  verdict, validation state, parent and local identifier lines, plan-file path,
  counts, the created or linked summary table, and warnings or failures.
- If the environment cannot invoke subagents, the coordinator reports the phase
  as blocked rather than reproducing the creator inline.
- This spec file is not a runtime input and must never be added as a read step
  in either task-creation workflow.

---

## Platform-Specific Divergence Boundaries

| Area | GitHub baseline to preserve | Jira baseline to preserve |
| ---- | --------------------------- | ------------------------- |
| Parent input | `ISSUE_URL` | `JIRA_URL` |
| Stable identifier | `ISSUE_SLUG` | `TICKET_KEY` |
| Top-level verdict family | `TASK_ISSUES` | `SUBTASKS` |
| Creator subagent | `task-issue-creator` | `subtask-creator` |
| Transport | `gh` as the primary transport, including `gh issue view`, `gh issue create`, `gh api`, and `gh` capability probes | Jira-capable tools available in the environment for parent lookup, issue-type discovery, existing-link verification, and subtask creation |
| Write-path model | Explicit capability detection, then per-task choice among `native-sub-issue`, `linked-issue`, and `task-list` fallback when needed | Single native Jira subtask path only |
| Plan artifact addition | `## GitHub Task Issues` section with required HTML machine handoff comment, fixed workflow table, and per-task `GitHub Task Issue:` lines | `## Jira Subtasks` section with fixed workflow table and per-task `Jira Subtask:` lines |
| Artifact workflow table columns | `Task`, `Issue ref`, `Title`, `Write model`, `Status`, `Dependencies`, `Priority` | `Task`, `Subtask Key`, `Title`, `Status`, `Dependencies`, `Priority` |
| Summary-only metadata lines | Required `Write model:` and `Capability:` lines on every summary | No `Write model:` or `Capability:` lines |
| Non-created task marker | `Not Created` or `task-list`, depending on the write path and outcome | `Not Created` only |
| Existing-link safety check | Reuse requires verified GitHub issue linkage to the parent, including body or parent-relationship evidence | Reuse requires verifying that the Jira issue exists and its parent is the current ticket |
| Placement note | `## GitHub Task Issues` is inserted after `## Issue Summary` when present, otherwise after the first top-level heading | `## Jira Subtasks` is inserted after `## Ticket Summary` when present, otherwise after the first top-level heading |

These differences are native to the platforms and were explicitly preserved.
The goal of this pass was workflow and system normalization for future
maintenance, not a unified cross-platform consumer contract.

---

## Harmonization Pass Decisions

### Pass Phase 0 audit findings

- The paired Phase 4 workflows were already aligned at the system level around
  the same coordinator -> creator -> local artifact update -> validation ->
  structured summary pipeline.
- The main harmonization target was documentation-model drift and contract-source
  ambiguity, not a broken runtime behavior mismatch.
- Platform-native consumer surfaces were already intentionally different and
  needed to stay different: GitHub task issues versus Jira subtasks, GitHub
  write-path metadata versus Jira's single-path reporting.

### Pass Phase 1 locked decisions

- Preserve GitHub `TASK_ISSUES` and Jira `SUBTASKS`; no cross-platform consumer
  normalization is required.
- Preserve GitHub's `gh`-specific tooling, explicit capability detection,
  multi-path write behavior, and HTML machine handoff mechanism.
- Preserve Jira's single native subtask path and the absence of GitHub-style
  `Write model:` and `Capability:` lines.
- Jira runtime Phase 4 summaries now explicitly include `TICKET_KEY:` in the
  structured reporting contract.
- The goal of this pass is workflow and system normalization for future
  maintenance, not a unified cross-platform consumer contract.
- Each skill's `references/phase-4-io-contracts.md` file is the sole normative
  runtime Phase 4 contract source.
- Harmonization pass Phase 2 was a documentation and contract consolidation
  pass only; no workflow behavior, status semantics, repair or validation
  logic, or tool or harness assumptions were changed.
- The approved harmonization pass Phase 2 runtime edit surface was the eight
  skill-local files listed in `## Scope`; this spec file is the pass Phase 3
  artifact.

### Pass Phase 2 approved changes and rationale

- The two `references/phase-4-io-contracts.md` files were elevated to the sole
  normative contract source for their respective skills.
- Both coordinator `SKILL.md` files now point to those references for complete
  runtime Phase 4 contract definitions and keep their own responsibility
  limited to dispatch, routing, and caller-facing reporting.
- Both creator subagents now frame themselves as the execution layer for the
  contract, explicitly re-open the reference file before validation and final
  reporting, and avoid presenting themselves as independent contract sources.
- Both templates now state that they are literal fragments and examples only
  and that Phase 4 contract semantics live in the local reference file.
- Jira's structured summary contract now makes `TICKET_KEY:` explicit on every
  runtime Phase 4 report so the stable local identifier is always available
  without importing GitHub-only metadata.
- GitHub kept its `Write model:` and `Capability:` lines plus the HTML handoff
  comment because those fields represent real runtime behavior and auditability
  needs, not accidental documentation drift.
- No workflow behavior changed. The approved work removed contract ambiguity and
  clarified authority boundaries without changing create order, retry policy,
  validation repair behavior, or tool assumptions.

---

## Harmonization Pass Edit Surface

- Pass Phase 2 runtime surface: `skills/creating-github-child-issues/{SKILL.md,references/phase-4-io-contracts.md,subagents/task-issue-creator.md,subagents/task-issue-creator-templates.md}` and `skills/creating-jira-subtasks/{SKILL.md,references/phase-4-io-contracts.md,subagents/subtask-creator.md,subagents/subtask-creator-templates.md}`.
- Pass Phase 3 artifact: `docs/execution-pipeline-harmonization-issue-ticket-task-creation.spec.md`.

---

## Non-goals / Change-Control Boundaries

- Do not make either Phase 4 skill, any reference file, any subagent, or any
  template depend on this spec at runtime.
- Do not rename, collapse, or normalize `TASK_ISSUES` and `SUBTASKS` into a
  shared cross-platform verdict family.
- Do not remove or weaken GitHub's `gh`-specific tooling, capability detection,
  multi-path write behavior, `task-list` fallback, or HTML handoff comment
  without explicit approval.
- Do not add GitHub-style `Write model:` or `Capability:` lines to Jira Phase 4
  reporting.
- Do not replace Jira's single native subtask path with alternate write models
  unless separately approved.
- Do not move normative Phase 4 contract authority out of each skill's
  `references/phase-4-io-contracts.md` file.
- Do not let `SKILL.md`, creator subagents, or templates redefine the contract
  independently of the local Phase 4 contract reference.
- Do not change section names, per-task inline reference formats, workflow
  table column order, or required summary fields without updating the skill-local
  contracts in lockstep and getting approval when semantics change.
- Do not change workflow behavior, status semantics, validation or repair
  behavior, or tool or harness assumptions under the banner of harmonization
  without explicit approval.
- Do not treat symmetry as a reason to remove platform-native terminology,
  metadata, or reporting differences that are intentional.
- Do not expand edits beyond the approved skill-local surface unless a new
  audited mismatch is identified and explicitly approved.

---

## Future Harmonization Checklist

- If a Phase 4 contract field changes, update
  `references/phase-4-io-contracts.md` first in the affected skill, then align
  `SKILL.md`, the creator subagent, and the templates as derivative documents.
- If the coordinator reporting contract changes, preserve the stable identifier
  line on every summary: `ISSUE_SLUG:` on GitHub and `TICKET_KEY:` on Jira.
- If GitHub write-path behavior changes, re-audit the handoff comment, artifact
  workflow table, per-task inline lines, and summary `Write model:` /
  `Capability:` lines together.
- If Jira Phase 4 behavior changes, re-audit the Jira workflow table, per-task
  inline lines, and structured summary together without importing GitHub-only
  metadata unless that expansion is explicitly approved.
- If section names, inline-link formats, or table columns change, update all
  downstream validators, progress trackers, and execution consumers that depend
  on those artifact shapes.
- Keep the creator boundary intact: coordinators route and relay; creators parse,
  write, validate, and summarize.
- Reconfirm the goal before any future parity work: workflow and system
  normalization for maintainability, not cross-platform consumer unification.
- Preserve runtime self-containment. This spec records the harmonized baseline
  but is never part of execution.
