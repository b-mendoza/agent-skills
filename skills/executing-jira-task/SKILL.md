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

| Subagent                | Path                                   | Purpose                                                                                                            |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `execution-prepper`     | `./subagents/execution-prepper.md`     | Pre-execution: validates task, sets up branch, transitions Jira to In Progress, assembles execution brief          |
| `execution-planner`     | `./subagents/execution-planner.md`     | Analyzes the task, inspects the codebase, and produces an execution plan with skills                               |
| `test-strategist`       | `./subagents/test-strategist.md`       | Defines behaviour-driven tests based on business requirements, not implementation                                  |
| `refactoring-advisor`   | `./subagents/refactoring-advisor.md`   | Evaluates whether existing code needs refactoring before or during task execution                                  |
| `task-executor`         | `./subagents/task-executor.md`         | Performs the actual implementation work based on the execution brief — cautious by design                          |
| `documentation-writer`  | `./subagents/documentation-writer.md`  | Documents codebase changes, commits all work, and handles post-execution tracking (plan updates, Jira transitions) |
| `clean-code-reviewer`   | `./subagents/clean-code-reviewer.md`   | Reviews for Clean Code, SOLID principles; validates recency via context7                                           |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews for DDD and functional programming principles; validates recency via context7                              |
| `security-auditor`      | `./subagents/security-auditor.md`      | Audits for security vulnerabilities, credential leaks, and insecure patterns                                       |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Pre-gate coverage check — confirms all requirements are met before quality gates run                               |

Before delegating, read the subagent file to understand its contract (expected
input format, output format, and rules). The path is relative to this skill's
directory.

### Skill Dependencies

All subagents depend on external skills that **must** be installed before
execution. These are validated by the orchestrator's `preflight-checker`
before execution begins AND by each subagent at runtime (defense-in-depth).

**If any skill is missing**, the subagent will STOP immediately and report
the missing skill to the orchestrator. The orchestrator will then prompt the
user to install the skill and re-dispatch the subagent from the beginning.
There is no fallback behavior — all skills are required.

| Subagent                | Depends on                     | Level    | Install command                                                                 |
| ----------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `execution-planner`     | `/find-skills`                 | Required | `skills install vercel-labs/skills/find-skills`                                 |
| `execution-planner`     | `/writing-plans`               | Required | `skills install obra/superpowers/writing-plans`                                 |
| `test-strategist`       | `/writing-plans`               | Required | `skills install obra/superpowers/writing-plans`                                 |
| `test-strategist`       | `/test-driven-development`     | Required | `skills install obra/superpowers/test-driven-development`                       |
| `test-strategist`       | `/vitest`                      | Required | `skills install antfu/skills/vitest`                                            |
| `refactoring-advisor`   | `/writing-plans`               | Required | `skills install obra/superpowers/writing-plans`                                 |
| `task-executor`         | `/executing-plans`             | Required | `skills install obra/superpowers/executing-plans`                               |
| `documentation-writer`  | `/commit-work`                 | Required | `skills install softaworks/agent-toolkit/commit-work`                           |
| `documentation-writer`  | `/humanizer`                   | Required | `skills install blader/humanizer`                                               |
| `clean-code-reviewer`   | `/clean-code`                  | Required | `skills install sickn33/antigravity-awesome-skills/clean-code`                  |
| `architecture-reviewer` | `/architecture-patterns`       | Required | `skills install wshobson/agents/architecture-patterns`                          |
| `security-auditor`      | `/api-security-best-practices` | Required | `skills install sickn33/antigravity-awesome-skills/api-security-best-practices` |
| Quality gates (all 3)   | `context7` MCP                 | Required | Connect context7 MCP in your IDE/CLI settings                                   |

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
verdict for the task execution to be considered complete. The
`requirements-verifier` runs before the gates (step 7) to confirm coverage
is complete — the gates then review code that is known to address all
requirements.

| Gate                    | Concern                                              | Runs after              |
| ----------------------- | ---------------------------------------------------- | ----------------------- |
| `clean-code-reviewer`   | Clean Code, SOLID, test quality, documentation       | `requirements-verifier` |
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

### 1. Dispatch: Execution Prepper

Read `./subagents/execution-prepper.md` and dispatch the execution-prepper
subagent with:

- `TICKET_KEY`
- `TASK_NUMBER`
- `BRANCH_OVERRIDE` (if the orchestrator or user specified a branch name)

The execution-prepper handles four setup steps in one dispatch:

1. **Validates the task** — checks that the task exists, dependencies are
   marked complete, and all questions are resolved.
2. **Ensures the working branch** — checks current branch, creates or switches
   to the feature branch, stashes uncommitted changes if needed.
