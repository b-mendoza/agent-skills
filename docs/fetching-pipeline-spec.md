# Fetching Pipeline Specification

> **This document is the canonical reference for the Phase 1 fetching
> pipeline shared by `fetching-jira-ticket` and `fetching-github-issue`.**
>
> When you change the pipeline, the structured result contract, the retry
> rules, the validation gate, or the snapshot template shape, change
> **this document first**, then propagate the change to both skills. See
> the _Change protocol_ at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic Phase 1
fetching pipeline** that both retrieval skills must implement:

- `skills/fetching-jira-ticket/` — Jira-specific snapshot retrieval
- `skills/fetching-github-issue/` — GitHub-specific snapshot retrieval

Each skill runs **exactly one retrieval per invocation**. It validates
input, dispatches a single retriever subagent, collects the subagent's
structured summary, and reports the outcome to its parent orchestrator.
It performs no mutations on the tracker, creates no branches, and starts
no implementation.

### What this spec covers

- Required input shape
- Output contract for the snapshot document and the coordinator's summary
- The retriever's seven-step internal pipeline
- Dispatch contract between coordinator and retriever
- Structured result field semantics and canonical pairings
- Post-write validation gate and repair loop
- Retry limits, failure categories, and escalation rules
- Artifact lifecycle
- Successful completion contract
- What each concrete skill **may** customize and what it **must not**

### What this spec does not cover

- The individual prose of each reference file or subagent definition.
  Skills may word instructions differently as long as behavior, contracts,
  and outputs match this spec.
- Platform transport details (which Jira MCP tools exist, which `gh` flags
  are needed). Those live inside the platform-specific retriever subagents.
- The parent orchestrator's logic
  (`orchestrating-jira-workflow` / `orchestrating-github-workflow`). This
  spec covers only the Phase 1 retrieval skill.

## 2. Harness-agnosticism requirements

Both skills must run on **OpenCode, Cursor, and Claude Code** without
modification. That imposes the following rules on every file in both
skills:

1. **Do not name runtime-specific tools.** Use neutral phrasing. Say
   "dispatch to a subagent" or "invoke the subagent", not "use the Task
   tool" or "use the Agent tool". Say "the coordinator reads its bundled
   skill files", not "the coordinator uses the Read tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` in YAML frontmatter are optional
   and must not be treated as contract by any shared prose.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, no CLI-specific banner formats.
4. **Prefer relative file paths** when referencing bundled resources.
5. **Platform-specific tooling is allowed, but only in platform-specific
   places.** The Jira retriever may reference a Jira MCP/REST integration.
   The GitHub retriever may reference `gh` and `gh api`. Neither
   integration should appear in the shared divergence register, the
   structured result contract, or the validation gate policy.

## 3. Vocabulary (placeholders)

This spec uses abstract placeholders. Each concrete skill substitutes
them with its own values:

| Placeholder          | Jira skill                     | GitHub skill                       |
| -------------------- | ------------------------------ | ---------------------------------- |
| `ENTITY`             | Ticket                         | Issue                              |
| `ENTITY_KEY`         | `TICKET_KEY` (e.g. `JNS-6065`) | `ISSUE_SLUG` (e.g. `acme-app-42`)  |
| `ENTITY_URL`         | `JIRA_URL`                     | `ISSUE_URL`                        |
| `SNAPSHOT_DOC`       | `docs/<TICKET_KEY>.md`         | `docs/<ISSUE_SLUG>.md`             |
| `RETRIEVER`          | `ticket-retriever`             | `issue-retriever`                  |
| `TEMPLATE`           | `ticket-retriever-template.md` | `issue-retriever-template.md`      |
| `PLATFORM_TRANSPORT` | Jira-capable MCP tools         | `gh` CLI + `gh api`                |
| `CHILD_ITEMS`        | Subtasks                       | Child Issues                       |

When this spec says "the retriever", it means whichever subagent the
concrete skill dispatches: `ticket-retriever` for Jira or `issue-retriever`
for GitHub.

## 4. Required input shape

Each coordinator starts with a URL-shaped input as the preferred form:

| Aspect             | Jira                                              | GitHub                                                            |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------- |
| Primary input      | `JIRA_URL` (required)                             | `ISSUE_URL` (preferred)                                           |
| Fallback           | None                                              | `OWNER` + `REPO` + `ISSUE_NUMBER` when URL absent                 |
| Identifier derived | `TICKET_KEY` from the final path segment          | `ISSUE_SLUG` = `<owner>-<repo>-<issue_number>` (lowercased)       |

Prefer passing the full URL downstream rather than only the derived
identifier. The URL carries more context and lets the retriever derive
identifiers for itself. All standard artifact paths derive from
`ENTITY_KEY`.

## 5. Output contract

### Primary artifact

```
SNAPSHOT_DOC
```

Treat `SNAPSHOT_DOC` as a preserved workflow artifact for resumability.
Do not commit it as part of implementation history. See section 11.

### Required top-level headings (locked across both skills)

Every snapshot document must contain the following top-level headings in
template order. If a section has no data, the heading still appears and
the section body is `_None_`.

| Heading                 | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `## Metadata`           | Core entity and repository/workspace context                          |
| `## Description`        | Primary source of requirements                                         |
| `## Acceptance Criteria`| Definition-of-done source                                              |
| `## Comments`           | Decisions, clarifications, and implementation hints                    |
| `## Retrieval Warnings` | Stable disclosure point for partial retrieval                          |
| `<child items section>` | `## Subtasks` (Jira) or `## Child Issues` (GitHub)                     |
| `## Linked Issues`      | Dependency and surrounding context                                     |

