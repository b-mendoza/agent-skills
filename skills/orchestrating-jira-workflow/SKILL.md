---
name: "orchestrating-jira-workflow"
description: 'Top-level orchestrator for the end-to-end Jira ticket workflow: fetch, plan, clarify, create subtasks, execute. Use this skill whenever the user wants to work on a Jira ticket from start to finish, says "work on ticket PROJECT-1234", "start the Jira workflow", "handle this ticket end to end", "orchestrate PROJECT-1234", or provides a Jira ticket key or URL without specifying a particular phase. Also use when the user says "resume ticket PROJECT-1234" or "where did we leave off on PROJECT-1234". This skill coordinates all downstream skills and subagents — it never runs tool calls, CLI commands, file reads, web searches, or MCP calls directly.'
---

# Orchestrating Jira Workflow

## Purpose

Coordinate the complete lifecycle of a Jira ticket through five sequential
phases. This skill is the **pure coordinator** — it dispatches to subagents and
downstream skills, tracks progress via summaries, manages handoffs between
phases, and handles errors. It never does heavy lifting itself.

## Critical Orchestration Constraint

**The orchestrator must NEVER directly execute any of the following:**

- Tool calls (Jira MCP, file system, search, etc.)
- CLI / bash commands (git, grep, find, cat, etc.)
- File reads or writes
- Web searches
- Code modifications

Every one of these operations must be delegated to a subagent. The
orchestrator's context window is the most valuable resource in the system —
polluting it with raw file contents, command output, git diffs, or search
results degrades decision-making quality across the entire workflow.

**The orchestrator's only jobs are:**

1. Decide which subagent or downstream skill to dispatch to next.
2. Pass explicit, structured inputs to that subagent.
3. Receive a concise summary back.
4. Decide the next action based on the summary.
5. Communicate progress and decisions to the user.

## Inputs

| Input        | Source              | Required | Example                                                     |
| ------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065`                                                  |
| `JIRA_URL`   | User (optional)     | No       | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

If the user provides a full URL, extract the ticket key from it.

## Pipeline Overview

```
Phase 1: Fetch          →  docs/<KEY>.md
Phase 2: Plan           →  docs/<KEY>-tasks.md
Phase 3: Clarify        →  docs/<KEY>-tasks.md (updated with decisions)
Phase 4: Create subtasks →  Jira subtasks created + plan updated with keys
Phase 5: Execute        →  Code changes, one task at a time
```

## Subagent Registry

These are the orchestrator's own utility subagents for tasks that would
otherwise pollute its context window. Dispatch to these instead of running
tool calls directly.

| Subagent                | Path                                   | Purpose                                                                                     |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `artifact-validator`    | `./subagents/artifact-validator.md`    | Check whether phase artifacts exist and are well-formed; return a pass/fail summary         |
| `progress-tracker`      | `./subagents/progress-tracker.md`      | Read, create, or update the progress file; return current workflow state as a brief summary |
| `ticket-status-checker` | `./subagents/ticket-status-checker.md` | Query Jira for the current status, assignee, and recent activity on a ticket                |
| `codebase-inspector`    | `./subagents/codebase-inspector.md`    | Report the current state of the working tree: branch, uncommitted changes, recent commits   |
| `code-reference-finder` | `./subagents/code-reference-finder.md` | Search the codebase for symbols, patterns, or file references; return concise matches       |
| `documentation-finder`  | `./subagents/documentation-finder.md`  | Locate relevant docs, READMEs, or wiki pages for a given topic; return summaries and paths  |
| `git-operator`          | `./subagents/git-operator.md`          | Execute git operations: create branches, commit, push, stash, checkout, merge               |

## Skill Registry (Downstream Phases)

Each phase is handled by a dedicated skill. The orchestrator dispatches to
these skills — it reads their SKILL.md only when it needs to invoke them.

| Phase | Skill                  | Skill Path (relative to skills root) | Purpose                                           |
| ----- | ---------------------- | ------------------------------------ | ------------------------------------------------- |
| 1     | fetching-jira-ticket   | `../fetching-jira-ticket/SKILL.md`   | Retrieve all ticket data into a Markdown snapshot |
| 2     | planning-jira-tasks    | `../planning-jira-tasks/SKILL.md`    | Decompose ticket into a prioritized task plan     |
| 3     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` | Walk user through open questions and assumptions  |
| 4     | creating-jira-subtasks | `../creating-jira-subtasks/SKILL.md` | Push planned tasks to Jira as subtasks            |
| 5     | executing-subtask      | `../executing-subtask/SKILL.md`      | Execute one task at a time from the plan          |

