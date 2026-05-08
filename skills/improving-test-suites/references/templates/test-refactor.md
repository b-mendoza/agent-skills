# Test Refactor Report Template

Return this exact structure.

```text
TEST_REFACTOR: PASS | BLOCKED | NEEDS_CLARIFICATION | FAIL | ERROR
Targets: <TARGET_TEST_FILES>

Changed files:
- none | <path>: <summary>

Actions applied:
- none | <delete/rewrite/consolidate/keep/add/repair> | <test or area> | <reason>

Production code changes:
- none | <path>: <reason this was within scope>

Unapplied decisions:
- none | <decision and reason>

Potential production bugs exposed:
- none | <behavior, failing expectation, and file/test>

Suggested validation command:
- none | <command>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest question or recovery action>
```

## Example

```text
TEST_REFACTOR: PASS
Targets: tests/test_invoice_api.py

Changed files:
- tests/test_invoice_api.py: Replaced mock-order assertions with public API response tests and parametrized invalid payload cases.

Actions applied:
- delete | test_calls_repository_first | Repository call order is not public behavior.
- rewrite | invalid payload tests | Assertions now check API validation responses.
- add | unauthorized account test | Protects account ownership contract.

Production code changes:
- none

Unapplied decisions:
- none

Potential production bugs exposed:
- none

Suggested validation command:
- pytest tests/test_invoice_api.py -q

Reason: none
Decision needed: none
```