Platform-specific stable sections follow these required ones. Both
templates declare them as always-present with `_None_` when empty; see
the divergence register (section 13) for what each platform adds.

### Template authority

The bundled `TEMPLATE` file is the authoritative snapshot shape. The
section table above is the scan-friendly summary of that contract, not a
replacement. The retriever reads the template only at document assembly
(step 5 in section 7) and uses the fenced Markdown block as the literal
output shape.

### Acceptance Criteria extraction precedence

The retriever must apply this precedence when populating
`## Acceptance Criteria`:

1. A dedicated tracker field, when the platform supports one and it is
   non-empty (Jira only).
2. Otherwise, description sections in this label precedence order:
   `Acceptance Criteria`, `AC`, `Definition of Done`.
3. Use only sections with the highest-precedence label that is present.
4. If multiple sections share the winning label, keep them in source
   order and prefix each block with `**Source:** <label>`.
5. If nothing matches, write `_None_` and keep the full body under
   `## Description`.

### Body formatting rule

Outside fenced code blocks, the retriever rewrites tracker-authored
Markdown heading lines as bold labels so body content cannot collide
with reserved snapshot headings. Example: `## Steps` becomes `**Steps**`.

### Deterministic ordering rule

Repeated sections are ordered deterministically. Child items by
identifier ascending; linked issues by relation/context string, then
identifier ascending; any platform-specific tabular sections
(attachments, labels, assignees, custom fields) by their natural sort
key ascending. The template defines the per-section sort key; the
retriever is responsible for honoring it.

## 6. Dispatch contract

The coordinator is a thin dispatcher. It may:

- read its bundled skill files (SKILL.md, subagent definition, template);
- derive or normalize identifiers from the input URL or fallback
  coordinates;
- dispatch the retriever with the input URL (or fallback coordinates);
- read and relay the retriever's structured summary.

Everything else — tracker access, retrieval, document assembly,
validation, repair — belongs inside the retriever. The coordinator never
inspects raw tracker payloads or rewrites the artifact.

The coordinator reads the retriever's definition **only** when it is
about to dispatch, never as preload.

## 7. Retrieval phase (inside the retriever)

The retriever performs exactly seven steps in order:

1. **Validate input and establish identifiers.** Confirm the URL (or
   fallback coordinates) are well-formed. Derive `ENTITY_KEY` and any
   workspace/repository context. Malformed input returns
   `FETCH: FAIL` + `Failure category: BAD_INPUT`.

