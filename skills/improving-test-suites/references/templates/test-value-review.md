# Test Value Review Report Template

Return this exact structure.

```text
TEST_VALUE_REVIEW: PASS | BLOCKED | NEEDS_CLARIFICATION | ERROR
Targets: <TARGET_TEST_FILES>
References fetched: none | <urls>

Suite diagnosis:
- <concise diagnosis>

Low-value tests:
- none | <file>::<test_name> | <category> | <keep/rewrite/delete/consolidate> | <reason>

High-value behaviors:
- none | <behavior or contract worth protecting> | Current coverage: <none/weak/good>

Missing high-value tests:
- none | <behavior, failure mode, or edge case to add>

Minimal target harness:
- <ordered keep/rewrite/delete/add recommendations>

Review routing:
- API_SECURITY_REVIEW: required | optional | skip | <reason>
- MAINTAINABILITY_REVIEW: required | optional | skip | <reason>

Blockers:
- none | <question or missing context>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest question or recovery action>
```

## Example

```text
TEST_VALUE_REVIEW: PASS
Targets: tests/test_invoice_api.py
References fetched: https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html

Suite diagnosis:
- The suite mostly verifies repository call order instead of invoice API results.

Low-value tests:
- tests/test_invoice_api.py::test_calls_repository_first | implementation-detail assertion | delete | The call order is not part of the public contract.

High-value behaviors:
- Rejects invoice creation when required account id is missing | Current coverage: weak

Missing high-value tests:
- Unauthorized account id should be rejected with the documented error.

Minimal target harness:
- Keep the success-path public response test.
- Rewrite validation tests around API responses instead of mock calls.
- Add one unauthorized account test.
- Delete repository call-order tests.

Review routing:
- API_SECURITY_REVIEW: required | Invoice creation accepts external account ids.
- MAINTAINABILITY_REVIEW: required | Invalid payload tests duplicate setup.

Blockers:
- none

Reason: none
Decision needed: none
```
