---
name: "executing-jira-task"
description: 'Execute a single task from a Jira task plan using a structured pipeline of specialist subagents: planning, testing, refactoring, implementation, documentation, code-quality review, architecture review, security audit, and requirements verification. The user must specify which task number to execute. Use when the user says "execute task 3", "work on task 2", "implement task 1", "start task 5 for PROJECT-1234", or "run task N". Also triggered by the orchestrating-jira-workflow skill as Phase 5 of the end-to-end pipeline (called once per task). Requires that the task plan exists at docs/<TICKET_KEY>-tasks.md. Executes ONLY the specified task — never continues to the next one without explicit user approval.'
---

# Executing Jira Task

## Purpose

Execute exactly ONE task from the task plan through a structured pipeline of
specialist subagents. Each subagent handles a specific concern (planning,
testing, refactoring, implementation, documentation, code quality, architecture,
security, requirements verification), keeping the orchestrator's context clean
for coordination and decision-making.

The pipeline ensures tasks are completed with proper planning, test coverage,
clean code practices, sound architecture, verified security, and confirmed
requirements before moving on.

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

| Required section / element                  | Produced by                | Used in step        | Why                                              |
| ------------------------------------------- | -------------------------- | ------------------- | ------------------------------------------------ |
| `## Task <N>:` with all 8 subsections       | planning-jira-tasks        | Step 1 (load)       | Source content for the execution brief           |
| `## Dependency Graph`                       | planning-jira-tasks        | Step 1 (pre-flight) | Validates dependencies are satisfied             |
| `## Decisions Log`                          | clarifying-assumptions     | Step 3 (brief)      | Resolved decisions folded into execution context |
| Per-task `Questions to answer` resolved     | clarifying-assumptions     | Step 1 (pre-flight) | Pre-flight checks all questions are answered     |
| `## Jira Subtasks` table with keys          | creating-jira-subtasks     | Step 13b (Jira)     | Maps task number to Jira subtask key for status  |
| `Jira Subtask: <KEY>` in each task section  | creating-jira-subtasks     | Step 13b (Jira)     | Identifies which Jira issue to transition        |
| `**Status:**` on previously completed tasks | executing-jira-task (self) | Step 1 (pre-flight) | Checks whether dependencies are marked complete  |

**Pre-flight gate:** If the `## Jira Subtasks` table is missing, subtasks were
not created in Jira. Warn the user and ask whether to proceed without Jira
integration or run the creating-jira-subtasks skill first. This is a warning,
not a hard block — execution can proceed without Jira tracking.

## Subagent Registry

| Subagent                | Path                                   | Purpose                                                                                   |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `execution-planner`     | `./subagents/execution-planner.md`     | Analyzes the task, inspects the codebase, and produces an execution plan with skills      |
| `test-strategist`       | `./subagents/test-strategist.md`       | Defines behaviour-driven tests based on business requirements, not implementation         |
| `refactoring-advisor`   | `./subagents/refactoring-advisor.md`   | Evaluates whether existing code needs refactoring before or during task execution         |
| `task-executor`         | `./subagents/task-executor.md`         | Performs the actual implementation work based on the execution brief — cautious by design |
| `documentation-writer`  | `./subagents/documentation-writer.md`  | Documents codebase changes and commits all work as atomic commits                         |
| `clean-code-reviewer`   | `./subagents/clean-code-reviewer.md`   | Reviews for Clean Code, SOLID principles; validates recency via context7                  |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews for DDD and functional programming principles; validates recency via context7     |
| `security-auditor`      | `./subagents/security-auditor.md`      | Audits for security vulnerabilities, credential leaks, and insecure patterns              |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Confirms all requirements were met or identifies gaps for another iteration               |

Before delegating, read the subagent file to understand its contract (expected
input format, output format, and rules). The path is relative to this skill's
directory.

### Skill Dependencies

Several subagents depend on external skills for best results. These are
validated by the orchestrator's `preflight-checker` before execution begins.
If a skill is unavailable, the subagent falls back to its built-in logic.

| Subagent                | Depends on                 | Level       | Fallback behavior                          |
| ----------------------- | -------------------------- | ----------- | ------------------------------------------ |
| `execution-planner`     | `/find-skills`             | Recommended | Cannot discover optimal skills for task    |
| `documentation-writer`  | `/commit-work`             | Recommended | Commits must be done manually              |
| `documentation-writer`  | `/humanizer`               | Recommended | Documentation may have AI writing patterns |
| `clean-code-reviewer`   | `/clean-code`              | Recommended | Uses built-in checklist only               |
| `architecture-reviewer` | `/architecture-patterns`   | Recommended | Uses built-in DDD/FP checklists only       |
| `security-auditor`      | `/security-best-practices` | Recommended | Uses built-in OWASP checklist only         |
| Quality gates (all 3)   | `context7` MCP             | Recommended | Library docs not validated for recency     |

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

