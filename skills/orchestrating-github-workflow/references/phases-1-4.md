# Phases 1-4 - Linear Pipeline

> Read this file when entering Phase 1, 2, 3, or 4. For exact artifact
> checks, load `./data-contracts.md` and dispatch `artifact-validator`;
> do not inspect artifacts inline in the orchestrator. For `gh` flag,
> REST endpoint, or sub-issue capability questions that the downstream
> skill cannot answer, fetch one URL from `./external-sources.md`.
> Load `./downstream-skills.md` only when you need the phase-to-skill
> dependency map or dispatch contract details.

After Phase 4 completes and the user selects a task, read `./task-loop.md`.

For every phase, use the standard cycle from `./workflow-policy.md`: announce,
validate preconditions when present, invoke the downstream skill, validate
postconditions, update progress, and run the gate.

## Phase 1 - Fetch Work Item

**Skill:** `fetching-github-issue`

1. Announce Phase 1.
2. Invoke the downstream skill with `ISSUE_URL` when available, otherwise with
   `OWNER`, `REPO`, and `ISSUE_NUMBER`. Do not pass `ISSUE_SLUG`; the downstream
   skill derives and returns it.
3. Interpret the downstream 12-line fetch summary using `./data-contracts.md`.
4. If retrieval failed before writing an artifact, route through
   `./error-handling.md` instead of running postcondition validation.
5. Dispatch `artifact-validator` for `PHASE=1`, `DIRECTION=postcondition`.
6. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=1`,
   `STATUS=complete`, and a one-line fetch summary.

**Gate:** Automatic. Proceed to Phase 2 when validation passes.

## Phase 2 - Plan Tasks

**Skill:** `planning-github-issue-tasks`

1. Announce Phase 2.
2. Dispatch `artifact-validator` for `PHASE=2`, `DIRECTION=precondition`.
3. Invoke the downstream skill with `ISSUE_SLUG`.
4. When re-planning from Phase 3, also pass `RE_PLAN=true` and the accepted
   `DECISIONS` summary from critique.
5. Dispatch `artifact-validator` for `PHASE=2`, `DIRECTION=postcondition`.
6. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=2`,
   `STATUS=complete`, and a one-line planning summary.

**Gate:** Automatic. Proceed to Phase 3 when validation passes.

## Phase 3 - Clarify Assumptions + Critique Plan

**Skill:** `clarifying-assumptions`
**Mode:** `upfront`

1. Announce Phase 3.
2. Dispatch `artifact-validator` for `PHASE=3`, `DIRECTION=precondition`.
3. Invoke `clarifying-assumptions` with `MODE=upfront`,
   `TICKET_KEY=<ISSUE_SLUG>`, and `ITERATION=<N>`.
4. Let the downstream skill handle user-facing clarification and critique.
5. If the downstream summary has `RE_PLAN_NEEDED=true`, re-run Phase 2 with the
   accepted decisions, then run Phase 3 again. Maximum: 3 re-plan loops.
6. After `RE_PLAN_NEEDED=false`, dispatch `artifact-validator` for `PHASE=3`,
   `DIRECTION=postcondition`.
7. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=3`,
   `STATUS=complete`, and a one-line clarification summary.

**Gate:** First honor `BLOCKERS_PRESENT` from the clarification summary. If it
is `true`, stop before GitHub writes and surface the unresolved blockers.

If blockers are clear, ask the user before Phase 4:

```text
Plan is ready. How would you like to proceed?

1. Create task issues on GitHub now
2. Review the plan first
3. Stop here and link issues manually
```

Proceed to Phase 4 only when the user explicitly chooses option 1.

## Phase 4 - Create Child Items

**Skill:** `creating-github-child-issues`

The downstream skill chooses the write model in this order: native child issues
when supported, linked issues with parent traceability, then task-list
references when neither issue model is viable.

1. Announce Phase 4.
2. Dispatch `artifact-validator` for `PHASE=4`, `DIRECTION=precondition`.
3. Invoke the downstream skill with `ISSUE_URL` when available, otherwise with
   owner/repo/issue context as the skill defines.
4. Retain only the structured write model, capability, `Created/Linked Task
   Issues` summary, warnings, and failed-create notes.
5. Dispatch `artifact-validator` for `PHASE=4`, `DIRECTION=postcondition`.
6. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=4`,
   `STATUS=complete`, `SUMMARY=<one-line result>`, and `TASKS=<rows from the
   downstream Created/Linked Task Issues table>`.
7. Surface any warnings or failed creates before task selection.

**Gate:** User chooses which task to execute next. Never auto-start a task.

<example>
Task issues created on GitHub. Which task would you like to work on first?

| # | Title | Dependencies | Priority |
| - | ----- | ------------ | -------- |
| 1 | Add input validation | None | High |
| 2 | Implement caching layer | Task 1 | High |
| 3 | Update API documentation | None | Medium |

Pick a task number, or say `show me the full plan` for more detail.
</example>
