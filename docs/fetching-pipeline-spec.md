# Fetching Pipeline Specification

> **This document is the canonical reference for the retrieval pipeline
> shared by `fetching-jira-ticket` and `fetching-github-issue`.**
>
> When you change the pipeline, the contracts, the retry rules, or the
> validation checklist, change **this document first**, then propagate the
> change to both skills. See the _Change protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic retrieval
pipeline** that both fetching skills must implement:

- `skills/fetching-jira-ticket/` — Jira-specific retrieval coordinator
- `skills/fetching-github-issue/` — GitHub-specific retrieval coordinator

Each skill runs **exactly one retrieval per invocation**. It dispatches a
single retrieval specialist subagent, interprets the structured summary it
returns, and reports the result to the caller.

### What this spec covers

- Required input shape and derivation rules
- Coordinator workflow, identity, and behavioral constraints
- Output artifact contract (template shape, section registry)
- Structured result contract (FETCH, Validation, Failure category)
- Escalation rules
- The 7-step retriever subagent pipeline
- Retry strategy
- Post-write validation checklist
- Structured summary output format
- Artifact lifecycle
- What each concrete skill **may** customize and what it **must not**

### What this spec does not cover

- The individual prose of each subagent definition or template file. Skills
  may word instructions differently as long as the behavior, contracts, and
  outputs match this spec.
- Platform-specific transport details (Jira MCP tool discovery vs `gh` CLI
  verification, exact API calls, auth flows). Those live inside the
  platform-specific subagents.
- The parent orchestrator's logic (`orchestrating-jira-workflow` /
  `orchestrating-github-workflow`). This spec covers only the per-invocation
  retrieval skill.

## 2. Harness-agnosticism requirements

Both skills must run on **OpenCode, Cursor, and Claude Code** without
modification:

1. **Do not name runtime-specific tools.** Use neutral phrasing: "dispatch
   to a subagent", not "use the Task tool" or "use the Agent tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` in YAML frontmatter must not be
   treated as contract by any shared prose.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   CLI-specific banner formats.
4. **Prefer relative file paths** over harness-internal indirection.
5. **Platform-specific tooling appears only in platform-specific subagents.**
   Jira MCP references belong in `ticket-retriever.md`. `gh` CLI references
   belong in `issue-retriever.md`. Neither transport appears in SKILL.md
   coordinator logic.

## 3. Vocabulary (placeholders)

This spec uses abstract placeholders. Each concrete skill substitutes them
with its own values:

| Placeholder          | Jira skill                       | GitHub skill                          |
| -------------------- | -------------------------------- | ------------------------------------- |
| `ITEM_KEY`           | `TICKET_KEY` (e.g. `JNS-6065`)  | `ISSUE_SLUG` (e.g. `acme-app-42`)    |
| `ITEM_URL`           | `JIRA_URL`                       | `ISSUE_URL`                           |
| `ITEM_IDENTITY`      | `<TICKET_KEY>: <Summary>`        | `<owner>/<repo>#<N>: <Title>`         |
| `ITEM_STATE`         | `Status: <s> \| Type: <t>`       | `State: <OPEN \| CLOSED>`            |
| `RELATED_SLOT`       | `## Subtasks`                    | `## Child Issues`                     |
| `PLATFORM_TRANSPORT` | Jira MCP / REST                  | `gh` CLI                              |
| `SNAPSHOT_PATH`      | `docs/<TICKET_KEY>.md`           | `docs/<ISSUE_SLUG>.md`               |

## 4. Required input shape

### Jira skill

| Input      | Required | Notes                                      |
| ---------- | -------- | ------------------------------------------ |
| `JIRA_URL` | Yes      | Derives workspace, project, and ticket key |

### GitHub skill