3. **Transitions the Jira subtask to "In Progress"** — if the subtask key
   and Jira MCP are available. Skips silently if not.
4. **Assembles the execution brief** — reads the task plan and Decisions Log,
   builds a self-contained brief, writes it to
   `docs/<TICKET_KEY>-task-<N>-brief.md`.

Collect its output as the `PREP_SUMMARY`.

**If pre-flight FAIL:** The subagent reports what needs resolution (unsatisfied
dependencies or unresolved questions). Relay this to the user and stop — do
not proceed to the execution pipeline.

**If an existing ticket branch was found:** The subagent notes this. Ask the
user whether to reuse the existing branch or create a new task-level branch.
If the user chooses to reuse, re-dispatch with the branch name as
`BRANCH_OVERRIDE`.

**If changes were stashed:** Inform the user that uncommitted changes were
stashed and will need to be popped later.

After the prep summary confirms PASS, proceed to step 2 using the brief file
path from the summary.

### 2. Dispatch: Execution Planner

Read `./subagents/execution-planner.md` and dispatch the execution-planner
subagent with the execution brief path.

The execution-planner will:

- Analyse the task and the relevant parts of the codebase.
- Use the `/find-skills` skill to identify the best available skills for the task.
- Produce a structured execution plan with recommended skills, approach, and
  file-level strategy.

Collect its output as the `EXECUTION_PLAN`. This plan feeds into all
subsequent subagents.

### 3. Dispatch: Test Strategist

Read `./subagents/test-strategist.md` and dispatch the test-strategist
subagent with the execution brief and the `EXECUTION_PLAN`.

The test strategist will:

- Analyse the business requirements from the execution brief.
- Define a list of behaviour-driven tests (not implementation-detail tests).
- Produce a test specification that the task-executor will implement.

Collect its output as the `TEST_SPEC`.

### 4. Dispatch: Refactoring Advisor

Read `./subagents/refactoring-advisor.md` and dispatch the refactoring-advisor
subagent with the execution brief, `EXECUTION_PLAN`, and `TEST_SPEC`.

The refactoring advisor will:

- Evaluate whether existing code needs changes to accommodate the task cleanly.
- Identify refactoring opportunities that prevent code rot.
- Produce a refactoring recommendation (which may be "no refactoring needed").

Collect its output as the `REFACTORING_PLAN`.

### 5. Dispatch: Task Executor

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

### 6. Dispatch: Documentation Writer

Read `./subagents/documentation-writer.md` and dispatch the documentation-writer
subagent with the `EXECUTION_REPORT`, `TICKET_KEY`, and `TASK_NUMBER`.

The documentation writer will:

- Review all changes made by the task-executor.
- Add or update code comments, docstrings, and inline documentation ONLY in
  files that the task-executor changed. It does NOT modify any other files.
- Use the `/humanizer` skill to ensure all written text reads naturally.
- Use the `/commit-work` skill to commit all changes (implementation, tests,
  and documentation) as atomic, logically scoped commits. It does NOT ask for
  user confirmation — it commits directly.
- **Update the task plan** with completion status, implementation summary, and
  files changed.
- **Transition the Jira subtask** to "Done" (if MCP available and subtask key
  present).
- **Update the `## Jira Subtasks` table** status to "Done".
- Produce a documentation report including commits, tracking updates, and any
  issues.

Collect its output as the `DOCUMENTATION_REPORT`.

### 7. Dispatch: Requirements Verifier (pre-gate coverage check)

Read `./subagents/requirements-verifier.md` and dispatch the
requirements-verifier subagent with the execution brief, `TEST_SPEC`,
`EXECUTION_REPORT`, and `DOCUMENTATION_REPORT`.

The requirements verifier runs BEFORE the quality gates to catch coverage
gaps early. This prevents the gates from reviewing code that is missing
functionality — wasting a full gate cycle on incomplete work.

The requirements verifier will:

- Cross-check every item in the Definition of Done against the actual changes.
- Verify test coverage matches business requirements.
- Confirm documentation is complete.
- Produce a verification verdict: PASS or FAIL with specific gaps.

**If the verdict is FAIL:** Report the gaps to the user and ask whether to
address the missing requirements before running the quality gates, or proceed
with the gates on the current implementation. Do NOT automatically re-run
the pipeline — let the user decide.

**If the verdict is PASS:** Proceed to the quality gates.

Collect its output as the `VERIFICATION_RESULT`. Pass it to the quality
gates as additional context so they know whether requirements coverage is
complete.

### 8. Dispatch: Clean Code Reviewer (Quality Gate 1/3)

