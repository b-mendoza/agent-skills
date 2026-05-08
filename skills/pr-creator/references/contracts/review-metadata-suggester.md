# Output Contract — Review Metadata Suggester

> Loaded by the `review-metadata-suggester` subagent at return time. The
> orchestrator uses the reviewer and label fields to populate the preview.

## Status Template

```text
REVIEW_METADATA: PASS | NEEDS_REVIEWER | INVALID_LABELS | AUTH | ERROR
Reviewers: <reviewer list or none>
Reviewer source: user | CODEOWNERS | none
Labels: <label list or none>
Label source: platform-list | user-override | skipped | none
CODEOWNERS source: .github/CODEOWNERS | CODEOWNERS | none

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or recovery action>
```

## Status Codes

| Code | Use When |
| ---- | -------- |
| `PASS` | At least one reviewer is resolved and any labels exist on the platform |
| `NEEDS_REVIEWER` | Neither user input nor CODEOWNERS provides at least one reviewer |
| `INVALID_LABELS` | A `LABELS_OVERRIDE` entry is not present in the platform's existing labels |
| `AUTH` | Platform CLI or credentials prevent reviewer or label lookup |
| `ERROR` | Unexpected metadata failure |

Fill `Reason` and `Decision needed` for every non-`PASS` result. When invalid
labels are reported, include a nearby valid alternative when one is obvious.

## Example

<example>
REVIEW_METADATA: INVALID_LABELS
Reviewers: alice
Reviewer source: user
Labels: none
Label source: user-override
CODEOWNERS source: none

Reason: Label `doc` does not exist on the repository.
Decision needed: Ask the user to choose `documentation` or remove labels.
</example>