---

## Quality Gate Architecture

Three subagents serve as mandatory quality gates. ALL THREE must return a PASS
verdict for the task execution to be considered complete:

| Gate                    | Concern                                              | Runs after              |
| ----------------------- | ---------------------------------------------------- | ----------------------- |
| `clean-code-reviewer`   | Clean Code, SOLID, test quality, documentation       | `documentation-writer`  |
| `architecture-reviewer` | DDD, functional programming, bounded contexts        | `clean-code-reviewer`   |
| `security-auditor`      | Vulnerabilities, credential leaks, insecure patterns | `architecture-reviewer` |

### On quality gate failure — targeted fix cycle

If ANY gate returns a verdict other than PASS, the pipeline does NOT re-run
from the beginning. Instead, a **targeted fix cycle** is triggered:

1. The failing gate's feedback (specific issues, file paths, and recommended
   fixes) is collected.
2. The `task-executor` subagent is re-dispatched with the original execution
   brief PLUS the gate feedback as additional context. The executor addresses
   only the issues raised by the failing gate — it does not redo the entire
   implementation.
3. The `documentation-writer` subagent is re-dispatched to commit the fixes
   as atomic commits.
4. The failing gate is re-run to verify the fixes.

If multiple gates fail in the same run, all gate feedback is collected and
passed to the task-executor together, so all issues are addressed in one fix
cycle. After the fixes are committed, ALL previously failing gates are re-run
in their original order.

**Fix cycle limit:** Maximum 3 targeted fix cycles per task. If the quality
gates still do not pass after 3 fix cycles, escalate to the user with the
accumulated gate feedback and ask how to proceed.

A full pipeline re-run (from step 1) is reserved for cases where the gate
feedback indicates a fundamental approach failure — not code quality issues.
The orchestrator makes this judgment call when the fix cycle limit is
exhausted.

The quality gates also enforce a **commit discipline rule**: if any gate
detects uncommitted changes in the working tree, it MUST stop immediately and
report this to the orchestrator. The orchestrator will then require the
`documentation-writer` subagent to commit all pending changes before the gates
can re-run. This ensures that reviewers always review committed, traceable code.

---

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

### 2. Ensure the working branch

Before any implementation starts, verify the codebase is on the correct
working branch. This prevents changes from landing on `main` or `develop`
directly.

1. Check the current branch (`git branch --show-current`).
2. Check for uncommitted changes (`git status --short`).

**If the correct feature branch already exists and is checked out:** proceed.

**If on `main`, `develop`, or another base branch:**

- Create and check out a feature branch:
  `git checkout -b <TICKET_KEY>-task-<N>/<short-title>`
  (e.g., `JNS-6065-task-3/setup-database-schema`).
- If a branch for this ticket already exists from a previous task
  (e.g., `JNS-6065-task-1/...`), ask the user whether to reuse the
  ticket-level branch or create a new task-level branch.

**If there are uncommitted changes:** stash them before switching branches
and report this to the user. Do NOT silently discard changes.

**Branch naming convention:** `<TICKET_KEY>-task-<N>/<kebab-case-title>`.
The orchestrator or user may override this — if a branch name was provided
in the dispatch, use that instead.

### 3. Prepare the execution brief

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

### 4. Dispatch: Execution Planner

Read `./subagents/execution-planner.md` and dispatch the execution-planner
subagent with the execution brief path.

The execution-planner will:

- Analyse the task and the relevant parts of the codebase.
- Use the `/find-skills` skill to identify the best available skills for the task.
- Produce a structured execution plan with recommended skills, approach, and
  file-level strategy.

Collect its output as the `EXECUTION_PLAN`. This plan feeds into all
subsequent subagents.

### 5. Dispatch: Test Strategist

Read `./subagents/test-strategist.md` and dispatch the test-strategist
subagent with the execution brief and the `EXECUTION_PLAN`.

The test strategist will:

- Analyse the business requirements from the execution brief.
- Define a list of behaviour-driven tests (not implementation-detail tests).
- Produce a test specification that the task-executor will implement.

Collect its output as the `TEST_SPEC`.

### 6. Dispatch: Refactoring Advisor

Read `./subagents/refactoring-advisor.md` and dispatch the refactoring-advisor
subagent with the execution brief, `EXECUTION_PLAN`, and `TEST_SPEC`.

