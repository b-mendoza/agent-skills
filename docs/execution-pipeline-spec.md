# Execution Pipeline Specification

> **This document is the canonical reference for the per-task execution
> pipeline shared by `executing-jira-task` and `executing-github-task`.**
>
> When you change the pipeline, the contract, the retry rules, or the review
> gate policy, change **this document first**, then propagate the change to
> both skills. See the _Change protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic execution
pipeline** that both task-execution skills must implement:

- `skills/executing-jira-task/` — Jira-specific execution orchestrator
- `skills/executing-github-task/` — GitHub-specific execution orchestrator

Each skill runs **exactly one task per invocation**. It validates readiness,
crosses the execution kickoff boundary, implements the scoped change, runs
requirements verification, runs three review gates, and reports the outcome.

### What this spec covers

- Required input shape and upstream artifacts
- Task readiness checks
- The execution kickoff boundary
- The standard 12-step pipeline runbook
- The targeted fix cycle
- Dispatch input contracts for every subagent
- Retry limits and escalation rules
- Review gate policy (evidence-first, library guidance, severity semantics)
- Artifact lifecycle (Category A vs Category B)
- Successful completion contract
- What each concrete skill **may** customize and what it **must not**

### What this spec does not cover

- The individual prose of each reference file or subagent definition. Skills
  may word instructions differently as long as the behavior, contracts, and
  outputs match this spec.
- Platform mutation details (e.g. exact `gh` commands, exact Jira transition
  IDs). Those live inside the platform-specific subagents.
- The parent orchestrator's logic (`orchestrating-jira-workflow` /
  `orchestrating-github-workflow`). This spec covers only the per-task
  execution skill.

## 2. Harness-agnosticism requirements

Both skills must run on **OpenCode, Cursor, and Claude Code** without
modification. That imposes the following rules on every file in both skills:

1. **Do not name runtime-specific tools.** Use neutral phrasing. Say "dispatch
   to a subagent" or "invoke the subagent", not "use the Task tool" or "use
   the Agent tool". Say "the orchestrator loads this reference file", not
   "the orchestrator uses the Read tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` in YAML frontmatter are optional and
   must not be treated as contract by any shared prose.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, no CLI-specific banner formats.
4. **Prefer relative file paths** over anything that resolves differently
   across harnesses (no symlinks, no `file://` URIs, no harness-internal
   indirection).
5. **Platform-specific tooling is allowed, but only in platform-specific
   places.** The Jira skill may reference a Jira MCP/REST integration inside
   `execution-starter.md` or `documentation-writer.md`. The GitHub skill may
   reference `gh` in the same subagents. Neither integration should appear
   in `pipeline.md`, `retry-and-escalation.md`, `review-gate-policy.md`,
   `requirements-verifier.md`, or any reviewer subagent.

## 3. Vocabulary (placeholders)

This spec uses abstract placeholders. Each concrete skill substitutes them
with its own values:

| Placeholder        | Jira skill                       | GitHub skill                             |
| ------------------ | -------------------------------- | ---------------------------------------- |
| `TASK_KEY`         | `TICKET_KEY` (e.g. `PROJ-123`)   | `ISSUE_SLUG` (e.g. `acme-app-42`)        |
| `TASK_NUMBER`      | `TASK_NUMBER`                    | `TASK_NUMBER`                            |
| `TASK_TRACKER`     | Jira (subtasks, transitions)    | GitHub (child issues, labels)            |
| `TRACKER_UPDATE`   | Jira transition + comment        | `gh` label/assignee/comment              |
| `TRACKER_CLI_OR_API` | Jira MCP / REST                | `gh` CLI                                 |
| `TASKS_DOC`        | `docs/<TASK_KEY>-tasks.md`       | `docs/<TASK_KEY>-tasks.md`               |
| `SNAPSHOT_DOC`     | `docs/<TASK_KEY>.md`             | `docs/<TASK_KEY>.md`                     |
| `TRACKER_TABLE`    | Jira subtask table in tasks doc  | `## GitHub Task Issues` in tasks doc     |

