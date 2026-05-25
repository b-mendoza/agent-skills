# Final User Report Template

Read this file only when the pipeline has stopped or completed and the
orchestrator is ready to return the selected task's `FINAL_TASK_REPORT`.

## Template

```markdown
## Final Task Report

### Status
<ONE OF: "COMPLETE" | "BLOCKED" | "STOPPED_FOR_USER_INPUT" | "ESCALATED">

### Task
- Ticket: `<TICKET_KEY>`
- Task: `<N>` - <title>

### Summary
<2-3 sentences>

### Evidence Checked
- Kickoff: <status>
- Execution: <status>
- Documentation/tracking: <status>
- Requirements verification: <verdict>
- Clean code review: <verdict>
- Architecture review: <verdict>
- Security audit: <verdict>

### Retry Counts
- Requirements fixes: <0-3>
- Clean-code fixes: <0-3>
- Architecture fixes: <0-3>
- Security fixes: <0-3>

### Implementation Artifacts
- <path>
(or `None`)

### Category A Tracking
- <path and update summary>
(or `None`)

### Tracker Updates
- <Jira action summary, or `None`>

### Blockers or Unresolved Items
- <issue or `None`>

### Next Required Action
- <action or `None`>
```

Use `COMPLETE` only after implementation, documentation/tracking, requirements
verification, and quality gates have passed. Use `BLOCKED` for missing
prerequisites or capabilities, `STOPPED_FOR_USER_INPUT` when a decision is the
next safe step, and `ESCALATED` when a retry budget is exhausted or recovery is
unsafe. Report only the selected task; do not continue to another task.
