# Fetching Pipeline Specification

> **This document is the canonical reference for the Phase 1 snapshot-retrieval
> skills shared by `fetching-github-issue` and `fetching-jira-ticket`.**
>
> When you change the retrieval pipeline, the structured summary contract, the
> snapshot artifact shape, or the allowed platform divergences, change **this
> document first**, then propagate the change to both skills. See the _Change
> protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-aware fetching pipeline**
implemented by these two skills:

- `skills/fetching-github-issue/` — GitHub issue snapshot coordinator
- `skills/fetching-jira-ticket/` — Jira ticket snapshot coordinator

Each skill runs **exactly one retriever dispatch per invocation**. The
coordinator derives the routing inputs it needs, dispatches exactly one
retriever specialist, and returns only that specialist's structured summary to
the caller. The retriever specialist validates the input, writes the stable
Markdown snapshot under `docs/`, and validates that artifact before reporting
success, partial success, or failure.

### What this spec covers

- Coordinator role and allowed direct actions
- Required input shape by platform
- The standard 7-step retriever pipeline
- The structured summary contract (`FETCH`, `Validation`, `Failure category`)
- Snapshot artifact requirements and template authority
- Post-write validation and repair-loop rules
- Coordinator interpretation and escalation
- Artifact lifecycle
- What each paired skill **may** customize and what it **must not**

### What this spec does not cover

- Exact CLI/API commands or exact tool names beyond platform-specific transport
  expectations
- The individual prose of the skill files, subagent definitions, or templates,
  as long as their behavior and contracts match this spec
- Parent orchestrator behavior after the snapshot is returned
- Downstream planning or execution behavior after Phase 1 retrieval completes

## 2. Harness-agnosticism requirements

Both fetch skills must run on **OpenCode, Cursor, and Claude Code** without
modification. That imposes these shared rules:

1. **Do not name harness-specific tools in shared coordinator prose.** Say
   "dispatch the retriever subagent" or "load the bundled template", not
   "use the Task tool", "use the Agent tool", or "use the Read tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` are optional and must not be treated as
   part of the shared contract.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, and no CLI-specific banner formats.
4. **Prefer relative file paths.** Use paths like `./subagents/...` and
   `docs/...`, not harness-internal indirection.
5. **Platform-specific transport is allowed only in platform-specific places.**
   The GitHub retriever may name `gh`; the Jira retriever may describe
   Jira-capable tool discovery. Shared contract sections must stay neutral.

## 3. Vocabulary and snapshot keying

This spec uses abstract placeholders where the two skills differ by platform:

| Placeholder     | GitHub skill             | Jira skill               |
| --------------- | ------------------------ | ------------------------ |
| `SNAPSHOT_KEY`  | `ISSUE_SLUG`             | `TICKET_KEY`             |
| `SOURCE_URL`    | `ISSUE_URL`              | `JIRA_URL`               |
| `PARENT_RECORD` | GitHub issue             | Jira ticket              |
| `PLATFORM_SLOT` | `## Child Issues`        | `## Subtasks`            |
| `SNAPSHOT_DOC`  | `docs/<SNAPSHOT_KEY>.md` | `docs/<SNAPSHOT_KEY>.md` |

Additional GitHub-only fallback inputs are `OWNER`, `REPO`, and
`ISSUE_NUMBER`. When `ISSUE_URL` is available, it is preferred.

For GitHub, `ISSUE_SLUG` is `<owner>-<repo>-<issue_number>` with `owner` and
`repo` normalized to lowercase for slug stability. For Jira, `TICKET_KEY` is
derived from the final path segment in `JIRA_URL`.

## 4. Required input shape

The paired fetch skills do not share one literal input schema. The canonical
input rules are:

### GitHub

| Input          | Required                                      | Notes                                                                   |
| -------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `ISSUE_URL`    | Preferred                                     | Use when available; it removes ambiguity and matches primary `gh` usage |
| `OWNER`        | With `REPO` + `ISSUE_NUMBER` when URL absent  | Used only when `ISSUE_URL` is unavailable                               |
| `REPO`         | With `OWNER` + `ISSUE_NUMBER` when URL absent | Used only when `ISSUE_URL` is unavailable                               |
| `ISSUE_NUMBER` | With `OWNER` + `REPO` when URL absent         | Used only when `ISSUE_URL` is unavailable                               |

If only coordinates are available, the retriever must scope reads explicitly to
`owner/repo`.

### Jira

| Input      | Required | Notes                                                                 |
| ---------- | -------- | --------------------------------------------------------------------- |
| `JIRA_URL` | Yes      | The retriever derives workspace, project, and ticket key from the URL |

The paired skills must remain self-contained: neither skill relies on an
external runtime spec file to interpret its input.

