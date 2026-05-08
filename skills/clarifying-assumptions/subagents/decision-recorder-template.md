# Decision Recorder Template

Read this file only when writing decision artifacts or formatting the final
recording summary.

## Main Decisions Log

Create or update `## Decisions Log` with this exact table schema:

```markdown
## Decisions Log

| Iteration | Scope | Item ID | Category | Outcome | Summary | Re-plan | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Plan-wide | PF1 | problem-framing | revised | End user narrowed to admins managing sync failures | Yes | - |
| 1 | Task 3 | TASK-3-DECISIONS | critique | revised | See per-task decisions file | Yes | docs/JNS-6065-task-3-decisions.md |
```

## Per-Task Decisions File

In `MODE=critique`, write `docs/<TICKET_KEY>-task-<TASK_NUMBER>-decisions.md`
using this structure:

```markdown
## Per-Task Decisions — Task <TASK_NUMBER>: <TASK_TITLE>

> TICKET_KEY: <KEY>
> Mode: critique
> Iteration: <ITERATION>

### Decisions

| # | Item ID | Category | Outcome | Answer | Rationale |
| --- | --- | --- | --- | --- | --- |
| 1 | TC1 | critique | revised | Use Fastify | Matches existing stack |

### Questions Marked Irrelevant

| # | Question | Reason |
| --- | --- | --- |
| 1 | Cache provider still unknown? | Resolved during Task 2 |

### Implementation Updates Required

- <update summary>
```

## Recording Summary Headers

Successful or warning runs must start with exactly one of these headers:

```text
RECORDING: PASS
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
```

```text
RECORDING: WARN
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
```

Then return:

```markdown
## Recording Summary

### Files Updated

- `docs/<KEY>-tasks.md`
- `docs/<KEY>-task-<N>-decisions.md` (critique mode only)

### Counts

- Decisions recorded: <N>
- Deferred questions tagged: <N>
- Questions marked irrelevant: <N>
- Implementation notes updated: <N>

### Validation

- PASS
- WARN: <warning text> (repeat as needed)
```

## Examples

```text
RECORDING: PASS
Ticket: JNS-6065 | Mode: upfront | Task: -

## Recording Summary

### Files Updated

- `docs/JNS-6065-tasks.md`

### Counts
- Decisions recorded: 3
- Deferred questions tagged: 2
- Questions marked irrelevant: 0
- Implementation notes updated: 1

### Validation
- PASS
```

```text
RECORDING: WARN
Ticket: acme-app-42 | Mode: critique | Task: 3

## Recording Summary

### Files Updated
- `docs/acme-app-42-tasks.md`
- `docs/acme-app-42-task-3-decisions.md`

### Counts
- Decisions recorded: 2
- Deferred questions tagged: 1
- Questions marked irrelevant: 1
- Implementation notes updated: 0

### Validation
- WARN: Assumption text for `A-3` was not found exactly; no inline marker added
```

## Blocked And Errored Headers

```text
RECORDING: BLOCKED
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
Reason: <what prerequisite is missing>
```

```text
RECORDING: ERROR
Ticket: <KEY> | Mode: <upfront|critique> | Task: <N|->
Reason: <filesystem or write failure>
```
