# Review File Template

> Read this file only from `review-writer` while assembling `OUTPUT_FILE`.
> Preserve verified findings and comments exactly. This template is formatting
> guidance, not permission to change verified content.

## With Findings

````markdown
# PR <number> Review

PR: <PR_URL>

## Findings

### 1. [<severity>] <finding title>

- Finding ID: `<id>`
- File/line: `<path>:<line-or-range>`
- Evidence: <specific evidence>
- Impact: <why this matters>
- Fix: <minimal fix>
- Line metadata: `path=<path>`, `line=<line>`, `side=<RIGHT|LEFT>`, `start_line=<line-or-none>`

Draft PR comment:

<comment body>

Suggestion:

```suggestion
<suggested patch, only when verified safe>
```

Or: `Suggestion: none`

## Review Decision

<comment | request changes | approve> because <short rationale>.

## Verification Notes

- Sources checked: <diff, files, CI, issue, docs, URLs>
- Residual risks: <risks or none>
- Posting status: <not posted | posted | cancelled>
````

## No Findings

```markdown
# PR <number> Review

PR: <PR_URL>

## Findings

No findings.

## Review Decision

approve/comment because <short rationale>.

## Residual Risks

- <risk, testing gap, unavailable context, or none>

## Verification Notes

- Sources checked: <diff, files, CI, issue, docs, URLs>
- Posting status: <not posted | posted | cancelled>
```

## Required Post-Write Check

After writing the file, confirm these sections exist:

- `## Findings`
- `## Review Decision`
- `## Verification Notes`
- `## Residual Risks` when there are no findings