| Input          | Required  | Notes                                             |
| -------------- | --------- | ------------------------------------------------- |
| `ISSUE_URL`    | Preferred | Derives owner, repo, issue number, and slug       |
| `OWNER`        | Fallback  | With `REPO` + `ISSUE_NUMBER` when URL absent      |
| `REPO`         | Fallback  | With `OWNER` + `ISSUE_NUMBER` when URL absent     |
| `ISSUE_NUMBER` | Fallback  | With `OWNER` + `REPO` when URL absent             |

Both skills prefer passing the full URL downstream. The URL carries more
context and lets the subagent derive identifiers for itself.

## 5. Coordinator workflow and identity

The coordinator is a Phase 1 skill that turns a platform reference into a
validated local snapshot. It is intentionally narrow: it coordinates
retrieval, not mutation, planning, or execution.

### Four permitted coordinator actions

1. Read its bundled skill files (subagent definition, template)
2. Derive identifiers from the input URL or coordinates
3. Dispatch the retriever subagent
4. Relay the retriever's structured summary

Everything else stays inside the subagent.

### Workflow steps

```text
1. Read the retriever subagent definition
2. Dispatch the subagent with the input URL (or coordinates)
3. Interpret the structured summary it returns
4. Report the file path, counts, and warnings to the caller
```

### Success condition

The phase succeeds only when the retriever returns a structured result that
matches the output contract and, when a file is written, reports validation
status consistently.

## 6. Output artifact contract

### Primary artifact

```text
SNAPSHOT_PATH  (Jira: docs/<TICKET_KEY>.md  |  GitHub: docs/<ISSUE_SLUG>.md)
```

Treat the snapshot as a **preserved workflow artifact for resumability**.
Write it, validate it, and leave it in place, but do not stage or commit it.

### Template authority

Each skill has a bundled template that defines the exact artifact shape:

- Jira: `./subagents/ticket-retriever-template.md`
- GitHub: `./subagents/issue-retriever-template.md`

The template is the authoritative contract. The section tables in SKILL.md
are the scan-friendly summary.

### Heading and content rules

- Every top-level heading from the template must appear in the output file.
- Repeated nested headings appear only when their parent section has
  material to render.
- If a top-level section has no data, keep the heading and write `_None_`.
- For empty scalar values in `## Metadata`, write `_None_` in the value
  column.
- If retrieval is partial, `## Retrieval Warnings` must list every warning
  and each missing related item must appear as a placeholder in its section.
- Downstream skills rely on stable headings, not best-effort prose.

### Section registry

**Locked-core sections** (shared by both skills; same names, same relative
order):

| Section                 | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `## Metadata`           | Core context for planning and validation         |
| `## Description`        | Primary source of requirements                   |
| `## Acceptance Criteria`| Definition-of-done source                        |
| `## Comments`           | Decisions, clarifications, implementation hints   |
| `## Retrieval Warnings` | Stable disclosure for partial retrieval           |
| `## Linked Issues`      | Dependency and surrounding context               |

**Locked platform-slot section** (shared concept, platform-named):

| Jira section    | GitHub section     | Purpose                      |
| --------------- | ------------------ | ---------------------------- |
| `## Subtasks`   | `## Child Issues`  | Existing execution breakdown |

**Platform-extension sections** (expected to differ between fetching
skills):

- **Jira:** `## Attachments`, `## Custom Fields`
- **GitHub:** `## Labels`, `## Assignees`, `## Milestone`, `## Projects`,
  `## Attachments`

Platform-extension sections are stably present with `_None_` when empty.

## 7. Structured result contract

The retriever returns a structured summary with three independent status
axes.

### FETCH status

| Value     | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `PASS`    | Retrieval and validation succeeded                                           |
| `PARTIAL` | Artifact written and validated, but some related data could not be retrieved  |
| `FAIL`    | Deterministic failure (bad input, not found, auth, rate limit, missing tools) |
| `ERROR`   | Unexpected tool or environment failure                                       |

### Validation status