Read `./subagents/clean-code-reviewer.md` and dispatch the clean-code-reviewer
subagent with the execution brief, `TEST_SPEC`, `REFACTORING_PLAN`,
`EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, and `VERIFICATION_RESULT`.

**Pre-gate check:** The clean-code-reviewer will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this — the
orchestrator must ensure the documentation-writer commits all pending work
before the review can proceed.

The clean code reviewer will:

- Use the `/clean-code` skill as its primary review reference (required —
  subagent will stop if not available).
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

### 9. Dispatch: Architecture Reviewer (Quality Gate 2/3)

Read `./subagents/architecture-reviewer.md` and dispatch the
architecture-reviewer subagent with the execution brief, `EXECUTION_PLAN`,
`EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, and `CODE_REVIEW`.

**Pre-gate check:** The architecture-reviewer will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this.

The architecture reviewer will:

- Use the `/architecture-patterns` skill as its primary review reference
  (required — subagent will stop if not available).
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

### 10. Dispatch: Security Auditor (Quality Gate 3/3)

Read `./subagents/security-auditor.md` and dispatch the security-auditor
subagent with the execution brief, `EXECUTION_REPORT`,
`DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, and `ARCHITECTURE_REVIEW`.

**Pre-gate check:** The security-auditor will first check for uncommitted
changes. If uncommitted changes exist, it stops and reports this.

The security auditor will:

- Use the `/api-security-best-practices` skill as its primary audit reference
  (required — subagent will stop if not available).
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

### 10a. Targeted fix cycle (if any gate returned NEEDS FIXES)

After all three gates have run, check whether any returned NEEDS FIXES. If
all three passed, skip to step 11.

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

5. **Check results.** If all re-run gates now pass, continue to step 11. If
   any still fail, repeat this fix cycle.

**Fix cycle limit:** Maximum 3 targeted fix cycles per task. If the quality
gates still do not pass after 3 fix cycles, escalate to the user with the
accumulated gate feedback and ask how to proceed. The user may choose to:

- Accept the current state and move on.
- Provide guidance for a different approach.
- Request a full pipeline re-run from step 1 (reserved for fundamental
  approach failures, not code quality issues).

Collect the output as the `SECURITY_AUDIT`.

### 11. Clean up

Delete the temporary execution brief file:

```bash
rm -f docs/<TICKET_KEY>-task-<N>-brief.md
```

Cleanup failure is non-critical — log a warning but do not block.

**Note:** Post-execution tracking (plan file updates, Jira subtask transitions,
Jira Subtasks table updates) is handled by the `documentation-writer` subagent
in step 6. Check the `DOCUMENTATION_REPORT` for the tracking status. If any
tracking update failed, relay it to the user in the report below.

### 12. Report to user

```
Task <N> complete: <Title>

Summary: <what was done in 2-3 sentences>

Pipeline results:
- Prep: <branch name, pre-flight PASS>
- Planning: <skills recommended, approach taken>
- Tests: <N tests defined, N passing>
- Refactoring: <what was refactored, or "none needed">
- Implementation: <files changed count>
- Documentation: <what was documented>
- Commits: <N atomic commits created>
- Tracking: <plan updated, Jira transitioned — from DOCUMENTATION_REPORT>
- Requirements verification: <PASS/FAIL> (pre-gate coverage check)
- Code review: <PASS/PASS WITH NOTES> (recency-validated via context7)
- Architecture review: <PASS/PASS WITH NOTES> (DDD + FP validated)
- Security audit: <PASS/PASS WITH ADVISORIES>

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

## Handling BLOCKED Verdicts (Missing Required Skills)

Every subagent checks for its required skills as its absolute first step
(defense-in-depth). If a subagent returns a `BLOCKED — MISSING REQUIRED
SKILL` verdict:

1. **Do NOT proceed** to the next pipeline step. The blocked subagent's
   output is required by downstream steps.
2. **Present the missing skill(s)** to the user with install commands from
   the subagent's report.
3. **Wait for the user** to confirm the skill(s) have been installed.
4. **Re-dispatch the blocked subagent from the beginning.** Do not attempt
   to resume from a partial state — the subagent performs no work before
   the skill check, so there is nothing to resume.

This applies to ANY subagent in the pipeline (steps 1–10). The orchestrator
should present the install instructions clearly:

```
⚠️ Missing required skill — pipeline paused

The <subagent-name> subagent requires the following skill(s):

- `/<skill-name>` — <purpose>
  Install: `skills install <path>`

Please install the skill(s) and let me know when ready to continue.
```

After the user confirms installation, re-dispatch the same subagent with the
same inputs it was originally given.
