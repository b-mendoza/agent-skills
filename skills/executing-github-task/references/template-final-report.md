# Final User Report Template

Read this file only when the pipeline has stopped or completed and the
orchestrator is ready to report the selected task's outcome to the user.

## Template

```markdown
Task <N> complete: <title>

Summary: <2-3 sentences>

Pipeline:
- Kickoff: <status>
- Execution: <status>
- Documentation/tracking: <status>
- Requirements verification: <verdict>
- Clean code review: <verdict>
- Architecture review: <verdict>
- Security audit: <verdict>

Files changed:
- <path>

Tracker updates:
- <GitHub or gh action summary, or `None`>

Remaining items:
- <issue or `None`>
```

If the task stops before completion, change the first line to
`Task <N> stopped: <title>` and replace completed-phase statuses with the
blocker or skipped reason. Report only the selected task; do not continue to
another task.