## Data Contracts Between Phases

Each phase produces a specific artifact that the next phase consumes. The
orchestrator verifies these artifacts via the `artifact-validator` subagent
before advancing.

| Transition | Artifact                          | Produced by            | Consumed by            | Validation                                    |
| ---------- | --------------------------------- | ---------------------- | ---------------------- | --------------------------------------------- |
| 1 → 2      | `docs/<KEY>.md`                   | fetching-jira-ticket   | planning-jira-tasks    | File exists, has `## Description` section     |
| 2 → 3      | `docs/<KEY>-tasks.md`             | planning-jira-tasks    | clarifying-assumptions | File exists, has `## Tasks` section, ≥2 tasks |
| 3 → 4      | `docs/<KEY>-tasks.md` (updated)   | clarifying-assumptions | creating-jira-subtasks | File has `## Decisions Log` section           |
| 4 → 5      | `docs/<KEY>-tasks.md` (with keys) | creating-jira-subtasks | executing-subtask      | File has `## Jira Subtasks` table with keys   |

## Progress Tracking

The orchestrator never reads or writes the progress file directly. Instead,
it dispatches to the `progress-tracker` subagent, which manages:

```
docs/<TICKET_KEY>-progress.md
```

The subagent returns a brief summary like:

```
Phase 1: ✅ | Phase 2: ✅ | Phase 3: 🔄 Active | Phase 4: ⬜ | Phase 5: ⬜
Last activity: 2025-06-01 15:10 UTC — Phase 3 clarification in progress (4/6 resolved)
```

The orchestrator uses this summary to make decisions — it never needs the
raw file contents.

## Execution Steps

### 1. Determine starting phase

Dispatch to `progress-tracker` with action `read` and the `TICKET_KEY`.

The subagent will check for existing artifacts and return a summary of the
current state. Based on the summary:

| Progress summary indicates…           | Resume from |
| ------------------------------------- | ----------- |
| No artifacts found                    | Phase 1     |
| Phase 1 complete, Phase 2 not started | Phase 2     |
| Phases 1–2 complete, Phase 3 not done | Phase 3     |
| Phases 1–3 complete, Phase 4 not done | Phase 4     |
| Phases 1–4 complete, tasks remaining  | Phase 5     |

Tell the user what was found and which phase you'll start from. If resuming,
ask for confirmation before proceeding.

### 2. Execute phases sequentially

For each phase, follow this pattern:

#### a. Announce the phase

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase <N>/5 — <Phase name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### b. Validate preconditions

Dispatch to `artifact-validator` to verify the input artifacts for this phase
exist and are well-formed (using the Data Contracts table above). Only proceed
if validation passes.

#### c. Invoke the downstream skill

Read the skill's SKILL.md to understand its contract, then follow its
instructions. Pass explicit inputs — never rely on ambient context.

Each skill is self-contained: it knows what files to read and write. The
orchestrator's job is to verify preconditions via subagent, invoke the skill,
and verify postconditions via subagent.

#### d. Validate the phase output

Dispatch to `artifact-validator` again to confirm the expected output artifact
was produced correctly.

#### e. Update progress

Dispatch to `progress-tracker` with action `update`, the `TICKET_KEY`, the
phase number, the status, and a one-line summary of the outcome.

#### f. Gate before the next phase

**Phases 1 → 2:** Automatic — proceed immediately.

**Phases 2 → 3:** Automatic — proceed immediately.

**Phase 3 → 4:** Ask the user for confirmation before creating Jira subtasks.
This is the point of no return for Jira modifications:

```
The plan is clarified and ready. Creating subtasks will modify your Jira board.
```

