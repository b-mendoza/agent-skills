# GitHub Issue Retrieval Playbook

> Load this file inside `issue-retriever` before GitHub reads. Use external URLs
> from `external-sources.md` only when exact current CLI, REST, or GraphQL syntax
> matters.

## Read Path Setup

Use `gh` as the default read path when available:

| Operation | Required capability |
| --------- | ------------------- |
| Parent issue | `gh issue view` by URL or number with explicit repository scope |
| Comments | Inline `comments` JSON or paginated issue-comments REST reads |
| Child issues | REST sub-issues endpoint or a documented GraphQL equivalent |
| Linked issues | Timeline events, cross-references, or a documented relationship source |
| Projects | `gh issue view` project fields or a small GraphQL query |

Confirm `gh` is on `PATH` and authenticated before the first GitHub read. Use
explicit repository scope with `--repo owner/repo` when not using a full URL. If
the URL host is not `github.com`, preserve that host when using `gh api` or
GraphQL. Return `AUTH` for missing or inadequate authentication and
`TOOLS_MISSING` when no read path can cover parent issue retrieval.

## Parent Issue Retrieval

Fetch parent issue fields with `gh issue view` or equivalent read-only calls.
Capture relevant non-empty parent data:

- Title, body, state, author, URL, number, created, updated, closed.
- Labels with name and description when available.
- Assignees with login and name when available.
- Milestone title and due date when set.
- Project membership when it can be verified without excessive setup.
- Parent comments in chronological order with author, timestamp, and body.
- Explicit upload or binary asset URLs found in issue or comment bodies.

Preserve useful Markdown formatting in bodies and comments. Outside fenced code
blocks, rewrite GitHub-authored heading lines as bold labels so body content
cannot collide with reserved snapshot headings. Example: `## Steps` becomes
`**Steps**`.

## Acceptance Criteria Extraction

Inspect the issue body in this precedence order:

1. `Acceptance Criteria`
2. `AC`
3. `Definition of Done` or `Definition of Done (DoD)`

Use only sections with the highest-precedence label present. If multiple
sections share that label, keep them in source order and prefix each block with
`**Source:** <label>`. Remove the winning blocks from `## Description`. If no
criteria exist, write `_None_` under `## Acceptance Criteria` and keep the full
body under `## Description`.

## Child Issues, Linked Issues, and Projects

Determine discovered totals before claiming full success.

Use the REST sub-issues endpoint or a documented GraphQL equivalent for child
issues. Use `0/0` only when a supported mechanism verifies there are no child
issues. If discovery cannot be verified after the parent issue was retrieved,
render the template's unknown marker, add the warning under
`## Retrieval Warnings`, report `<retrieved>/UNKNOWN`, and return
`FETCH: PARTIAL`.

Prefer timeline events or documented relationship fields for linked issues.
Deduplicate discovered references by `owner/repo#number`. For each linked issue,
fetch enough detail to render title, state, URL, description, and comments. If
linked-issue discovery cannot be verified, use the same unknown-marker and
partial-result pattern.

For project membership, render verified project data when it is available from a
small `gh` or GraphQL read. If membership cannot be verified, render
`_Unknown. Project membership not determined: <reason>_`, record the same
warning, and return `FETCH: PARTIAL` rather than collapsing the state to
`_None_`.

If one child or linked issue cannot be hydrated after discovery, continue with
the others, add a warning, and render the matching `Not retrieved` placeholder
from the template. Order child issues by number, linked issues by relation then
`owner/repo#number`, labels by name, and assignees by login.

## Partial Comment Retrieval

When comment retrieval is partial after the parent or related issue is known,
keep retrieved comments, append
`_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` to that
comment section, record the same warning under `## Retrieval Warnings`, and
return `FETCH: PARTIAL`.

## Assembly

Read `./references/issue-snapshot-template.md` only at assembly time. Copy the
fenced Markdown shape into `docs/<ISSUE_SLUG>.md` and fill it from retrieved
data. Top-level headings are always required. For empty scalar metadata values,
write `_None_`. Normalize timestamps with times to `YYYY-MM-DD HH:MM UTC`; keep
date-only values as `YYYY-MM-DD`. Leave the artifact in place and unstaged.

## Validation Gate

After writing, re-read the artifact and verify:

- Every required top-level heading exists in template order.
- The title is `# <ISSUE_SLUG>: <Issue title>`.
- The preamble includes `Retrieved on`, `Source`, and repository/issue identity.
- The metadata table includes required rows in template order.
- `## Description` and `## Acceptance Criteria` follow the extraction rules.
- Parent comment count matches retrieved parent comments.
- Child and linked issue sections match discovered identities, placeholders, or
  unknown markers.
- Project membership is verified data, `_None_` for verified absence, or the
  template's unknown marker.
- Partial comment warnings have matching terminal markers in comment sections.
- Each unretrieved related issue has both a warning and placeholder.
- Heading-like body lines outside fenced code blocks were rewritten as bold
  labels.
- Labels, assignees, milestone, projects, and attachments match template rules.
- Repeated sections follow deterministic ordering.

If validation fails, fix only missing or mismatched portions, rewrite, and
re-check. Use at most 3 repair passes. After the limit, return `FETCH: ERROR`,
`Validation: FAIL`, and `Failure category: UNEXPECTED`.
