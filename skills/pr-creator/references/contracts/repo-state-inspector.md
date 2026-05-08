# Output Contract — Repo State Inspector

> Loaded by the `repo-state-inspector` subagent at return time. The orchestrator
> uses only the summary fields when routing the next phase.

## Status Template

```text
REPO_STATE: PASS | BLOCKED | ERROR
Remote: <remote url or none>
Platform: github | github-enterprise | gitlab | bitbucket | unknown
Current branch: <branch or none>
Target branch: <target branch or missing>
PR state: draft | ready | invalid
Uncommitted work: none | <count and concise categories>
Platform adapter needed: yes | no

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or orchestrator action>
```

## Status Codes

| Code | Use When |
| ---- | -------- |
| `PASS` | Routing data is available and the working tree is safe to inspect further |
| `BLOCKED` | Not a git repository, detached HEAD, or no branch can be named safely |
| `ERROR` | Unexpected inspection failure |

Fill `Reason` and `Decision needed` for every non-`PASS` result.

## Example

<example>
REPO_STATE: PASS
Remote: git@github.com:acme/app.git
Platform: github
Current branch: docs/pr-creator-skill
Target branch: main
PR state: draft
Uncommitted work: none
Platform adapter needed: no

Reason: none
Decision needed: none
</example>
