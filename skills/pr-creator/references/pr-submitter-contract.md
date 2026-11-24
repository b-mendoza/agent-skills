# Contract: pr-submitter

Return exactly one status block. Echo platform-returned values for orchestrator verification; do not rely on inputs as verification evidence.

```text
PR_SUBMIT: <PASS | CREATED_WITH_ADDITIONS | CREATED_WITH_DRIFT | HEAD_MOVED | CREATE_UNCERTAIN | BLOCKED | CREATE_ERROR | AUTH | ERROR>
Approval record: <valid | missing | digest-mismatch>
Frozen head SHA: <sha>
Remote head SHA before create: <sha | unavailable>
Existing PR race check: <none | url>
Create attempted: <yes | no>
Create retry used: <yes | no>
URL: <platform-returned url | unavailable>
Base returned: <platform-returned base | unavailable>
Head ref returned: <platform-returned head ref | unavailable>
Head SHA returned: <platform-returned head sha | unavailable>
Title returned: <platform-returned title | unavailable>
State returned: <platform-returned state | unavailable>
Reviewers returned: <platform-returned reviewers | none | unavailable>
Labels returned: <platform-returned labels | none | unavailable>
Assignees returned: <platform-returned assignees | none | unavailable>
Body first line returned: <line | unavailable>
Body line count returned: <number | unavailable>
Approved body digest: <digest>
Returned body digest: <digest | unavailable>
Outcome: <exact | additions | drift | n/a>
Mismatched fields: <comma list | none>
Added fields: <comma list | none>
Closing issues returned: <canonical refs | none | unavailable>
Returned values file: <path | n/a>
Uncertain check commands: <commands | n/a>
Reason: <one line>
Decision needed: <none | rerun diff after head moved | user checks commands | next action>
```

`PASS`, `CREATED_WITH_ADDITIONS`, and `CREATED_WITH_DRIFT` require a confirmed HTTPS URL. A created status never permits a retry or an edit. `PASS` means exact agreement: equal SHA-256 body digests, no mismatches and no additions. Additions preserve all approved values and name the extra fields without mismatches. Drift names at least one mismatch or unreadable field. Every other status has `URL: unavailable`: `HEAD_MOVED` is returned before create when either remote pin differs from the approved value; `CREATE_UNCERTAIN` means querying for the PR/MR and one bounded retry still could not confirm creation; `BLOCKED`, `CREATE_ERROR`, `AUTH`, and `ERROR` report a precondition, creation, authentication, or unexpected failure.
