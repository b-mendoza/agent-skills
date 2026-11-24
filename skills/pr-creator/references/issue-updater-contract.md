# Contract: issue-updater

Return exactly one status block. Do not include tokens, raw platform responses, or full command output.

```text
ISSUE_ACTION: <PASS | VERIFY_FAILED | ISSUE_CHANGED | UNSUPPORTED | BLOCKED | AUTH | ERROR>
Action: <read | comment | close>
Index: <positive integer | n/a>
Approval record: <valid | missing | digest-mismatch | n/a>
Repository: <repo path>
Number: <positive integer>
Issue URL: <HTTPS URL | unavailable>
Issue title: <issue title | n/a>
State before: <open | closed | unavailable>
State after: <open | closed | unavailable | n/a>
State reason after: <state reason after | n/a>
Comment URL: <HTTPS URL | n/a>
Approved body digest: <SHA-256 digest | n/a>
Returned body digest: <SHA-256 digest | n/a>
Write attempted: <yes | no>
Reason: <one line>
Decision needed: <none | next action>
```

`PASS` for `read` describes the issue without a write. For `comment` it confirms the posted comment URL and matching body digests, including an already-posted identical comment with no new write; for `close` it confirms the issue is closed as `not planned`. `VERIFY_FAILED` means the write could not be verified; `ISSUE_CHANGED` means the baseline changed before the write. `UNSUPPORTED`, `BLOCKED`, `AUTH`, and `ERROR` report an unavailable capability, unmet precondition, authentication failure, or unexpected failure.

On every status, a `comment` or `close` identifies its one-based index in the approved batch. A `read` has no batch entry: report `Index: n/a`.
