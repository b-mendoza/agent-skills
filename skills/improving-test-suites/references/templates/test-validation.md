# Test Validation Report Template

Return this exact structure.

```text
TEST_VALIDATION: PASS | FAIL | BLOCKED | ERROR
Targets: <TARGET_TEST_FILES>
Command: <command or none>
Result: <concise result>
Likely cause: none | test refactor regression | production bug exposed | pre-existing failure | unknown

Failure summary:
- none | <top failure with file/test/error and one-line meaning>

Recommended next action:
- handoff | rerun test-refactorer with <summary> | ask user for <decision> | report blocker

Reason: none | <why status is not PASS>
Decision needed: none | <smallest question or recovery action>
```

## Example

```text
TEST_VALIDATION: PASS
Targets: tests/test_invoice_api.py
Command: pytest tests/test_invoice_api.py -q
Result: 6 passed
Likely cause: none

Failure summary:
- none

Recommended next action:
- handoff

Reason: none
Decision needed: none
```
