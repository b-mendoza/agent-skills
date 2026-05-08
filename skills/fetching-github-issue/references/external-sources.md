# External Sources

> Read this file only to choose public URLs for just-in-time retrieval. Fetch the
> smallest number of pages that can change the current GitHub issue retrieval
> decision.

These public sources replace copied static CLI, REST, GraphQL, and design
guidance. The skill is usable without web access because routing, contracts,
fallback retrieval rules, and templates are bundled locally; fetched pages only
clarify current syntax or source-backed rationale.

## Fetch Policy

- Fetch a source only when exact command flags, JSON fields, authentication,
  pagination, rate limiting, project/sub-issue behavior, or
  progressive-disclosure rationale can change the next action.
- Prefer official GitHub and GitHub CLI sources for tracker behavior.
- Prefer conceptual articles only for rationale, not tracker-specific contracts.
- If fetching fails, proceed from bundled references when safe and record the
  uncertainty in `Warnings` when it affects completeness.

## Source Routing

| Reference key | URL | Use when |
| ------------- | --- | -------- |
| `progressive-disclosure-skill` | https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure | Maintaining or explaining staged loading in this skill |
| `progressive-disclosure-ux` | https://www.nngroup.com/articles/progressive-disclosure/ | A short public explanation of showing only needed information would help |
| `gh-issue-view` | https://cli.github.com/manual/gh_issue_view | Parent issue command flags or JSON fields are unclear |
| `gh-api` | https://cli.github.com/manual/gh_api | REST, GraphQL, pagination, headers, host, or jq behavior through `gh api` is unclear |
| `gh-auth-status` | https://cli.github.com/manual/gh_auth_status | Non-interactive authentication checks are unclear |
| `github-rest-issues` | https://docs.github.com/en/rest/issues/issues#get-an-issue | REST issue fields, status codes, or media types are unclear |
| `github-rest-comments` | https://docs.github.com/en/rest/issues/comments#list-issue-comments | Issue comment pagination or payload shape is unclear |
| `github-rest-timeline` | https://docs.github.com/en/rest/issues/timeline#list-timeline-events-for-an-issue | Linked issue discovery through timeline events is unclear |
| `github-rest-sub-issues` | https://docs.github.com/en/rest/issues/sub-issues#list-sub-issues | Child issue discovery or sub-issue endpoint support is unclear |
| `github-rest-pagination` | https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api | REST pagination behavior is unclear |
| `github-rest-rate-limits` | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api | Retry or rate-limit classification is unclear |
| `github-graphql` | https://docs.github.com/en/graphql | Project membership or fields require GraphQL syntax |
| `github-projects` | https://docs.github.com/en/issues/planning-and-tracking-with-projects | Project membership concepts or limitations are unclear |

## Network Unavailable

Continue with bundled references. Do not claim version-specific GitHub API or
CLI facts that were not verified. Use `FETCH: PARTIAL` when unavailable source
material prevents verifying child issues, linked issues, or project membership
after the parent issue was retrieved.
