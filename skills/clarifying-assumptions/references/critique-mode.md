# Critique Mode — Phase 6 Playbook

> Read `./design-thinking-mindset.md` first.
>
> Reminder: critique mode stays conversational for the developer, but subagents
> still own artifact reading, deferred-question filtering, and file writes.
>
> Use the main `SKILL.md` file's `## Escalation` table as the authoritative verdict
> routing policy. This playbook focuses on phase flow and inline questioning.

## 1. Dispatch `critique-analyzer`

Read `../subagents/critique-analyzer.md`, then dispatch with:

- `MODE=critique`
- `TICKET_KEY=<TICKET_KEY>`
- `TASK_NUMBER=<TASK_NUMBER>`
- `MAIN_PLAN_FILE=docs/<TICKET_KEY>-tasks.md`
- `ARTIFACTS`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-brief.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-execution-plan.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-test-spec.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-refactoring-plan.md`
- `CRITIQUE_REPORT_FILE=docs/<TICKET_KEY>-task-<TASK_NUMBER>-critique.md`
- `PRIOR_DECISIONS_FILE=docs/<TICKET_KEY>-task-<TASK_NUMBER>-decisions.md`
  only when `ITERATION > 1`
- `PRIOR_DECISIONS_KIND=per-task` when `PRIOR_DECISIONS_FILE` is provided

Handle the verdicts:

- `CRITIQUE: FAIL` → stop and surface the reason.
- `CRITIQUE: WARN` → continue only if the warning does not invalidate the task critique.
- `CRITIQUE: PASS` → continue.

## 2. Dispatch `question-manifest-builder`

Read `../subagents/question-manifest-builder.md`, then dispatch with:

- `MODE=critique`
- `TICKET_KEY=<TICKET_KEY>`
- `TASK_NUMBER=<TASK_NUMBER>`
- `PLAN_FILE=docs/<TICKET_KEY>-tasks.md`
- `CURRENT_TASK_ARTIFACTS`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-brief.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-execution-plan.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-test-spec.md`
  - `docs/<TICKET_KEY>-task-<TASK_NUMBER>-refactoring-plan.md`
- `CRITIQUE_REPORT_FILE=docs/<TICKET_KEY>-task-<TASK_NUMBER>-critique.md`

The manifest builder returns:

- Critique items for the current task
- User-impact items linked to Phase 3 problem framing
- Deferred questions that still matter for this task
- Deferred questions that are now irrelevant

Handle the verdicts:

- `MANIFEST: BLOCKED` or `MANIFEST: FAIL` → stop and surface the reason.
- `MANIFEST: WARN` → continue, but carry the warning into the final summary.
- `MANIFEST: PASS` → continue.

## 3. Present the task manifest

Show the developer a concise preview:

```markdown
## Critique & Clarification Manifest — Task <TASK_NUMBER>

Critique items: <C>
User-impact items: <U>
Deferred questions still relevant: <Q>
Deferred questions now irrelevant: <R>
```

If there are no items left after filtering, say so clearly and skip to the
recording step with an empty decision list.

## 4. Walk items one at a time

Every item in critique mode uses Model B.

Use this flow:

1. Present the original decision or unresolved question.
2. Present the critique, trade-offs, or user-impact consequence.
3. Ask the developer whether the reasoning holds up, and why.
4. Record the decision and rationale.

For critique and user-impact items, present these options when a discrete
choice is needed:

1. `Keep current approach`
2. `Switch to <alternative>`
3. `I need more information`
4. `Acknowledge but proceed`

Record `I need more information` and `Action needed` style responses as the
canonical `blocked` outcome for the recorder.

For deferred questions, use the simplest fitting response form:

- direct answer
- revise current plan
- skip with fallback

### Recording rules

- `Switch to <alternative>` → set `RE_PLAN_NEEDED=true`
- `blocked` → set `RE_PLAN_NEEDED=true`, set `BLOCKERS_PRESENT=true`, and stop after recording the blocker
- `Acknowledge but proceed` → record as override, no re-plan
- `Skip` → record the fallback and warning
- If a deferred question is clearly obsolete, do not ask it; rely on the
  manifest builder's `RESOLVED_IRRELEVANT` list

## 5. Dispatch `decision-recorder`

Read `../subagents/decision-recorder.md`, then dispatch with:

- `TICKET_KEY=<TICKET_KEY>`
- `MODE=critique`
- `TASK_NUMBER=<TASK_NUMBER>`
- `TASK_TITLE=<task title from the manifest>`
- `ITERATION=<ITERATION or 1>`
- `DECISIONS=<resolved decisions from the session>`
- `RESOLVED_IRRELEVANT=<items marked no longer applicable>`
- `DEFERRED_QUESTIONS=<new future-task questions created during this session>`
  only when the discussion surfaces items that should be revisited later
- `IMPLEMENTATION_UPDATES=<any implementation-note edits caused by switch decisions>`

In critique mode, `decision-recorder` creates or updates
`docs/<TICKET_KEY>-task-<TASK_NUMBER>-decisions.md` and also updates the main
task plan.

## 6. Present the final summary

Use the recorder summary plus session counts to present:

```markdown
## Critique & Clarification Complete — Task <TASK_NUMBER>

- Critique artifact: <path>
- Files updated: <path list or ->
- Critique items resolved: <N>
- User-impact items resolved: <N>
- Deferred questions resolved: <N>
- Questions marked irrelevant: <N>
- Blocking items: <N>
- Overrides: <N>
- RE_PLAN_NEEDED: <true|false>
- BLOCKERS_PRESENT: <true|false>
```

If `RE_PLAN_NEEDED=true`, tell the orchestrator to re-run the per-task planning
phase before execution begins.

If `BLOCKERS_PRESENT=true`, tell the orchestrator to stop before execution and
escalate the unresolved items.
