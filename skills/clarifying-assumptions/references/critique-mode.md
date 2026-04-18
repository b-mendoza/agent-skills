# Critique Mode Playbook

> Read `./design-thinking-mindset.md` first.
>
> Reminder: critique mode stays conversational for the developer, but subagents
> still own artifact reading, deferred-question filtering, and file writes.
>
> Use the main `SKILL.md` file's `## Escalation` table as the authoritative verdict
> routing policy. This playbook focuses on the canonical stage flow and inline questioning.

## Stage 2 — Analyze Artifacts

Dispatch `critique-analyzer`.

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
- `PRIOR_DECISIONS_KIND=per-task`

The analyzer consults that decisions file on every run, including
`ITERATION=1`. If the file does not exist yet, it treats the source as empty.
When the file exists, it judges prior answers by substance rather than by item
ID or exact wording.

Handle the verdicts:

- `CRITIQUE: FAIL` → stop and surface the reason.
- `CRITIQUE: WARN` → continue only if the warning does not invalidate the task critique.
- `CRITIQUE: PASS` → continue.

## Stage 3 — Build Manifest

Dispatch `question-manifest-builder`.

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

The manifest builder returns the same three-way manifest shape used in upfront
mode:

- Questions for now
- Deferred questions
- Resolved irrelevant items

Handle the verdicts:

- `MANIFEST: BLOCKED` or `MANIFEST: FAIL` → stop and surface the reason.
- `MANIFEST: WARN` → continue, but carry the warning into the final summary.
- `MANIFEST: PASS` → continue.

### Stage 4 substep — Preview Manifest

Show the manifest summary before asking the first question. Reuse the
`question-manifest-builder` header counts and `## Questions For Now` table
shape instead of inventing a different critique-mode preview schema.

```markdown
## Question Manifest — <TICKET_KEY> / Task <TASK_NUMBER>

Questions now: <N> | Deferred: <M> | Irrelevant: <R>

| # | Item ID | Category | Severity | Model | Skippable | Affects |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | TC1 | Critique | HIGH | B | No | Task <TASK_NUMBER> |
| 2 | UI1 | User impact | MEDIUM | B | Yes | Task <TASK_NUMBER> |
| 3 | DQ-<TASK_NUMBER>-1 | Task question | MEDIUM | B | Yes | Task <TASK_NUMBER> |
```

If there are no items left after filtering, say so clearly, do not emit a
placeholder prompt, and skip to the recording step with an empty decision list.

After the preview, ask:

> Ready to start? I'll walk through these one at a time.

## Stage 4 — Clarify Inline

Every item in critique mode uses Model B.

Always show progress:

```text
Question <current>/<total> — [<category>]
```

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
- skip with fallback, but only when the manifest marks the item `Skippable`

### Recording rules

- `Switch to <alternative>` → set `RE_PLAN_NEEDED=true`
- `blocked` → set `RE_PLAN_NEEDED=true`, set `BLOCKERS_PRESENT=true`, and stop after recording the blocker
- `Acknowledge but proceed` → record as override, no re-plan
- `Skip` → record the fallback and warning
- Follow the manifest's `Skippable` field. Do not skip items that were surfaced as
  non-skippable.
- If a deferred question is clearly obsolete, do not ask it; rely on the
  manifest builder's `RESOLVED_IRRELEVANT` list

## Stage 5 — Record Decisions

Dispatch `decision-recorder`.

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

Handle the verdicts:

- `RECORDING: BLOCKED` or `RECORDING: ERROR` → stop and surface the reason.
- `RECORDING: WARN` → continue, but carry the warnings into the final summary.
- `RECORDING: PASS` → continue.

### Stage 5 substep — Present Final Summary

Keep the first four lines in the same order as the main `SKILL.md` final
summary contract, then add any extra counts that help the user understand what
happened in this run.

Use the recorder summary plus session counts to present:

```markdown
## Clarification Complete — <TICKET_KEY> / Task <TASK_NUMBER>

- Critique artifact: <path>
- Files updated: <path list or ->
- RE_PLAN_NEEDED: <true|false>
- BLOCKERS_PRESENT: <true|false>
- Critique items resolved: <N>
- User-impact items resolved: <N>
- Deferred questions resolved: <N>
- Questions marked irrelevant: <N>
- Blocking items: <N>
- Overrides: <N>
```

If `RE_PLAN_NEEDED=true`, tell the orchestrator to re-run the per-task planning
phase before execution begins.

If `BLOCKERS_PRESENT=true`, tell the orchestrator to stop before execution and
escalate the unresolved items.
