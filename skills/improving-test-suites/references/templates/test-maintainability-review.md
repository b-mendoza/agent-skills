# Test Maintainability Review Report Template

Return this exact structure.

```text
MAINTAINABILITY_REVIEW: PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR
Targets: <TARGET_TEST_FILES>
References fetched: none | <urls>

Maintainability diagnosis:
- <concise diagnosis>

Rewrite opportunities:
- none | <file>::<test_name or area> | <rename/fixture/parametrize/mock/assertion/delete> | <specific recommendation>

Fixture and helper guidance:
- none | <specific helper or fixture change and why it reduces noise>

Readability risks to preserve:
- none | <behavior, name, or assertion that should stay explicit>

Blockers:
- none | <question or missing context>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest question or recovery action>
```

## Example

```text
MAINTAINABILITY_REVIEW: PASS
Targets: tests/test_invoice_api.py
References fetched: https://docs.pytest.org/en/stable/example/parametrize.html

Maintainability diagnosis:
- Three invalid payload tests duplicate setup and hide the only changing field.

Rewrite opportunities:
- tests/test_invoice_api.py::test_invalid_payloads | parametrize | Use one parametrized test for missing account id, negative amount, and unknown currency.

Fixture and helper guidance:
- Add a local `valid_invoice_payload()` helper with only contract-level defaults.

Readability risks to preserve:
- Keep unauthorized account behavior as a separate named test because it documents a distinct security rule.

Blockers:
- none

Reason: none
Decision needed: none
```