Offer the user:

- "Create subtasks now"
- "Review the plan first"
- "Stop here — I'll create subtasks manually"

**Phase 4 → 5:** Ask the user which task to execute first. Never auto-start
execution.

**Within Phase 5:** After each task completes, ask the user which task to
execute next. Never auto-continue.

### 3. Handle Phase 5 (execution) specially

Phase 5 is iterative — it runs once per task, not once for the entire plan.

Before each task execution, dispatch to the relevant utility subagents as
needed. Common dispatch patterns during Phase 5:

| Situation                                | Dispatch to             |
| ---------------------------------------- | ----------------------- |
| Need to check current ticket status      | `ticket-status-checker` |
| Need to understand codebase state        | `codebase-inspector`    |
| Need to find relevant code before a task | `code-reference-finder` |
| Need to find docs/configs for context    | `documentation-finder`  |
| Need to create a feature branch          | `git-operator`          |
| Task complete, need to commit changes    | `git-operator`          |
| Need to verify output artifacts          | `artifact-validator`    |

The orchestrator:

1. Dispatches to `progress-tracker` to get the list of remaining tasks.
2. Presents the remaining tasks to the user.
3. Asks the user which task to execute.
4. Dispatches to utility subagents as needed for pre-task context gathering.
5. Invokes the `executing-subtask` skill for that task, passing any context
   summaries from the utility subagents as explicit inputs.
6. After completion, dispatches to `git-operator` to commit if needed.
7. Dispatches to `progress-tracker` to update the task status.
8. Returns to step 1.

Continue until all tasks are complete or the user decides to stop.

### 4. Final summary

When all tasks are complete (or the user stops), dispatch to
`progress-tracker` with action `read` to get the final state, then present:

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

- **Skill failure:** If a downstream skill fails, dispatch to
  `progress-tracker` to record the failure with details. Report to the user
  and ask how to proceed: retry, skip, or abort.

- **Missing prerequisites:** If `artifact-validator` reports a phase's input
  artifact is missing or malformed, do NOT proceed. Tell the user which earlier
  phase needs to run (or re-run) and offer to do it.

- **Jira MCP unavailable:** If the `ticket-status-checker` or Phase 1/4
  reports the Jira MCP is not connected, tell the user to connect it and offer
  to resume when ready.

- **Subagent failure:** If a utility subagent fails, report the error to the
  user. For non-critical subagents (like `documentation-finder`), offer to
  proceed without that context. For critical subagents (like
  `artifact-validator`), do not advance.

- **User interruption:** The progress file ensures the workflow can always be
  resumed. If the user stops mid-workflow, tell them how to resume:
  "Say 'resume ticket <KEY>' to pick up where we left off."

## Orchestration Rules

1. **Never execute directly.** The orchestrator never runs tool calls, bash
   commands, file reads/writes, web searches, or MCP calls. Every operation
   goes through a subagent or downstream skill. If you find yourself about to
   run a command — stop, and find the right subagent to dispatch to instead.

2. **Dispatch, don't execute.** The orchestrator coordinates — it dispatches
   to subagents for utility operations and to downstream skills for phase work.
   It never fetches Jira data, decomposes tasks, creates subtasks, reads files,
   runs git commands, or writes code itself.

3. **Verify via subagent.** Always dispatch to `artifact-validator` to check
   that expected artifacts exist and are well-formed before advancing to the
   next phase. Never read files directly to verify.

4. **One phase at a time.** Complete each phase fully before starting the next.
   No parallel execution of phases.

5. **Explicit handoffs.** Pass file paths, ticket keys, and context summaries
   explicitly. Never rely on conversation history for critical data.

6. **Protect context.** The orchestrator's context window holds only progress
   summaries, subagent result summaries, and phase summaries — never raw ticket
   data, full task plans, file contents, git diffs, or command output.

7. **Gate destructive actions.** Any phase that modifies external systems (Jira,
   git push) requires explicit user confirmation before proceeding.

8. **Support resume.** Always maintain the progress file (via
   `progress-tracker`) so the workflow can be interrupted and resumed at any
   point.
