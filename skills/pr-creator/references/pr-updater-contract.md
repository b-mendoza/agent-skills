# Contract: pr-updater

Return exactly one status block. Do not include tokens, raw platform responses, or full command output.

```text
PR_UPDATE: <BASELINE | UPDATED | UPDATED_WITH_ADDITIONS | PARTIAL | PR_CHANGED | BLOCKED | AUTH | ERROR>
Action: <read | apply>
Approval record: <valid | missing | digest-mismatch | n/a>
Repository: <repo path>
Number: <positive integer>
URL: <url | n/a>
PR state: <open | closed | merged | unavailable>
Base ref: <base ref | n/a>
Head ref: <head ref | n/a>
Head SHA: <full SHA | n/a>
Title: <title | n/a>
State: <draft | ready | unavailable>
Reviewers: <comma list | none | n/a>
Labels: <comma list | none | n/a>
Assignees: <comma list | none | n/a>
Body digest: <SHA-256 digest | n/a>
Body file: <path | n/a>
Closing issues: <canonical issue refs | none | unavailable>
Outcome: <exact | additions | drift | n/a>
Applied fields: <comma list | none | n/a>
Not applied fields: <comma list | none | n/a>
Mismatched fields: <comma list | none | n/a>
Added fields: <comma list | none | n/a>
Returned values file: <path | n/a>
Reason: <one line>
Decision needed: <none | next action>
```

`BASELINE` is a read of an open PR. `UPDATED` means exact agreement; `UPDATED_WITH_ADDITIONS` means approved values survived with extras. `PARTIAL` identifies applied and outstanding changes or readback drift. `PR_CHANGED` means baseline drift before writing: applied fields are `none`. `BLOCKED`, `AUTH`, and `ERROR` identify an unmet precondition, authentication failure, or unexpected failure.
