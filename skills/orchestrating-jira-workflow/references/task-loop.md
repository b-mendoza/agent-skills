# Task Loop - Phases 5-7

> Read this file when entering the per-task execution loop.
>
> Reminder: the orchestrator reads skill/reference/subagent files, talks to the
> user, and dispatches helpers. Codebase inspection, searches, Jira queries,
> and file updates stay delegated.

Each task passes through Phase 5 (plan), Phase 6 (critique), and Phase 7
(execute) before the next task begins.

---

## Task Selection

Before entering the loop for a task:

1. **Get remaining tasks.** Dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: read
   ```

   The summary shows which tasks are complete and which remain.

2. **Present remaining tasks to the user.** Show the task list with
   dependencies and status. Let the user choose — never auto-select.

3. **Gather pre-task context.** Dispatch relevant utility subagents to gather
   context the downstream skill will need. These are independent and can run
   in parallel:

   | Need                        | Dispatch to             |
   | --------------------------- | ----------------------- |
   | Current ticket status       | `ticket-status-checker` |
   | Working tree / branch state | `codebase-inspector`    |
   | Relevant code to locate     | `code-reference-finder` |
   | Documentation / config      | `documentation-finder`  |

   Not all dispatches are needed every time — use judgment based on the task.

4. **Initialize task progress.** Dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: initialize_task
   TASK_NUMBER: <N>
   TASK_TITLE: "<title>"
   ```

   Do this only when the selected task has not started yet.

   If resuming a task that already has a progress file, do not re-initialize
   it. Keep the existing task progress artifact and continue from the reported
   phase.

---

## Phase 5 — Plan Task Execution

**Skill:** `planning-jira-task` (at `../planning-jira-task/SKILL.md`)

**Announce:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 5/7 — Plan Task Execution (Task <N>)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Validate preconditions:** Dispatch `artifact-validator`:

```
TICKET_KEY: <KEY>
PHASE: 5
DIRECTION: precondition
```

**Invoke:** Read the skill's SKILL.md and invoke with `TICKET_KEY`,
`TASK_NUMBER`, and any context summaries from the pre-task utility dispatches.
Follow every step defined in the skill.

The skill runs a 4-subagent pipeline:

1. `execution-prepper` — validates task and assembles the execution brief
2. `execution-planner` — analyzes task and codebase, produces execution plan
3. `test-strategist` — defines behavior-driven tests
4. `refactoring-advisor` — evaluates pre-implementation refactoring needs

**Validate output:** Dispatch `artifact-validator`:

```
TICKET_KEY: <KEY>
PHASE: 5
DIRECTION: postcondition
TASK_NUMBER: <N>
```

Expected: all 4 planning artifacts exist for the task.

**Update progress:** Dispatch `progress-tracker`:

```
TICKET_KEY: <KEY>
ACTION: update_task
TASK_NUMBER: <N>
PHASE: 5
STATUS: complete
SUMMARY: "Planning complete — <approach summary>"
```

**Gate:** Automatic → proceed to Phase 6.

---

## Phase 6 — Clarify + Critique Execution Plan

**Skill:** `clarifying-assumptions` (at `../clarifying-assumptions/SKILL.md`)
**Mode:** `critique`

**Announce:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 6/7 — Clarify + Critique (Task <N>)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Validate preconditions:** Dispatch `artifact-validator`:

```
TICKET_KEY: <KEY>
PHASE: 6
DIRECTION: precondition
TASK_NUMBER: <N>
```

Expected: all 4 planning artifacts exist.

**Invoke:** Read the skill's SKILL.md and invoke with:

- `MODE=critique`
- `TICKET_KEY`
- `TASK_NUMBER`
- Paths to all 4 planning artifacts

The skill dispatches its `critique-analyzer` to review the planning artifacts,
then walks the user through all critique items and any deferred questions for
this task.

### Re-plan cycle

If the skill reports `RE_PLAN_NEEDED=true`:

1. Re-dispatch Phase 5 (`planning-jira-task`) with:
   - `RE_PLAN=true`
   - `DECISIONS_FILE=docs/<KEY>-task-<N>-decisions.md`
2. All 4 Phase 5 subagents re-run with prior artifacts plus new decisions.
3. After Phase 5 completes, re-dispatch Phase 6 to critique the updated plan.
4. Maximum 3 iterations. After 3, present accumulated critique to the user and
   ask how to proceed.

<example>
Re-plan cycle for per-task planning:

Phase 6 (iteration 1):
critique-analyzer: "The execution plan uses a synchronous HTTP call for
the notification service. User impact: 200-500ms added latency on every
save. Alternative: async event via message queue."
User: "You're right, let's go async."
→ RE_PLAN_NEEDED=true

Phase 5 (re-dispatch):
All 4 subagents re-run with the decision: "Use async event for notifications."
execution-planner updates the plan. test-strategist adjusts test cases.

Phase 6 (iteration 2):
critique-analyzer: Notification decision resolved. No new concerns.
User confirms plan.
→ RE_PLAN_NEEDED=false → advance to gate
</example>

**Validate output:** Dispatch `artifact-validator`:

```
TICKET_KEY: <KEY>
PHASE: 6
DIRECTION: postcondition
TASK_NUMBER: <N>
```

Expected: `docs/<KEY>-task-<N>-decisions.md` exists.

**Update progress:** Dispatch `progress-tracker`:

```
TICKET_KEY: <KEY>
ACTION: update_task
TASK_NUMBER: <N>
PHASE: 6
STATUS: complete
SUMMARY: "N critique items addressed, plan confirmed"
```

**Gate:** User confirmation required. The user must confirm the plan is ready
for implementation before Phase 7 begins.

```
The execution plan for Task <N> has been critiqued and updated.
Ready to start implementation? (y/n)
```

---

## Phase 7 — Execute Task

**Skill:** `executing-jira-task` (at `../executing-jira-task/SKILL.md`)

**Announce:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 7/7 — Execute (Task <N>)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Validate preconditions:** Dispatch `artifact-validator`:

```
TICKET_KEY: <KEY>
PHASE: 7
DIRECTION: precondition
TASK_NUMBER: <N>
```

**Invoke:** Read the skill's SKILL.md and invoke with `TICKET_KEY`,
`TASK_NUMBER`, and context summaries from the pre-task utility dispatches.
Follow every step defined in the skill.

The skill manages its own 6-subagent pipeline and quality gates internally.
The orchestrator does not intervene in quality gate fix cycles — the skill
handles up to 3 fix iterations on its own.

### Quality gate escalation

The orchestrator only acts when the skill reports that its fix cycle limit is
exhausted. In that case, present the accumulated gate feedback to the user:

<example>
Quality gates did not pass after 3 fix cycles for Task 2.

Accumulated feedback:

- clean-code-reviewer: "extract-validation module has 4 functions over 30
  lines each — violates single-responsibility"
- architecture-reviewer: PASS
- security-auditor: PASS

Options:

1. Accept the current state and move to the next task
2. Provide guidance for a different approach
3. Re-run the full task pipeline from Phase 5 (for fundamental approach issues)
</example>

Option 3 is for fundamental approach failures — not for minor code quality
issues that can be accepted.

There is no orchestrator-level Phase 7 postcondition artifact check. The
downstream execution skill owns its internal quality gates and returns the
completion summary that drives the workflow update.

**Update progress:** Dispatch `progress-tracker`:

```
TICKET_KEY: <KEY>
ACTION: update_task
TASK_NUMBER: <N>
PHASE: 7
STATUS: complete
SUMMARY: "Implemented — N files changed, N commits"
```

Then refresh the main progress file's task table:

```
TICKET_KEY: <KEY>
ACTION: update
PHASE: 4
STATUS: complete
SUMMARY: "Task N complete — <title>"
```

---

## Loop Continuation

After Phase 7 completes for a task:

1. Return to the **Task Selection** procedure above.
2. Present remaining tasks to the user.
3. The user selects the next task — never auto-continue.
4. Continue until all tasks are complete or the user stops.

---

## Final Summary

When all tasks are complete (or the user decides to stop), dispatch
`progress-tracker` with `ACTION=read` for the final state, then present:

```markdown
## Workflow Summary — <TICKET_KEY>

| Phase | Status      | Key outcome                            |
| ----- | ----------- | -------------------------------------- |
| 1     | ✅ Complete | Ticket fetched (N comments)            |
| 2     | ✅ Complete | N tasks planned                        |
| 3     | ✅ Complete | N/N questions resolved, N critiqued    |
| 4     | ✅ Complete | N subtasks created in Jira             |
| 5–7   | ✅ Complete | N/N tasks planned, critiqued, executed |

Per-task detail in docs/<TICKET_KEY>-task-<N>-progress.md.
All artifacts are in docs/<TICKET_KEY>*.
```