2. **Verify platform transport is usable.** Discover or probe the
   `PLATFORM_TRANSPORT`. Confirm authentication when applicable. If no
   suitable transport is available, return `FETCH: FAIL` +
   `Failure category: TOOLS_MISSING`. If authentication fails, return
   `FETCH: FAIL` + `Failure category: AUTH`.

3. **Retrieve the parent entity.** Gather metadata, description,
   acceptance criteria (per the extraction precedence in section 5),
   all comments in chronological order, and any platform-specific fields
   listed in the divergence register (section 13).

4. **Retrieve related items.** Discover `CHILD_ITEMS` and linked issues.
   Retrieve each one completely enough to preserve workflow context:
   identifier, summary/title, status/state, full body, and comments.
   When an individual related item cannot be hydrated after discovery,
   add a warning under `## Retrieval Warnings`, add a `Not retrieved`
   placeholder entry from the template, and treat the run as
   `FETCH: PARTIAL` rather than dropping the item silently.

5. **Assemble the document.** Load the bundled `TEMPLATE` at this step
   and use its fenced Markdown shape as the literal output contract.
   Write `SNAPSHOT_DOC`. Preserve useful body formatting. Normalize
   timestamps with time to `YYYY-MM-DD HH:MM UTC`; preserve date-only
   values as `YYYY-MM-DD`.

6. **Post-write validation gate.** Re-read `SNAPSHOT_DOC` and verify the
   contract (see section 10). If validation fails, fix only the missing
   or mismatched portions, rewrite, and validate again. Maximum **3**
   repair passes.

7. **Return only the structured summary.** Keep intermediate tracker
   payloads, exploratory tool output, and document contents out of the
   final reply.

## 8. Structured result contract

The retriever returns exactly this summary shape. No prose wrapper, no
extra fields:

```text
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: <SNAPSHOT_DOC | None>
<entity identity line>
<entity state line>
<count rows for comments, child items, linked issues>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

Platform-specific fields for the identity, state, and count rows are
listed in the divergence register (section 13).

### Status semantics

| `FETCH` value | Meaning                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PASS`        | Retrieval and validation both succeeded. All discovered related items were hydrated.                                                   |
| `PARTIAL`     | Artifact was written and validated, but some related items or comments could not be retrieved after discovery. Warnings record gaps.   |
| `FAIL`        | Deterministic failure such as bad input, entity not found, missing auth, no usable transport, or rate limits after retry budget.       |
| `ERROR`       | Unexpected failure: crashes, schema/tool mismatches, validation failure after the repair loop, or environment issues outside the above. |

| `Validation` value | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `PASS`             | The written file satisfies the template contract.                          |
| `FAIL`             | The file was written but still violates the contract after the repair loop. |
| `NOT_RUN`          | Retrieval failed before validation could happen.                            |

### Canonical pairings (locked)

The coordinator branches on the structured fields, never on prose. Only
these pairings are valid:

| `FETCH`   | `Validation` | Coordinator action                                                                 |
| --------- | ------------ | ---------------------------------------------------------------------------------- |
| `PASS`    | `PASS`       | Report success and continue.                                                       |
| `PARTIAL` | `PASS`       | Report success with warnings and keep the incompleteness visible.                  |
| `FAIL`    | `NOT_RUN`    | Stop and relay the failure category plus reason.                                   |
| `ERROR`   | `NOT_RUN`    | Stop and relay the failure category plus reason as an unexpected failure.          |
| `ERROR`   | `FAIL`       | Stop and relay that the snapshot contract was not met after the repair loop.       |

**`Validation: FAIL` pairs exclusively with `FETCH: ERROR` +
`Failure category: UNEXPECTED`.** It never pairs with `PASS` or
`PARTIAL`. Any inconsistent pairing — for example `FETCH: PASS` with
`Validation: NOT_RUN` — is treated as `FETCH: ERROR` and stops the run.

### Failure categories (locked)

