# GitHub Fetch Playbook

> Read this file only after detecting the GitHub platform. It is the per-platform fetch contract. Shared fetch policy lives in `./fetch-contract.md` and `./retrieval-playbook.md`.

## Inputs and Identifier

| Input                             | Required        | Example                                 |
| --------------------------------- | --------------- | --------------------------------------- |
| `ISSUE_URL`                       | Preferred       | `https://github.com/acme/app/issues/42` |
| `OWNER` / `REPO` / `ISSUE_NUMBER` | When URL absent | `acme` / `app` / `42`                   |

Derive owner/repo/number from `ISSUE_URL` when present; lowercase owner and repo. **`ISSUE_SLUG = <owner>-<repo>-<number>`** is the `<KEY>` that names `docs/<KEY>.md`. If coordinates are missing or the URL is not an issue path, return `FETCH: FAIL` with `Failure category: BAD_INPUT`.

## Transport / Read Path

GitHub reads use `gh` by default (`gh api` for paginated REST/GraphQL). Use `--repo owner/repo` when not passing a full URL; preserve a non-`github.com` host for `gh api`/GraphQL.

| Operation     | Required capability                                                  |
| ------------- | -------------------------------------------------------------------- |
| Parent issue  | `gh issue view` by URL or number with explicit repo scope            |
| Comments      | Inline `comments` JSON or paginated issue-comments REST              |
| Child issues  | REST sub-issues endpoint or documented GraphQL equivalent            |
| Linked issues | Timeline events, cross-references, or documented relationship source |
| Projects      | `gh issue view` project fields or a small GraphQL query              |

Return `AUTH` for missing/inadequate auth; `TOOLS_MISSING` when no read path covers parent issue retrieval.

## Capture Rules

Capture non-empty values among: title, body, state, author, URL, number; created, updated, closed; labels (name + description); assignees (login + name); milestone (title + due) when set; project membership when verifiable; parent comments chronologically; explicit upload/binary asset URLs in bodies. Preserve useful Markdown (lists, tables, code fences, links).

## Relationships

Capture per child/linked issue: title, state, URL, description, comments; relation type for linked issues. Deduplicate linked issues by `owner/repo#number`. Order child issues by number, linked issues by relation then `owner/repo#number`, labels by name, assignees by login.

## Snapshot Sections

`docs/<ISSUE_SLUG>.md` heading order (stable when empty): `## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`, `## Child Issues`, `## Linked Issues`, `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, `## Attachments`. Full template: `./github-snapshot-template.md` (read at assembly).

## Summary Fields

Lines 5, 6, and 8 of the shared 12-line summary:

```text
Issue: <owner>/<repo>#<N>: <Title | Unknown>
State: <OPEN | CLOSED | Unknown>
Child issues: <retrieved>/<found | UNKNOWN | N/A>
```

`Attachments:` counts explicit upload/binary asset references in issue or comment bodies; binaries are not downloaded. Unverified project membership is a `FETCH: PARTIAL` trigger.

## Rate-Limit Specifics

Honor `retry-after` or `x-ratelimit-reset`; preserve the rate-limit message. For a secondary limit with no explicit timing, wait at least 60s. Then apply the shared retry budget.

## External-Source Routing

Use the `GitHub` group in `./external-sources.md` (`gh-issue-view`, `gh-api`, `github-rest-issues`, `github-rest-comments`, `github-rest-timeline`, `github-rest-sub-issues`, `github-graphql`, `github-rest-rate-limits`, etc.).

## Example Invocation

```yaml
ISSUE_URL: https://github.com/acme/app/issues/42
```

## Cross-referencing pull requests

`## Linked Issues` also contains pull-request cross-references; keep this heading and the locked `Linked issues:` summary line unchanged for consumers. Include every issue or PR returned by the parent timeline's cross-reference discovery, including open, merged, and closed-unmerged PRs. Fetch every page to exhaustion. Do not search the entire repository for textual mentions, and do not treat PRs as child issues.

Use relation `cross-reference/issue` or `cross-reference/pull-request`. Deduplicate by host + owner/repo + number across timeline pages, preserving relation kinds in sorted order. Order entries by relation then canonical identity. Each PR entry includes `**Kind:** Pull request`, URL, title, `**State:** OPEN | CLOSED`, `**Merge outcome:** MERGED | UNMERGED`, and `**Head ref:** <branch | Unknown>`, plus its retrieved description and comments. Fetch PR details through the read-only pulls endpoint or equivalent GraphQL fields; a closed PR is not necessarily merged. Never infer merge outcome from state alone.

The linked count includes unique issues and PRs. Known but inaccessible details get a Not retrieved placeholder and warning. If pagination, timeline access, merge outcome, head ref, or comment discovery is incomplete, retain known entries, state the exact limit under `## Retrieval Warnings`, and return `FETCH: PARTIAL`. An incomplete discovery uses `<retrieved>/UNKNOWN`, not `0/0`. The warning and user summary must name the PR/discovery gap, not silently claim complete linked-issue retrieval.
