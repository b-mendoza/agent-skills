# Test Value Review Template

Fill this fenced block exactly enough for the orchestrator to route. Allowed statuses: `PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR`.

```markdown
## Test Value Review

Status: PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR

## Empty Target Note
- none, or evidence that resolved files contain zero test functions:

## Low-Value Candidates
- shown N of M:
- overflow file path or none:
- `file::test_name | category | reason | suggested action`:

## High-Value Behaviors
- shown N of M:
- overflow file path or none:
- `behavior | category | current named test | coverage rating none/weak/good | notes`:

## Minimal Harness Proposal
- keep:
- rewrite:
- delete:
- consolidate:
- add:

## Review Routing
- API/security route `required | optional | not needed` and reason:
- Maintainability route `required | optional | not needed` and reason:

## Sources And Risks
- fetched URLs and influenced decisions:
- reachability gaps:
- instruction-like content risk line or none:

## Non-PASS Detail
- reason:
- smallest decision needed or none:
```
