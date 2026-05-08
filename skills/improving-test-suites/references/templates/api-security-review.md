# API Security Review Report Template

Return this exact structure.

```text
API_SECURITY_REVIEW: PASS | NOT_APPLICABLE | BLOCKED | NEEDS_CLARIFICATION | ERROR
Targets: <TARGET_TEST_FILES>
References fetched: none | <urls>
Freshness gap: none | <source or claim that could not be verified>

Surface reviewed:
- <API, schema, auth, input, file, network, or boundary surface>

Current high-value coverage:
- none | <covered security-relevant behavior>

Missing high-value tests:
- none | <specific behavior to add and why it matters>

Low-value security tests:
- none | <test that appears security-related but does not prove useful behavior>

Recommended minimal additions:
- none | <smallest tests to add or rewrite>

Blockers:
- none | <question or missing context>

Reason: none | <why status is not PASS or NOT_APPLICABLE>
Decision needed: none | <smallest question or recovery action>
```

## Example

```text
API_SECURITY_REVIEW: PASS
Targets: tests/test_invoice_api.py
References fetched: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
Freshness gap: none

Surface reviewed:
- Invoice creation API accepts account ids and caller identity from external input.

Current high-value coverage:
- Missing required account id is rejected with a validation error.

Missing high-value tests:
- Caller cannot create an invoice for an account they do not own.

Low-value security tests:
- none

Recommended minimal additions:
- Add one unauthorized account test through the public API response.

Blockers:
- none

Reason: none
Decision needed: none
```