The refactoring advisor will:

- Evaluate whether existing code needs changes to accommodate the task cleanly.
- Identify refactoring opportunities that prevent code rot.
- Produce a refactoring recommendation (which may be "no refactoring needed").

Collect its output as the `REFACTORING_PLAN`.

### 7. Dispatch: Task Executor

Read `./subagents/task-executor.md` and dispatch the task-executor subagent
with the execution brief, `EXECUTION_PLAN`, `TEST_SPEC`, and `REFACTORING_PLAN`.

The task executor operates under a **cautious execution model**: it will STOP
and report back to the orchestrator whenever it encounters ambiguity, unclear
intent, uncertain architectural decisions, or any situation where the correct
course of action is not explicitly documented in its inputs. The orchestrator
must then resolve the ambiguity and re-dispatch the task-executor with updated
guidance.

The task executor will:

- Apply any recommended refactoring first.
- Implement the task following the execution plan and recommended skills.
- Write and run the tests from the test specification.
- STOP and escalate if anything is unclear — it does NOT guess or assume.
- Produce an execution report.

Collect its output as the `EXECUTION_REPORT`.

**If the task-executor stops due to ambiguity:**

1. Review the reported ambiguity.
2. Resolve it with the user if needed.
3. Update the execution brief with the resolution.
4. Re-dispatch the task-executor with the updated brief and the
   `PARTIAL_EXECUTION_REPORT` from the previous run.

**Note:** The task-executor does NOT write documentation — that is handled
separately by the documentation-writer subagent.

### 8. Dispatch: Documentation Writer

Read `./subagents/documentation-writer.md` and dispatch the documentation-writer
subagent with the `EXECUTION_REPORT` (which includes files changed).

The documentation writer will:

- Review all changes made by the task-executor.
- Add or update code comments, docstrings, and inline documentation ONLY in
  files that the task-executor changed. It does NOT modify any other files.
- Use the `/humanizer` skill to ensure all written text reads naturally.
- Use the `/commit-work` skill to commit all changes (implementation, tests,
  and documentation) as atomic, logically scoped commits. It does NOT ask for
  user confirmation — it commits directly.
- Produce a documentation report including the list of commits made.

Collect its output as the `DOCUMENTATION_REPORT`.

### 9. Dispatch: Clean Code Reviewer (Quality Gate 1/3)

Read `./subagents/clean-code-reviewer.md` and dispatch the clean-code-reviewer
subagent with the execution brief, `TEST_SPEC`, `REFACTORING_PLAN`,
`EXECUTION_REPORT`, and `DOCUMENTATION_REPORT`.

**Pre-gate check:** The clean-code-reviewer will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this — the
orchestrator must ensure the documentation-writer commits all pending work
before the review can proceed.

The clean code reviewer will:

- Use the `/clean-code` skill as its primary review reference if available;
  fall back to its built-in checklist otherwise.
- Review the full picture: task requirements, tests, refactoring decisions,
  implementation, and documentation.
- Check for Clean Code and SOLID principles compliance.
- Use the `context7` MCP to retrieve up-to-date documentation for libraries
  used in the project, ensuring recommendations reflect current best practices.
- Produce a review verdict: PASS, PASS WITH SUGGESTIONS, or NEEDS FIXES.

**If verdict is NEEDS FIXES:** Collect the review feedback. Do NOT stop the
gate cycle — continue to the architecture-reviewer and security-auditor so
all issues are identified in one pass. After all three gates have run, trigger
a targeted fix cycle (see Quality Gate Architecture above).

Collect the output as the `CODE_REVIEW`.

### 10. Dispatch: Architecture Reviewer (Quality Gate 2/3)