When this spec says "the tracker update", it means whatever the platform
equivalent is: a Jira transition-plus-comment, or a `gh` label/assignee
change plus optional comment.

## 4. Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Notes                                   |
| ------------- | -------- | --------------------------------------- |
| `TASK_KEY`    | Yes      | Derives every standard artifact path.   |
| `TASK_NUMBER` | Yes      | Exactly one task per invocation.        |

All standard artifact paths derive from `TASK_KEY` and `TASK_NUMBER`. The
skill may define additional optional inputs (resume flags, override briefs,
etc.) but those must not be required for the normal path.

## 5. Upstream artifacts

The normal Phase 7 path requires the following artifacts to exist on disk
before kickoff. Missing any required artifact is a stop-and-escalate
condition.

| Path pattern                                  | Required | Purpose                                               |
| --------------------------------------------- | -------- | ----------------------------------------------------- |
| `docs/<TASK_KEY>.md`                          | Yes      | Task snapshot (issue/ticket context).                 |
| `docs/<TASK_KEY>-tasks.md`                    | Yes      | Source of truth for task selection and status.        |
| `docs/<TASK_KEY>-task-<N>-brief.md`           | Yes      | Scope, context, Definition of Done.                   |
| `docs/<TASK_KEY>-task-<N>-execution-plan.md`  | Yes      | Approved implementation approach.                     |
| `docs/<TASK_KEY>-task-<N>-test-spec.md`       | Yes      | Required behavior coverage.                           |
| `docs/<TASK_KEY>-task-<N>-refactoring-plan.md`| Yes      | Approved structural prep and cleanup.                 |
| `docs/<TASK_KEY>-task-<N>-critique.md`        | Yes      | Task-level critique record from Phase 6.              |
| `docs/<TASK_KEY>-task-<N>-decisions.md`       | Yes      | Confirmed decisions after critique. **Required.**     |

**`decisions.md` is required on the normal Phase 7 path.** Both skills treat
its absence as a `BLOCKED` condition at kickoff, not as a silent fallback to
a legacy path. A user who wants to execute without critique decisions must
explicitly opt into a direct-execution mode (not a default behavior).

If a selected task is already marked complete, the skill stops and reports
that state instead of re-running it, unless the user explicitly asked to
re-run or revise.

## 6. Task readiness checklist

Before the kickoff step, confirm all of the following:

1. `docs/<TASK_KEY>-tasks.md` contains a `## Task <N>:` (or equivalent
   numbered task heading) for the selected task, consistent with the plan
   format.
2. The task is not already marked complete unless the user explicitly asked
   to re-run or revise it.
3. Dependencies or prerequisite tasks referenced in the plan are already
   complete where the plan requires it.
4. Per-task planning artifacts align with the task section in
   `docs/<TASK_KEY>-tasks.md`. Material conflicts between the plan and the
   per-task files are a stop-and-escalate condition.
5. Questions for the selected task are resolved, explicitly waived, or
   recorded as conscious follow-ups in the task plan or decisions record.
6. If `docs/<TASK_KEY>-task-<N>-decisions.md` records a later decision that
   differs from the Phase 2 task plan, treat `decisions.md` as authoritative.
7. **Tracker reference resolution.** Resolve the platform-specific tracker
   reference (Jira subtask key, GitHub child issue URL, etc.) from the task
   section. Values may be "not created" placeholders, in which case local
   implementation is not blocked but tracker updates performed by
   `execution-starter` and `documentation-writer` become no-ops with a
   recorded skip reason.

## 7. Execution kickoff boundary

Phase 7 kickoff is the **first execution mutation boundary after critique
approval**. Before kickoff, the workflow stays on disk: it edits planning
artifacts, runs critique, and resolves questions. After kickoff, the
workflow is actively implementing the task and may mutate external state.

