# External Sources

> Read this file only when you need current platform docs, setup details, or
> general background. Fetch one URL at a time and keep only the facts needed for
> the current decision. Bundled workflow contracts in this skill package remain
> authoritative for execution.

## Loading Rules

- Use bundled references first for workflow-specific behavior.
- Fetch external URLs for current syntax, setup instructions, or conceptual
  background that would otherwise bloat the prompt.
- Do not fetch external sources during routine phase execution when the bundled
  contract already answers the question.
- If a web source conflicts with a bundled workflow contract, follow the bundled
  contract and note the discrepancy only if it affects the user.

## Progressive Disclosure And Context

| Need | Source |
| ---- | ------ |
| Progressive disclosure concept and disclosure levels | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| UX origin of progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |
| Context engineering, just-in-time retrieval, and long-horizon agent patterns | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Subagent context isolation and when to delegate | https://docs.claude.com/en/docs/claude-code/sub-agents |

## GitHub And GitHub CLI

| Need | Source |
| ---- | ------ |
| GitHub CLI overview, auth, Enterprise host behavior | https://cli.github.com/manual/ |
| `gh auth status` and authentication checks | https://cli.github.com/manual/gh_auth_status |
| `gh issue view` fields and read options | https://cli.github.com/manual/gh_issue_view |
| `gh issue create` flags and behavior | https://cli.github.com/manual/gh_issue_create |
| `gh api` for GraphQL or REST fallback paths | https://cli.github.com/manual/gh_api |
| GitHub Issues concepts and issue management | https://docs.github.com/en/issues |
| GitHub sub-issues | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues |
| GitHub issue dependencies | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies |

## How To Use Returned Web Content

When you fetch a source, summarize it into one of these forms:

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <decision or setup question>
Relevant facts:
- <fact 1>
- <fact 2>
Workflow impact: <none | changed next step | user action needed>
```

If the source cannot be fetched, continue with bundled contracts when possible
and report the missing external confirmation only when it blocks the user.
