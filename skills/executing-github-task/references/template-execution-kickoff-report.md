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
- Primary reference: <owner/repo#num | task-list | Not Created | None>
- Secondary reference: <owner/repo#num or `None`>
- Actions taken: <labels | assignee | comment on child | comment on parent | none>
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
- Target branch: `feature/acme-app-42-task-3-cache-invalidation`
- Branch source: task section
- Checkout result: already on branch
- Local changes handling: clean
- Notes: None

### Tracker Kickoff
- Primary reference: acme/app#100
- Secondary reference: acme/app#42
- Actions taken: labels, comment on child
- Result: done - added `status/in-progress` and commented start of implementation

### Next Step
- Dispatch task-executor

### Blockers or Ambiguities
- None
```

## Blocked Outcome

For a `BLOCKED` result, set the affected readiness fields to `blocked` or
`No`, and explain the precise blocker under `Blockers or Ambiguities`.
Examples: missing prerequisite task, conflicting branch names, unsafe checkout,
or mandatory tracker kickoff unavailable.
