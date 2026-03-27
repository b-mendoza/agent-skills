---
name: "executing-subtask"
description: 'Execute a single subtask from a task plan using a structured pipeline of specialist subagents: planning, testing, refactoring, implementation, documentation, code-quality review, and requirements verification. The user must specify which task number to execute. Use when the user says "execute task 3", "work on task 2", "implement task 1", "start task 5 for PROJECT-1234", or "run subtask N". Also triggered by the orchestrating-jira-workflow skill as Phase 5 of the end-to-end pipeline (called once per task). Requires that the task plan exists at docs/<TICKET_KEY>-tasks.md. Executes ONLY the specified task — never continues to the next one without explicit user approval.'
---

# Executing Subtask

## Purpose

Execute exactly ONE task from the task plan through a structured pipeline of
specialist subagents. Each subagent handles a specific concern (planning,
testing, refactoring, implementation, documentation, code quality, requirements
verification), keeping the orchestrator's context clean for coordination and
decision-making.

The pipeline ensures tasks are completed with proper planning, test coverage,
clean code practices, and verified requirements before moving on.

## Platform Compatibility

This skill works across multiple AI coding tools. Each platform uses a
different syntax for dispatching subagents:

| Platform        | Dispatch syntax                                                     |
| --------------- | ------------------------------------------------------------------- |
| Claude Code CLI | `agent <subagent-name> "<prompt>"` — native subagent via Agent tool |
| Cursor IDE      | Place `.md` files in `.cursor/agents/` or `@`-mention the subagent  |
| OpenCode CLI    | Subagents invoked via Task tool or `@`-mention in messages          |

All three platforms support the Agent Skills open standard (SKILL.md format).
The subagent files are self-contained markdown — each platform discovers and
dispatches them using its own native mechanism.