At kickoff, the workflow may:

- confirm or adjust branch/worktree readiness (when policy is explicit);
- apply dirty-worktree handling only when the policy is clear;
- perform **platform-specific startup updates** via `TRACKER_CLI_OR_API`
  when a concrete tracker reference exists. Examples: a Jira transition to
  `In Progress` plus a starting comment, or a GitHub label/assignee change
  plus a starting comment on the child and/or parent issue.

**Kickoff is idempotent on resume.** If startup conditions are already
satisfied — the tracker already reflects "in progress", the starting comment
already exists, the branch is already ready — record the current state and
continue instead of duplicating side effects.

If the platform integration (`TRACKER_CLI_OR_API`) is unavailable or
unauthenticated, `execution-starter` records skips in its report and
continues **only when the workspace is otherwise ready**. A missing
integration does not block local implementation unless the task brief or
team policy explicitly requires the tracker update.

Everything after a `READY` kickoff assumes the task is actively in execution.

## 8. Dispatch contracts

The orchestrator passes only structured inputs between subagents. Prefer
file paths when the downstream specialist can read the artifact; prefer
short structured reports when a prior verdict is required. Symbolic handoff
names (`KICKOFF_REPORT`, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`,
`VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW`) refer to the
full markdown outputs returned by those subagents.

`EXECUTION_REPORT` and `DOCUMENTATION_REPORT` may carry blocked-state
information. Downstream steps must preserve those statuses instead of
inferring success from partial file changes alone.

| Subagent                | Required inputs                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution-starter`     | `TASK_KEY`, `TASK_NUMBER`, snapshot path, tasks-doc path, brief path; optional readiness summaries from the parent orchestrator                           |
| `task-executor`         | Paths to brief, execution plan, test spec, refactoring plan, decisions; optional critique path, fix brief, previous execution report                     |
| `documentation-writer`  | `EXECUTION_REPORT`, `TASK_KEY`, `TASK_NUMBER`                                                                                                             |
| `requirements-verifier` | Brief path, test spec path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`                                                                                    |
| `clean-code-reviewer`   | Brief path, test spec path, refactoring plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`                                      |
| `architecture-reviewer` | Brief path, execution plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`                                         |
| `security-auditor`      | Brief path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW`                                       |

The orchestrator reads **exactly one subagent definition per dispatch**, and
never preloads the full subagent tree.

## 9. Artifact lifecycle

| Category | Contents                                                        | Git behavior       | Lifecycle     |
| -------- | --------------------------------------------------------------- | ------------------ | ------------- |
| A        | `docs/<TASK_KEY>*.md`, progress files, plans, critique, decisions | Never committed  | Never deleted |
| B        | Source, tests, config, in-code docs                              | Committed normally | Normal rules  |

`documentation-writer` may update Category A artifacts on disk; they stay
out of git history.

## 10. Standard phase cycle (pipeline runbook)

Every successful task run follows this sequence. Each step is a dispatch to
a subagent unless explicitly marked as an orchestrator decision.

1. **Validate prerequisites.** Load the skill's contracts reference; confirm
   all required upstream artifacts exist and the task is ready. Stop if the
   task is already complete, a required artifact is missing, or there are
   material plan/artifact conflicts.

2. **Dispatch `execution-starter`.** Pass `TASK_KEY`, `TASK_NUMBER`,
   snapshot path, tasks-doc path, brief path. Treat this as the explicit
   execution kickoff. Kickoff is idempotent on resume. Collect only the
   structured `KICKOFF_REPORT`.

3. **Handle kickoff results.** `READY` continues. `BLOCKED` or `ERROR`
   stops and uses `retry-and-escalation.md`.

4. **Dispatch `task-executor`.** Pass the required planning artifact paths
   (brief, execution plan, test spec, refactoring plan, decisions),
   optional critique path, and any targeted fix brief. Collect only the
   structured `EXECUTION_REPORT`.

5. **Handle executor escalations.** `COMPLETE` continues. `NEEDS_CONTEXT`,
   `BLOCKED`, or `ERROR` stops and uses `retry-and-escalation.md`.

6. **Dispatch `documentation-writer`.** Pass `EXECUTION_REPORT`, `TASK_KEY`,
   and `TASK_NUMBER`. This step adds in-code documentation, commits
   Category B files, updates Category A tracking in
   `docs/<TASK_KEY>-tasks.md`, and performs optional tracker completion
   updates when a concrete tracker reference exists and policy requires it.
   Collect only the structured `DOCUMENTATION_REPORT`.

7. **Handle documentation results.** `COMPLETE` continues. `BLOCKED` or
   `ERROR` stops and uses `retry-and-escalation.md`.

8. **Dispatch `requirements-verifier`.** Pass brief path, test spec path,
   `EXECUTION_REPORT`, and `DOCUMENTATION_REPORT`. This is the postcondition
   for implementation completeness before review gates.

9. **Resolve requirements gaps.** `PASS` continues. `BLOCKED` stops the
   pipeline immediately — a missing capability, missing access, or blocked
   documentation is not a normal fix loop. `FAIL` with plainly in-scope gaps
   triggers a fix loop: build a concise fix brief, re-dispatch
   `task-executor`, then `documentation-writer`, then re-run
   `requirements-verifier`. Ambiguous briefs, conflicting artifacts, or
   planning mistakes are stop-and-escalate.

10. **Run the quality gates in order.** `clean-code-reviewer`, then
    `architecture-reviewer`, then `security-auditor`. Each receives only
    the inputs listed in the dispatch contracts table.

11. **Interpret gate verdicts.** `PASS`, `PASS WITH SUGGESTIONS`, and
    `PASS WITH ADVISORIES` let the pipeline continue. `NEEDS FIXES` triggers
    the targeted fix cycle. `BLOCKED` or `ERROR` stops the run and escalates.

12. **Report the outcome.** Summarize what changed. Include kickoff status,
    commit hashes/messages, gate verdicts, files changed, and any tracker
    steps skipped or failed. Stop after the selected task. Do not continue
    to the next task automatically.

## 11. Targeted fix cycle

When one or more reviewers return `NEEDS FIXES`:

1. Consolidate only the blocking issues from the failing gates into a
   single fix brief.
2. Re-dispatch `task-executor` with the original planning artifacts plus
   that fix brief.
3. Re-dispatch `documentation-writer` so new Category B changes are
   committed and tracking artifacts are updated.
4. Re-run **only the gate(s) that previously failed**, in their original
   order.
5. If every previously failing gate now passes, finish the task. Otherwise
   use `retry-and-escalation.md`.

Never re-run passing gates. Never re-run the full pipeline.

## 12. Report template

Each skill's `pipeline.md` includes this report template verbatim:

```markdown
Task <N> complete: <title>

Summary: <2-3 sentences>

Pipeline:
- Kickoff: <status>
- Execution: <status>
- Documentation/commits: <status>
- Requirements verification: <verdict>
- Clean code review: <verdict>
- Architecture review: <verdict>
- Security audit: <verdict>

Commits:
- <short hash> - <message>

Files changed:
- <path>

Remaining items:
- <issue or "None">
```

## 13. Retry and escalation

### Status handling

| Step / subagent          | Expected statuses                                                                         | Orchestrator action                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `execution-starter`      | `READY`, `BLOCKED`, `ERROR`                                                               | Continue on `READY`; otherwise pause before implementation.                          |
| `task-executor`          | `COMPLETE`, `NEEDS_CONTEXT`, `BLOCKED`, `ERROR`                                           | Continue on `COMPLETE`; otherwise pause.                                             |
| `documentation-writer`   | `COMPLETE`, `BLOCKED`, `ERROR`                                                            | Continue on `COMPLETE`; otherwise stop and surface the blocker.                      |
| `requirements-verifier`  | `PASS`, `FAIL`, `BLOCKED`, `ERROR`                                                        | Re-run coverage fix loop only on clear in-scope `FAIL` gaps; stop on blocked states. |
| Review gates             | `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`, `NEEDS FIXES`, `BLOCKED`, `ERROR` | Continue on non-blocking passes; targeted fix cycle on `NEEDS FIXES`.                |

### When to ask the user

Ask for user input instead of improvising when any of these occur:

1. A subagent reports `NEEDS_CONTEXT` for a real business, scope, or
   architectural decision.
2. `execution-starter` reports that branch/worktree or dirty-state handling
   needs a user decision.
3. Required planning artifacts conflict with each other.
4. A required supporting skill, tool, runtime, permission, or environment
   capability is missing and the run cannot proceed safely. This includes
   the platform integration (`TRACKER_CLI_OR_API`) being unavailable when
   tracker updates are mandatory for the team or task policy.
5. The same ambiguity or gate failure persists after the retry limit.
6. A tracker operation fails with permissions or policy errors that cannot
   be resolved inside the session.

### Retry limits

- `task-executor` ambiguity/context loop: maximum **3** re-dispatches for
  the same blocker.
- Requirements coverage fix loop: maximum **3** cycles.
- Quality-gate targeted fix loop: maximum **3** cycles.

If a loop reaches its limit, stop and report accumulated findings rather
than retrying with unchanged inputs. The parent orchestrator may then
present options to the user.

### Non-blocking outcomes

Report these but do not reopen the task automatically:

- `PASS WITH SUGGESTIONS`
- `PASS WITH ADVISORIES`
- Tracker updates skipped because the tracker reference was a "not created"
  placeholder, the integration was unavailable, or the team chose not to
  mutate the tracker at kickoff/completion
- Pre-existing failing tests explicitly reported and outside the selected
  task's scope

### Missing capability pattern

When a subagent reports a missing required skill, tool, or integration:

1. Surface the exact capability name.
2. Include install or setup instructions returned by the subagent.
3. Stop the pipeline at that phase.
4. Resume from the blocked phase after the user confirms the capability is
   available.

This rule applies both at initial preflight and whenever a missing
capability is discovered during execution or validation.

## 14. Review gate policy

Every reviewer follows the same evidence-first pattern, uses the same
library-guidance rule, uses the same severity semantics, and uses the same
output discipline. The review gate policy is platform-agnostic: it never
mentions Jira, GitHub, `gh`, or any integration.

### Evidence-first review

1. Read the structured inputs to understand the task and prior verdicts.
2. Verify the working tree is clean before reviewing.
3. Inspect the changed files named in `EXECUTION_REPORT`.
4. Use reports as summaries, not substitutes for reading the code.
5. Return concise findings with clear file locations and concrete
   remediation.

If the working tree is dirty, the reviewer returns `BLOCKED` and lets the
orchestrator resolve it before reviewing.

### Library and framework guidance

When a recommendation depends on current library, framework, or API
behavior:

1. Query context7 if it is available in the environment.
2. Use the retrieved documentation to validate the recommendation.
3. If context7 is unavailable, say so explicitly and mark the
   library-specific recommendation as lower confidence instead of inventing
   certainty.

### Severity semantics

- Blocking findings become `NEEDS FIXES`.
- Non-blocking improvement ideas stay in `Suggestions` or `Advisories`.
- Praise specific good decisions in `What Went Well` so the next fix cycle
  does not accidentally undo them.

### Output discipline

- Prefer short tables or bullets over long prose.
- Skip empty issue sections instead of filling them with filler text.
- If there are no blockers, say so directly.

### Reviewer prescriptiveness

Each reviewer subagent's `## Instructions` section lists the **explicit
concerns** it is expected to evaluate. Reviewers do not abstract the list
away as "consider clean-code principles"; they enumerate the specific
concerns. This keeps review depth consistent across both skills.

Required concern lists:

- **`clean-code-reviewer`:** naming clarity, duplication and abstraction
  level, function/module size, SOLID alignment, test readability and
  coverage of the test spec.
- **`architecture-reviewer`:** bounded contexts and domain language,
  module boundaries and composition, dependency direction, alignment with
  the approved execution plan, and architectural fit with the surrounding
  codebase.
- **`security-auditor`:** input validation and injection vectors,
  authentication and authorization changes, secret handling, logging and
  telemetry leakage, and dependency/supply-chain risks introduced by the
  change set. Findings are bucketed into `Critical`, `High`, and `Medium`
  severity bins.

## 15. Successful completion contract

After a successful run, all of the following are true:

1. `EXECUTION_REPORT` and `DOCUMENTATION_REPORT` both indicate successful
   completion rather than blocked partial progress.
2. Execution kickoff either performed the planned tracker startup actions
   via `TRACKER_CLI_OR_API` or reported clearly why each action was
   skipped.
3. Category B changes are committed.
4. The task section in `docs/<TASK_KEY>-tasks.md` includes completion
   metadata consistent with the team template (status, implementation
   summary, files changed).
5. If the tasks doc has a `TRACKER_TABLE`, the row for this task reflects
   the current tracker state when known.
6. Optional tracker completion steps (comment, close subtask/child issue
   when policy requires, label or transition changes) are either completed
   or reported as skipped with a reason.

Partial progress alone does not satisfy successful completion. If a
required task step, test, or validation command could not run because a
capability or prerequisite was unavailable, the task remains blocked until
that dependency is resolved.

## 16. Divergence register

The following sections are **locked to this spec**. Both skills must express
the same contract; wording may differ but behavior must not.

- Required input shape (section 4)
- Upstream artifacts and `decisions.md` being **required** (section 5)
- Task readiness checklist (section 6)
- Execution kickoff boundary and idempotency rule (section 7)
- Dispatch contracts table (section 8)
- Artifact lifecycle table (section 9)
- The 12-step pipeline runbook (section 10)
- The targeted fix cycle (section 11)
- The report template (section 12)
- Retry limits and escalation statuses (section 13)
- The review gate policy (section 14), including the reviewer concern lists
- The successful completion contract (section 15)

The following sections are **platform-specific** and are expected to
differ:

- The concrete tracker integration (`gh` vs Jira MCP/REST).
- The text of the startup and completion comments the skill posts to the
  tracker.
- The exact shape of tracker status updates (labels vs transitions, child
  issue vs subtask).
- The parent orchestrator references in each skill's `SKILL.md` and
  `contracts.md`.
- The `TASK_KEY` variable name and any tracker-specific input validation.

Anything else that diverges should either be harmonized or explicitly
noted here as an intentional platform difference.

## 17. Change protocol

When the execution pipeline needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update `executing-jira-task`** to match. Touch `SKILL.md`, the four
   reference files, and any affected subagents.
3. **Update `executing-github-task`** to match, using the same edits where
   the content is shared.
4. **Verify alignment.** Re-read both skills' `pipeline.md`,
   `retry-and-escalation.md`, `review-gate-policy.md`, and `contracts.md`
   side by side and confirm they express the same contract in the same
   order. Differences must map to an entry in the divergence register
   (section 16).
5. **Do not add a feature to one skill only.** If a behavior is valuable in
   one execution skill, it is valuable in both. Changes that only make
   sense for one platform belong inside a platform-specific subagent, not
   in the shared pipeline.

This spec is intentionally denser than a skill file. It exists to be read
by the human author (or a future agent) at change time, not every task
run. Neither skill loads this file during normal operation.
