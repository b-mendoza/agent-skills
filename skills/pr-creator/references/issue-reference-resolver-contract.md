# Contract: issue-reference-resolver

Return exactly one status block. Do not include tokens, raw platform responses, or full command output.

```text
ISSUE_REFS: <PASS | NEEDS_DECISION | INVALID_ISSUES | AUTH | ERROR>
Repository: <repo path>
Default branch: <default branch | n/a>
Target branch: <target branch | n/a>
Auto-close: <yes | no | unverifiable | none>
Closes: <canonical issue refs | none | unavailable>
Related: <canonical issue refs | none | unavailable>
Invalid: <invalid explicit references | none>
Warnings: <comma list | none | n/a>
Reason: <one line>
Decision needed: <none | next action>
```

`PASS` identifies validated closing and related references and requires `Invalid: none`. `NEEDS_DECISION` identifies an unresolved closure expectation; `INVALID_ISSUES` must name the invalid explicit references in `Invalid`, not `none`. `AUTH` and `ERROR` denote authentication and lookup failures.
