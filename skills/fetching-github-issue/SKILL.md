---
name: "fetching-github-issue"
description: 'Phase 1 of `orchestrating-github-workflow`: retrieve a GitHub issue into a stable Markdown snapshot for downstream workflow phases. Use this as a workflow phase, not as a standalone implementation skill, when an issue URL or owner/repo/number needs to become `docs/<ISSUE_SLUG>.md` with predictable headings for metadata, description, acceptance criteria, comments, child issues, linked issues, labels, assignees, and optional milestone/projects/attachments. Primary transport is the GitHub CLI (`gh`). This skill coordinates retrieval only: it does not modify GitHub state beyond read-only queries, create branches, or start implementation.'
---

# Fetching GitHub Issue

You are a Phase 1 coordinator. Your job is to turn a GitHub issue reference
into a validated local snapshot by dispatching one retrieval specialist, keeping
only its structured summary, and reporting the result in a form the orchestrator
can carry forward.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_URL` | Preferred | `https://github.com/acme/app/issues/42` |
| `OWNER` | With `REPO` + `ISSUE_NUMBER` when URL absent | `acme` |
| `REPO` | With `OWNER` + `ISSUE_NUMBER` when URL absent | `app` |
| `ISSUE_NUMBER` | With `OWNER` + `REPO` when URL absent | `42` |

Derive when needed (normalize **owner** and **repo** to lowercase for slug
stability):

- **ISSUE_SLUG:** `<owner>-<repo>-<issue_number>`
- **OWNER**, **REPO**, **ISSUE_NUMBER** from `ISSUE_URL` when present

Prefer passing `ISSUE_URL` downstream when you have it; it removes ambiguity and
matches `gh issue view` usage. If only `OWNER` / `REPO` / `ISSUE_NUMBER` are
provided, the subagent must still run `gh` with an explicit `--repo owner/repo`
(or equivalent) scope.

## Workflow Overview

```text
1. Read the retriever subagent definition
2. Dispatch the subagent with ISSUE_URL (or OWNER, REPO, ISSUE_NUMBER)
3. Interpret the structured summary it returns
4. Report the file path, counts, and warnings to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `issue-retriever` | `./subagents/issue-retriever.md` | Uses `gh` (and `gh api` where needed) to read GitHub data, writes `docs/<ISSUE_SLUG>.md`, validates the artifact, and returns a concise fetch summary |

## How This Skill Works

This skill is intentionally narrow. It coordinates retrieval, not mutation,
planning, or execution. Keep only:

- `ISSUE_SLUG` and the URL or coordinates needed for the next phase
- The file path written
- Counts and warnings from the retriever summary
- Any fatal reason that requires user action

This phase succeeds only when the retriever returns a structured result that
matches the output contract and, when a file is written, reports validation
status consistently.

This coordinator may do four things directly: read its bundled skill files,
derive identifiers from the input URL (or fallback coordinates when no URL is
provided), dispatch the retriever, and relay the retriever's structured
summary. Everything else stays inside the subagent.

### 1. Dispatch the retriever

Read `./subagents/issue-retriever.md`, then dispatch it with:

- `ISSUE_URL` when available, otherwise `OWNER`, `REPO`, and `ISSUE_NUMBER`

The subagent owns input validation, `gh` availability and auth checks, issue
and relationship retrieval, document assembly, output validation, and cleanup.

### 2. Interpret the structured result

> Reminder: branch on the structured result fields, not on prose. This
> coordinator dispatches, interprets, and relays summaries; it does not inspect
> raw GitHub payloads or rewrite the artifact.

The retriever returns a summary with these top-level fields:

- `FETCH: PASS` -> retrieval and validation succeeded
- `FETCH: PARTIAL` -> artifact was written and validated, but some comments or
  related items could not be retrieved, related-item discovery could not be
  verified, or `## Projects` membership could not be determined because the
  required capability was unavailable
- `FETCH: FAIL` -> deterministic failure such as bad input, issue not found,
  missing auth, rate limits after retry, or unusable `gh` environment
- `FETCH: ERROR` -> unexpected tool or environment failure
- `Failure category` -> machine-readable cause for `FETCH: FAIL` or
  `FETCH: ERROR`

Validation is reported separately:

