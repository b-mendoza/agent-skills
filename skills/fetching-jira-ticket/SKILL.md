---
name: "fetching-jira-ticket"
description: 'Phase 1 of `orchestrating-jira-workflow`: retrieve a Jira ticket into a stable Markdown snapshot for downstream workflow phases. Use this as a workflow phase, not as a standalone implementation skill, whenever a Jira URL needs to become `docs/<TICKET_KEY>.md` with predictable headings for metadata, description, acceptance criteria, comments, subtasks, linked issues, attachments, and custom fields. The bundled retriever handles Jira reads, validation, and snapshot assembly. This skill coordinates retrieval only: it does not modify Jira, create branches, or start implementation.'
---

# Fetching Jira Ticket

You are a Phase 1 coordinator. Your job is to turn a Jira URL into a validated
local snapshot by dispatching one retrieval specialist, keeping only its
structured summary, and reporting the result in a form the orchestrator can
carry forward.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Yes | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Derive these values from the URL when you need to talk about the ticket:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **Ticket key:** full path segment, such as `JNS-6065`

Prefer passing the full `JIRA_URL` downstream rather than only the derived key.
The URL carries more context and lets the subagent derive identifiers for
itself.

## Workflow Overview

```text
1. Read the retriever subagent definition
2. Dispatch the subagent with JIRA_URL
3. Interpret the structured summary it returns
4. Report the file path, counts, and warnings to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | Uses the bundled Jira read path to retrieve Jira data, writes `docs/<TICKET_KEY>.md`, validates the artifact, and returns a concise fetch summary |

## How This Skill Works

This skill is intentionally narrow. It coordinates retrieval, not mutation,
planning, or execution. Keep only:

- `TICKET_KEY` and the URL needed for the next phase
- The file path written
- Counts and warnings from the retriever summary
- Any fatal reason that requires user action

This phase succeeds only when the retriever returns a structured result that
matches the output contract and, when a file is written, reports validation
status consistently.

This coordinator may do four things directly: read its bundled skill files,
derive identifiers from the input URL, dispatch the retriever, and relay the
retriever's structured summary. Everything else stays inside the subagent.

### 1. Dispatch the retriever

Read `./subagents/ticket-retriever.md`, then dispatch it with:

- `JIRA_URL`

The subagent owns input validation, Jira read-path discovery and auth checks,
ticket and relationship retrieval, document assembly, output validation, and
cleanup.

### 2. Interpret the structured result

> Reminder: branch on the structured result fields, not on prose. This
> coordinator dispatches, interprets, and relays summaries; it does not inspect
> raw Jira payloads or rewrite the artifact.

The retriever returns a summary with these top-level fields:

- `FETCH: PASS` -> retrieval and validation succeeded
- `FETCH: PARTIAL` -> artifact was written and validated, but some comments or
  related items could not be retrieved, or related-item discovery could not be
  verified
- Parent comment retrieval and subtask / linked-issue retrieval or discovery
  gaps use `PARTIAL`; `## Attachments` and `## Custom Fields` are populated
  from the retrieved parent ticket payload and do not introduce a separate
  unverifiable-section state analogous to unknown discovery on related items
- `FETCH: FAIL` -> deterministic failure such as bad input, ticket not found,
  missing auth, rate limits after retry, or no usable Jira tools
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
- `<retrieved>/UNKNOWN` means the parent ticket was retrieved but discovery
  for that section could not be verified; the retriever records a warning and
  treats the run as `FETCH: PARTIAL`
- `N/A` for `Comments`, `Subtasks`, or `Linked issues` means the parent ticket
  was not retrieved and those retrieval steps never ran (for example,
  `Failure category: NOT_FOUND` before any snapshot). Do not use `0/0` or
  `<retrieved>/UNKNOWN` in that case
- `Attachments: <N>` is the number of attachment rows under `## Attachments`;
  use `Attachments: N/A` when the parent ticket was not retrieved (that section
  was not populated from a successful parent read)

Failure categories are:

- `NONE` -> no fatal failure occurred
- `BAD_INPUT` -> malformed or unsupported Jira URL
- `NOT_FOUND` -> the parent Jira ticket could not be found before a valid
  artifact was produced
- `AUTH` -> Jira access was denied or not authenticated
- `TOOLS_MISSING` -> no suitable Jira-capable tools were available
- `RATE_LIMIT` -> Jira access was rate-limited and retry budget was exhausted
- `UNEXPECTED` -> tool or environment failure outside the expected categories

Handle them this way:

- `FETCH: PASS` with `Validation: PASS`: report success and continue
- `FETCH: PARTIAL` with `Validation: PASS`: report success with warnings and
  make the incompleteness visible
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
- The ticket identity (`Ticket: <TICKET_KEY>: <Summary>`)
- The ticket state (`Status: ... | Type: ...`)
- Retrieved versus discovered counts for comments, or `N/A` when the parent
  ticket was not retrieved
- The attachment row count (`Attachments: <N>`), or `N/A` when the parent ticket
  was not retrieved