For Claude Code, place subagent `.md` files in `.claude/agents/` (or reference
them from the skill's `subagents/` directory). For Cursor, place them in
`.cursor/agents/` (Cursor also reads from `.claude/agents/` for compatibility).
For OpenCode, place them in `.opencode/agents/` or define them in
`opencode.json`.

If your platform does not support native subagent dispatch, read the subagent
file and execute its instructions directly, keeping the subagent's output
contract intact so downstream steps can consume it.

## Inputs

| Input         | Source              | Required | Example    |
| ------------- | ------------------- | -------- | ---------- |
| `TICKET_KEY`  | User / `$ARGUMENTS` | Yes      | `JNS-6065` |
| `TASK_NUMBER` | User / `$ARGUMENTS` | Yes      | `3`        |

Both the ticket snapshot (`docs/<TICKET_KEY>.md`) and the task plan
(`docs/<TICKET_KEY>-tasks.md`) must exist. If either is missing, tell the user
which prerequisite skill to run.

### Input contract (produced by upstream skills)

The task plan file `docs/<TICKET_KEY>-tasks.md` must contain these sections,
built up across the preceding phases:

| Required section / element                  | Produced by              | Used in step        | Why                                              |
| ------------------------------------------- | ------------------------ | ------------------- | ------------------------------------------------ |
| `## Task <N>:` with all 8 subsections       | planning-jira-tasks      | Step 1 (load)       | Source content for the execution brief           |
| `## Dependency Graph`                       | planning-jira-tasks      | Step 1 (pre-flight) | Validates dependencies are satisfied             |
| `## Decisions Log`                          | clarifying-assumptions   | Step 2 (brief)      | Resolved decisions folded into execution context |
| Per-task `Questions to answer` resolved     | clarifying-assumptions   | Step 1 (pre-flight) | Pre-flight checks all questions are answered     |
| `## Jira Subtasks` table with keys          | creating-jira-subtasks   | Step 8b (Jira)      | Maps task number to Jira subtask key for status  |
| `Jira Subtask: <KEY>` in each task section  | creating-jira-subtasks   | Step 8b (Jira)      | Identifies which Jira issue to transition        |
| `**Status:**` on previously completed tasks | executing-subtask (self) | Step 1 (pre-flight) | Checks whether dependencies are marked complete  |

**Pre-flight gate:** If the `## Jira Subtasks` table is missing, subtasks were
not created in Jira. Warn the user and ask whether to proceed without Jira
integration or run the creating-jira-subtasks skill first. This is a warning,
not a hard block — execution can proceed without Jira tracking.

## Subagent Registry

| Subagent                | Path                                   | Purpose                                                                              |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| `planner-inspector`     | `./subagents/planner-inspector.md`     | Analyzes the task, inspects the codebase, and produces an execution plan with skills |
| `test-strategist`       | `./subagents/test-strategist.md`       | Defines behaviour-driven tests based on business requirements, not implementation    |
| `refactoring-advisor`   | `./subagents/refactoring-advisor.md`   | Evaluates whether existing code needs refactoring before or during task execution    |
| `task-executor`         | `./subagents/task-executor.md`         | Performs the actual implementation work based on the execution brief                 |
| `documentation-writer`  | `./subagents/documentation-writer.md`  | Documents codebase changes, then commits all work as atomic commits                  |
| `clean-code-reviewer`   | `./subagents/clean-code-reviewer.md`   | Reviews for Clean Code, SOLID, and architecture; validates recency of advice         |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Confirms all requirements were met or identifies gaps for another iteration          |

Before delegating, read the subagent file to understand its contract (expected
input format, output format, and rules). The path is relative to this skill's
directory.

## Output

- Implemented code / configuration changes for the specified task.
- Tests covering business requirements.
- Documentation for all changes.
- Atomic commits for all changes (via /commit-work skill).
- Updated task plan with execution status.
- Jira subtask transitioned (if Jira MCP available and subtask keys present).

### Output contract (consumed by orchestrator and self)

After this skill completes for a given task, the plan file must contain these
updates:

| Addition                                        | Consumed by        | Why                                            |
| ----------------------------------------------- | ------------------ | ---------------------------------------------- |
| `**Status:** ✅ Complete (<date>)` on task      | orchestrator, self | Orchestrator tracks progress; self checks deps |
| `**Implementation summary:**` on task           | orchestrator       | Progress file gets a concise summary           |
| `**Files changed:**` list on task               | orchestrator       | Progress reporting                             |
| `## Jira Subtasks` table status updated to Done | orchestrator       | Reflects current state                         |

## Execution Steps

### 1. Load and validate the task

Read `docs/<TICKET_KEY>-tasks.md` and extract `## Task <TASK_NUMBER>`.

**Pre-flight checks — stop if any fail:**

- [ ] The task exists in the plan.
- [ ] Dependencies listed in `Dependencies / prerequisites` are marked complete
      (look for `**Status:** ✅ Complete` on each dependency's task section).
- [ ] `Questions to answer before starting` are all resolved (no unresolved items
      without a recorded fallback — look for strikethrough + answer format or
      `None`).

If pre-flight fails, tell the user what needs to be resolved first and stop.

### 2. Prepare the execution brief

Build a self-contained execution brief that includes ONLY what the subagents
need:

```markdown
# Execution Brief — <TICKET_KEY> Task <N>: <Title>

## Objective

<from task plan>

## Relevant Requirements and Context

<from task plan, plus any resolved decisions from the Decisions Log>

## Implementation Notes

<from task plan — must reflect any updates applied during clarification>

## Definition of Done

<from task plan>

## Likely Files / Artefacts Affected

<from task plan>

## Resolved Questions and Decisions

<any answers from the Decisions Log that affect this task>

## Constraints

- Only implement what is described above.
- Do not modify files unrelated to this task.
- If you encounter ambiguity not covered here, STOP and report it — do not guess.
- Run existing tests to verify you have not broken anything.
- If the definition of done includes new tests, write them.
```

Write this brief to `docs/<TICKET_KEY>-task-<N>-brief.md`.

### 3. Dispatch: Planner-Inspector

Read `./subagents/planner-inspector.md` and dispatch the planner-inspector
subagent with the execution brief path.

The planner-inspector will:

- Analyse the task and the relevant parts of the codebase.
- Use the `/find-skills` skill to identify the best available skills for the task.
- Produce a structured execution plan with recommended skills, approach, and
  file-level strategy.

Collect its output as the `EXECUTION_PLAN`. This plan feeds into all
subsequent subagents.

### 4. Dispatch: Test Strategist

Read `./subagents/test-strategist.md` and dispatch the test-strategist
subagent with the execution brief and the `EXECUTION_PLAN`.

The test strategist will:

- Analyse the business requirements from the execution brief.
- Define a list of behaviour-driven tests (not implementation-detail tests).
- Produce a test specification that the task-executor will implement.

Collect its output as the `TEST_SPEC`.

### 5. Dispatch: Refactoring Advisor

Read `./subagents/refactoring-advisor.md` and dispatch the refactoring-advisor
subagent with the execution brief, `EXECUTION_PLAN`, and `TEST_SPEC`.

The refactoring advisor will:

- Evaluate whether existing code needs changes to accommodate the task cleanly.
- Identify refactoring opportunities that prevent code rot.
- Produce a refactoring recommendation (which may be "no refactoring needed").

Collect its output as the `REFACTORING_PLAN`.

### 6. Dispatch: Task Executor

Read `./subagents/task-executor.md` and dispatch the task-executor subagent
with the execution brief, `EXECUTION_PLAN`, `TEST_SPEC`, and `REFACTORING_PLAN`.

The task executor will:

- Apply any recommended refactoring first.
- Implement the task following the execution plan and recommended skills.
- Write and run the tests from the test specification.
- Produce an execution report.

Collect its output as the `EXECUTION_REPORT`.

**Note:** The task-executor does NOT write documentation — that is handled
separately by the documentation-writer subagent.

### 7. Dispatch: Documentation Writer

Read `./subagents/documentation-writer.md` and dispatch the documentation-writer
subagent with the `EXECUTION_REPORT` (which includes files changed).

The documentation writer will:

- Review all changes made by the task-executor.
- Add or update code comments, docstrings, and inline documentation.
- Use the `/humanizer` skill to ensure all written text reads naturally.
- Use the `/commit-work` skill to commit all changes (implementation, tests,
  and documentation) as atomic, logically scoped commits.
- Produce a documentation report including the list of commits made.

Collect its output as the `DOCUMENTATION_REPORT`.

### 8. Dispatch: Clean Code Reviewer

Read `./subagents/clean-code-reviewer.md` and dispatch the clean-code-reviewer
subagent with the execution brief, `TEST_SPEC`, `REFACTORING_PLAN`,
`EXECUTION_REPORT`, and `DOCUMENTATION_REPORT`.

The clean code reviewer will:

- Review the full picture: task requirements, tests, refactoring decisions,
  implementation, and documentation.
- Check for Clean Code and SOLID principles compliance.
- Check for good architecture patterns.
- Apply the `/recency-guard` skill's validation methodology inline (reading
  the skill for its source hierarchy and confidence scoring, then web-searching
  to verify recommendations are current). Note: since subagents cannot dispatch
  other subagents, the reviewer applies the methodology directly rather than
  running the full /recency-guard pipeline.
- Produce a review verdict with any required fixes.

If the reviewer identifies issues, provide the feedback to the task-executor
subagent for corrections. Limit to **2 fix cycles** — after that, report
remaining issues to the user.

Collect the final output as the `CODE_REVIEW`.

### 9. Dispatch: Requirements Verifier

Read `./subagents/requirements-verifier.md` and dispatch the
requirements-verifier subagent with the execution brief, `TEST_SPEC`,
`EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, and `CODE_REVIEW`.

The requirements verifier will:

- Cross-check every item in the Definition of Done against the actual changes.
- Verify test coverage matches business requirements.
- Confirm documentation is complete.
- Produce a verification verdict: PASS or FAIL with specific gaps.

If the verdict is FAIL, report the gaps to the user and ask whether to run
another iteration targeting the missing requirements. Do NOT automatically
re-run the pipeline — let the user decide.

Collect its output as the `VERIFICATION_RESULT`.

### 10. Update tracking

#### a. Update the task plan

In `docs/<TICKET_KEY>-tasks.md`, update the task section:

```markdown
**Status:** ✅ Complete (<YYYY-MM-DD>)
**Implementation summary:** <2-3 sentence summary of what was done>
**Files changed:**

- `path/to/file1.ts` — <what changed>
- `path/to/file2.ts` — <what changed>
```

#### b. Update Jira (if MCP available)

Look up the Jira subtask key from the `Jira Subtask: <KEY>` line in the task
section, or from the `## Jira Subtasks` table.

- Transition the subtask to "In Progress" at the start of execution (Step 6).
- Transition the subtask to "Done" after successful verification.
- Add a comment to the subtask summarising what was implemented.

If the Jira subtask key is not present (subtasks were never created), skip Jira
updates silently — do not error.

#### c. Update the Jira Subtasks table

If the `## Jira Subtasks` table exists, update the Status column for this task
from `To Do` to `Done`.

#### d. Clean up

Delete the temporary execution brief file:
`docs/<TICKET_KEY>-task-<N>-brief.md`

After deletion, verify the file no longer exists. If deletion fails (e.g.,
permission error), log a warning but do not block — cleanup failure is
non-critical.

### 11. Report to user

```
Task <N> complete: <Title>

Summary: <what was done in 2-3 sentences>

Pipeline results:
- Planning: <skills recommended, approach taken>
- Tests: <N tests defined, N passing>
- Refactoring: <what was refactored, or "none needed">
- Implementation: <files changed count>
- Documentation: <what was documented>
- Commits: <N atomic commits created>
- Code review: <PASS/PASS WITH NOTES> (recency-validated)
- Verification: <PASS/FAIL>

Commits:
- <short hash> — <commit message>
- <short hash> — <commit message>

Files changed:
- <list>

Jira subtask <KEY>: transitioned to Done.

⚠️ Remaining items (if any):
- <anything that could not be fully resolved>

Ready for the next task? Let me know which one to tackle.
```

## Safety Rules

- **One task at a time.** Never auto-continue to the next task.
- **Scope discipline.** Do not implement anything outside the task's scope, even
  if it seems like a quick win.
- **Fail loudly.** If any subagent encounters ambiguity or a blocker, surface it
  to the user immediately rather than making assumptions.
- **Preserve the plan.** The task plan is the source of truth. If execution
  reveals the plan needs changes, propose the change to the user — do not
  silently modify the plan.
- **Respect the pipeline order.** Do not skip subagent steps or reorder them.
  Each step depends on the output of the previous one.
- **Limit retries.** The task-executor gets at most 3 retry cycles. The
  clean-code fix loop gets at most 2 cycles. After that, escalate to the user.
