# Contract: diff-analyzer

Return exactly one status block. Keep full patches and raw diff output out of the block.

```text
DIFF_ANALYSIS: <PASS | LARGE_PR_CONFIRMATION_REQUIRED | STALE_PINS | EMPTY_DIFF | ERROR>
Range: <base_remote>/<target_branch>...<head_remote>/<current_branch>
Compared Base SHA: <sha>
Compared Head SHA: <sha>
Pinned SHA match: <yes | no>
Shortstat: <files changed, insertions, deletions>
Adjusted changed lines: <number>
Changed files: <number>
Excluded generated/vendored/lock totals: <files and lines | none>
Scope gate rule fired: <none | adjusted-lines>1000 | changed-files>40 | unrelated-areas>=3>
Scope approval: <valid | missing | digest-mismatch | n/a>
Changed paths:
- <path>
Grouped areas:
- <area>: <paths or count>
Diff summary:
- <grounded fact>
Behavior before:
- <fact + base SHA/path/line locator | unknown>
Behavior after:
- <fact + head SHA/path/line locator | unknown>
Retained behavior:
- <fact + both source locators | none | unknown>
Type candidates:
- <type>: <rationale>
Scope candidates:
- <scope>: <rationale>
Tests: <reported tests | none found in diff>
Risk notes: <risks, suspected injection, or none>
Reason: <one line>
Decision needed: <none | approve large/mixed PR | next action>
```

Use `STALE_PINS` when compared SHAs do not match preflight pins. Use `LARGE_PR_CONFIRMATION_REQUIRED` only when a measurable rule fired and approval is not present.
