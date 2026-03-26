---
name: "planning-jira-tasks"
description: 'Create an implementation task plan from a previously retrieved Jira ticket document. Breaks the ticket into the smallest practical set of focused, independent, and executable tasks. Use when the user says "plan the ticket", "create tasks", "break down the ticket", "create an implementation plan", "plan JNS-1234", "decompose this ticket", "what needs to be done for this ticket", or "make a task plan". Also triggered by the orchestrating-jira-workflow skill as Phase 2 of the end-to-end pipeline. Requires that the ticket information has already been retrieved into docs/<TICKET_KEY>.md. This skill produces a plan ONLY — it does NOT implement anything. Works with Claude Code CLI, Cursor IDE, and OpenCode CLI.'
---

# Planning Jira Tasks

## Purpose

Read the ticket snapshot at `docs/<TICKET_KEY>.md` and produce a detailed,
self-contained task plan at `docs/<TICKET_KEY>-tasks.md`. Each task must carry
enough local context that a future agent with zero prior knowledge can execute
it in isolation.

This skill orchestrates a **pipeline of specialized subagents**, each handling
one phase of the planning process. The main agent coordinates handoffs, manages
intermediate artifacts, and performs a final quality check.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The ticket snapshot file must already exist at `docs/<TICKET_KEY>.md`.
If it does not, tell the user to run the **fetching-jira-ticket** skill first.

### Input contract (produced by upstream skill)

The input file `docs/<TICKET_KEY>.md` must contain these sections (produced by
the `fetching-jira-ticket` skill). If any are missing, the ticket was not
fetched correctly — stop and ask the user to re-fetch.

| Required section         | Used by subagent(s)           | Why                                         |
| ------------------------ | ----------------------------- | ------------------------------------------- |
| `## Description`         | task-decomposer, task-planner | Primary source for identifying work items   |
| `## Acceptance Criteria` | task-planner, task-validator  | Maps to Definition of Done per task         |
| `## Comments`            | task-decomposer, task-planner | Contains decisions and scope clarifications |
| `## Subtasks`            | task-decomposer               | Existing work to account for, not duplicate |
| `## Linked Issues`       | dependency-mapper             | Cross-ticket dependency awareness           |

## Output

```
docs/<TICKET_KEY>-tasks.md
```

### Output contract (consumed by downstream skills)

The output file **must** contain all of these sections for downstream skills to
function correctly.

| Section                              | Required by                                                       | Why                                            |
| ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------- |
| `## Ticket Summary`                  | clarifying-assumptions                                            | Context for question presentation              |
| `## Assumptions and Constraints`     | clarifying-assumptions                                            | Items to confirm with user                     |
| `## Cross-Cutting Open Questions`    | clarifying-assumptions                                            | Questions that affect multiple tasks           |
| `## Tasks` (each with 6 subsections) | clarifying-assumptions, creating-jira-subtasks, executing-subtask | The core plan content                          |
| `## Execution Order Summary`         | creating-jira-subtasks                                            | Determines subtask creation sequence           |
| `## Dependency Graph`                | executing-subtask                                                 | Pre-flight dependency checks before execution  |
| `## Validation Report`               | clarifying-assumptions                                            | WARN/FAIL items become clarification questions |

**Required subsections per task** (enforced by task-validator):

1. `**Objective:**`
2. `**Relevant requirements and context:**`
3. `**Questions to answer before starting:**`
4. `**Implementation notes:**`
5. `**Definition of done:**`
6. `**Likely files / artifacts affected:**`

Plus these annotations added by later pipeline stages:

7. `**Dependencies / prerequisites:**` (added by dependency-mapper)
8. `**Priority:**` annotation (added by task-prioritizer)

## Subagent Registry

| Subagent            | Path                               | Purpose                          |
| ------------------- | ---------------------------------- | -------------------------------- |
| `task-decomposer`   | `./subagents/task-decomposer.md`   | Raw task list (the WHAT)         |
| `task-planner`      | `./subagents/task-planner.md`      | Detailed tasks (the HOW)         |
| `dependency-mapper` | `./subagents/dependency-mapper.md` | Dependency graph + critical path |
| `task-prioritizer`  | `./subagents/task-prioritizer.md`  | Final execution order            |
| `task-validator`    | `./subagents/task-validator.md`    | QA gate — 19 validation checks   |

Read each subagent file only when you are about to dispatch to it — do not
preload all definitions.

## Platform-Specific Dispatch

This skill works across multiple AI coding tools. Read
`./references/platform-dispatch.md` to determine the correct subagent dispatch
syntax for your current environment.

**Quick reference:**

| Platform     | Dispatch mechanism                                             |
| ------------ | -------------------------------------------------------------- |
| Claude Code  | `agent` tool — co-located `.md` files in `subagents/`          |
| Cursor IDE   | Native subagents (2.4+) — `.cursor/agents/` or inline dispatch |
| OpenCode CLI | Task tool — `.opencode/agents/` or `@mention` invocation       |

All three platforms have native subagent support. The co-located subagent
`.md` files in this skill's `subagents/` directory are compatible with all
platforms. See the reference file for platform-specific dispatch details and
tips.

### Pipeline flow

