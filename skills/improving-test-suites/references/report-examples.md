# Report Examples

Load only when a report shape is ambiguous.

## Id-Stamped Harness Action

```markdown
D-03 | delete | tests/test_billing.py::test_retries_private_client_call | implementation-detail-assertion | asserts private retry call count; behavior covered by D-04 rewrite through public invoice result | target test
```

## Sufficiency Checklist

```markdown
Optional-review sufficiency checklist: cannot downgrade; ask
- VALUE_STATUS=PASS: yes
- Every high-value behavior has coverage rating: yes
- Route reason does not mention blocked surface: no, value review mentions tenant-boundary behavior
```

## Behavior Coverage Map Row

```markdown
Rejects cross-tenant invoice access | security-sensitive-behavior | tests/api/test_invoices.py::test_rejects_cross_tenant_access | good | file-inspection
```
