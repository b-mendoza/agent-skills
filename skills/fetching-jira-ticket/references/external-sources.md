# External Sources

> Read this file only to choose public URLs for just-in-time retrieval. Fetch the
> smallest number of pages that can change the current Jira retrieval decision.

These public sources replace copied static API and design guidance. The skill is
usable without web access because routing, contracts, fallback retrieval rules,
and templates are bundled locally; fetched pages only clarify current syntax or
source-backed rationale.

## Fetch Policy

- Fetch a source only when exact syntax, authentication behavior, pagination,
  rate limiting, or progressive-disclosure rationale can change the next action.
- Prefer official Atlassian sources for Jira REST behavior.
- Prefer conceptual articles only for rationale, not tracker-specific contracts.
- If fetching fails, proceed from bundled references when safe and record the
  uncertainty in `Warnings` when it affects completeness.

## Source Routing

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining or explaining staged loading in this skill |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short public explanation of showing only needed information would help |
| `jira-rest-intro` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ | Authentication, status codes, pagination, expansions, or timestamp behavior is unclear |
| `jira-get-issue` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get | Parent or related issue field retrieval syntax is unclear |
| `jira-bulk-fetch` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-bulkfetch-post | Multiple related issues should be fetched efficiently by key or ID |
| `jira-comments` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/ | Comment pagination or comment payload shape is unclear |
| `jira-issue-search` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/ | JQL search is needed to verify relationships or hydrate related issues |
| `jira-issue-links` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/ | Linked issue payloads or link-type semantics are unclear |
| `jira-attachments` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/ | Attachment metadata fields or binary-download boundaries are unclear |
| `jira-fields` | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/ | Custom field names or field metadata are unclear |
| `jira-adf` | https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/ | Jira rich-text description or textarea field content needs normalization |
| `jira-rate-limits` | https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ | Retry or rate-limit classification is unclear |

## Network Unavailable

Continue with bundled references. Do not claim version-specific Jira API facts
that were not verified. Use `FETCH: PARTIAL` when unavailable source material
prevents verifying related-item discovery after the parent ticket was retrieved.