| Value     | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `PASS`    | Written file satisfies the template contract               |
| `FAIL`    | File was written but violates the contract after repair    |
| `NOT_RUN` | Retrieval failed before validation could happen            |

### Failure category

| Value          | Meaning                                          |
| -------------- | ------------------------------------------------ |
| `NONE`         | No fatal failure                                 |
| `BAD_INPUT`    | Malformed input or unusable identifiers          |
| `NOT_FOUND`    | Parent item not found before valid artifact      |
| `AUTH`         | Access denied or not authenticated               |
| `TOOLS_MISSING`| Required platform transport unavailable          |
| `RATE_LIMIT`   | Rate limited after retry budget exhausted        |
| `UNEXPECTED`   | Failure outside expected categories              |

### Coordinator interpretation rules

1. `FETCH: PASS` with `Validation: PASS` — report success and continue
2. `FETCH: PARTIAL` with `Validation: PASS` — report success with warnings;
   make incompleteness visible
3. `FETCH: FAIL` — stop and relay failure category plus reason
4. `FETCH: ERROR` — stop and relay as unexpected failure
5. `Validation: FAIL` with `FETCH: ERROR` — stop and relay contract failure
6. Inconsistent pairing (e.g. `FETCH: PASS` + `Validation: NOT_RUN`) —
   treat as `FETCH: ERROR` and stop

Branch on the structured fields, not on prose. Use `Reason` only for
user-facing detail after branching on `Failure category`.

## 8. Escalation

| Summary state                                  | Coordinator action                                     |
| ---------------------------------------------- | ------------------------------------------------------ |
| `FETCH: PASS` with `Validation: PASS`          | Report success and continue                            |
| `FETCH: PARTIAL` with `Validation: PASS`       | Report success with warnings; keep incompleteness visible |
| `FETCH: FAIL`                                  | Stop and surface failure category plus reason          |
| `FETCH: ERROR` or `Validation: FAIL`           | Stop and surface unexpected or contract failure        |

## 9. Retriever subagent pipeline

Both retriever subagents follow a 7-step sequence. Each step is
platform-adapted but follows the same contract.

### Step 1: Validate input and establish identifiers

Confirm the input is valid and extract platform-specific identifiers. If
input is malformed, return `FETCH: FAIL` with
`Failure category: BAD_INPUT`.

### Step 2: Verify platform transport

Before the first read, verify the platform transport is available and
authenticated:

- **Jira:** Discover Jira-capable MCP tools by inspecting schemas. Map
  available tools to required operations (issue reads, comment reads,
  related-issue retrieval). Choose deterministically: prefer the most
  specific read-only tool; keep the mapping stable for the run. If the
  server exposes an auth step, complete it before the first read.
- **GitHub:** Verify `gh` is on `PATH` (`gh --version`) and authenticated
  (`gh auth status`).

If the transport is unavailable, return `FETCH: FAIL` with
`Failure category: TOOLS_MISSING`. If auth fails, return `FETCH: FAIL`
with `Failure category: AUTH`.

### Step 3: Retrieve the parent item

Fetch the parent item with comprehensive metadata, full description, all
comments in chronological order, and platform-specific fields.

**Shared formatting rules:**

- Preserve useful formatting: lists, fenced code blocks, links, tables
- Outside fenced code blocks, rewrite platform-authored Markdown heading
  lines as bold labels to prevent collision with reserved snapshot headings
- Serialize multi-value metadata as comma-separated strings sorted
  alphabetically by display text
- For empty scalar metadata values, write `_None_`

**Acceptance criteria extraction:**

Apply the template's precedence rules. Remove the winning AC blocks from
`## Description` so AC is not duplicated unless the template says otherwise.

**Partial comment handling:**

If parent-comment retrieval becomes partial after the item is known, keep
retrieved comments, append the partial-comment marker per template rules,
record the warning under `## Retrieval Warnings`, and treat the run as
`FETCH: PARTIAL`.

### Step 4: Retrieve related items