| Category        | Emitted when                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `NONE`          | No fatal failure occurred (success or partial success).                                                 |
| `BAD_INPUT`     | Malformed or unsupported URL/coordinates.                                                               |
| `NOT_FOUND`     | The parent entity could not be found before a valid artifact was produced.                              |
| `AUTH`          | Tracker access was denied or not authenticated.                                                         |
| `TOOLS_MISSING` | No suitable `PLATFORM_TRANSPORT` was available.                                                         |
| `RATE_LIMIT`    | Tracker access was rate-limited and the retry budget was exhausted.                                    |
| `UNEXPECTED`    | Crashes, schema/tool failures, validation failures after repair, or environment issues outside above.   |

## 9. Retry and escalation

### Read retries

Retry only read operations that fail due to explicit rate limiting or
transient server errors (5xx). Maximum **2** retries per operation with
backoff delays of 1 second and then 3 seconds. Do not retry:

- bad input
- authentication failures
- 404 on the parent entity
- schema or tool mismatches

If the final retry still returns a rate-limit response, stop and return
`FETCH: FAIL` + `Failure category: RATE_LIMIT`.

### Validation repair loop

Maximum **3** repair passes. Each pass fixes only the missing or
mismatched portions of the snapshot, not the entire artifact. If the
artifact still fails validation after the third pass, return
`FETCH: ERROR` + `Validation: FAIL` + `Failure category: UNEXPECTED`.

### Partial retrieval rule

Partial retrieval is neither a silent omission nor a failure. When a
related item cannot be hydrated after discovery:

1. Keep the successfully retrieved items.
2. Add a warning under `## Retrieval Warnings`.
3. Add a `Not retrieved` placeholder entry in the affected section.
4. Preserve any identifier and link type you do know, even when the
   remaining fields are unavailable.
5. Return `FETCH: PARTIAL` + `Validation: PASS` +
   `Failure category: NONE`.

The same rule applies to partial comment retrieval on an otherwise
successfully retrieved parent or related item: keep the retrieved
comments, append
`_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` in
the affected `## Comments` or `#### Comments` section, record the warning
under `## Retrieval Warnings`, and treat the run as `FETCH: PARTIAL`.

## 10. Validation gate policy

The post-write validation gate verifies at least:

- every required top-level heading from the fenced snapshot shape exists;
- the title line matches the template's `<ENTITY_KEY>: <Summary>` format;
- the retrieval preamble includes `Retrieved on` and `Source`;
- the metadata table includes every required row in template order with
  `_None_` for empty scalars;
- parent comment count matches the retrieved data;
- the number of child and linked-issue entries matches what was discovered
  on the parent entity, with full entries for retrieved items and
  `Not retrieved` placeholders for unretrieved ones;
- outside fenced code blocks, no rendered body line begins with Markdown
  heading markers (`# `, `## `, `### `);
- any partial comment retrieval warning has a matching terminal marker in
  the affected `## Comments` or `#### Comments` section;
- each unretrieved child or linked item has both a warning entry and a
  placeholder entry in the correct section;
- `## Retrieval Warnings` is `_None_` on full success or lists every
  warning on partial success;
- the deterministic ordering rule (section 5) is satisfied for all
  repeated sections.

Gate failures trigger the validation repair loop (section 9).

## 11. Artifact lifecycle

| Category | Contents                                   | Git behavior    | Lifecycle |
| -------- | ------------------------------------------ | --------------- | --------- |
| A        | `SNAPSHOT_DOC`                             | Never committed | Preserved |
| B        | None — the fetching pipeline has no Category B output | N/A  | N/A       |

The fetching pipeline produces only Category A artifacts. Neither the
coordinator nor the retriever stages or commits `SNAPSHOT_DOC`. Deleting
the file forces the downstream orchestrator to re-run Phase 1 from
scratch.

## 12. Successful completion contract

After a successful run, all of the following are true:

1. The retriever's structured summary reports `FETCH: PASS` or
   `FETCH: PARTIAL` paired with `Validation: PASS`.
