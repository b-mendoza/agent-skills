# Final Handoff Template

Use this template for the user-visible response after the workflow completes or
when no safe edit is justified.

```text
Test suite improved: <one-sentence result>

Diagnosis:
- <original suite problem summary>

Changed harness:
- Deleted: <tests/areas or none>
- Rewritten: <tests/areas or none>
- Added: <tests/areas or none>
- Kept: <high-value behaviors preserved>

Files changed:
- <path>: <summary>

Validation:
- <command>: <PASS/FAIL/BLOCKED/ERROR>

References fetched:
- none | <urls that materially influenced decisions>

Remaining risks:
- none | <skipped checks, unresolved blockers, production bug candidates, or scope limits>
```

## Example

```text
Test suite improved: The invoice API suite now protects response-level behavior instead of repository call order.

Diagnosis:
- The previous suite coupled most assertions to mock interaction order and duplicated invalid payload setup.

Changed harness:
- Deleted: repository call-order tests
- Rewritten: invalid payload checks around API validation responses
- Added: unauthorized account id rejection
- Kept: successful invoice creation response contract

Files changed:
- tests/test_invoice_api.py: Replaced interaction assertions with behavior assertions and parametrized invalid payload cases.

Validation:
- pytest tests/test_invoice_api.py -q: PASS

References fetched:
- https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html

Remaining risks:
- none
```
