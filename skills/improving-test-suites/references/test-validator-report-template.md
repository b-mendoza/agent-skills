# Test Validator Report Template

Fill this fenced block exactly enough for the orchestrator to route. Allowed statuses: `PASS | FAIL | BLOCKED | ERROR`.

```markdown
## Test Validator Report

Status: PASS | FAIL | BLOCKED | ERROR

## Mode And Scope
- MODE: baseline | post-change
- resolved targets:
- changed files:
- scope widening:

## Command
- selected command:
- guard result: allowlisted | user-confirmed verbatim | blocked
- guard detail:
- script-runner disclosure:

## Counts
- collected:
- executed:
- passed:
- failed:
- skipped:
- unavailable count evidence, quoted if any:

## Result
- PASS requires executed count at least one:
- post-change consistency with expected surviving count:
- zero collected cause `empty-selection` if applicable:

## Baseline Diff
- baseline status and counts:
- identical baseline failures:
- new touched-test failures:
- new production-behavior evidence:
- likely cause: test refactor regression | production bug exposed | pre-existing failure | empty-selection | unknown

## Raw Log
- raw-log path on non-PASS:

## Risks
- instruction-like content risk line or none:
- script-runner residual risk line when applicable:

## Non-PASS Detail
- reason:
- smallest decision needed or none:
```
