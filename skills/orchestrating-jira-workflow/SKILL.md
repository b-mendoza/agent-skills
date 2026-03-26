---
name: "orchestrating-jira-workflow"
description: 'Top-level orchestrator for the end-to-end Jira ticket workflow: fetch, plan, clarify, create subtasks, execute. Use this skill whenever the user wants to work on a Jira ticket from start to finish, says "work on ticket PROJECT-1234", "start the Jira workflow", "handle this ticket end to end", "orchestrate PROJECT-1234", "pick up PROJECT-1234", or provides a Jira ticket key or URL without specifying a particular phase. Also trigger when the user says "resume ticket PROJECT-1234", "where did we leave off on PROJECT-1234", "continue PROJECT-1234", or "what''s the status of PROJECT-1234". This skill coordinates all downstream skills and subagents — it never runs tool calls, CLI commands, file reads, web searches, or MCP calls directly.'
---

# Orchestrating Jira Workflow

## Purpose

Coordinate the complete lifecycle of a Jira ticket through five sequential
phases. This skill is a **pure coordinator** — it dispatches to subagents and
downstream skills, tracks progress via summaries, manages handoffs between
phases, and handles errors.

The orchestrator's context window is the most expensive resource in the system.
Every byte of raw file content, git diff, API response, or command output that
leaks into it degrades decision-making quality for every subsequent step. This
is why the orchestrator never does heavy lifting — it delegates everything and
operates only on concise summaries returned by subagents.

## Inputs

| Input        | Source              | Required | Example                                                     |
| ------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065`                                                  |
| `JIRA_URL`   | User (optional)     | No       | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

If the user provides a full URL, extract the ticket key from it.

## Pipeline Overview

```
Phase 1: Fetch           →  docs/<KEY>.md
Phase 2: Plan            →  docs/<KEY>-tasks.md
Phase 3: Clarify         →  docs/<KEY>-tasks.md (updated with decisions)
Phase 4: Create subtasks →  Jira subtasks created + plan updated with keys
Phase 5: Execute         →  Code changes, one task at a time
```

## Subagent Registry

These are the orchestrator's utility subagents. Dispatch to these instead of
running tool calls, reading files, or executing commands directly.

| Subagent                | Path                                   | Purpose                                                                                   |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `artifact-validator`    | `./subagents/artifact-validator.md`    | Check whether phase artifacts exist and are well-formed; return a pass/fail summary       |
| `progress-tracker`      | `./subagents/progress-tracker.md`      | Read, create, or update the progress file; return current workflow state as a summary     |
| `ticket-status-checker` | `./subagents/ticket-status-checker.md` | Query Jira for the current status, assignee, and recent activity on a ticket              |
| `codebase-inspector`    | `./subagents/codebase-inspector.md`    | Report the current state of the working tree: branch, uncommitted changes, recent commits |
| `code-reference-finder` | `./subagents/code-reference-finder.md` | Search the codebase for symbols, patterns, or file references; return concise matches     |
| `documentation-finder`  | `./subagents/documentation-finder.md`  | Locate relevant docs, READMEs, or wiki pages for a given topic; return summaries          |
| `git-operator`          | `./subagents/git-operator.md`          | Execute git operations: create branches, push, stash, checkout, merge, and commit work    |

### How to Dispatch

The subagent `.md` files above are co-located reference documents. To dispatch:

1. Read the subagent's `.md` file from the path in the registry.
2. Use the **Task tool** to spawn a subagent, passing the `.md` content as the
   system prompt and the step's inputs as the user message.
3. Collect the returned summary.
4. Use the summary to decide the next action.

Subagents run sequentially by default. Parallel dispatch is acceptable for
independent utility calls (e.g., `codebase-inspector` + `documentation-finder`
before a task) but never for dependent operations.

## Downstream Skills (Phase Handlers)

Each phase is handled by a dedicated skill. The orchestrator reads their
SKILL.md only when invoking them.

| Phase | Skill                  | Skill Path (relative to skills root) | Purpose                                           |
| ----- | ---------------------- | ------------------------------------ | ------------------------------------------------- |
| 1     | fetching-jira-ticket   | `../fetching-jira-ticket/SKILL.md`   | Retrieve all ticket data into a Markdown snapshot |
| 2     | planning-jira-tasks    | `../planning-jira-tasks/SKILL.md`    | Decompose ticket into a prioritized task plan     |
| 3     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` | Walk user through open questions and assumptions  |
| 4     | creating-jira-subtasks | `../creating-jira-subtasks/SKILL.md` | Push planned tasks to Jira as subtasks            |
| 5     | executing-subtask      | `../executing-subtask/SKILL.md`      | Execute one task at a time from the plan          |

## Data Contracts Between Phases

Each phase produces an artifact that the next phase consumes. Validate via
`artifact-validator` before advancing.

| Transition | Artifact                          | Validation                                    |
| ---------- | --------------------------------- | --------------------------------------------- |
| 1 → 2      | `docs/<KEY>.md`                   | File exists, has `## Description` section     |
| 2 → 3      | `docs/<KEY>-tasks.md`             | File exists, has `## Tasks` section, ≥2 tasks |
| 3 → 4      | `docs/<KEY>-tasks.md` (updated)   | File has `## Decisions Log` section           |
| 4 → 5      | `docs/<KEY>-tasks.md` (with keys) | File has `## Jira Subtasks` table with keys   |

## Execution Steps

### 1. Determine starting phase

Dispatch to `progress-tracker` with action `read` and the `TICKET_KEY`.

