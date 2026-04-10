# Planning Pipeline Specification

> **This document is the canonical reference for the three-stage planning
> pipeline shared by `planning-jira-tasks` and `planning-github-issue-tasks`.**
>
> When you change the pipeline, the contracts, the retry rules, or the
> validation checks, change **this document first**, then propagate the change
> to both skills. See the _Change protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic planning
pipeline** that both task-planning skills must implement:

- `skills/planning-jira-tasks/` — Jira-specific planning orchestrator
- `skills/planning-github-issue-tasks/` — GitHub-specific planning orchestrator

Each skill runs **exactly one planning pass per invocation**. It validates a
snapshot, decomposes it into a task plan through a three-stage subagent
pipeline (plan → prioritize → validate), validates each stage boundary, and
reports the outcome.

### What this spec covers

- Required input shape and upstream snapshot
- The three-stage pipeline and stage artifacts
- Subagent registry and dispatch contracts
- The 19 validation checks and their severities
- Quality self-check requirements for stage 1 and stage 2
- Execution steps (the locked sequence)
- Targeted retry limits and re-plan cycle
- Output contract (final artifact and return handoff)
- What each concrete skill **may** customize and what it **must not**

### What this spec does not cover

- The individual prose of each subagent definition. Skills may word
  instructions differently as long as behavior, contracts, and outputs match.
- Platform-specific snapshot structures (Jira ticket sections vs GitHub issue
  sections). Those live inside the platform-specific `stage-validator` and
  `task-planner` files.
- The parent orchestrator's logic (`orchestrating-jira-workflow` /
  `orchestrating-github-workflow`). This spec covers only the Phase 2
  planning skill.

## 2. Harness-agnosticism requirements

Both skills must run on **OpenCode, Cursor, and Claude Code** without
modification. That imposes the following rules on every file in both skills:

1. **Do not name runtime-specific tools.** Use neutral phrasing. Say
   "dispatch to a subagent" or "invoke the subagent", not "use the Task
   tool" or "use the Agent tool". Say "the orchestrator loads this reference
   file", not "the orchestrator uses the Read tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` in YAML frontmatter are optional and
   must not be treated as contract by any shared prose.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, no CLI-specific banner formats.
4. **Prefer relative file paths** over anything that resolves differently
   across harnesses (no symlinks, no `file://` URIs, no harness-internal
   indirection).
5. **Do not hardcode cross-skill paths.** Planning skill files must not
   reference parent orchestrator files via `../../orchestrating-*` paths or
   name the parent orchestrator skill in prose. The planning skill is
   self-contained; its contracts are defined here and in its own files, not
   by reference to an external skill.
6. **Do not cross-reference the sibling planning skill.** Neither skill
   should say "same logic as planning-jira-tasks" or "see
   planning-github-issue-tasks". Each skill must be self-contained.

## 3. Vocabulary (placeholders)

This spec uses abstract placeholders. Each concrete skill substitutes them
with its own values:

| Placeholder        | Jira skill                    | GitHub skill                 |
| ------------------ | ----------------------------- | ---------------------------- |
| `TASK_KEY`         | `TICKET_KEY` (e.g. `JNS-6065`) | `ISSUE_SLUG` (e.g. `acme-app-42`) |
| `TASK_TRACKER`     | Jira (subtasks, transitions)  | GitHub (child issues, labels) |
| `SUMMARY_HEADING`  | `## Ticket Summary`           | `## Issue Summary`           |
| `SNAPSHOT_INPUT`   | `TICKET_PATH`                 | `SNAPSHOT_PATH`              |
| `SNAPSHOT_SOURCE`  | `fetching-jira-ticket`        | `fetching-github-issue`      |
| `DOWNSTREAM_CONSUMER` | `creating-jira-subtasks`  | child-issue creation skill   |

When this spec says "the snapshot", it means the Phase 1 output document at
`docs/<TASK_KEY>.md`, regardless of platform.

## 4. Required input shape