## 5. Coordinator contract

The coordinator is intentionally narrow. It does four things directly:

1. Read its bundled skill files
2. Derive the platform identifiers it needs from the input
3. Dispatch exactly one retriever subagent
4. Interpret and relay only the retriever's structured summary

The coordinator does **not**:

- Inspect raw tracker payloads
- Rewrite the snapshot artifact
- Perform tracker mutation
- Start implementation or planning

The canonical coordinator workflow is:

1. Read the retriever subagent definition
2. Dispatch the retriever with the platform-specific input set
3. Interpret the structured summary it returns
4. Report the file path, counts, warnings, and fatal reason to the caller

## 6. Retriever pipeline

Both retrievers follow the same 7-step pipeline, even though the transport
details differ by platform:

1. **Validate the input and establish identifiers.**
2. **Verify transport readiness and authentication.**
3. **Retrieve the parent record** and parent comments.
4. **Retrieve related items** and related comments.
5. **Load the bundled template at assembly time** and write the snapshot to
   `docs/<SNAPSHOT_KEY>.md`.
6. **Re-read the artifact and run the post-write validation/repair loop.**
7. **Return only the structured summary.**

Canonical retriever responsibilities:

- Own input validation and tooling/auth checks
- Gather the parent record plus all required related-item context
- Assemble the artifact from the bundled template, not by ad hoc shape
- Keep intermediate payloads, exploratory output, and full artifact text out of
  the final reply
- Return only the machine-readable summary defined by this spec

Allowed transport differences:

- **GitHub:** `gh` / `gh api` are the primary transport.
- **Jira:** discover the currently available Jira-capable read tools, map them
  deterministically to issue/comment/search operations, and treat missing
  coverage as `TOOLS_MISSING`.

### Shared retry policy

Both retrievers share the same retry and no-retry rules:

- Retry only explicit rate limits or transient service failures.
- Use at most **2 retries per operation**, with backoff delays of **1 second**
  and then **3 seconds**.
- Do **not** retry bad input, auth failures, not found on the parent record, or
  schema/tool mismatch failures.
- If rate limiting persists after the retry budget is exhausted, return
  `FETCH: FAIL` with `Failure category: RATE_LIMIT`.

## 7. Structured summary contract

Every retriever returns a structured summary with the same overall contract.
Field names vary only where the platform requires different identity or state
labels.

### Shared top-level status fields

| Field              | Allowed values                                                                        | Notes                                 |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------- |
| `FETCH`            | `PASS`, `PARTIAL`, `FAIL`, `ERROR`                                                    | Primary retrieval verdict             |
| `Validation`       | `PASS`, `FAIL`, `NOT_RUN`                                                             | Artifact validation verdict           |
| `Failure category` | `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`, `RATE_LIMIT`, `UNEXPECTED` | Machine-readable failure cause        |
| `File written`     | `docs/<SNAPSHOT_KEY>.md` or `None`                                                    | Path to written artifact when present |
| `Warnings`         | `None` or semicolon-separated warnings                                                | Retrieval warnings only               |
| `Reason`           | `None` or fatal reason                                                                | User-facing detail, not routing logic |

### Platform-specific identity and state lines

| Concept                  | GitHub                             | Jira            |
| ------------------------ | ---------------------------------- | --------------- | ------------------------------------- | ---------------- | -------- | ----------- | --------- |
| Identity line            | `Issue: <owner>/<repo>#<N>: <Title | Unknown>`       | `Ticket: <TICKET_KEY>: <Summary/Title | Unknown>`        |
| State line               | `State: <OPEN                      | CLOSED          | Unknown>`                             | `Status: <status | Unknown> | Type: <type | Unknown>` |
| Platform-slot count line | `Child issues: ...`                | `Subtasks: ...` |

### Shared count and attachment lines

Both retrievers include:

- `Comments: <retrieved>/<found | N/A>`
- `<PLATFORM_SLOT>: <retrieved>/<found | UNKNOWN | N/A>`
- `Linked issues: <retrieved>/<found | UNKNOWN | N/A>`
- `Attachments: <N | N/A>`

### Count semantics

- `0/0` means the retriever **positively verified** that no items exist in that
  section.
- `<retrieved>/UNKNOWN` means the parent record was retrieved but discovery for
  that related-item section could not be verified. The retriever records a
  warning and treats the run as `FETCH: PARTIAL`.
- `N/A` means the parent record was **never retrieved**, so that retrieval step
  never ran. Do not use `0/0` or `UNKNOWN` in that case.
- `Attachments: <N>` is the number of rendered entries or rows under
  `## Attachments`. Use `Attachments: N/A` when the parent record was never
  retrieved.

