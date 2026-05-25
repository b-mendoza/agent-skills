# Documentation Report Template

Read this file only when `documentation-writer` is ready to return its report.
Use the structure exactly and replace every placeholder. Use `None` for empty
sections.

## Template

```markdown
## Documentation Report

### Status
<ONE OF: "COMPLETE" | "BLOCKED" | "ERROR">

### Mode
<ONE OF: "UPDATE_TRACKING" | "FINALIZE_TRACKER">

### Files Documented
| File | What was added or updated |
| ---- | ------------------------- |
| `path/to/file.ts` | <summary> |

### Files Intentionally Skipped
- <file and reason>
(or `None`)

### Documentation Decisions
- <decision or `None`>

### Prose Review
- Matched repository tone: Yes | No (<reason>)

### Final Gate Evidence
- Requirements verification: <verdict or `Not applicable`>
- Clean code review: <verdict or `Not applicable`>
- Architecture review: <verdict or `Not applicable`>
- Security audit: <verdict or `Not applicable`>

### Tracking Updates
- Task plan file: <updated | failed>
- Task status line: <updated | pending final verification | finalized | failed>
- Implementation summary: <updated | failed>
- Files changed list: <updated | failed>
- Tracker table row: <updated | skipped | failed>
- Tracker completion actions: <updated | skipped | deferred | failed>

### Blockers or Ambiguities
- <issue or `None`>
```

`COMPLETE` is the normal success outcome. `BLOCKED` and `ERROR` are
escalations.

## Example Success

```markdown
## Documentation Report

### Status
COMPLETE

### Mode
UPDATE_TRACKING

### Files Documented
| File | What was added or updated |
| ---- | ------------------------- |
| `src/tasks/cache.ts` | Added one docstring and one trade-off comment |

### Files Intentionally Skipped
- `src/tasks/cache.test.ts` - test names were already self-explanatory

### Documentation Decisions
- Matched the project's sparse comment style

### Prose Review
- Matched repository tone: Yes

### Final Gate Evidence
- Requirements verification: Not applicable
- Clean code review: Not applicable
- Architecture review: Not applicable
- Security audit: Not applicable

### Tracking Updates
- Task plan file: updated
- Task status line: pending final verification
- Implementation summary: updated
- Files changed list: updated
- Tracker table row: skipped
- Tracker completion actions: deferred

### Blockers or Ambiguities
- None
```

In `FINALIZE_TRACKER`, set `Files Documented` to `None`, include the passing
gate verdicts under `Final Gate Evidence`, finalize the task status line, and
record completion-time Jira actions as `updated` or `skipped`.

## Example Finalize Tracker Success

```markdown
## Documentation Report

### Status
COMPLETE

### Mode
FINALIZE_TRACKER

### Files Documented
None

### Files Intentionally Skipped
None

### Documentation Decisions
- Final completion deferred until all gates passed

### Prose Review
- Matched repository tone: Yes

### Final Gate Evidence
- Requirements verification: PASS
- Clean code review: PASS WITH SUGGESTIONS
- Architecture review: PASS
- Security audit: PASS WITH ADVISORIES

### Tracking Updates
- Task plan file: updated
- Task status line: finalized
- Implementation summary: updated
- Files changed list: updated
- Tracker table row: updated
- Tracker completion actions: skipped

### Blockers or Ambiguities
- None
```

## Blocked Outcome

For a `BLOCKED` outcome, set `Status` to `BLOCKED`, leave action sections as
`None` or `failed`, and name the upstream blocker, usually a blocked
`EXECUTION_REPORT` or missing/failing final gate summary, under `Blockers or
Ambiguities`.
