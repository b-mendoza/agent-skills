---
name: orchestrating-jira-workflow
description: 'Top-level orchestrator for the end-to-end Jira ticket workflow: fetch, plan, clarify, create subtasks, execute. Use this skill whenever the user wants to work on a Jira ticket from start to finish, says "work on ticket PROJECT-1234", "start the Jira workflow", "handle this ticket end to end", "orchestrate PROJECT-1234", or provides a Jira ticket key or URL without specifying a particular phase. Also use when the user says "resume ticket PROJECT-1234" or "where did we leave off on PROJECT-1234". This skill coordinates all five downstream skills and never performs heavy execution itself.'
---

# Orchestrating Jira Workflow

## Purpose

Coordinate the complete lifecycle of a Jira ticket through five sequential
phases. This skill is the single entry point — it dispatches to downstream
skills, tracks progress, manages handoffs between phases, and handles errors.
It never does the heavy lifting itself.

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

## Skill Registry

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
orchestrator verifies these artifacts exist and are well-formed before
advancing.

| Transition | Artifact                          | Produced by            | Consumed by            | Validation                                    |
| ---------- | --------------------------------- | ---------------------- | ---------------------- | --------------------------------------------- |
| 1 → 2      | `docs/<KEY>.md`                   | fetching-jira-ticket   | planning-jira-tasks    | File exists, has `## Description` section     |
| 2 → 3      | `docs/<KEY>-tasks.md`             | planning-jira-tasks    | clarifying-assumptions | File exists, has `## Tasks` section, ≥2 tasks |
| 3 → 4      | `docs/<KEY>-tasks.md` (updated)   | clarifying-assumptions | creating-jira-subtasks | File has `## Decisions Log` section           |
| 4 → 5      | `docs/<KEY>-tasks.md` (with keys) | creating-jira-subtasks | executing-subtask      | File has `## Jira Subtasks` table with keys   |

## Progress Tracking

The orchestrator maintains a lightweight progress file at:

```
docs/<TICKET_KEY>-progress.md
```

This file tracks which phases have completed, enabling resume after
interruptions. Structure:

```markdown
# <TICKET_KEY> — Workflow Progress

| Phase | Skill                  | Status      | Completed at         | Notes                   |
| ----- | ---------------------- | ----------- | -------------------- | ----------------------- |
| 1     | fetching-jira-ticket   | ✅ Complete | 2025-06-01 14:30 UTC | 12 comments, 4 subtasks |
| 2     | planning-jira-tasks    | ✅ Complete | 2025-06-01 14:45 UTC | 8 tasks created         |
| 3     | clarifying-assumptions | ✅ Complete | 2025-06-01 15:10 UTC | 6/6 resolved            |
| 4     | creating-jira-subtasks | ✅ Complete | 2025-06-01 15:15 UTC | 8 subtasks created      |
| 5     | executing-subtask      | 🔄 Active   | —                    | Task 3 of 8 in progress |

## Execution Log

### Phase 1 — 2025-06-01 14:30 UTC

Fetched ticket JNS-6065. Snapshot written to docs/JNS-6065.md.
12 comments, 4 subtasks, 2 linked issues retrieved.

### Phase 2 — 2025-06-01 14:45 UTC

Plan written to docs/JNS-6065-tasks.md. 8 tasks, 3 dependency chains.
2 validation warnings (see plan).

...
```

## Execution Steps

### 1. Determine starting phase

Check whether any artifacts from previous phases already exist:

```
docs/<KEY>-progress.md   → Resume from last incomplete phase
docs/<KEY>-tasks.md      → At least Phases 1–2 are done
docs/<KEY>.md            → At least Phase 1 is done
(nothing)                → Start from Phase 1
```

If a progress file exists, read it and resume from the first incomplete phase.

If artifacts exist but no progress file, infer the state:

| Artifacts found                          | Resume from |
| ---------------------------------------- | ----------- |
| `docs/<KEY>.md` only                     | Phase 2     |
| `docs/<KEY>.md` + `docs/<KEY>-tasks.md`  | Phase 3     |
| Above + `## Decisions Log` in tasks file | Phase 4     |
| Above + `## Jira Subtasks` in tasks file | Phase 5     |

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

#### b. Invoke the downstream skill

Read the skill's SKILL.md to understand its contract, then follow its
instructions. Pass explicit inputs — never rely on ambient context.

Each skill is self-contained: it knows what files to read and write. The
orchestrator's job is to verify preconditions are met, invoke the skill,
and verify postconditions are met.

#### c. Validate the phase output

After the skill completes, verify the expected artifact exists and passes
the validation criteria from the Data Contracts table above.

#### d. Update progress

Write the phase result to `docs/<KEY>-progress.md`.

#### e. Gate before the next phase

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
The orchestrator:

1. Presents the remaining tasks (those not marked `✅ Complete`).
2. Asks the user which task to execute.
3. Invokes the `executing-subtask` skill for that task.
4. Updates progress after completion.
5. Returns to step 1.

Continue until all tasks are complete or the user decides to stop.

### 4. Final summary

When all tasks are complete (or the user stops), present:

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

- **Skill failure:** If a downstream skill fails, record the failure in the
  progress file with details. Report to the user and ask how to proceed:
  retry, skip, or abort.

- **Missing prerequisites:** If a phase's input artifact is missing or
  malformed, do NOT proceed. Tell the user which earlier phase needs to run
  (or re-run) and offer to do it.

- **Jira MCP unavailable:** If Phase 1 or 4 fails because the Jira MCP is not
  connected, tell the user to connect it and offer to resume when ready.

- **User interruption:** The progress file ensures the workflow can always be
  resumed. If the user stops mid-workflow, tell them how to resume:
  "Say 'resume ticket <KEY>' to pick up where we left off."

## Orchestration Rules

1. **Dispatch, don't execute.** The orchestrator coordinates — it never fetches
   Jira data, decomposes tasks, creates subtasks, or writes code itself.

2. **Verify, don't assume.** Always check that expected artifacts exist and are
   well-formed before advancing to the next phase.

3. **One phase at a time.** Complete each phase fully before starting the next.
   No parallel execution of phases.

4. **Explicit handoffs.** Pass file paths and ticket keys explicitly. Never
   rely on conversation history for critical data.

5. **Protect context.** The orchestrator's context window holds only progress
   state and phase summaries — never raw ticket data, full task plans, or
   implementation details.

6. **Gate destructive actions.** Any phase that modifies external systems (Jira)
   requires explicit user confirmation before proceeding.

7. **Support resume.** Always maintain the progress file so the workflow can be
   interrupted and resumed at any point.