- `Validation: PASS` -> the written file satisfies the template contract
- `Validation: FAIL` -> the file was written but still violates the contract
- `Validation: NOT_RUN` -> retrieval failed before validation could happen

For count lines in the summary:

- `0/0` (where that shape applies) means the retriever verified that no items
  exist in that section
- `<retrieved>/UNKNOWN` means the parent issue was retrieved but discovery
  for that section could not be verified; the retriever records a warning and
  treats the run as `FETCH: PARTIAL`
- `N/A` for `Comments`, `Child issues`, or `Linked issues` means the parent
  issue was not retrieved and those retrieval steps never ran (for example,
  `Failure category: NOT_FOUND` before any snapshot). Do not use `0/0` or
  `<retrieved>/UNKNOWN` in that case
- `Attachments: <N>` is the number of entries under `## Attachments`; use
  `Attachments: N/A` when the parent issue was not retrieved (that section was
  not populated from a successful parent read)

Failure categories are:

- `NONE` -> no fatal failure occurred
- `BAD_INPUT` -> malformed URL, missing coordinates, or unusable slug
- `NOT_FOUND` -> the parent issue could not be found before a valid artifact
  was produced
- `AUTH` -> GitHub access was denied or not authenticated (`gh auth status`)
- `TOOLS_MISSING` -> `gh` not installed or insufficient for required reads
- `RATE_LIMIT` -> GitHub API rate-limited and retry budget was exhausted
- `UNEXPECTED` -> tool or environment failure outside the expected categories

Handle them this way:

- `FETCH: PASS` with `Validation: PASS`: report success and continue
- `FETCH: PARTIAL` with `Validation: PASS`: report success with warnings and
  make the incompleteness visible, including capability-unavailable
  `## Projects` cases
- `Validation: FAIL`: stop and relay contract failure (any `FETCH`)
- `FETCH: FAIL`: stop and relay the failure category plus the reason
- `FETCH: ERROR`: stop and relay the failure category plus the reason as an
  unexpected failure
- Any inconsistent pairing, such as `FETCH: PASS` with `Validation: NOT_RUN`:
  treat it as `FETCH: ERROR` and stop

Do not infer fatal cause from prose when `Failure category` is present. Branch
on the category, then use `Reason` only for user-facing detail.

### 3. Report only the summary

Using only the subagent's structured summary, tell the caller:

- The file path written, when one exists
- The issue identity (`Issue: <owner>/<repo>#<N>: <Title>`)
- The issue state (`State: OPEN | CLOSED`)
- Retrieved versus discovered counts for comments, or `N/A` when the parent
  issue was not retrieved
- The attachment entry count (`Attachments: <N>`), or `N/A` when the parent
  issue was not retrieved
- Retrieved versus discovered counts for child issues and linked issues, where
  the discovered total may be `UNKNOWN` when discovery could not be verified,
  or `N/A` when the parent issue was not retrieved and discovery never ran
- Any warnings or fatal reason
- Any failure category, when one exists
- That this phase is retrieval only and does not mutate GitHub

## Output Contract

Primary artifact:

```text
docs/<ISSUE_SLUG>.md
```

Treat `docs/<ISSUE_SLUG>.md` as a preserved workflow artifact for resumability.
Do not commit it as part of implementation history.

The document must contain every top-level heading from the fenced Markdown
snapshot shape in `./subagents/issue-retriever-template.md`. Repeated nested
headings appear only when their parent section has material to render. If a
top-level section has verified empty data, the heading still appears and the
section body is `_None_`. If the retriever could not verify whether a section
is empty, the artifact must use the template's unknown marker instead.
Downstream skills rely on stable headings rather than best-effort prose. If
retrieval is partial, the artifact must record that explicitly in
`## Retrieval Warnings` and use the template's placeholder shapes for any child
or linked issue that could not be hydrated, or the template's unknown marker
when a section could not be verified as empty.

Treat `./subagents/issue-retriever-template.md` as the authoritative snapshot
shape bundled with this skill; no external spec file is required. The section
tables below are the scan-friendly summary of that contract.

**Locked-core sections** (same names and relative order across the paired
issue/ticket-fetching skills; the platform-slot section appears between
`## Retrieval Warnings` and `## Linked Issues`):

