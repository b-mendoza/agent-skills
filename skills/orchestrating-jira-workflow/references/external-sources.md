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

## Jira And Atlassian

| Need | Source |
| ---- | ------ |
| Jira Cloud REST API concepts, auth, permissions, pagination, status codes | https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ |
| Jira issue operations reference | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ |
| Atlassian Rovo MCP Server IDE setup | https://support.atlassian.com/rovo/docs/setting-up-ides/ |
| Atlassian Rovo MCP troubleshooting and verification | https://support.atlassian.com/rovo/docs/troubleshooting-and-verifying-your-setup/ |
| MCP client security risks for Atlassian tools | https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness |

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