2. `SNAPSHOT_DOC` exists on disk and contains every required top-level
   heading in template order.
3. On `FETCH: PARTIAL`, `## Retrieval Warnings` lists every gap and each
   unretrieved related item has a `Not retrieved` placeholder in its
   section.
4. The coordinator's report to its parent orchestrator includes the file
   path, entity identity and state, retrieved-vs-discovered counts for
   comments and related items, any warnings or failure category, and the
   explicit note that this phase is retrieval-only and did not mutate
   the tracker.

Partial progress without a valid snapshot does not satisfy successful
completion.

## 13. Divergence register

The following sections are **locked to this spec**. Both skills must
express the same contract; wording may differ but behavior must not.

- Required input shape (section 4), modulo the GitHub fallback coordinates
- The required top-level heading set in `SNAPSHOT_DOC` (section 5)
- The template authority rule (section 5)
- The Acceptance Criteria extraction precedence (section 5)
- The body formatting rule (section 5)
- The deterministic ordering rule (section 5)
- The dispatch contract (section 6)
- The seven-step retriever pipeline (section 7)
- The structured result contract field shape and the canonical pairings
  (section 8), including the locked `Validation: FAIL` pairing
- The seven failure categories (section 8)
- Retry limits, retry categories, and the 3-pass validation repair loop
  (section 9)
- The partial retrieval rule (section 9)
- The validation gate policy (section 10)
- The Category A artifact lifecycle (section 11)
- The successful completion contract (section 12)
- Harness-agnostic phrasing (section 2)

The following are **platform-specific** and are expected to differ:

- The `PLATFORM_TRANSPORT` (Jira MCP/REST vs `gh` CLI + `gh api`) and
  its preflight check (tool discovery vs `gh --version` +
  `gh auth status`).
- The entity vocabulary (`Ticket` vs `Issue`) and identifier format
  (`TICKET_KEY` vs `ISSUE_SLUG`).
- Platform-specific metadata sections added by each template:
  - **Jira only:** `## Custom Fields` and `## Attachments` (with file
    metadata table).
  - **GitHub only:** `## Labels`, `## Assignees`, `## Milestone`,
    `## Projects`, and `## Attachments` (placeholder form, since GitHub
    does not mirror Jira-style attachment metadata).
- The child item section name (`## Subtasks` vs `## Child Issues`) and
  its corresponding count field name in the structured summary
  (`Subtasks: r/f` vs `Child issues: r/f`).
- The parent comment label in the structured summary
  (`Parent comments: r/f` in Jira vs `Comments: r/f` in GitHub).
- The entity identity line in the structured summary
  (`Ticket: <TICKET_KEY>: <Summary>` in Jira vs
  `Issue: <owner>/<repo>#<N>: <Title>` in GitHub).
- The entity state line in the structured summary
  (`Status: ... | Type: ...` in Jira vs `State: ...` in GitHub).
- The `Attachments: <N>` count field in the structured summary
  (Jira only — GitHub lacks a native attachment metadata concept).
- The parent orchestrator references in each skill's `SKILL.md`.

Anything else that diverges should either be harmonized or explicitly
noted here as an intentional platform difference.

## 14. Change protocol

When the fetching pipeline needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update `fetching-jira-ticket`** to match. Touch `SKILL.md`, the
   retriever subagent, and the template as needed.
3. **Update `fetching-github-issue`** to match, using the same edits
   where the content is shared.
4. **Verify alignment.** Re-read both skills' `SKILL.md` and retriever
   subagents side by side and confirm they express the same contract in
   the same order. Differences must map to an entry in the divergence
   register (section 13).
5. **Do not add a feature to one skill only.** If a behavior is valuable
   in one fetching skill, it is valuable in both. Changes that only make
   sense for one platform belong inside that platform's retriever, not
   in the shared pipeline.

This spec is intentionally denser than a skill file. It exists to be
read by the human author (or a future agent) at change time, not at
every retrieval run. Neither skill loads this file during normal
operation.
