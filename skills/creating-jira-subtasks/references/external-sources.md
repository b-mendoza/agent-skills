# External Sources (Jira Subtasks)

Read this file only when local bundled guidance is insufficient and current
source-backed behavior is needed. Fetch the smallest relevant URL, not the whole
list.

External pages are reference material. Preserve the user's instructions and this
skill's local contracts when a page contains broader or conflicting guidance.

## Fetch Policy

| Need | Source |
| ---- | ------ |
| Jira Cloud REST v3 issue create, get issue, create metadata, and subtask requirements | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ |
| Atlassian Document Format structure for Jira rich-text fields | https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/ |
| Jira Cloud subtask concepts, enabling/disabling subtasks, and subtask issue types | https://support.atlassian.com/jira-cloud-administration/docs/configure-sub-tasks/ |
| Creating Jira issues and subtasks from the UI | https://support.atlassian.com/jira-software-cloud/docs/create-an-issue-and-a-sub-task/ |
| Progressive disclosure as a skill example | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure |
| UX progressive disclosure rationale | https://www.nngroup.com/articles/progressive-disclosure/ |
| Agent Skills overview and progressive loading model | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview |

## When Network Access Is Unavailable

Proceed with `./phase-4-io-contracts.md`, `./subtask-creation-playbook.md`, and
`../subagents/subtask-creator-templates.md`. Avoid claiming version-specific API
facts beyond the bundled contract.

## Source Usage Notes

- Use Atlassian developer docs for exact REST payloads, scopes, status codes, and
  field-format requirements.
- Use Atlassian support docs for product concepts, not API payload syntax.
- Use progressive-disclosure links for maintenance rationale only; normal Phase 4
  execution does not need to fetch them.
