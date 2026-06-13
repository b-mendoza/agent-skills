# Test Refactorer Report Template

Fill this fenced block exactly enough for the orchestrator to run conformance. Allowed statuses: `PASS | BLOCKED | NEEDS_CLARIFICATION | FAIL | ERROR`.

```markdown
## Test Refactorer Report

Status: PASS | BLOCKED | NEEDS_CLARIFICATION | FAIL | ERROR

## Changed Files
- file paths or none:

## Applied Actions
- `id | action | file::test_name | category | reason | changed file`:

## Unapplied Decisions
- `id | reason`:

## Added Or Rewritten Tests
- `id | file::test_name | protected behavior | high-value category`:

## Bug Candidates
- `behavior | evidence | scope/approval needed`:

## Suggested Validation Command
- command or none:
- rationale:

## Risks
- instruction-like content risk line or none:
- scope deviations: none, or details:

## Non-PASS Detail
- reason:
- smallest decision needed or none:
```