The planning skill starts with exactly these inputs:

| Input         | Required | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `TASK_KEY`    | Yes      | Derives every standard artifact path.         |
| `RE_PLAN`     | No       | `true` when Phase 3 critique triggers re-plan.|
| `DECISIONS`   | No       | Decisions from Phase 3 that require changes.  |

Phase 2 is file-driven: `TASK_KEY` is sufficient. The URL used by Phase 1
is not required once the snapshot exists on disk.

## 5. Upstream artifacts (snapshot requirements)

The snapshot must already exist at `docs/<TASK_KEY>.md` with the sections
defined by the platform's Phase 1 skill. The `stage-validator` preflight
enforces the platform-specific minimum heading set.

If any required preflight check fails, treat Phase 1 as incomplete and stop
with a preflight failure.

**Preflight checks are platform-specific.** Jira and GitHub snapshots have
different section structures. Each skill's `stage-validator` defines its own
preflight checklist. The spec locks the *behavior* (preflight must pass
before stage 1) but not the specific headings checked.

## 6. Three-stage pipeline

```
docs/<TASK_KEY>.md (snapshot)
       │
       ▼
┌──────────────────────────┐
│  task-planner            │  → Detailed tasks (what + how)
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  dependency-prioritizer  │  → Dependencies + execution order
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  task-validator          │  → Final validated plan + report
└──────────────────────────┘
         │
         ▼
docs/<TASK_KEY>-tasks.md
```

Each stage writes a **Category A orchestration artifact** that stays on disk
for Phase 3 critique, targeted retries, and workflow resume:

| Stage | File                                     | Produced by              |
| ----- | ---------------------------------------- | ------------------------ |
| 1     | `docs/<TASK_KEY>-stage-1-detailed.md`    | `task-planner`           |
| 2     | `docs/<TASK_KEY>-stage-2-prioritized.md` | `dependency-prioritizer` |
| 3     | `docs/<TASK_KEY>-tasks.md`               | `task-validator`         |

Preserve these planning artifacts on disk. They support resume and critique
workflows, and they stay out of git history as orchestration artifacts.

## 7. Subagent registry

| Subagent                 | Path                                    | Purpose                                               |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| `task-planner`           | `./subagents/task-planner.md`           | Decompose the snapshot and draft the stage 1 plan     |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Annotate dependencies and determine execution order   |
| `task-validator`         | `./subagents/task-validator.md`         | Validate the prioritized plan and append QA findings  |
| `stage-validator`        | `./subagents/stage-validator.md`        | Check preflight, inter-stage, and final output gates  |

Read a subagent definition only when you are about to dispatch that
subagent. Do not read stage artifacts inline unless a validator or subagent
contract explicitly requires it.

## 8. Dispatch contracts

The orchestrator passes only structured inputs between subagents.

| Subagent                | Required inputs                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| `stage-validator`       | `TASK_KEY`, `STAGE`, `FILE_PATH`                                       |
| `task-planner`          | `TASK_KEY`, `INPUT_PATH`, `OUTPUT_PATH`; optional `DECISIONS`, `VALIDATION_ISSUES` |
| `dependency-prioritizer`| `TASK_KEY`, `INPUT_PATH`, `OUTPUT_PATH`; optional `DECISIONS`, `VALIDATION_ISSUES` |
| `task-validator`        | `TASK_KEY`, `SNAPSHOT_INPUT`, `PLAN_PATH`, `OUTPUT_PATH`; optional `VALIDATION_ISSUES` |

`STAGE` values: `preflight`, `1`, `2`, `3`, `postpipeline`.

The generic names above (`TASK_KEY`, `SNAPSHOT_INPUT`) map to
platform-specific variable names in each skill. See the _Divergence register_
(section 16) for the full mapping.

The orchestrator reads **exactly one subagent definition per dispatch**, and
never preloads the full subagent tree.

## 9. Stage 1: task-planner contract

### Output structure

Write to `OUTPUT_PATH` in this order:

1. `SUMMARY_HEADING` (platform-specific)
2. `## Problem Framing` with all six subsections:
   - `### End User`
   - `### Underlying Need`
   - `### Proposed Solution`
   - `### Solution-Problem Fit`
   - `### Alternative Approaches Not Explored`
   - `### Evidence Basis`
3. `## Assumptions and Constraints`
4. `## Cross-Cutting Open Questions`
5. `## Tasks` (lettered: Task A, Task B, ...)
6. `## Notes`

### Six stage 1 task subsections

Each task must have these six subsections plus an embedded `Traces to` line:

- `**Objective:**`
- `**Relevant requirements and context:**`
- `**Questions to answer before starting:**`
- `**Implementation notes:**`
- `**Definition of done:**`
- `**Likely files / artifacts affected:**`

### Decomposition target

4–15 tasks. Explain exceptions in `## Notes`.

### Quality self-check (stage 1)

Before writing the file, verify:

- Problem Framing has all six subsections.
- Any inferred content is clearly marked as inference.
- Every requirement in the snapshot's description section has at least one
  task or an explicit deferral in `## Notes`.
- Every acceptance criterion maps to at least one task's Definition of done.
- Every task has all six required subsections.
- Every task has a `Traces to` reference back to the snapshot.
- Open questions are in the right place: cross-cutting vs per-task.
- Task count is appropriate, with `## Notes` explaining any range exception.

### Return format

```text
PLAN: PASS | FAIL | BLOCKED | ERROR
<TASK_KEY_LABEL>: <TASK_KEY>
File: <OUTPUT_PATH or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Assumptions: <N>
Reason: <one line>
```

Where `<TASK_KEY_LABEL>` is `Ticket` for Jira and `Issue` for GitHub.

### Escalation categories

- **BLOCKED** — prerequisite missing (e.g. `/writing-plans` or `INPUT_PATH`)
- **FAIL** — snapshot too vague for a fully actionable plan
- **ERROR** — unexpected failure (filesystem, tool access)

## 10. Stage 2: dependency-prioritizer contract

### Output structure

Preserve stage 1 content and add only:

- Renumbered task headings in execution order
- `**Priority:**` annotations on every task
- `**Dependencies / prerequisites:**` annotations on every task
- `**Dependency rationale:**` text for meaningful relationships
- `## Execution Order Summary` — inserted immediately after `SUMMARY_HEADING`
  and before `## Problem Framing`
- `## Dependency Graph` — appended at end of document

After renumbering, every dependency reference uses the new task number with
the original letter label in parentheses for traceability.

### Dependency classifications

- **Hard** — task cannot start until dependency completes
- **Soft** — useful but not strictly required
- **Parallel** — tasks can proceed independently

Conservative bias: if unsure, call it soft unless shared-file risk makes it
mandatory.

### Prioritization scoring

Score each task 1–5 on: Risk, Complexity, Value unlock, Dependency.

Ordering rules (priority order):

1. Respect hard dependencies.
2. Front-load high-risk tasks.
3. Front-load high-value-unlock tasks.
4. Defer low-risk, low-complexity tasks when nothing depends on them.
5. Group related tasks when it reduces context switching without violating
   the dependency graph.

Final order must be a valid topological sort.

### Quality self-check (stage 2)

Before writing the file, verify:

- Every task has a `**Priority:**` annotation.
- Every task has a `**Dependencies / prerequisites:**` section.
- Every dependency reference points to a valid renumbered task.
- No hard dependency is violated by the final order.
- `## Execution Order Summary` and `## Dependency Graph` are present.
- Original stage 1 task content is preserved except for required stage 2
  annotations and renumbering.

### Return format

```text
PRIORITIZATION: PASS | FAIL | BLOCKED | ERROR
<TASK_KEY_LABEL>: <TASK_KEY>
File: <OUTPUT_PATH or "not written">
Tasks: <N>
Critical path length: <N>
Parallel groups: <N>
Reason: <one line>
```

