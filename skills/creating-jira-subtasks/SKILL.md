---
name: "creating-jira-subtasks"
description: 'Create subtasks in Jira based on a previously generated task plan document. Reads the plan from docs/<TICKET_KEY>-tasks.md and creates one Jira subtask per task entry under the parent ticket. Use when the user says "create subtasks", "push tasks to Jira", "sync plan to Jira", or "create Jira subtasks for PROJECT-1234". Also triggered by the orchestrating-jira-workflow skill as Phase 4 of the end-to-end pipeline. Requires that the task plan already exists and has been clarified (Decisions Log present).'
---

# Creating Jira Subtasks

## Purpose

Read the task plan at `docs/<TICKET_KEY>-tasks.md` and create corresponding
subtasks in Jira under the parent ticket. Each subtask gets a structured
description derived from the plan so that Jira becomes the canonical task
tracker.

## Platform Compatibility

This skill follows the Agent Skills open standard and works across Claude Code,
Cursor, OpenCode, and other compatible tools. The only platform-specific
behavior is **subagent delegation**, which applies when the plan contains more
than 3 tasks.

| Platform        | Subagent delegation                                                                                       | Agent directory     |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------- |
| **Claude Code** | Natural language or @-mention the subagent. Uses the Agent tool (renamed from Task in v2.1.63).           | `.claude/agents/`   |
| **Cursor**      | Auto-delegates based on subagent description, or explicit mention. Supported since Cursor 2.4 (Jan 2026). | `.cursor/agents/`   |
| **OpenCode**    | @-mention or Task tool. Also reads `.claude/agents/` as a fallback.                                       | `.opencode/agents/` |

All three platforms support co-located subagents inside skill directories. The
subagent at `./subagents/subtask-creator.md` is read by the orchestrating agent
at dispatch time and passed as the subagent's system prompt.

**Dispatching the subagent (platform-adaptive):**

- **Claude Code:** `"Use the subtask-creator subagent to read the manifest at docs/<TICKET_KEY>-subtask-manifest.md and create all subtasks in Jira. Write results to docs/<TICKET_KEY>-subtask-results.md."`
- **Cursor / OpenCode:** Same natural language delegation. If the platform
  cannot resolve the co-located subagent, fall back to inline execution.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run the **planning-jira-tasks** skill first.

### Input contract (produced by upstream skills)

The input file `docs/<TICKET_KEY>-tasks.md` must contain these sections. The
first group is produced by `planning-jira-tasks`; the second by
`clarifying-assumptions`.

| Required section                        | Produced by            | Why                                           |
| --------------------------------------- | ---------------------- | --------------------------------------------- |
| `## Tasks` with numbered task sections  | planning-jira-tasks    | Each task becomes one Jira subtask            |
| `## Execution Order Summary`            | planning-jira-tasks    | Determines creation sequence                  |
| `## Decisions Log`                      | clarifying-assumptions | Phase-completion signal; resolved decisions   |
| Per-task `Questions to answer` resolved | clarifying-assumptions | Subtask descriptions should reflect decisions |
| Per-task `Implementation notes` updated | clarifying-assumptions | Descriptions include the confirmed approach   |

**Pre-flight gate:** If `## Decisions Log` is missing, the plan has not been
through clarification. Warn the user and ask whether to proceed anyway or run
the clarifying-assumptions skill first. This is a warning, not a hard block —
the user may choose to skip clarification intentionally.

## Output

- Subtasks created in Jira under `TICKET_KEY`.
- A summary table printed to the user showing each subtask key and title.
- The local plan file updated with the created subtask keys for traceability.

### Output contract (consumed by downstream skill)

After this skill completes, the plan file must contain these additions for the
`executing-subtask` skill to function correctly:

