---
name: creating-jira-subtasks
description: >
  Create subtasks in Jira based on a previously generated task plan document.
  Reads the plan from docs/<TICKET_KEY>-tasks.md and creates one Jira subtask
  per task entry under the parent ticket. Use when the user says "create
  subtasks", "push tasks to Jira", "sync plan to Jira", or "create Jira
  subtasks for PROJECT-1234". Requires that the task plan already exists.
allowed-tools:
  - mcp__jira__*
  - Read
  - Write
  - Edit
  - Grep
  - Bash
  - agent
---

# Creating Jira Subtasks

## Purpose

Read the task plan at `docs/<TICKET_KEY>-tasks.md` and create corresponding
subtasks in Jira under the parent ticket. Each subtask gets a structured
description derived from the plan so that Jira becomes the canonical task
tracker.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run the **planning-jira-tasks** skill first.

## Output

- Subtasks created in Jira under `TICKET_KEY`.
- A summary table printed to the user showing each subtask key and title.
- The local plan file is updated with the created subtask keys for traceability.

## Subagents

This skill uses one subagent to isolate the Jira MCP creation loop from the
main agent's context. The subagent is colocated in this folder:

| Subagent        | File                   | Purpose                               |
| --------------- | ---------------------- | ------------------------------------- |
| subtask-creator | `./subtask-creator.md` | Creates subtasks in Jira sequentially |

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

### 2. Determine the parent ticket's project and issue type

Use the Jira MCP to look up `TICKET_KEY` and extract:

- `project.key` — needed when creating subtasks.
- The correct issue type name for subtasks in this project (commonly `Sub-task`
  or `Subtask` — verify via the API, do not hardcode).

### 3. Prepare the creation manifest

Write a structured manifest file at `docs/<TICKET_KEY>-subtask-manifest.md`
containing:

- The parent ticket key.
- The project key.
- The subtask issue type name.
- For each task: the summary line and formatted description (using Jira wiki
  markup or Markdown depending on what the MCP accepts).

**Summary format:**

```
Task <N>: <Short title from plan>
```

**Description format:**

```
h3. Objective

<Objective text>

h3. Relevant Requirements and Context

<Bullet list>

h3. Dependencies / Prerequisites

<Content or "None">

h3. Questions to Answer Before Starting

<Content or "None">

h3. Implementation Notes

<Content>

h3. Definition of Done

<Checklist>

h3. Likely Files / Artifacts Affected

<List>
```

### 4. Delegate creation to the subtask-creator subagent

**If the plan has ≤ 3 tasks:** Create them inline — the context cost is
manageable.

**If the plan has > 3 tasks:** Delegate to the subagent:

```
agent subtask-creator "Read the manifest at docs/<TICKET_KEY>-subtask-manifest.md and create all subtasks in Jira. Write the results to docs/<TICKET_KEY>-subtask-results.md."
```

The subagent creates subtasks sequentially, handles errors per-task, and writes
a results file with the created subtask keys and any failures.

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

### 6. Clean up temporary files

Delete the manifest and results files if they were created:

```
docs/<TICKET_KEY>-subtask-manifest.md
docs/<TICKET_KEY>-subtask-results.md
```

### 7. Report to user

Print a summary:

- Total subtasks created vs. total tasks in plan.
- Table of subtask keys, titles, and links.
- Any failures or warnings.
- Remind the user that no implementation has started — subtasks are in "To Do".

## Validation

After creating all subtasks, verify:

- [ ] Number of subtasks created matches number of tasks in the plan.
- [ ] Each subtask's parent is set to `TICKET_KEY`.
- [ ] The local plan file has been updated with subtask keys.

## Error Handling

- If the Jira MCP is not available, stop and tell the user.
- If a subtask fails to create (e.g., permission error, invalid field), log the
  error with the task number and continue with the rest.
- If the parent ticket does not exist, stop and inform the user immediately.