Determine how many related items exist (subtasks/child issues and linked
issues). For each, retrieve identity, status, full description, and all
comments with the same formatting rules.

**Shared partial retrieval rules:**

- If an individual related item cannot be retrieved, continue with others
- Add a warning under `## Retrieval Warnings`
- Add a placeholder entry using the template's `Not retrieved` shape
- This is `FETCH: PARTIAL`, not a silent omission

**Deterministic ordering** (platform-specific rules):

- **Jira:** Subtasks by ticket key ascending; linked issues by link type,
  then ticket key ascending; attachments by filename ascending
- **GitHub:** Child issues by number ascending; linked issues by
  relation/context, then `owner/repo#N` ascending; labels by name
  ascending; assignees by login ascending

### Step 5: Assemble the document

Load the bundled template only at this step (not earlier). Write the
snapshot to `SNAPSHOT_PATH`.

Treat the file as a **preserved workflow artifact for resumability**. Write
it, validate it, and leave it in place, but do not stage or commit it.

**Required elements:**

- Title line: `# <ITEM_KEY>: <Title>`
- Retrieval preamble with `Retrieved on` timestamp and `Source` reference
- Every top-level heading from the template
- Timestamps normalized to `YYYY-MM-DD HH:MM UTC`; date-only as
  `YYYY-MM-DD`

### Step 6: Post-write validation checklist

After writing the file, re-read and verify. Both retriever subagents must
satisfy this checklist (platform-adapted):

1. Every required top-level heading from the fenced snapshot shape exists
2. Repeated nested headings are present only when their parent item exists,
   and every materialized item follows the template's nested shape
3. `## Description` is present and explicitly represented with either the
   source body or `_None_`
4. The title line matches `# <ITEM_KEY>: <Title>`
5. The retrieval preamble includes `Retrieved on` and `Source`
6. The metadata table includes every required row in template order, and
   empty scalar values are written as `_None_`
7. Parent comment count in the file matches the retrieved data
8. The number of related-item entries matches the number discovered, with
   full entries for retrieved items and `Not retrieved` placeholders for
   unretrieved ones
9. Within body content, useful formatting is preserved and, outside fenced
   code blocks, no rendered body line begins with Markdown heading markers
   (`# `, `## `, `### `)
10. For each materialized related item or placeholder, the required nested
    headings and fields from the template appear exactly once
11. `## Acceptance Criteria` follows the template's precedence and
    extraction rules
12. `## Retrieval Warnings` is `_None_` on full success, or lists every
    warning on partial success
13. Any partial comment retrieval warning has a matching terminal marker in
    the affected comments section
14. Each unretrieved related item has both a warning entry and a placeholder
    entry in the correct section
15. Platform-extension sections are either `_None_` or valid content
    matching the template's rules
16. Deterministic ordering rules are satisfied

**Repair loop:** Fix only the missing or mismatched portions. Maximum **3**
repair passes. If still failing, return `FETCH: ERROR`,
`Validation: FAIL`, `Failure category: UNEXPECTED`.

### Step 7: Return only the structured summary

## 10. Retry strategy

Retry only read operations that fail due to:

- Explicit rate limiting (Jira: rate-limit responses; GitHub: `403` with
  rate limit header, `429`)
- Transient server errors (Jira: service unavailability; GitHub: `5xx`)

**Limits:** At most **2** retries per operation, with backoff **1s** then
**3s**.

**Do not retry:** Bad input, auth failures, not-found responses, or
tool/schema mismatches.

If rate limits persist after retry budget, return `FETCH: FAIL` with
`Failure category: RATE_LIMIT`.

## 11. Structured summary output format

Both retrievers return a structured summary as their only output. The
summary must be machine-readable so the coordinator can branch on status
fields without re-reading the artifact.

### Shared fields