### Escalation categories

- **BLOCKED** — prerequisite missing (e.g. `/writing-plans` or `INPUT_PATH`)
- **FAIL** — unresolved circular dependency or input plan too incomplete
- **ERROR** — unexpected failure (filesystem, tool access)

Both the return format and escalation format use the same schema so the
orchestrator parses one structure for success and failure cases.

## 11. Stage 3: task-validator contract

### Validation checks (19 total)

#### Coverage

| #   | Check                                                         | Severity |
| --- | ------------------------------------------------------------- | -------- |
| 1   | Every requirement in the snapshot description is addressed    | FAIL     |
| 2   | Every acceptance criterion maps to at least one task's DoD    | FAIL     |
| 3   | Platform-specific child-item coverage (subtasks or child issues) | WARN  |
| 4   | Actionable comments (decisions, clarifications) are reflected | WARN     |

Check 3 is **platform-specific**: Jira checks subtask coverage, GitHub
checks retrieved child issue coverage. The check text may differ but the
severity and purpose are locked.

#### Structure

| #   | Check                                                 | Severity |
| --- | ----------------------------------------------------- | -------- |
| 5   | Every task has all 6 core subsections                 | FAIL     |
| 6   | Every task has a Dependencies annotation              | FAIL     |
| 7   | Every task has a Priority annotation                  | WARN     |
| 8   | Task numbering is sequential with no gaps             | FAIL     |
| 9   | Execution Order Summary table is present and complete | WARN     |
| 10  | Dependency Graph section is present                   | WARN     |

**Check 5 validates the six stage-1 subsections** (Objective, Relevant
requirements and context, Questions to answer before starting, Implementation
notes, Definition of done, Likely files / artifacts affected). Checks 6 and
7 validate the two stage-2 additions separately because they carry different
severities: Dependencies is FAIL, Priority is WARN.

#### Consistency

| #   | Check                                                      | Severity |
| --- | ---------------------------------------------------------- | -------- |
| 11  | No circular dependencies                                   | FAIL     |
| 12  | Hard dependency references point to valid task numbers     | FAIL     |
| 13  | No task is ordered before its hard dependency              | FAIL     |
| 14  | No two tasks have identical objectives                     | WARN     |
| 15  | Cross-cutting questions do not duplicate per-task questions | WARN     |

#### Quality

| #   | Check                                                        | Severity |
| --- | ------------------------------------------------------------ | -------- |
| 16  | No vague DoD ("works", "is complete", "functions properly")  | WARN     |
| 17  | Task count is appropriate for snapshot scope                 | WARN     |
| 18  | No empty or "TBD" Implementation Notes                       | WARN     |
| 19  | Assumptions are numbered and referenced by at least one task | WARN     |

### Severity handling

- **FAIL items** — fix directly only when mechanical (numbering gaps, missing
  headings, broken references). If fixing requires planning judgment, leave
  plan content intact and record in `### Unresolved Issues`.
- **WARN items** — note in report for downstream awareness. Do not block the
  artifact unless they also imply a FAIL-severity structural break.

### Write policy

- Preserve task ordering and substantive task content.
- Apply targeted fixes first when `VALIDATION_ISSUES` are present, then
  rerun the full validator so the report reflects the final artifact state.
- When a problem requires planning judgment, leave plan content intact and
  record it in `### Unresolved Issues`.

### Output format

Write the full validated plan to `OUTPUT_PATH`, then append:

- `## Validation Report` with subsections:
  - `### Summary` (PASS/WARN/FAIL counts)
  - `### Check Results` (all 19 checks)
  - `### Fixes Applied`
  - `### Unresolved Issues`
  - `### Warnings`

### Return format

```text
TASK_VALIDATION: PASS | FAIL | BLOCKED | ERROR
<TASK_KEY_LABEL>: <TASK_KEY>
File: <OUTPUT_PATH or "not written">
PASS: <N>
WARN: <N>
FAIL: <N>
Reason: <one line>
```