| Section | Why it exists |
| ------- | ------------- |
| `## Metadata` | Core issue and repository context for planning and validation |
| `## Description` | Primary source of requirements (issue body, normalized) |
| `## Acceptance Criteria` | Definition-of-done source, including extracted AC when present |
| `## Comments` | Decisions, clarifications, and implementation hints |
| `## Retrieval Warnings` | Stable disclosure for partial related-item or API limits |
| `## Linked Issues` | Dependency and surrounding context |

**Locked platform-slot section** (shared concept; the parallel ticket-fetching
skill uses `## Subtasks`):

| Section | Why it exists |
| ------- | ------------- |
| `## Child Issues` | GitHub sub-issues / child work items when discoverable |

Top-level snapshot order is `## Metadata`, `## Description`,
`## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`,
`## Child Issues`, `## Linked Issues`, then the platform-extension sections
below.

The retrieval preamble must include `Retrieved on`, `Source: <ISSUE_URL>` (or
`owner/repo#N` when no URL is available), and
`Repository: <owner>/<repo> | Issue: #<N>`. In `## Metadata`, keep stable
identity rows for `ISSUE_SLUG`, `Repository`, `Issue number`, and `URL`.

**Platform-extension sections** (GitHub-specific; expected to differ across
tracker-fetching skills). All stay stably present, using `_None_` only when
their absence was verified:

| Section | Why it exists |
| ------- | ------------- |
| `## Labels` | Scoped classification |
| `## Assignees` | Ownership |
| `## Milestone` | Release or iteration bucket when set |
| `## Projects` | Project board / project fields when retrievable without excessive custom setup; when not determinable, render the template's unknown marker instead of `_None_` |
| `## Attachments` | Placeholder for file-like assets; GitHub rarely exposes a Jira-style attachment list - record `_None_` unless you have concrete linked assets to enumerate |

## Escalation

Branch on the retriever's structured status fields, not on prose:

| Summary state | Coordinator action |
| ------------- | ------------------ |
| `FETCH: PASS` with `Validation: PASS` | Report success and continue |
| `FETCH: PARTIAL` with `Validation: PASS` | Report success with warnings and keep the incompleteness visible |
| `FETCH: FAIL` | Stop and surface the failure category plus reason |
| `FETCH: ERROR` or `Validation: FAIL` | Stop and surface the unexpected failure or contract failure |

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42` -> `ISSUE_SLUG=acme-app-42`

1. Read `./subagents/issue-retriever.md`
2. Dispatch `issue-retriever` with `ISSUE_URL`
3. Subagent returns:

   FETCH: PASS
   Validation: PASS
   Failure category: NONE
   File written: docs/acme-app-42.md
   Issue: acme/app#42: Implement dark mode toggle
   State: OPEN
   Comments: 4/4
   Child issues: 0/0
   Linked issues: 1/1
   Attachments: 0
   Warnings: None
   Reason: None

4. Report:
   "Issue fetched to `docs/acme-app-42.md`.
   `acme/app#42: Implement dark mode toggle` is `OPEN`.
   Retrieved 4/4 comments, 0/0 child issues, 1/1 linked issues, 0 attachments.
   Retrieval only; GitHub was not modified."
</example>

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/7001`

1. Read `./subagents/issue-retriever.md`
2. Dispatch `issue-retriever` with `ISSUE_URL`
3. Subagent returns:

   FETCH: PARTIAL
   Validation: PASS
   Failure category: NONE
   File written: docs/acme-app-7001.md
   Issue: acme/app#7001: Audit webhook retries
   State: OPEN
   Comments: 2/2
   Child issues: 0/UNKNOWN
   Linked issues: 1/1
   Attachments: 0
   Warnings: Child issue discovery unavailable: sub_issues endpoint unsupported on this host
   Reason: None

4. Report:
   "Issue fetched to `docs/acme-app-7001.md` with retrieval warnings.
   `acme/app#7001: Audit webhook retries` is `OPEN`.
   Retrieved 2/2 comments, 0/UNKNOWN child issues, 1/1 linked issues, 0 attachments.
   Warning: Child issue discovery unavailable: sub_issues endpoint unsupported
   on this host.
   Retrieval only; GitHub was not modified."
</example>