```text
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: <SNAPSHOT_PATH | None>
<ITEM_IDENTITY line>
<ITEM_STATE line>
Comments: <retrieved>/<found>
<RELATED_SLOT count>: <retrieved>/<found>
Linked issues: <retrieved>/<found>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

`<found>` is the count of related item identities discovered on the parent;
`<retrieved>` is how many were fully hydrated per template. When discovery
yields zero, use `0/0`.

### Platform-specific fields

- **Jira** adds `Attachments: <N>` after the linked issues line.
- **GitHub** omits the Attachments count (GitHub's `## Attachments` is
  typically `_None_`).

### Coordinator report content

Using only the subagent's summary, the coordinator tells the caller:

- The file path written (when one exists)
- The item identity
- The item state
- Retrieved versus discovered counts for comments
- Retrieved versus discovered counts for related items and linked issues
- Platform-specific counts (Jira: attachment count)
- Any warnings or fatal reason
- Any failure category (when one exists)
- That this phase is retrieval only and does not mutate the platform

## 12. Artifact lifecycle

| Category | Contents        | Git behavior     | Lifecycle     |
| -------- | --------------- | ---------------- | ------------- |
| A        | `SNAPSHOT_PATH` | Never committed  | Never deleted |

The snapshot is a workflow artifact for resumability. It stays out of git
history. Downstream phases read it for planning context.

## 13. Divergence register

### Locked to this spec

Both skills must express the same contract; wording may differ but behavior
must not:

- Coordinator workflow and the 4 permitted actions (section 5)
- Locked-core section registry and ordering (section 6)
- Structured result contract: FETCH, Validation, Failure category
  (section 7)
- Coordinator interpretation rules (section 7)
- Escalation table (section 8)
- The 7-step retriever pipeline structure (section 9)
- Retry strategy: limits, backoff, non-retryable categories (section 10)
- Post-write validation checklist (section 9, step 6)
- Structured summary shared fields and `<found>` semantics (section 11)
- Artifact lifecycle (section 12)

### Platform-specific (expected to differ)

- The concrete platform transport (Jira MCP tool discovery vs `gh` CLI)
- The input shape (single URL vs URL-or-fallback-coordinates)
- The `ITEM_KEY` derivation and naming (`TICKET_KEY` vs `ISSUE_SLUG`)
- The metadata table fields (Jira: 17 rows; GitHub: 9 rows)
- The related-item metadata fields (Jira: Status/Assignee/Type; GitHub:
  State/URL)
- The related-item placeholder fields (Jira: Status/Assignee/Type/Retrieval
  Status/Reason; GitHub: State/URL/Retrieval Status/Reason)
- Platform-extension sections (Jira: Attachments, Custom Fields; GitHub:
  Labels, Assignees, Milestone, Projects, Attachments)
- The template preamble structure (Jira: 2 lines; GitHub: 3 lines
  including `Repository | Issue`)
- The `Attachments: <N>` line in the structured summary (Jira only)
- The acceptance criteria primary source (Jira: dedicated field first, then
  body; GitHub: body only)
- Platform-specific deterministic ordering rules
- The parent orchestrator references in each SKILL.md frontmatter

Anything else that diverges should either be harmonized or explicitly noted
here as an intentional platform difference.

## 14. Change protocol

When the fetching pipeline needs to change:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update `fetching-jira-ticket`** to match. Touch `SKILL.md` and the
   subagent files as needed.
3. **Update `fetching-github-issue`** to match, using the same edits where
   content is shared.
4. **Verify alignment.** Re-read both skills' `SKILL.md`, retriever
   subagent, and template side by side. Confirm they express the same
   contract. Differences must map to an entry in the divergence register
   (section 13).
5. **Do not add a feature to one skill only.** If a behavior is valuable in
   one fetching skill, it is valuable in both. Changes that only make sense
   for one platform belong inside that platform's subagent, not in the
   shared pipeline.

This spec is intentionally denser than a skill file. It exists to be read
by the human author (or a future agent) at change time, not every retrieval
run. Neither skill loads this file during normal operation.
