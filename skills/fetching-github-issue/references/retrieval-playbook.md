# GitHub Issue Retrieval Playbook

> Load this file inside `issue-retriever` before GitHub reads. Use external
> URLs from `external-sources.md` only when exact CLI, REST, or GraphQL
> syntax matters. The orchestrator does not load this file.

## Contents

- Read path setup
- Capture rules
- Acceptance criteria precedence
- Child issues, linked issues, and projects
- Partial comment retrieval
- Assembly
- Validation gate
- Rate limiting

## Read Path Setup

Use `gh` as the default read path when available. Prefer the most specific
read-only operation, then keep the mapping stable for the run.

| Operation | Required capability |
| --------- | ------------------- |
| Parent issue | `gh issue view` by URL or number with explicit repository scope |
| Comments | Inline `comments` JSON or paginated issue-comments REST reads |
| Child issues | REST sub-issues endpoint or a documented GraphQL equivalent |
| Linked issues | Timeline events, cross-references, or a documented relationship source |
| Projects | `gh issue view` project fields or a small GraphQL query |

Confirm `gh` is on `PATH` and authenticated before the first GitHub read.
Use explicit repository scope with `--repo owner/repo` when not using a full
URL. If the URL host is not `github.com`, preserve that host when using
`gh api` or GraphQL. Return `AUTH` for missing or inadequate authentication
and `TOOLS_MISSING` when no read path can cover parent issue retrieval. For
exact flag, REST, or GraphQL shapes, fetch `gh-issue-view`, `gh-api`,
`github-rest-issues`, or `github-graphql` from `external-sources.md` only
when the current decision needs them.

## Capture Rules

**Parent issue.** Capture all non-empty values among: title, body, state,
author, URL, number; created, updated, closed; labels (name and description
when available); assignees (login and name when available); milestone (title
and due date) when set; project membership when verifiable without excessive
setup; parent comments in chronological order with author, timestamp, and
body; explicit upload or binary asset URLs found in issue or comment bodies.

**Heading rewrite.** Outside fenced code blocks, rewrite GitHub-authored
Markdown headings (`#`–`####`) as bold labels so body content cannot collide
with reserved snapshot headings. Example: `## Steps` becomes `**Steps**`.

**Formatting.** Preserve useful Markdown formatting in bodies and comments
(lists, tables, code fences, links).

## Acceptance Criteria Precedence

Inspect the issue body in this label order:

1. `Acceptance Criteria`
2. `AC`
3. `Definition of Done` or `Definition of Done (DoD)`

Use only sections matching the highest-precedence label found. If multiple
sections share that label, keep them in source order, prefix each block with
`**Source:** <label>`, and remove the winning blocks from `## Description`.
If no criteria exist, write `_None_` under `## Acceptance Criteria` and keep
the full body under `## Description`.

## Child Issues, Linked Issues, and Projects

Determine totals before claiming full success.

- **Child issues.** Use the REST sub-issues endpoint or a documented GraphQL
  equivalent. Use `0/0` only when a supported mechanism verifies absence.
- **Linked issues.** Prefer timeline events or documented relationship
  fields. Deduplicate by `owner/repo#number`.
- **Projects.** Render verified project data when retrievable from a small
  `gh` or GraphQL read.

If discovery for any of these cannot be verified after the parent issue was
retrieved, render the template's unknown marker, add the same warning under
`## Retrieval Warnings`, report `<retrieved>/UNKNOWN`, and return
`FETCH: PARTIAL` instead of collapsing the section to `_None_`.

For each retrieved child or linked issue, capture: title, state, URL,
description (with heading rewrite), and comments. Link metadata for linked
issues is the relation type. If one related item cannot be hydrated after
discovery, continue with the others, add a warning, and render the matching
`Not retrieved` placeholder. Order child issues by number, linked issues by
relation then `owner/repo#number`, labels by name, and assignees by login.

## Partial Comment Retrieval

When parent or related-item comments are partial, keep retrieved comments,
append `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_`
to that comment section, record the same warning under
`## Retrieval Warnings`, and return `FETCH: PARTIAL`.

## Assembly

Read `./issue-snapshot-template.md` only at assembly time. Copy
the fenced shape into `docs/<ISSUE_SLUG>.md` and fill it from retrieved
data. Top-level headings are always required. For empty scalar metadata
values, write `_None_`. Normalize timestamps with times to
`YYYY-MM-DD HH:MM UTC`; keep date-only values as `YYYY-MM-DD`. Leave the
artifact in place and unstaged.

## Validation Gate

After writing, re-read the artifact and verify:

- Every required top-level heading exists in template order.
- Title is `# <ISSUE_SLUG>: <Issue title>`.
- Preamble includes `Retrieved on`, `Source`, and repository/issue identity.
- `## Metadata` table has the required rows in template order.
- `## Description` and `## Acceptance Criteria` follow the precedence rules.
- Parent comment count matches retrieved parent comments.
- Child and linked issue sections match discovered identities, placeholders,
  or unknown markers.
- Project membership is verified data, `_None_` for verified absence, or the
  unknown marker.
- Each unretrieved related issue has both a warning and a placeholder.
- Heading-like body lines outside code fences were rewritten as bold labels.
- Labels, assignees, milestone, projects, and attachments match template
  rules.
- Repeated sections follow deterministic ordering.

If validation fails, fix only missing or mismatched portions, rewrite, and
re-check. Max 3 repair passes. After the limit, return `FETCH: ERROR`,
`Validation: FAIL`, and `Failure category: UNEXPECTED`.

## Rate Limiting

For exact retry policy and limit categories, fetch `github-rest-rate-limits`
from `external-sources.md` when needed. Default behavior: at most 2 retries
with 1s then 3s backoff; classify exhausted limits as `FETCH: FAIL` with
`Failure category: RATE_LIMIT`.