### Escalation categories

- **BLOCKED** — `SNAPSHOT_INPUT` or `PLAN_PATH` is missing
- **FAIL** — validation completed, one or more FAIL-severity issues remain
- **ERROR** — unexpected failure (filesystem, tool access)

## 12. Stage-validator contract

### Purpose

Structural validation at every pipeline boundary. Reports only structured
verdicts, never file contents.

### Stage checks

| Stage         | Artifact                                  | Checks                                              |
| ------------- | ----------------------------------------- | --------------------------------------------------- |
| `preflight`   | `docs/<TASK_KEY>.md`                      | Platform-specific snapshot heading set               |
| `1`           | `docs/<TASK_KEY>-stage-1-detailed.md`     | `SUMMARY_HEADING`, Problem Framing (6 subs), A&C, CCOQ, 2+ tasks with 6 subsections + Traces to |
| `2`           | `docs/<TASK_KEY>-stage-2-prioritized.md`  | Dependencies, Priority, sequential numbering, EOS, Dep Graph |
| `3`           | `docs/<TASK_KEY>-tasks.md`                | `## Validation Report` present                       |
| `postpipeline`| `docs/<TASK_KEY>-tasks.md`                | Full downstream contract: all required sections + all 8 task subsections |

### Verdicts

- `PASS` — artifact exists and satisfies every required check
- `FAIL` — artifact missing or any required section/field missing
- `ERROR` — unexpected failure unrelated to artifact contents

Missing files, sections, and fields are `FAIL`, not `ERROR`.

### Output format

```text
## Stage Validation: <STAGE>

- **File:** <FILE_PATH>
- **Verdict:** PASS | FAIL | ERROR
- **Checks passed:** <N> / <total> | n/a
- **Issues:** <bulleted list of failures, or "None">
```

## 13. Output contract

### Final artifact

Path: `docs/<TASK_KEY>-tasks.md`

Required sections in document order:

1. `SUMMARY_HEADING`
2. `## Execution Order Summary`
3. `## Problem Framing` (with all six subsections)
4. `## Assumptions and Constraints`
5. `## Cross-Cutting Open Questions`
6. `## Tasks` (with numbered task entries)
7. `## Dependency Graph`
8. `## Validation Report`

The section ordering above reflects the **actual document structure** after
all three stages complete. `## Execution Order Summary` appears second
(inserted by stage 2 after `SUMMARY_HEADING`), not at the bottom.

### Eight final task subsections

Each numbered task in the final artifact has all eight subsections:

Six stage-1 subsections:
- `**Objective:**`
- `**Relevant requirements and context:**`
- `**Questions to answer before starting:**`
- `**Implementation notes:**`
- `**Definition of done:**`
- `**Likely files / artifacts affected:**`

Two stage-2 additions:
- `**Dependencies / prerequisites:**`
- `**Priority:**`

Phase 2 does **not** add `## Decisions Log`; that artifact is appended later
by Phase 3.

### Return handoff

```text
PLANNING: PASS | FAIL
<TASK_KEY_LABEL>: <TASK_KEY>
File: <final file path or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```

## 14. Execution steps

### Orchestrator identity

The planning skill does exactly three things:

- **Dispatch** the planning subagents in sequence.
- **Validate** each artifact boundary with `stage-validator`.
- **Report** only stage verdicts and summary counts to the parent workflow.

The orchestrator keeps only decision-relevant handoff data between stages:

- The validator verdict
- The output file path for the passing stage
- The specific issues that failed the current gate
- Retry count for the current gate

Do not carry raw plan content forward in the orchestrator context.

### Execution paths

- **Normal path:** `preflight → stage 1 → stage 2 → stage 3 → postpipeline`
- **Re-plan path:** read `./references/re-plan-cycle.md`, identify the
  earliest affected stage, resume from that stage using preserved on-disk
  artifacts, then rerun every downstream stage and finish with `postpipeline`

