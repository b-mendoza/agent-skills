# Final Handoff Template

Use one terminal status line, then the fields below. Include `Resume Packet` only for `COMPLETE_BLOCKED`.

```markdown
Status: CHANGED_PASS | COMPLETE_NO_SAFE_CHANGE | COMPLETE_PRODUCTION_BUG_EXPOSED | VALIDATION_FAILED | COMPLETE_ERROR | COMPLETE_BLOCKED | COMPLETE_EMPTY_TARGET

## Target
- Requested:
- Resolved test files:
- Excluded non-test matches:
- Goal:
- Scope limits:
- AUTO_APPROVE value, provenance, rails outcome:

## Baseline
- Command:
- Guard result:
- Counts collected / executed / passed / failed / skipped:
- Named failing tests or none:
- Raw-log path if failed:

## Outcome
- Changed files or none:
- No-op rationale:
- Production bug evidence:
- Error or blocker context:

## Workspace State
- Required whenever mutation occurred:
- Left mutated or reverted:
- Revert recipe or recorded user choice:

## Harness Actions
- Deleted / rewritten / consolidated / added items, each `id | file::test_name | verbatim category | reason`:
- Unapplied decisions, each `id | reason`:

## Metrics And Coverage Map
- Before count, from baseline collected:
- After count, from final collected:
- Any unavailable count with quoted runner output:
- Behavior-to-surviving-test map, including verification method per row:

## Validation
- Command:
- Guard result:
- Script-runner disclosure:
- Scope widening:
- Counts collected / executed / passed / failed / skipped:
- Result:
- Cause on failure:
- Raw-log path on non-pass:

## Reviews And Sources
- Review statuses and routes:
- Truncation `shown N of M` notes and resolution:
- Optional-review sufficiency checklist outcomes:
- Fetched URLs and influenced decisions:

## Approvals And Safety Gates
- Plan approval:
- Amendments:
- Auto-approve rails:
- Production/shared-helper approvals:
- Workspace acknowledgments stages 1 and 2:
- Conformance summary with verification methods:
- REPAIR_TOTAL used:
- ASK_COUNTS notes:

## Remaining Risks
- Script-runner residual risk when applicable:
- External-source prompt-injection residual when applicable:
- Other known risks:

## Resume Packet
- For COMPLETE_BLOCKED only, include the full schema from `resume-packet-schema.md`.
```