Based on the returned summary:

| Progress indicates…                   | Resume from |
| ------------------------------------- | ----------- |
| No artifacts found                    | Phase 1     |
| Phase 1 complete, Phase 2 not started | Phase 2     |
| Phases 1–2 complete, Phase 3 not done | Phase 3     |
| Phases 1–3 complete, Phase 4 not done | Phase 4     |
| Phases 1–4 complete, tasks remaining  | Phase 5     |

Tell the user what was found and which phase you'll start from. If resuming
from a phase beyond 1, ask for confirmation before proceeding.

### 2. Execute phases sequentially

For each phase:

**a. Announce it**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase <N>/5 — <Phase name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**b. Validate preconditions** — dispatch to `artifact-validator`. Only proceed
if it passes.

**c. Invoke the downstream skill** — read its SKILL.md and follow its contract.
Pass explicit inputs; never rely on ambient context.

**d. Validate the output** — dispatch to `artifact-validator` again to confirm
the phase artifact was produced correctly.

**e. Update progress** — dispatch to `progress-tracker` with the phase number,
status, and a one-line outcome summary.

**f. Gate before advancing**

| Transition | Gate                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| 1 → 2      | Automatic                                                                  |
| 2 → 3      | Automatic                                                                  |
| 3 → 4      | Ask user — this creates Jira subtasks (point of no return for Jira writes) |
| 4 → 5      | Ask user which task to execute first — never auto-start execution          |
| Within 5   | After each task, ask user which task next — never auto-continue            |

For the Phase 3 → 4 gate, offer these options:

- "Create subtasks now"
- "Review the plan first"
- "Stop here — I'll create subtasks manually"

### 3. Handle Phase 5 (execution loop)

Phase 5 is iterative — it runs once per task, not once for the plan. Each
iteration follows this cycle:

1. Dispatch to `progress-tracker` to get remaining tasks.
2. Present remaining tasks to the user.
3. Ask the user which task to execute.
4. **Pre-task context gathering** — dispatch to relevant utility subagents as
   needed. Use this routing table:

   | Situation                        | Dispatch to             |
   | -------------------------------- | ----------------------- |
   | Need current ticket status       | `ticket-status-checker` |
   | Need working tree / branch state | `codebase-inspector`    |
   | Need to find relevant code       | `code-reference-finder` |
   | Need docs or config context      | `documentation-finder`  |
   | Need a feature branch            | `git-operator`          |

5. Invoke the `executing-subtask` skill, passing context summaries from step 4
   as explicit inputs.
6. After the task completes, dispatch to `git-operator` with operation
   `commit-work` to commit the changes. The git-operator delegates to the
   `/commit-work` skill, which produces atomic, well-scoped commits.
7. Dispatch to `progress-tracker` to mark the task complete.
8. Return to step 1.

Continue until all tasks are complete or the user decides to stop.

### 4. Final summary

When all tasks are complete (or the user stops), dispatch to `progress-tracker`
for the final state, then present:

```markdown
## Workflow Summary — <TICKET_KEY>

| Phase | Status      | Key outcome                 |
| ----- | ----------- | --------------------------- |
| 1     | ✅ Complete | Ticket fetched (N comments) |
| 2     | ✅ Complete | N tasks planned             |
| 3     | ✅ Complete | N/N questions resolved      |
| 4     | ✅ Complete | N subtasks created in Jira  |
| 5     | ✅ Complete | N/N tasks executed          |

All artifacts are in docs/<TICKET_KEY>\*.
```

## Error Handling

| Error type               | Response                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill failure**        | Record via `progress-tracker`. Report to user with options: retry, skip, or abort.                                                                   |
| **Missing artifact**     | `artifact-validator` reports input missing or malformed → do NOT proceed. Tell user which earlier phase needs to run (or re-run) and offer to do it. |
| **Jira MCP unavailable** | Tell user to connect it. Offer to resume when ready.                                                                                                 |
| **Subagent failure**     | Non-critical (e.g., `documentation-finder`): offer to proceed without that context. Critical (e.g., `artifact-validator`): do not advance.           |
| **User interruption**    | Progress file ensures resumability. Tell user: "Say 'resume ticket <KEY>' to pick up where we left off."                                             |

## Orchestration Principles

These exist to protect the orchestrator's context window and maintain reliable
coordination. Each one addresses a specific failure mode observed in complex
multi-phase workflows.

1. **Delegate everything.** The orchestrator never runs tool calls, bash
   commands, file reads/writes, web searches, or MCP calls. Every operation
   goes through a subagent or downstream skill. If you find yourself about to
   run a command — stop and find the right subagent instead. This prevents
   context pollution from raw output.

2. **Verify via subagent.** Always use `artifact-validator` to check artifacts
   before advancing. Reading files directly to "quickly check" is how context
   pollution starts — one peek becomes a habit.

3. **One phase at a time.** Complete each phase fully before starting the next.
   Phase dependencies are strict, and partial artifacts cause cascading failures.

4. **Explicit handoffs.** Pass file paths, ticket keys, and context summaries
   explicitly to every subagent and skill. Relying on conversation history for
   critical data is fragile — subagents don't see it, and the orchestrator's
   history gets long.

5. **Gate destructive actions.** Any phase that modifies external systems (Jira
   writes, git push) requires explicit user confirmation. This is a trust
   mechanism — automation that surprises users with side effects gets turned off.

6. **Maintain resumability.** Always update `progress-tracker` after each phase
   and task. The workflow can be interrupted at any point and resumed later
   without losing progress.