| Addition                                              | Required by       | Why                                               |
| ----------------------------------------------------- | ----------------- | ------------------------------------------------- |
| `## Jira Subtasks` table (Task #, Key, Title, Status) | executing-subtask | Maps task numbers to Jira keys for status updates |
| `Jira Subtask: <KEY>` line in each task section       | executing-subtask | Executor transitions the correct Jira issue       |

The orchestrator checks for the `## Jira Subtasks` section as the
phase-completion signal for Phase 4.

## Subagent Registry

| Subagent          | Path                             | Purpose                               |
| ----------------- | -------------------------------- | ------------------------------------- |
| `subtask-creator` | `./subagents/subtask-creator.md` | Creates subtasks in Jira sequentially |

Before delegating, read the subagent file to understand its contract (expected
input format, output format, and rules). The path is relative to this skill's
directory.

## Execution Steps

### 1. Read and parse the task plan

Read `docs/<TICKET_KEY>-tasks.md`. For each `## Task N: <title>` section,
extract:

- Task number
- Title
- Full content of all subsections (Objective, Implementation notes, Definition
  of done, Dependencies, Questions, etc.)

### 2. Look up the parent ticket

Use the Jira MCP to fetch `TICKET_KEY` and extract:

- `project.key` — needed when creating subtasks.
- The correct subtask issue type name for this project (commonly `Sub-task` or
  `Subtask` — verify via the Jira MCP, do not hardcode).

If the parent ticket does not exist, stop immediately and inform the user.

### 3. Build subtask payloads

For each task, prepare a summary and description.

**Summary format:**

```
Task <N>: <Short title from plan>
```

**Description format (Jira wiki markup):**

```
h3. Objective
<Objective text>

h3. Relevant Requirements and Context
<Bullet list>

h3. Dependencies / Prerequisites
<Content or "None">

h3. Questions to Answer Before Starting
<Content or "None — all resolved">

h3. Implementation Notes
<Content — must reflect any updates from the Decisions Log>

h3. Definition of Done
<Checklist>

h3. Likely Files / Artifacts Affected
<List>
```

When building descriptions, cross-reference the `## Decisions Log`. If a
decision updated a task's implementation notes or resolved a question, use the
updated content, not the pre-clarification version.

### 4. Create subtasks

**Inline path (≤ 3 tasks, or subagent delegation unavailable):**

Create each subtask sequentially via the Jira MCP. After each successful
creation, record the returned subtask key. If a subtask fails, log the error
with the task number and continue with the rest.

**Subagent path (> 3 tasks):**

Write a manifest to `docs/<TICKET_KEY>-subtask-manifest.md` containing the
parent ticket key, project key, subtask issue type, and all subtask payloads.
Then delegate to the `subtask-creator` subagent using natural language (see
Platform Compatibility above for syntax).

After the subagent finishes, read the results file at
`docs/<TICKET_KEY>-subtask-results.md`.

If delegation fails (subagent not found, platform limitation), fall back to the
inline path.

### 5. Update the local plan file

After all subtasks are created (either inline or via subagent), update
`docs/<TICKET_KEY>-tasks.md`:

- Add a `Jira Subtask: <SUBTASK_KEY>` line to each task section.
- Add a summary table at the top of the file under the ticket summary:

```markdown
## Jira Subtasks

| Task | Subtask Key | Title               | Status |
| ---- | ----------- | ------------------- | ------ |
| 1    | JNS-6070    | Set up database ... | To Do  |
| 2    | JNS-6071    | Implement API ...   | To Do  |
```

### 6. Validate output contract

After updating the plan file, re-read it and verify:

- [ ] The `## Jira Subtasks` table exists and has one row per task.
- [ ] Every `## Task N:` section has a `Jira Subtask: <KEY>` line.
- [ ] Number of subtasks created matches number of tasks in the plan.
- [ ] Each subtask's parent is set to `TICKET_KEY`.

If any check fails for a task that was successfully created, fix the plan file.
If a task failed to create, note it in the table with status `❌ Failed`.

### 7. Clean up temporary files

Delete the manifest and results files if they were created:

```
docs/<TICKET_KEY>-subtask-manifest.md
docs/<TICKET_KEY>-subtask-results.md
```

### 8. Report to user

Print a summary:

- Total subtasks created vs. total tasks in plan.
- Table of subtask keys, titles, and links.
- Any failures or warnings.
- Remind the user that no implementation has started — subtasks are in "To Do".

## Error Handling

- **Jira MCP unavailable:** Stop and tell the user.
- **Parent ticket not found:** Stop immediately.
- **Individual subtask failure** (permission error, invalid field, rate limit):
  Log the error with the task number, continue with remaining tasks.
- **Rate limiting:** If the Jira API returns a 429 or rate-limit error, wait
  briefly and retry the failed request once before logging it as a failure.
- **ALL subtasks fail:** Do NOT write the `## Jira Subtasks` table — this
  prevents downstream skills from thinking Phase 4 completed.
- **Subagent delegation fails:** Fall back to inline creation silently.
