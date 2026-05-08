# Execution Kickoff Report Template

Read this file only when `execution-starter` is ready to return its report.
Use the structure exactly and replace every placeholder. Use `None` for empty
sections.

## Template

```markdown
## Execution Kickoff Report

### Status
<ONE OF: "READY" | "BLOCKED" | "ERROR">

### Task Readiness
- Task exists: Yes | No
- Dependencies complete: Yes | No
- Planning artifacts aligned: Yes | No

### Workspace Readiness
- Branch/worktree state: <ready | adjusted | blocked>
- Target branch: <branch or `None`>
- Branch source: <task section | execution order summary | none | conflict>
- Checkout result: <already on branch | switched | created | blocked | skipped>
- Local changes handling: <clean | isolated | blocked>
- Notes: <summary or `None`>

### Tracker Kickoff
- Primary reference: <subtask key or `None`>
- Secondary reference: `None`
- Actions taken: <transition | comment | none>
- Result: <done | skipped | blocked> - <detail>

### Next Step
- <usually `Dispatch task-executor` or a specific blocker>

### Blockers or Ambiguities
- <issue or `None`>
```

`READY` is the normal success outcome. `BLOCKED` means the next safe action
needs orchestrator or user judgment. `ERROR` means an unexpected failure
prevented a reliable kickoff.

## Example Success

```markdown
## Execution Kickoff Report

### Status
READY

### Task Readiness
- Task exists: Yes
- Dependencies complete: Yes
- Planning artifacts aligned: Yes

### Workspace Readiness
- Branch/worktree state: ready
- Target branch: `feature/jns-6065-task-3-cache-invalidation`
- Branch source: task section
- Checkout result: already on branch
- Local changes handling: clean
- Notes: None

### Tracker Kickoff
- Primary reference: `JNS-6071`
- Secondary reference: `None`
- Actions taken: transition
- Result: done - moved subtask to `In Progress`

### Next Step
- Dispatch task-executor

### Blockers or Ambiguities
- None
```

## Blocked Outcome

For a `BLOCKED` result, set the affected readiness fields to `blocked` or
`No`, and explain the precise blocker under `Blockers or Ambiguities`.
Examples: missing prerequisite task, conflicting branch names, unsafe checkout,
or mandatory Jira kickoff unavailable.
