# Output Contract — PR Drafter

> Loaded by the `pr-drafter` subagent at return time. The orchestrator uses the
> resulting title, body, and source attribution for the preview step.

## Status Template

```text
PR_DRAFT: PASS | NEEDS_CHOICE | ERROR
Title: <title or none>
Type: <type or needs-choice>
Scope: none | <scope or needs-choice>

Body:
<body or none>

Sources used:
- diff analysis
- title override | body override | none

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user choice or recovery action>
```

## Status Codes

| Code | Use When |
| ---- | -------- |
| `PASS` | A grounded title and body are produced from the diff analysis or exact overrides |
| `NEEDS_CHOICE` | Two or more type or scope options are equally plausible and no explicit choice was supplied |
| `ERROR` | Unexpected drafting failure |

Fill `Reason` and `Decision needed` for every non-`PASS` result. Title and body
overrides, when provided, are exact replacements and must be returned verbatim.

## Example

<example>
PR_DRAFT: PASS
Title: docs(skills): strengthen pr creation workflow
Type: docs
Scope: skills

Body:
## Summary

This updates the PR creation skill so execution-heavy work is delegated to
focused subagents. The workflow keeps the user in control of push, preview, and
create gates while reducing raw git and diff output in the orchestrator.

## Key Changes

- Adds subagent routing for state inspection, preflight, diff analysis,
  drafting, metadata, and submission.
- Preserves explicit preview approval before creating the PR.

## Impact

- PR creation runs with clearer phase boundaries and less orchestrator context
  pollution.
- No runtime migration is required for existing skill consumers.

Sources used:
- diff analysis
- none

Reason: none
Decision needed: none
</example>