### Canonical status meanings

- `FETCH: PASS` -> retrieval and validation succeeded
- `FETCH: PARTIAL` -> artifact was written and validated, but some related-item
  or comment retrieval was incomplete, or allowed platform-specific discovery
  could not be verified
- `FETCH: FAIL` -> deterministic failure such as bad input, not found, auth
  failure, missing tooling, or exhausted rate-limit retries
- `FETCH: ERROR` -> unexpected environment, schema, or validation failure

`Validation: FAIL` always means the artifact was written but still violates the
template contract after the repair loop. It pairs with `FETCH: ERROR` and
`Failure category: UNEXPECTED`.

## 8. Snapshot artifact contract

Primary artifact:

```text
docs/<SNAPSHOT_KEY>.md
```

The snapshot artifact contract is template-driven:

- The bundled template's fenced Markdown shape is authoritative.
- Every required top-level heading from that shape must appear in the written
  file.
- Repeated nested headings appear only for items that exist, required
  `_Unknown. ..._` markers, or required `Not retrieved` placeholders.
- `_None_` means the section was verified empty.
- `_Unknown. ..._` means the parent record was retrieved but a permitted
  discovery step could not be verified.
- `Not retrieved` placeholders mean a related-item identity was known but the
  item could not be hydrated completely.

### Locked-core sections

These top-level sections and their relative order are locked across the paired
skills:

| Section                  | Why it exists                                       |
| ------------------------ | --------------------------------------------------- |
| `## Metadata`            | Core identity and tracker context                   |
| `## Description`         | Primary source of requirements                      |
| `## Acceptance Criteria` | Definition-of-done source                           |
| `## Comments`            | Decisions, clarifications, and implementation hints |
| `## Retrieval Warnings`  | Stable disclosure point for partial retrieval       |
| `## Linked Issues`       | Dependency and surrounding context                  |

### Locked platform-slot section

The shared slot between `## Retrieval Warnings` and `## Linked Issues` is
conceptually locked, but its name differs by platform:

| GitHub            | Jira          |
| ----------------- | ------------- |
| `## Child Issues` | `## Subtasks` |

### Top-level order

The canonical top-level order is:

1. `## Metadata`
2. `## Description`
3. `## Acceptance Criteria`
4. `## Comments`
5. `## Retrieval Warnings`
6. `PLATFORM_SLOT`
7. `## Linked Issues`
8. Platform-extension sections

### Required identity blocks

Each artifact must include a retrieval preamble and stable identity rows in
`## Metadata`, with platform-specific content:

| Platform | Required preamble lines                               | Required metadata identity rows |
| -------- | ----------------------------------------------------- | ------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| GitHub   | `Retrieved on`, `Source`, `Repository: <owner>/<repo> | Issue: #<N>`                    | `ISSUE_SLUG`, `Repository`, `Issue number`, `URL` |
| Jira     | `Retrieved on`, `Source`, `Workspace: <workspace>     | Project: <project>              | Ticket: <TICKET_KEY>`                             | `Ticket Key`, `Workspace`, `Project`, `URL` |

Those identity rows are the stable minimum. The full `## Metadata` table is
still template-defined and mandatory in template order for each platform. The
retriever validators enforce every required metadata row from the bundled
template, not only the identity subset listed above.

### Platform-extension sections

Allowed extension sections are:

| GitHub           | Jira               |
| ---------------- | ------------------ |
| `## Labels`      | `## Attachments`   |
| `## Assignees`   | `## Custom Fields` |
| `## Milestone`   |                    |
| `## Projects`    |                    |
| `## Attachments` |                    |

GitHub's `## Attachments` is a placeholder for explicitly linked file-like
assets. Jira's `## Attachments` is a table of attachment metadata.

Jira-specific rendering rules that are already fixed by the current retriever
and template contract:

- Multi-value metadata or custom-field values serialize as comma-separated
  strings sorted by display text.
- Structured custom-field values serialize as compact JSON with object keys
  sorted alphabetically.

## 9. Template authority and assembly

Each skill's bundled template is the authoritative snapshot shape for that
skill:

- `skills/fetching-github-issue/subagents/issue-retriever-template.md`
- `skills/fetching-jira-ticket/subagents/ticket-retriever-template.md`

Canonical assembly rules:

- Load the bundled template only at **assembly time**, not earlier in the run.
- Copy the fenced Markdown shape into the artifact contract; explanatory notes
  outside the fence remain instructions, not output.
- Treat the bundled template as authoritative at runtime. No external spec file
  is required during execution.

## 10. Post-write validation and repair loop

After writing the snapshot, the retriever must re-read it and validate at least
these contract points:

