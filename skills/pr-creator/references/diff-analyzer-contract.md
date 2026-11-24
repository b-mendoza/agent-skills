# Contract: diff-analyzer

Return exactly one status block. Keep full patches and raw diff output out of the block.

```text
DIFF_ANALYSIS: <PASS | LARGE_PR_CONFIRMATION_REQUIRED | STALE_PINS | EMPTY_DIFF | ERROR>
Range: <base_remote>/<target_branch>...<head_remote>/<head_branch>
Compared Base SHA: <sha>
Compared Head SHA: <sha>
Pinned SHA match: <yes | no>
Shortstat: <files changed, insertions, deletions>
Adjusted changed lines: <number>
Changed files: <number>
Excluded generated/vendored/lock totals: <N files, M lines | none>
Scope gate rule fired: <none | comma list of adjusted-lines>1000, changed-files>40, unrelated-areas>=3>
Scope approval: <valid | missing | digest-mismatch | n/a>
Scope values: <canonical JSON | n/a>
Changed paths:
- <path>
Grouped areas:
- <area>: <paths or count>
Diff summary:
- <grounded fact>
Behavior before:
- Bn: <fact + base SHA/path/line locator | unknown>
Behavior after:
- Bn: <fact + head SHA/path/line locator | unknown>
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

`PASS` requires matching pins and either no fired rule (at most 1000 adjusted lines and 40 files, approval `n/a`) or valid approval for the fired rules. `LARGE_PR_CONFIRMATION_REQUIRED` means a rule fired with a missing or stale record. Fired rules require canonical scope values with matching pins, rules and counts; otherwise scope values are `n/a`. Before and after facts carry paired `Bn:` identifiers. Retained behavior carries no id. `STALE_PINS`, `EMPTY_DIFF`, and `ERROR` mean the pins moved, the range was empty, or analysis failed.
