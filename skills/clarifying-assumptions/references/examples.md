# Clarifying Assumptions Examples

Read this file only when you need a dispatch round-trip example or a failure
trace. Do not load examples during normal execution.

## Upfront Mode Round Trip

Input: `TICKET_KEY=JNS-6065`, `MODE=upfront`, `ITERATION=1`

1. Read `./design-thinking-mindset.md`.
2. Read `./upfront-mode.md`.
3. Dispatch `critique-analyzer` with the plan file, stage artifacts, and
   `docs/JNS-6065-upfront-critique.md`, plus `docs/JNS-6065-tasks.md` as
   `PRIOR_DECISIONS_FILE` and `PRIOR_DECISIONS_KIND=main-log`.
4. Receive:

```text
CRITIQUE: PASS
Ticket: JNS-6065 | Mode: upfront | Task: -
Artifact: docs/JNS-6065-upfront-critique.md

## Critique Summary

- Problem-framing items: 2
- Technology critique items: 3
- User-impact items: 0
```

5. Dispatch `question-manifest-builder` with `docs/JNS-6065-upfront-critique.md`
   and `docs/JNS-6065-tasks.md`.
6. Receive:

```text
MANIFEST: PASS
Ticket: JNS-6065 | Mode: upfront | Task: -
Task title: -
Questions now: 8 | Deferred: 4 | Irrelevant: 1
```

7. Walk the 8 questions one at a time.
8. Dispatch `decision-recorder` with resolved decisions and deferred items.
9. Receive:

```text
RECORDING: PASS
Ticket: JNS-6065 | Mode: upfront | Task: -

## Recording Summary

### Files Updated

- `docs/JNS-6065-tasks.md`

### Counts

- Decisions recorded: 8
- Deferred questions tagged: 4
- Questions marked irrelevant: 0
- Implementation notes updated: 1

### Validation

- PASS
```

10. Present:

```markdown
- Critique artifact: docs/JNS-6065-upfront-critique.md
- Files updated: docs/JNS-6065-tasks.md
- RE_PLAN_NEEDED: true
- BLOCKERS_PRESENT: false
```

## Critique Mode Blocked Round Trip

Input: `TICKET_KEY=acme-app-42`, `MODE=critique`, `TASK_NUMBER=3`, `ITERATION=2`

1. Read `./design-thinking-mindset.md`.
2. Read `./critique-mode.md`.
3. Dispatch `critique-analyzer` with task artifacts and
   `docs/acme-app-42-task-3-critique.md`, plus
   `docs/acme-app-42-task-3-decisions.md` as `PRIOR_DECISIONS_FILE` and
   `PRIOR_DECISIONS_KIND=per-task`.
4. Receive:

```text
CRITIQUE: PASS
Ticket: acme-app-42 | Mode: critique | Task: 3
Artifact: docs/acme-app-42-task-3-critique.md
```

5. Dispatch `question-manifest-builder` with the critique report, main task plan,
   and `CURRENT_TASK_ARTIFACTS`.
6. Receive:

```text
MANIFEST: BLOCKED
Reason: docs/acme-app-42-task-3-test-spec.md is missing
```

7. Stop clarification and present:

```markdown
- Critique artifact: docs/acme-app-42-task-3-critique.md
- Files updated: -
- RE_PLAN_NEEDED: false
- BLOCKERS_PRESENT: true
- Blocking verdict: MANIFEST: BLOCKED
- Reason: docs/acme-app-42-task-3-test-spec.md is missing
```