Use targeted fix loops only. When a gate fails, re-dispatch the stage that
produced the failing artifact, pass only the validator's issues list, and
re-run only the failing gate. Do not restart already-passing stages unless
the re-plan rules require it.

### Step-by-step sequence

1. **Choose execution path**
   - If `RE_PLAN` is absent or `false`, run the normal path.
   - If `RE_PLAN=true`, read `./references/re-plan-cycle.md`, determine the
     earliest affected stage, and resume from that point using on-disk
     artifacts from the prior run.
   - Start at **Stage 1** when the critique changes snapshot interpretation,
     scope, assumptions, or task decomposition.
   - Start at **Stage 2** when the stage 1 task content is still valid but
     ordering, dependencies, or priority need to change.
   - Start at **Stage 3** when only the final validated artifact or report
     needs correction.
   - After rerunning the earliest affected stage, rerun every downstream
     stage and finish with the post-pipeline gate. Skip preflight on a
     re-plan unless the snapshot itself changed.

2. **Preflight**
   Dispatch `stage-validator` with:
   - `TASK_KEY=<TASK_KEY>`
   - `STAGE=preflight`
   - `FILE_PATH=docs/<TASK_KEY>.md`

   If the verdict is FAIL, stop and return `PLANNING: FAIL` with
   `Failure category: PREFLIGHT`.

3. **Stage 1 — Plan**
   Dispatch `task-planner` with:
   - `TASK_KEY=<TASK_KEY>`
   - `INPUT_PATH=docs/<TASK_KEY>.md`
   - `OUTPUT_PATH=docs/<TASK_KEY>-stage-1-detailed.md`
   - `DECISIONS=<DECISIONS>` only when Stage 1 is part of a re-plan
   - `VALIDATION_ISSUES=<issues list>` only when retrying after a failed gate

   Then dispatch `stage-validator` with `STAGE=1` and
   `FILE_PATH=docs/<TASK_KEY>-stage-1-detailed.md`.

4. **Stage 2 — Prioritize**
   Dispatch `dependency-prioritizer` with:
   - `TASK_KEY=<TASK_KEY>`
   - `INPUT_PATH=docs/<TASK_KEY>-stage-1-detailed.md`
   - `OUTPUT_PATH=docs/<TASK_KEY>-stage-2-prioritized.md`
   - `DECISIONS=<DECISIONS>` only when Stage 2 is part of a re-plan
   - `VALIDATION_ISSUES=<issues list>` only when retrying after a failed gate

   Then dispatch `stage-validator` with `STAGE=2` and
   `FILE_PATH=docs/<TASK_KEY>-stage-2-prioritized.md`.

5. **Stage 3 — Validate**
   Dispatch `task-validator` with:
   - `TASK_KEY=<TASK_KEY>`
   - `SNAPSHOT_INPUT=docs/<TASK_KEY>.md`
   - `PLAN_PATH=docs/<TASK_KEY>-stage-2-prioritized.md`
   - `OUTPUT_PATH=docs/<TASK_KEY>-tasks.md`
   - `VALIDATION_ISSUES=<issues list>` only when retrying or repairing
     a failed post-pipeline gate

   Then dispatch `stage-validator` with `STAGE=3` and
   `FILE_PATH=docs/<TASK_KEY>-tasks.md`.

6. **Post-pipeline gate**
   Dispatch `stage-validator` with:
   - `TASK_KEY=<TASK_KEY>`
   - `STAGE=postpipeline`
   - `FILE_PATH=docs/<TASK_KEY>-tasks.md`

   This confirms the full output contract for downstream phases.

7. **Targeted retry loop**
   For any failing gate:
   - Collect only the validator's issues list.
   - Re-dispatch only the stage that produced that artifact.
   - Pass the original inputs plus `VALIDATION_ISSUES=<issues list>`.
   - Re-run only the previously failing validator gate.
   - If the failed gate is `postpipeline`, re-dispatch Stage 3 with
     `VALIDATION_ISSUES`, then rerun `STAGE=3` and `STAGE=postpipeline`.
   - Stop after 3 failed cycles for the same gate and return
     `PLANNING: FAIL` with the relevant failure category.

