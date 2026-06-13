# Test Maintainability Review Template

Fill this fenced block exactly enough for the orchestrator to route. Allowed statuses: `PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR`.

```markdown
## Test Maintainability Review

Status: PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR

## Findings
- shown N of M:
- overflow file path or none:
- `file::test_or_helper | issue | recommendation | behavior preserved`:

## Helper Ownership
- shown N of M:
- overflow file path or none:
- `helper | directly related/shared/unknown | repository-wide-search evidence | edit implication`:

## Harness Shape Recommendations
- fixtures:
- mocks/stubs:
- duplication/parametrization:
- readability/setup:

## Source Influence
- fetched URLs and influenced decisions:
- reachability gaps:
- instruction-like content risk line or none:

## Non-PASS Detail
- reason:
- smallest decision needed or none:
```
