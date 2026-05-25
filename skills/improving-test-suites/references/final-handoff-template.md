# Final Handoff Template

> Load this file immediately before the final user-visible response. For a
> sample completed handoff, load `./report-examples.md` only when
> needed.

Use this template after the workflow completes, blocks, errors, or when no safe
edit is justified. Choose exactly one handoff status:
`CHANGED_PASS`, `COMPLETE_NO_SAFE_CHANGE`,
`COMPLETE_PRODUCTION_BUG_EXPOSED`, `VALIDATION_FAILED_AFTER_REPAIR`,
`COMPLETE_ERROR`, or `COMPLETE_BLOCKED`.

```text
Handoff status: CHANGED_PASS | COMPLETE_NO_SAFE_CHANGE | COMPLETE_PRODUCTION_BUG_EXPOSED | VALIDATION_FAILED_AFTER_REPAIR | COMPLETE_ERROR | COMPLETE_BLOCKED
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

Approvals and blockers:
- none | <production-code approval, unsupported-source approval, missing decision, command, dependency, or prerequisite>
```
