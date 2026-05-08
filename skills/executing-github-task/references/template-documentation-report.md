# Documentation Report Template

Read this file only when `documentation-writer` is ready to return its report.
Use the structure exactly and replace every placeholder. Use `None` for empty
sections.

## Template

```markdown
## Documentation Report

### Status
<ONE OF: "COMPLETE" | "BLOCKED" | "ERROR">

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

### Tracking Updates
- Task plan file: <updated | failed>
- Task status line: <updated | failed>
- Implementation summary: <updated | failed>
- Files changed list: <updated | failed>
- Tracker table row: <updated | skipped | failed>
- Tracker completion actions: <updated | skipped | failed>

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

### Files Documented
| File | What was added or updated |
| ---- | ------------------------- |
| `src/tasks/cache.ts` | Added one docstring and one trade-off comment |

### Files Intentionally Skipped
- `src/tasks/cache.test.ts` - test names were already self-explanatory

### Documentation Decisions
- Matched the repository's sparse comment style

### Prose Review
- Matched repository tone: Yes

### Tracking Updates
- Task plan file: updated
- Task status line: updated
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
`EXECUTION_REPORT`, under `Blockers or Ambiguities`.
