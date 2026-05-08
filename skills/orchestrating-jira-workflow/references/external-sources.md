# External Sources

> Read this file only when you need general background, setup details, or
> current API/CLI syntax. Fetch one URL at a time, summarize the result, and
> discard the raw page. The bundled workflow contracts in this skill package
> remain authoritative for execution.

This file is the only outbound knowledge hub for this skill. Every
context-heavy concept, setup instruction, and platform-syntax reference lives
behind a URL below so it can be retrieved just in time instead of being
preloaded into the orchestrator's prompt.

## Loading Rules

- Use bundled references (`./workflow-policy.md`, `./phases-1-4.md`,
 `./task-loop.md`, `./data-contracts.md`, `./error-handling.md`) for
 anything workflow-specific.
- Fetch an external URL only when (a) the bundled contract does not answer
 the question, and (b) the answer would otherwise force a long inline
 instruction.
- Fetch one URL at a time. Summarize, then move on.
- If a web source conflicts with a bundled contract, follow the bundled
 contract and surface the discrepancy only when it affects the user's
 decision.
- Do not paraphrase whole pages back to the orchestrator; return only the
 single fact or step the current decision needs.

## When To Fetch

| Trigger | Pick a URL from |
| ------- | --------------- |
| User asks why this workflow loads files just-in-time, or you must explain context engineering choices | [Concepts](#concepts) |
| `preflight-checker` reports `Jira MCP MISSING` or the user needs setup help | [Jira / Atlassian setup](#jira--atlassian-setup) |
| You need the exact field name, endpoint, or query syntax for a Jira read or write | [Jira REST API](#jira-rest-api-syntax) |
| You are authoring or revising a sibling skill or subagent and need design guidance | [Skill-authoring background](#skill-authoring-background-optional) |

## Concepts

| Need | Source |
| ---- | ------ |
| Progressive disclosure for skill content layering | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| Original UX framing of progressive disclosure | https://www.nngroup.com/articles/progressive-disclosure/ |
| Context engineering, just-in-time retrieval, long-horizon agent loops | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Subagent context isolation and when to delegate | https://docs.claude.com/en/docs/claude-code/sub-agents |
| Skill format reference (frontmatter, structure, capabilities) | https://docs.claude.com/en/docs/claude-code/skills |

## Jira / Atlassian Setup

| Need | Source |
| ---- | ------ |
| Atlassian Rovo MCP server overview and IDE setup | https://support.atlassian.com/rovo/docs/setting-up-ides/ |
| Rovo MCP troubleshooting and verification | https://support.atlassian.com/rovo/docs/troubleshooting-and-verifying-your-setup/ |
| MCP client security risks for Atlassian tools | https://www.atlassian.com/blog/artificial-intelligence/mcp-risk-awareness |
| Jira Cloud auth, scopes, and permissions overview | https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#authentication-and-authorization |

## Jira REST API Syntax

| Need | Source |
| ---- | ------ |
| Jira Cloud REST API v3 intro: pagination, status codes, expansions | https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ |
| Issue read/update/transition operations | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ |
| Issue links and remote links | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/ |
| Comments on issues | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/ |
| JQL search and field reference | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/ |

## Skill-Authoring Background (optional)

Use this section only when the user asks about how this skill itself was
written, or when extending this orchestrator with a new sibling skill. None of
these URLs need to be fetched during normal Jira workflow execution.

| Need | Source |
| ---- | ------ |
| Skill authoring overview and best-practice index | https://github.com/anthropics/skills |
| Sub-agent design guidance | https://docs.claude.com/en/docs/claude-code/sub-agents |

## How To Use Returned Web Content

When you fetch a source, condense it to one of these forms before continuing:

```text
EXTERNAL_SOURCE: OK
Source: <url>
Used for: <decision or setup question>
Relevant facts:
- <fact 1>
- <fact 2>
Workflow impact: <none | changed next step | user action needed>
```

If the source cannot be fetched, fall back to bundled contracts when possible
and surface the missing external confirmation only when it blocks the user:

```text
EXTERNAL_SOURCE: UNAVAILABLE
Source: <url>
Used for: <decision or setup question>
Fallback: <bundled contract or local heuristic used instead>
Workflow impact: <none | needs user action>
```