- Required top-level headings exist
- Nested headings and placeholder shapes match the template
- Title line and retrieval preamble match the platform template
- Required metadata rows exist and preserve identity fields
- Parent comment count matches the retrieved data
- Related-item counts, placeholders, and `_Unknown. ..._` markers match the
  discovered state
- Acceptance-criteria extraction rules were applied correctly
- Retrieval warnings match every partial or unknown state
- Markdown heading lines in description/comment bodies were rewritten outside
  fenced code blocks
- Deterministic ordering rules were followed
- Platform-extension sections are valid content, `_None_`, or template-defined
  unknown markers where applicable
- On pre-snapshot failure, `Comments`, related-item counts, and `Attachments`
  use `N/A` rather than `0/0`, `UNKNOWN`, or numeric attachment counts

Use a **targeted repair loop** with a maximum of **3** passes. If the artifact
still fails validation after that loop, return:

- `FETCH: ERROR`
- `Validation: FAIL`
- `Failure category: UNEXPECTED`

## 11. Coordinator interpretation and escalation

The coordinator branches on structured fields, not on prose:

- `FETCH: PASS` with `Validation: PASS` -> report success and continue
- `FETCH: PARTIAL` with `Validation: PASS` -> report success with warnings and
  keep the incompleteness visible
- `Validation: FAIL` -> stop and surface contract failure
- `FETCH: FAIL` -> stop and surface the failure category plus reason
- `FETCH: ERROR` -> stop and surface the unexpected failure
- Any inconsistent pairing, such as `FETCH: PASS` with `Validation: NOT_RUN` ->
  treat as `FETCH: ERROR`

Coordinator reporting is summary-only. It may report:

- File path written
- Identity line
- State/status line
- Comment, related-item, and attachment counts
- Warnings or fatal reason
- Failure category
- That Phase 1 is retrieval-only and does not mutate the tracker

## 12. Artifact lifecycle

The snapshot artifact is a preserved workflow artifact for resumability:

- Path: `docs/<SNAPSHOT_KEY>.md`
- Lifecycle: never deleted by the fetch skill
- Git behavior: do not commit it as part of implementation history

This is a Category A-style orchestration artifact even though the fetch skills
do not use that label directly.

## 13. Divergence register

### Locked to this spec

The following aspects are locked. The paired skills may word them differently,
but the behavior must match:

- Coordinator role and allowed direct actions
- The 4-step coordinator workflow
- The 7-step retriever pipeline
- The shared retry policy and `RATE_LIMIT` outcome handling
- The structured summary contract (`FETCH`, `Validation`, `Failure category`,
  `Warnings`, `Reason`)
- Count semantics for `0/0`, `<retrieved>/UNKNOWN`, and `N/A`
- The presence of `Attachments: <N | N/A>` in the structured summary
- Template-authority and assembly timing
- Locked-core section set and top-level order
- Post-write validation obligations and max 3-pass repair loop
- Coordinator interpretation and inconsistent-pairing handling
- Snapshot artifact lifecycle

### Platform-specific and expected to differ

The following divergences are expected and do not require harmonization beyond
what is described here:

- Required input shape (`ISSUE_URL` or fallback coordinates vs `JIRA_URL`)
- Transport details (`gh` vs Jira-capable tool discovery)
- Snapshot key name (`ISSUE_SLUG` vs `TICKET_KEY`)
- Identity and state/status summary lines
- Retrieval preamble and metadata row sets
- Platform-slot section (`## Child Issues` vs `## Subtasks`)
- Platform-extension sections and their rendered shapes
- Acceptance-criteria sourcing:
  GitHub extracts from issue-body sections only; Jira uses a dedicated field
  first, then description sections
- Platform-specific partial nuance:
  GitHub treats unverifiable `## Projects` membership as `FETCH: PARTIAL`;
  Jira explicitly treats `## Attachments` and `## Custom Fields` as parent
  payload sections rather than analogous unknown-discovery sections

Anything else that diverges should either be harmonized or explicitly added to
this register.

## 14. Change protocol

When the fetch pipeline needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the divergence
   register if the allowed differences change.
2. **Update `fetching-jira-ticket`** to match. Touch `SKILL.md`, the retriever,
   and the bundled template if affected.
3. **Update `fetching-github-issue`** to match, using the same edits where the
   content is shared.
4. **Verify alignment.** Re-read both skills' `SKILL.md`, retriever
   definitions, and bundled templates side by side. Differences must map to an
   entry in the divergence register.
5. **Do not add behavior to one fetch skill only** unless it is a genuine
   platform-specific difference and is recorded in this spec.

This spec is intentionally denser than the skill files. It exists to be read
by a human author or future agent at change time, not during every Phase 1
invocation.