Read `./subagents/architecture-reviewer.md` and dispatch the
architecture-reviewer subagent with the execution brief, `EXECUTION_PLAN`,
`EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, and `CODE_REVIEW`.

**Pre-gate check:** The architecture-reviewer will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this.

The architecture reviewer will:

- Use the `/architecture-patterns` skill as its primary review reference if
  available; fall back to its built-in DDD/FP checklists otherwise.
- Verify that changes follow domain-driven design principles: bounded contexts,
  aggregates, entities, value objects, domain events, and ubiquitous language.
- Verify that changes follow functional programming principles: functional
  composition, immutability, pure functions, and declarative patterns.
- Explicitly NOT enforce OOP patterns — the codebase should favor composition
  over inheritance, data transformations over stateful objects.
- Use the `context7` MCP to retrieve up-to-date documentation for libraries
  used in the project.
- Produce a review verdict: PASS, PASS WITH SUGGESTIONS, or NEEDS FIXES.

**If verdict is NEEDS FIXES:** Collect the review feedback. Continue to the
security-auditor so all issues are identified in one pass.

Collect the output as the `ARCHITECTURE_REVIEW`.

### 11. Dispatch: Security Auditor (Quality Gate 3/3)

Read `./subagents/security-auditor.md` and dispatch the security-auditor
subagent with the execution brief, `EXECUTION_REPORT`,
`DOCUMENTATION_REPORT`, `CODE_REVIEW`, and `ARCHITECTURE_REVIEW`.

**Pre-gate check:** The security-auditor will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this.

The security auditor will:

- Use the `/security-best-practices` skill as its primary audit reference if
  available; fall back to its built-in OWASP checklist otherwise.
- Audit all changes for security vulnerabilities (injection, XSS, CSRF,
  insecure deserialization, broken access control, etc.).
- Check for credential leaks, hardcoded secrets, and sensitive information
  exposure in code, comments, logs, or error messages.
- Verify secure coding patterns (input validation, output encoding,
  authentication/authorization checks, secure defaults).
- Use the `context7` MCP to retrieve up-to-date security documentation for
  libraries used in the project.
- Produce an audit verdict: PASS, PASS WITH ADVISORIES, or NEEDS FIXES.

**If verdict is NEEDS FIXES:** Collect the audit feedback.

### 11a. Targeted fix cycle (if any gate returned NEEDS FIXES)

After all three gates have run, check whether any returned NEEDS FIXES. If
all three passed, skip to step 12.

If one or more gates returned NEEDS FIXES:

1. **Collect all feedback.** Merge the NEEDS FIXES feedback from every failing
   gate into a single consolidated fix brief. Include specific file paths,
   line numbers, and recommended fixes from each gate.

2. **Re-dispatch the task-executor.** Pass the original execution brief PLUS
   the consolidated fix brief as additional context. The executor addresses
   only the issues raised by the failing gates — it does not redo the entire
   implementation.

3. **Re-dispatch the documentation-writer.** Pass the fix execution report so
   the documentation-writer can commit the fixes as atomic commits.

4. **Re-run only the previously failing gates.** If only the security-auditor
   failed, only re-run the security-auditor. If clean-code-reviewer and
   architecture-reviewer both failed, re-run both (in their original order).
   Gates that already passed do not need to re-run.

5. **Check results.** If all re-run gates now pass, continue to step 12. If
   any still fail, repeat this fix cycle.

**Fix cycle limit:** Maximum 3 targeted fix cycles per task. If the quality
gates still do not pass after 3 fix cycles, escalate to the user with the
accumulated gate feedback and ask how to proceed. The user may choose to:

- Accept the current state and move on.
- Provide guidance for a different approach.
- Request a full pipeline re-run from step 1 (reserved for fundamental
  approach failures, not code quality issues).

Collect the output as the `SECURITY_AUDIT`.

### 12. Dispatch: Requirements Verifier

Read `./subagents/requirements-verifier.md` and dispatch the
requirements-verifier subagent with the execution brief, `TEST_SPEC`,
`EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `CODE_REVIEW`,
`ARCHITECTURE_REVIEW`, and `SECURITY_AUDIT`.

The requirements verifier will:

- Cross-check every item in the Definition of Done against the actual changes.
- Verify test coverage matches business requirements.
- Confirm documentation is complete.
- Confirm all three quality gates passed.
- Produce a verification verdict: PASS or FAIL with specific gaps.

If the verdict is FAIL, report the gaps to the user and ask whether to run
another iteration targeting the missing requirements. Do NOT automatically
re-run the pipeline — let the user decide.

Collect its output as the `VERIFICATION_RESULT`.

### 13. Update tracking

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

- Transition the subtask to "In Progress" at the start of execution (Step 7).
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

### 14. Report to user

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
- Code review: <PASS/PASS WITH NOTES> (recency-validated via context7)
- Architecture review: <PASS/PASS WITH NOTES> (DDD + FP validated)
- Security audit: <PASS/PASS WITH ADVISORIES>
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
- **Limit retries.** The task-executor gets at most 3 retry cycles for
  ambiguity escalations within a single pipeline run. The targeted fix cycle
  (triggered by quality gate failures) is limited to 3 iterations within this
  skill. Full pipeline re-runs are reserved for fundamental approach failures
  and require user approval.
- **Quality gates are non-negotiable.** All three quality gates (clean-code,
  architecture, security) must pass. There is no override, no "good enough."
