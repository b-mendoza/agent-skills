---
name: "orchestrating-jira-workflow"
description: 'Top-level orchestrator for end-to-end Jira ticket workflows. Use this skill when the user provides a Jira URL like "https://workspace.atlassian.net/browse/PROJECT-1234", says "work on ticket PROJECT-1234", "start the Jira workflow", "handle this ticket end to end", "orchestrate PROJECT-1234", or provides a Jira ticket key/URL without specifying a particular phase. Also trigger on "resume ticket PROJECT-1234", "where did we leave off on PROJECT-1234", "continue PROJECT-1234", or "what''s the status of PROJECT-1234". This skill coordinates all downstream skills and subagents — it thinks, decides, and dispatches, but never executes work directly.'
---

# Orchestrating Jira Workflow

## Purpose

Coordinate the complete lifecycle of a Jira ticket through seven sequential
phases. This skill is a **pure coordinator** — it dispatches to subagents and
downstream skills, operates only on concise summaries, and never does heavy
lifting directly.

## Inputs

| Input      | Required | Example                                                     |
| ---------- | -------- | ----------------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Extract these values from the URL:

- **Workspace:** subdomain before `.atlassian.net` → `vukaheavyindustries`
- **Project:** prefix before the dash in the path segment → `JNS`
- **Ticket key:** full path segment → `JNS-6065`

If the user provides only a ticket key (e.g., `JNS-6065`), ask for the full
URL — it carries workspace and project context that downstream skills need.

## Pipeline

```
Phase 1: Fetch           →  docs/<KEY>.md
Phase 2: Plan tasks      →  docs/<KEY>-tasks.md + intermediates
Phase 3: Clarify+Critique→  docs/<KEY>-tasks.md (updated with decisions)
Phase 4: Create subtasks →  Jira subtasks created + plan updated with keys
Phase 5: Plan task exec  →  docs/<KEY>-task-<N>-*.md (4 planning artifacts)
Phase 6: Clarify+Critique→  docs/<KEY>-task-<N>-decisions.md
Phase 7: Execute         →  Code changes, tests, commits
         ↑_______________↓  (Phases 5-6-7 loop per task)
```

## Subagent Registry

Utility subagents handle all tool calls, file reads, and command execution.

| Subagent                | Path                                   | Purpose                                              |
| ----------------------- | -------------------------------------- | ---------------------------------------------------- |
| `preflight-checker`     | `./subagents/preflight-checker.md`     | Validate environment dependencies before workflow    |
| `artifact-validator`    | `./subagents/artifact-validator.md`    | Check phase artifacts exist and are well-formed      |
| `progress-tracker`      | `./subagents/progress-tracker.md`      | Read, create, or update progress files               |
| `ticket-status-checker` | `./subagents/ticket-status-checker.md` | Query Jira for ticket status and activity            |
| `codebase-inspector`    | `./subagents/codebase-inspector.md`    | Report working tree state (branch, changes, commits) |
| `code-reference-finder` | `./subagents/code-reference-finder.md` | Search codebase for symbols and patterns             |
| `documentation-finder`  | `./subagents/documentation-finder.md`  | Locate relevant docs and return summaries            |

## Downstream Skills

Each phase is handled by a dedicated skill. Read its SKILL.md only when
invoking it.

| Phase | Skill                  | Path (relative to skills root)       |
| ----- | ---------------------- | ------------------------------------ |
| 1     | fetching-jira-ticket   | `../fetching-jira-ticket/SKILL.md`   |
| 2     | planning-jira-tasks    | `../planning-jira-tasks/SKILL.md`    |
| 3     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` |
| 4     | creating-jira-subtasks | `../creating-jira-subtasks/SKILL.md` |
| 5     | planning-jira-task     | `../planning-jira-task/SKILL.md`     |
| 6     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` |
| 7     | executing-jira-task    | `../executing-jira-task/SKILL.md`    |

## How the Orchestrator Works

The orchestrator does exactly three things: **think** (analyze summaries,
assess state), **decide** (choose next phase, pick subagent, resolve
ambiguity), and **dispatch** (send work to a subagent via the Task tool).

When work needs to happen — checking a file, running a command, querying
Jira, updating progress — that is always a dispatch:

| Need                          | Dispatch to             |
| ----------------------------- | ----------------------- |
| Check if an artifact exists   | `artifact-validator`    |
| Get git branch / working tree | `codebase-inspector`    |
| Query Jira ticket status      | `ticket-status-checker` |
| Update progress files         | `progress-tracker`      |
| Find code symbols or patterns | `code-reference-finder` |
| Locate relevant documentation | `documentation-finder`  |
| Validate environment setup    | `preflight-checker`     |

### Context protection

The orchestrator's context window is the most expensive resource in the
system. Every byte of raw content that leaks into it degrades decision-making
for every subsequent step. Delegation is not optional — it is the
architecture.

When a subagent returns a result, extract the verdict and summary. Discard
everything else. If details are needed later, dispatch a subagent to retrieve
them.

The orchestrator holds only:

- Decision-relevant summaries from subagents
- Current workflow state (phase, task, status)
- User instructions and confirmations
- Error reports that require judgment

### Behavioral principles

- **Follow every step in every skill file** — no skipping, no reordering.
- **One phase at a time** — partial artifacts cause cascading failures.
- **Explicit handoffs** — pass file paths, ticket keys, and summaries
  explicitly. Subagents cannot see conversation history.
- **Gate destructive actions** — Jira writes and git push require user
  confirmation.
- **Maintain resumability** — update `progress-tracker` after every phase
  and task.
- **Preserve everything, commit selectively** — no orchestration artifact is
  deleted. Only implementation output is committed to git.
- **Fail loudly, recover gracefully** — surface failures immediately. When
  something goes wrong, read `./references/error-handling.md`.

## How to Dispatch

Subagent `.md` files are co-located reference documents. To dispatch:

1. Read the subagent's `.md` file from the path in the registry above.
2. Spawn a subagent using the **Task tool**, passing the `.md` content as the
   prompt and the step's inputs as context.

   | Platform        | Dispatch method                                               |
   | --------------- | ------------------------------------------------------------- |
   | Claude Code CLI | `Task(prompt=<.md content>, description=<step summary>)`      |
   | Cursor IDE      | `Task(subagent_type="generalPurpose", prompt=<.md + inputs>)` |
   | OpenCode CLI    | `Task(prompt=<.md content>, description=<step summary>)`      |

3. Collect the returned summary. Use that summary — not raw output — for all
   downstream decisions.

Subagents run sequentially by default. Parallel dispatch is acceptable only
for independent utility calls (e.g., `codebase-inspector` +
`documentation-finder` before a task), never for dependent operations.

## Phase Execution Template

Every phase follows this cycle — no step skipped:

1. **Announce** — display the phase banner
2. **Validate preconditions** — dispatch `artifact-validator`
3. **Invoke the downstream skill** — read its SKILL.md, follow every step
4. **Validate output** — dispatch `artifact-validator`
5. **Update progress** — dispatch `progress-tracker`
6. **Gate check** — automatic, user confirmation, or re-plan (see reference)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase <N>/7 — <Phase name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Phase Guide

Load the right reference file based on the current or starting phase:

| Phase range | Reference file                   | Content                       |
| ----------- | -------------------------------- | ----------------------------- |
| 1–4         | `./references/phases-1-4.md`     | Linear pipeline execution     |
| 5–7         | `./references/task-loop.md`      | Per-task loop + final summary |
| Error/issue | `./references/error-handling.md` | Recovery and resumability     |
| Validation  | `./references/data-contracts.md` | Artifact validation reference |

## Starting the Workflow

### 1. Preflight

Dispatch `preflight-checker` with the `TICKET_KEY` (derived from `JIRA_URL`)
and the phases that will run (all phases for a fresh start, remaining phases
if resuming).

- **FAIL:** Stop. Present missing dependencies and install instructions. Do
  not proceed until resolved.
- **PASS:** Proceed silently.

### 2. Determine starting phase

Dispatch `progress-tracker` with `ACTION=read` and the `TICKET_KEY`.

- **No progress found:** Start at Phase 1.
- **Progress found:** Resume from the next incomplete phase. If past Phase 1,
  confirm with the user before proceeding.

### 3. Load phase reference and execute

Based on the starting phase, read the appropriate reference file from the
Phase Guide above and follow its instructions.
