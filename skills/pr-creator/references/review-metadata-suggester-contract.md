# Contract: review-metadata-suggester

Return exactly one status block. Do not include raw CODEOWNERS contents or full platform API responses.

```text
REVIEW_METADATA: <PASS | NEEDS_REVIEWER | INVALID_LABELS | INVALID_ASSIGNEES | AUTH | ERROR>
Reviewers: <comma list | none (user-confirmed) | none>
Reviewer source: <user | CODEOWNERS | none-confirmed | none>
Normalized reviewers:
- <username/team | n/a>
Solo repository condition: <yes | no | unknown>
CODEOWNERS source: <owners-file path named by the platform playbook | none>
CODEOWNERS matches:
- <pattern -> requestable owners | none>
Labels: <comma list | none>
Label source: <override | inferred | none>
Invalid labels: <comma list | none>
Suggested valid labels: <comma list | none>
Assignees: <normalized comma list | none>
Invalid assignees: <comma list | none>
Reason: <one line>
Decision needed: <none | provide reviewers or none | choose existing labels or remove | choose assignable users or none | next action>
```

`REVIEWERS=none` resolves to `Reviewers: none (user-confirmed)`. `PASS` requires valid assignees and labels: both invalid lists are `none`. `INVALID_LABELS` and `INVALID_ASSIGNEES` identify at least one invalid item in the corresponding list. `NEEDS_REVIEWER` leaves the reviewer decision open. `AUTH` denotes an authentication failure; `ERROR` denotes an unexpected failure.