```
docs/<KEY>.md (ticket snapshot)
       │
       ▼
┌──────────────────┐
│  task-decomposer │  → Raw task list (what needs doing)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  task-planner    │  → Detailed tasks (how to do each one)
└────────┬─────────┘
         ▼
┌──────────────────────┐
│  dependency-mapper   │  → Tasks with dependency graph + ordering
└────────┬─────────────┘
         ▼
┌──────────────────┐
│  task-prioritizer│  → Final ordered task list
└────────┬─────────┘
         ▼
┌──────────────────┐
│  task-validator  │  → Validated plan with issues flagged
└──────────────────┘
         │
         ▼
docs/<KEY>-tasks.md (final plan)
```

### Intermediate files

Each subagent writes to a stage file. These are working artifacts — they get
cleaned up after the final plan is written.

| Stage | File                                 | Subagent          |
| ----- | ------------------------------------ | ----------------- |
| 1     | `docs/<KEY>-stage-1-decomposed.md`   | task-decomposer   |
| 2     | `docs/<KEY>-stage-2-detailed.md`     | task-planner      |
| 3     | `docs/<KEY>-stage-3-dependencies.md` | dependency-mapper |
| 4     | `docs/<KEY>-stage-4-prioritized.md`  | task-prioritizer  |
| 5     | `docs/<KEY>-tasks.md` (final)        | task-validator    |

## Execution Steps

### 1. Pre-flight

- Verify `docs/<TICKET_KEY>.md` exists. If not, stop and tell the user.
- Read the file to confirm it follows the expected template (has `## Description`,
  `## Subtasks`, etc.). If required sections from the input contract table above
  are missing, stop and ask the user to re-fetch the ticket.

### 2. Run the pipeline

Execute each subagent in order. After each stage, do a quick sanity check on the
output before proceeding.

#### Stage 1 — Decompose

```
agent task-decomposer "Read docs/<KEY>.md and write a decomposed task list to docs/<KEY>-stage-1-decomposed.md"
```

**Sanity check:** File exists and contains at least 2 tasks.

#### Stage 2 — Detail

```
agent task-planner "Read docs/<KEY>.md (ticket) and docs/<KEY>-stage-1-decomposed.md (task list), then write detailed tasks to docs/<KEY>-stage-2-detailed.md"
```

**Sanity check:** Every task from Stage 1 is present with all required
subsections (Objective, Implementation notes, Definition of done).

#### Stage 3 — Map dependencies

```
agent dependency-mapper "Read docs/<KEY>-stage-2-detailed.md and write dependency-annotated tasks to docs/<KEY>-stage-3-dependencies.md"
```

**Sanity check:** Every task has a `Dependencies / prerequisites` field.

#### Stage 4 — Prioritize

```
agent task-prioritizer "Read docs/<KEY>-stage-3-dependencies.md and write the prioritized plan to docs/<KEY>-stage-4-prioritized.md"
```

**Sanity check:** Tasks are renumbered in execution order. Priority rationale
is present.

#### Stage 5 — Validate

```
agent task-validator "Read docs/<KEY>.md (ticket) and docs/<KEY>-stage-4-prioritized.md (plan), then write the validated final plan to docs/<KEY>-tasks.md"
```

**Sanity check:** File exists. Validation report section is present.

### 3. Post-pipeline output validation

After Stage 5 completes, verify the final `docs/<KEY>-tasks.md` satisfies the
output contract. Specifically check:

- [ ] `## Ticket Summary` section exists.
- [ ] `## Assumptions and Constraints` section exists.
- [ ] `## Cross-Cutting Open Questions` section exists (even if empty).
- [ ] `## Execution Order Summary` table exists.
- [ ] `## Dependency Graph` section exists.
- [ ] `## Validation Report` section exists.
- [ ] Every `## Task N:` section has all 8 required subsections.

If any are missing, the task-validator should have caught them. Re-run Stage 5
with specific feedback about what's missing. If it fails again, stop and report.

### 4. Clean up intermediate files

After the final `docs/<KEY>-tasks.md` is written and passes validation:

```bash
rm -f docs/<KEY>-stage-1-decomposed.md
rm -f docs/<KEY>-stage-2-detailed.md
rm -f docs/<KEY>-stage-3-dependencies.md
rm -f docs/<KEY>-stage-4-prioritized.md
```

### 5. Report to user

Tell the user:

- File path written.
- Total number of tasks created.
- Number of open questions flagged across all tasks.
- Number of dependency chains identified.
- Any validation warnings from Stage 5.
- Remind them that no implementation has started.

## Error Handling

- If any subagent fails, do NOT proceed to the next stage. Report the failure
  to the user with the stage number and error.
- If a sanity check fails, retry the subagent ONCE with specific feedback about
  what was missing. If it fails again, stop and report.
- Intermediate files are NOT cleaned up on failure — they help with debugging.

## Task-Planning Rules (enforced across subagents)

These rules are embedded in each subagent but listed here for reference:

- Keep tasks as small, focused, and independent as possible.
- Do not combine unrelated work into a single task.
- Prefer tasks that can be started, paused, reassigned, or clarified in isolation.
- If a task depends on missing information, call that out explicitly.
- Preserve traceability: each task references which requirement(s) it addresses.
- Include enough task-local context for zero-context execution.
- Order tasks in a sensible implementation sequence.
- Split large or ambiguous tasks until they are practical and self-contained.