- Retrieved versus discovered counts for subtasks and linked issues, where the
  discovered total may be `UNKNOWN` when discovery could not be verified, or
  `N/A` when the parent ticket was not retrieved and discovery never ran
- Any warnings or fatal reason
- Any failure category, when one exists
- That this phase is retrieval only and does not mutate Jira

## Output Contract

Primary artifact:

```text
docs/<TICKET_KEY>.md
```

Treat `docs/<TICKET_KEY>.md` as a preserved workflow artifact for resumability.
Do not commit it as part of implementation history.

The document must contain every top-level heading from the fenced Markdown
snapshot shape in `./subagents/ticket-retriever-template.md`. Repeated nested
headings, such as comment entries or per-related-item subsections, appear only
when their parent section has material to render. If a top-level section has
verified empty data, the heading still appears and the section body is
`_None_`. For `## Subtasks` and `## Linked Issues`, use the template's unknown
marker when discovery could not be verified after the parent ticket was
retrieved, and use placeholder entries for known related items that could not
be hydrated. Downstream skills rely on stable headings rather than best-effort
prose. If retrieval is partial, the artifact must record that explicitly in
`## Retrieval Warnings`.

Treat `./subagents/ticket-retriever-template.md` as the authoritative snapshot
shape bundled with this skill; no external spec file is required. The section
tables below are the scan-friendly summary of that contract.

**Locked-core sections** (same names and relative order across the paired
issue/ticket-fetching skills; the platform-slot section appears between
`## Retrieval Warnings` and `## Linked Issues`):

| Section | Why it exists |
| ------- | ------------- |
| `## Metadata` | Core ticket context for planning and validation |
| `## Description` | Primary source of requirements |
| `## Acceptance Criteria` | Definition-of-done source, including extracted AC when present |
| `## Comments` | Decisions, clarifications, and implementation hints |
| `## Retrieval Warnings` | Stable disclosure point for partial related-item retrieval |
| `## Linked Issues` | Dependency and surrounding context |

**Locked platform-slot section** (shared concept; the parallel issue-fetching
skill uses `## Child Issues`):

| Section | Why it exists |
| ------- | ------------- |
| `## Subtasks` | Existing Jira execution breakdown |

Top-level snapshot order is `## Metadata`, `## Description`,
`## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`,
`## Subtasks`, `## Linked Issues`, then the platform-extension sections below.

The retrieval preamble must include `Retrieved on`, `Source: <JIRA_URL>`, and
`Workspace: <workspace> | Project: <project> | Ticket: <TICKET_KEY>`. In
`## Metadata`, keep stable identity rows for `Ticket Key`, `Workspace`,
`Project`, and `URL`.

**Platform-extension sections** (Jira-specific; expected to differ across
tracker-fetching skills). All stay stably present with `_None_` when their
absence was verified:

| Section | Why it exists |
| ------- | ------------- |
| `## Attachments` | File-level reference metadata |
| `## Custom Fields` | Non-standard fields that may carry requirements |

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
Input: `JIRA_URL=https://vukaheavyindustries.atlassian.net/browse/JNS-6065`

1. Read `./subagents/ticket-retriever.md`
2. Dispatch `ticket-retriever` with `JIRA_URL`
3. Subagent returns:

   FETCH: PASS
   Validation: PASS
   Failure category: NONE
   File written: docs/JNS-6065.md
   Ticket: JNS-6065: Implement dark mode toggle
   Status: In Progress | Type: Story
   Comments: 4/4
   Subtasks: 3/3
   Linked issues: 1/1
   Attachments: 2
   Warnings: None
   Reason: None

4. Report:
   "Ticket fetched to `docs/JNS-6065.md`.
   `JNS-6065: Implement dark mode toggle` is `In Progress` (`Story`).
   Retrieved 4/4 comments, 3/3 subtasks, 1/1 linked issues, and 2
   attachments. Retrieval only; Jira was not modified."
</example>

<example>
Input: `JIRA_URL=https://vukaheavyindustries.atlassian.net/browse/JNS-7001`

1. Read `./subagents/ticket-retriever.md`
2. Dispatch `ticket-retriever` with `JIRA_URL`
3. Subagent returns:

   FETCH: PARTIAL
   Validation: PASS
   Failure category: NONE
   File written: docs/JNS-7001.md
   Ticket: JNS-7001: Audit webhook retries
   Status: To Do | Type: Task
   Comments: 2/2
   Subtasks: 1/2
   Linked issues: 0/0
   Attachments: 0
   Warnings: Could not retrieve JNS-7002 (404 Not Found)
   Reason: None

4. Report:
   "Ticket fetched to `docs/JNS-7001.md` with retrieval warnings.
   `JNS-7001: Audit webhook retries` is `To Do` (`Task`).
   Retrieved 2/2 comments, 1/2 subtasks, 0/0 linked issues, and 0
   attachments. Warning: Could not retrieve JNS-7002 (404 Not Found).
   Retrieval only; Jira was not modified."
</example>