8. **Report**
   On success, return the completion handoff from the output contract.
   Include the final file path, task count, cross-cutting question count,
   warning count, and preserved artifact paths. State explicitly that
   planning is complete and implementation has not started.

## 15. Retry and re-plan limits

### Targeted fix cycles

- Maximum **3** cycles per gate.
- If the same gate still fails after the third cycle, stop and report.

### Re-plan cycles

- Maximum **3** re-plan iterations driven by Phase 3 critique.
- If Phase 3 critique still has unresolved concerns after 3 cycles, escalate
  to the user.
- Re-plan budget is **separate** from per-gate targeted fix budget.

### Error handling

- If any subagent fails, stop the pipeline. Report the failure with the
  stage number and the subagent's structured summary.
- If a `stage-validator` check fails, re-dispatch only the stage that
  produced that artifact. Pass the validator's issues list as
  `VALIDATION_ISSUES`, then re-run only that failing gate.
- Intermediate files are always preserved — never deleted, regardless of
  success or failure.

## 16. Divergence register

The following sections are **locked to this spec**. Both skills must express
the same contract; wording may differ but behavior must not.

- Required input shape (section 4)
- Three-stage pipeline and stage artifacts (section 6)
- Subagent registry (section 7)
- Dispatch contracts table (section 8)
- Stage 1 output structure, six task subsections, quality self-check,
  return format, and escalation categories (section 9)
- Stage 2 output structure, dependency classifications, prioritization
  scoring, quality self-check, return format, and escalation categories
  (section 10)
- The 19 validation checks and their severities, with check 5 saying
  **"6 core subsections"** (section 11)
- Severity handling, write policy, and common mistakes (section 11)
- Stage-validator stages, verdicts, and output format (section 12)
- Output contract section ordering, eight final task subsections, and
  return handoff format (section 13)
- Execution steps sequence (section 14)
- Retry limits and error handling (section 15)

The following are **platform-specific** and are expected to differ:

- The `TASK_KEY` variable name (`TICKET_KEY` vs `ISSUE_SLUG`).
- The summary heading (`## Ticket Summary` vs `## Issue Summary`).
- The snapshot input variable name (`TICKET_PATH` vs `SNAPSHOT_PATH`).
- The snapshot preflight checks (different section structures).
- Validation check 3 wording (subtask vs child issue coverage).
- The return format label (`Ticket:` vs `Issue:`).
- The `task-planner` decomposition guidance for platform-specific items
  (GitHub adds child issue and linked issue guidance).
- The `task-planner` Traces to guidance specificity.
- The `task-planner-template` and `dependency-prioritizer-template`
  platform substitutions.
- The parent orchestrator references in the SKILL.md description
  frontmatter.
- The downstream consumer references in the output contract table.
- The compatibility paragraph (GitHub only, for `TICKET_KEY`/`ISSUE_SLUG`
  equivalence).

Anything else that diverges should either be harmonized or explicitly noted
here as an intentional platform difference.

## 17. Change protocol

When the planning pipeline needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update `planning-jira-tasks`** to match. Touch `SKILL.md`, the
   reference file, and any affected subagents.
3. **Update `planning-github-issue-tasks`** to match, using the same edits
   where the content is shared.
4. **Verify alignment.** Re-read both skills' `SKILL.md`, subagent files,
   and reference files side by side and confirm they express the same
   contract in the same order. Differences must map to an entry in the
   divergence register (section 16).
5. **Do not add a feature to one skill only.** If a behavior is valuable in
   one planning skill, it is valuable in both. Changes that only make sense
   for one platform belong inside a platform-specific subagent or template,
   not in the shared pipeline.

This spec is intentionally denser than a skill file. It exists to be read by
the human author (or a future agent) at change time, not every planning run.
Neither skill loads this file during normal operation.
