# Creation Pipeline Specification

> **This document is the canonical reference for the Phase 4 task-creation
> pipeline shared by `creating-jira-subtasks` and
> `creating-github-child-issues`.**
>
> When you change the pipeline, the contracts, the status rules, or the
> escalation patterns, change **this document first**, then propagate the
> change to both skills. See the _Change protocol_ section at the bottom.

## 1. Purpose and scope

This spec defines the **harness-agnostic, platform-agnostic task-creation
pipeline** that both Phase 4 skills must implement:

- `skills/creating-jira-subtasks/` — Jira-specific subtask creation
- `skills/creating-github-child-issues/` — GitHub-specific child issue creation

Each skill runs **once per parent ticket/issue**. It dispatches a single
specialist subagent that verifies the parent, captures existing linkage,
creates missing tracker items, updates the plan file idempotently, validates
the result, and returns a structured summary.

### What this spec covers

- Required input shape
- Expected plan shape (upstream artifacts)
- The coordinator dispatch pattern
- The creation pipeline steps (shared core)
- Plan-file update contract (table shape, per-task inline reference)
- Validation and repair rules
- Structured summary contract (output format)
- Status rules (PASS / WARN / BLOCKED / FAIL / ERROR)
- Escalation patterns
- Retry rules
- What each concrete skill **may** customize and what it **must not**

### What this spec does not cover

- The individual prose of each subagent or template file. Skills may word
  instructions differently as long as the behavior, contracts, and outputs
  match this spec.
- Platform mutation details (e.g. exact `gh` commands, exact Jira MCP calls,
  GitHub write-model detection). Those live inside the platform-specific
  subagent.
- The parent orchestrator's logic (`orchestrating-jira-workflow` /
  `orchestrating-github-workflow`). This spec covers only the Phase 4
  creation skill.

## 2. Harness-agnosticism requirements

Both skills must run on **OpenCode, Cursor, and Claude Code** without
modification. That imposes the following rules on every file in both skills:

1. **Do not name runtime-specific tools.** Use neutral phrasing. Say "dispatch
   to a subagent" or "invoke the subagent", not "use the Task tool" or "use
   the Agent tool". Say "the coordinator loads this file", not "the coordinator
   uses the Read tool".
2. **Do not assume harness-specific frontmatter.** Fields like
   `allowed-tools`, `model`, or `tools` in YAML frontmatter are optional and
   must not be treated as contract by any shared prose.
3. **Do not encode harness-specific scaffolding.** No `TODO(human)`, no
   "learning mode" placeholders, no CLI-specific banner formats.
4. **Prefer relative file paths** over anything that resolves differently
   across harnesses (no symlinks, no `file://` URIs, no harness-internal
   indirection).
5. **Platform-specific tooling is allowed, but only in platform-specific
   places.** The Jira skill may reference Jira MCP tools inside
   `subtask-creator.md`. The GitHub skill may reference `gh` in
   `task-issue-creator.md`. Neither integration should appear in SKILL.md
   or `phase-4-io-contracts.md`.

## 3. Vocabulary (placeholders)

This spec uses abstract placeholders. Each concrete skill substitutes them
with its own values:

| Placeholder           | Jira skill                         | GitHub skill                               |
| --------------------- | ---------------------------------- | ------------------------------------------ |
| `PARENT_URL`          | `JIRA_URL`                         | `ISSUE_URL`                                |
| `PARENT_KEY`          | `TICKET_KEY` (e.g. `PROJ-123`)     | `ISSUE_SLUG` (e.g. `acme-app-42`)         |
| `PARENT_REF`          | `PROJ-123`                         | `acme/app#42`                              |
| `CHILD_KEY`           | Jira subtask key (e.g. `PROJ-200`) | `owner/repo#number` (e.g. `acme/app#100`) |
| `TRACKER_CLI_OR_API`  | Jira MCP / REST                    | `gh` CLI                                   |
| `TASKS_DOC`           | `docs/<PARENT_KEY>-tasks.md`       | `docs/<PARENT_KEY>-tasks.md`               |
| `TRACKER_SECTION`     | `## Jira Subtasks`                 | `## GitHub Task Issues`                    |
| `INLINE_REF`          | `Jira Subtask: <KEY>`             | `GitHub Task Issue: <ref>`                 |
| `VERDICT_PREFIX`      | `SUBTASKS`                         | `TASK_ISSUES`                              |
| `SUBAGENT`            | `subtask-creator`                  | `task-issue-creator`                       |

When this spec says "the tracker item", it means whatever the platform
equivalent is: a Jira subtask or a GitHub child issue.

## 4. Required input shape

The coordinator starts with one or two explicit inputs:

| Input         | Required | Notes                                            |
| ------------- | -------- | ------------------------------------------------ |
| `PARENT_URL`  | Yes      | Authoritative source for workspace/project/key.  |
| `PARENT_KEY`  | No       | Derived from URL when omitted.                   |

`PARENT_URL` is passed downstream to the subagent. The URL carries the full
context needed for tracker reads and writes (workspace, project, key).

### Derivation rules

When `PARENT_KEY` is not provided, the subagent derives it from `PARENT_URL`:

- **Jira:** workspace = subdomain before `.atlassian.net`, project = prefix
  before the dash, ticket key = full path segment (e.g. `PROJ-123`).
- **GitHub:** owner and repo from the URL path (lowercased), issue number
  from `/issues/<N>`, slug = `<owner>-<repo>-<number>`.

## 5. Expected plan shape (upstream artifacts)

Primary input artifact:

```text
PARENT_URL   — parent ticket/issue (authoritative for tracker context)
docs/<PARENT_KEY>-tasks.md
```

For normal Phase 4 execution, the plan is expected to contain:

| Expected section / element                         | Produced by               | Why it matters                                    |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| `## Tasks` with numbered `## Task <N>:` headings   | planning skill            | Each task maps to one tracker item                |
| `## Execution Order Summary`                       | planning skill            | Preserves task ordering context                   |
| `## Decisions Log`                                 | clarifying-assumptions    | Indicates critique completed before tracker writes |

Each task section may contain these subsections (same shape across both
platforms): `Objective`, `Relevant requirements and context`, `Questions to
answer before starting`, `Implementation notes`, `Definition of done`,
`Likely files / artifacts affected`, `Dependencies / prerequisites`, and
`Priority`.

### Missing or malformed plan

The parent orchestrator is responsible for validating the normal Phase 4
precondition before this skill runs. If the skill is used standalone:

- Missing or malformed plan → `VERDICT_PREFIX: BLOCKED`.
- Missing `## Decisions Log` → `VERDICT_PREFIX: WARN` (plan is still
  parseable but the normal workflow precondition was skipped).

## 6. Coordinator dispatch pattern

The coordinator is intentionally narrow. It does exactly four things:

1. Read the subagent definition.
2. Dispatch the subagent with `PARENT_URL` (and `PARENT_KEY` when already
   known).
3. Interpret the structured result.
4. Report only the concise phase summary to the caller.

Plan parsing, tracker operations, plan-file edits, and validation all stay
inside the subagent. The coordinator keeps only:

- The structured `VERDICT_PREFIX` verdict
- The validation verdict
- Task / child-key / title / dependency / priority / outcome rows for
  progress reporting
- Any warning or fatal reason that requires user attention
- Platform-specific auditability metadata (e.g. write model and capability
  summary on GitHub)

Raw tracker payloads, full API responses, raw file contents, and
intermediate parse details stay inside the subagent unless the user
explicitly asks for them.

If dispatch is unavailable, the coordinator reports the skill as blocked
rather than reproducing the subagent inline.

## 7. Creation pipeline steps (shared core)

The subagent executes these steps in order. Platform-specific steps (such as
GitHub write-model detection) may add intermediary steps, but the core
sequence must be preserved:

### Step 1: Resolve parent and load the plan

- Derive `PARENT_KEY` and other identifiers from `PARENT_URL`.
- Read `TASKS_DOC`.
- Confirm `## Tasks` and at least one `## Task <N>:` heading.
- Record whether `## Decisions Log` is present. If missing, continue with a
  warning (WARN-eligible) rather than blocking.

### Step 2: Capture existing linkage before creating anything

- Detect existing `INLINE_REF` lines in task sections.
- Detect existing `TRACKER_SECTION` table rows if present.
- Treat the current task section content as source of truth for descriptions.

### Step 3: Verify parent and safe reuse candidates

- Use `TRACKER_CLI_OR_API` to fetch and verify the parent ticket/issue.
- For every existing child key in the plan, verify:
  - the item exists in the tracker
  - the item's parent is `PARENT_REF`
- If any existing key is invalid or belongs to a different parent, return
  `VERDICT_PREFIX: BLOCKED`. Do not silently replace or duplicate.
- Valid existing items count as **Already linked**; do not recreate.

### Step 4: Build payloads for unlinked tasks

- Title format: `Task <N>: <Short title from plan>`
- Read the subagent's co-located templates file for the description format.
- Use the current clarified plan content as written.

### Step 5: Create missing items (sequential)

- Create one item at a time using `TRACKER_CLI_OR_API`.
- Require a definitive tracker key in the response before counting
  **Created now**.
- On rate limit (HTTP 429 or 403 with rate messaging): wait **5 seconds**
  and retry **once**. If still fails, record **Failed creates** and continue
  with other tasks.
- Continue past individual failures so partial success is visible.

### Step 6: Update the local plan file idempotently

- Update only `TASKS_DOC`.
- For every task, ensure **exactly one** `INLINE_REF` line **immediately
  after** the `## Task <N>:` heading (repair duplicates).
- Insert or replace `TRACKER_SECTION` with the workflow table from the
  templates file.
- Place `TRACKER_SECTION` after `## Ticket Summary` or `## Issue Summary`
  when that section exists; otherwise after the first top-level heading.
- Table must have **exactly one row per parsed task**.
- `Dependencies` and `Priority` columns must mirror the plan (use `None` /
  `Unknown` as fallbacks).

### Step 7: Validate and repair the artifact

- Re-read the updated plan file.
- Verify:
  - `TRACKER_SECTION` exists with the workflow table.
  - Table has one row per parsed task; column order matches the template.
  - Every row with a concrete child key has a matching `INLINE_REF` line in
    that task section.
  - Rows with `Not Created` match their per-task lines.
- If a structural check fails, repair the local file **once** without
  creating new tracker items, then re-run checks.
- If still failing, return `VERDICT_PREFIX: FAIL` with `Validation: FAIL`.

### Step 8: Return the structured summary

- Return only the structured summary (see section 9).
- Keep raw payloads, full file contents, and conversational narration
  internal to the run.

## 8. Plan-file update contract

### Workflow table (required)

After Phase 4, `TASKS_DOC` must contain a `TRACKER_SECTION` with a workflow
table. Both platforms share these core columns:

| Column       | Required | Semantics                                                              |
| ------------ | -------- | ---------------------------------------------------------------------- |
| Task         | Yes      | Integer task index matching `## Task <N>:`                             |
| Child key    | Yes      | Tracker key for a concrete item, or `Not Created` if creation failed   |
| Title        | Yes      | Short title aligned with the task heading                              |
| Status       | Yes      | Tracker status when known, or `Not Created`                            |
| Dependencies | Yes      | Same normalized form as the plan (`None`, `1`, `1,2`, etc.)            |
| Priority     | Yes      | From plan or `Unknown`                                                 |

Platform-specific columns (e.g. GitHub `Write model`) may be added but must
not replace any core column. Exactly **one row per** parsed `## Task <N>:`
section.

Column names differ by platform (`Subtask Key` vs `Issue ref`) — that is
expected. The semantics and count must match.

### Per-task inline reference (required)

In each `## Task <N>:` section, on the **first** line after the heading,
include exactly one line of this form (no variation in prefix):

```text
<INLINE_REF>: <child key | Not Created>
```

Jira form: `Jira Subtask: PROJ-200` or `Jira Subtask: Not Created`.
GitHub form: `GitHub Task Issue: acme/app#100` or
`GitHub Task Issue: Not Created` or `GitHub Task Issue: task-list`.

This line is the format referenced by each platform's
`orchestrating-*/references/data-contracts.md` for Phase 4 postcondition
checks.

### GitHub-specific additions

GitHub's plan file also includes:

- A **machine handoff HTML comment** immediately after `TRACKER_SECTION`,
  recording `parent`, `model`, `capability`, and `updated` fields for
  validators and resumability.
- A `Write model` column in the workflow table (`native-sub-issue`,
  `linked-issue`, `task-list`, or `mixed`).
- A `task-list` traceability path (plan-only row, no GitHub issue created).

These are platform-specific and do not apply to Jira.

## 9. Structured summary contract (output format)

The subagent returns only a structured summary. Both platforms share the
same shape, with platform-specific field names:

### Shared fields

```text
<VERDICT_PREFIX>: <PASS | WARN | FAIL | BLOCKED | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
<Parent/Ticket identifier>
Plan file: <path or "not updated">
Tasks in plan: <N>
Already linked: <N>
Created now: <N>
Failed creates: <N>
Decisions Log: <PRESENT | MISSING>
Reason: <one line>

Created/Linked <Items>:
| Task | <Child key> | Title | Dependencies | Priority | Outcome |
| ---- | ----------- | ----- | ------------ | -------- | ------- |

Warnings:
- <warning or "None">

Failures:
- <failure or "None">
```

### Platform-specific fields

- **GitHub** adds `Write model:` and `Capability:` lines after `Plan file:`.
  Uses `Parent: owner/repo#N` as the identifier.
- **Jira** uses `Ticket: <TICKET_KEY>` as the identifier. No write-model or
  capability fields.

### Field population rules

- Populate `Dependencies` and `Priority` from the current task plan.
- Use `None` for tasks without prerequisites and `Unknown` when the plan
  does not provide a priority value.
- Include **one row per parsed task** when the plan file was updated.
- For tasks without a concrete item: use `Not Created` in the child key
  column and an outcome such as `Create failed`.
- When the run stops before creates begin, report `Failed creates: 0`.

### Output table columns (per platform)

- **GitHub:** `Task | Issue ref | Title | Write model | Dependencies | Priority | Outcome`
- **Jira:** `Task | Subtask Key | Title | Dependencies | Priority | Outcome`

The GitHub table includes `Write model` as a platform-specific column. Both
tables include `Dependencies`, `Priority`, and `Outcome` as shared columns.

## 10. Status rules

Both skills must use the same status semantics:

| Status    | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `PASS`    | Every task has a valid handoff row and matching per-task inline ref; validation passed; no blocking warnings. `Decisions Log` missing alone → WARN, not PASS. |
| `WARN`    | Validation passed but non-fatal issues exist: Decisions Log missing, some tasks `Not Created`, or non-fatal tracker degradation. |
| `BLOCKED` | Missing/malformed plan, unsupported task shape, or unsafe existing refs that must be corrected before continuing. |
| `FAIL`    | Fatal tracker or validation failure: parent not found, auth failure, tracker CLI/API missing, all tasks unlinked after attempts, or validation unrepaired after one repair pass. |
| `ERROR`   | Unexpected filesystem or environment failure unrelated to the artifact.     |

Use `Validation: NOT_RUN` only when the run failed before any plan-file
update or post-write validation could occur.

## 11. Escalation patterns

Both skills must map failure conditions to the same status categories:

| Condition                                           | Status      |
| --------------------------------------------------- | ----------- |
| Plan file missing, malformed, or unsupported         | `BLOCKED`   |
| Existing child key invalid or wrong parent           | `BLOCKED`   |
| Parent ticket/issue not found                        | `FAIL`      |
| Auth failure                                         | `FAIL`      |
| Tracker CLI/API not installed or not authenticated   | `FAIL`      |
| Individual create failure after single retry         | Record in `Failed creates`; usually `WARN` if others succeeded |
| All tasks remain unlinked after create attempts      | `FAIL`      |
| Post-write validation failing after one repair pass  | `FAIL`      |
| Repair pass                                          | Fix file only; never create new tracker items during repair |
| Unexpected error                                     | `ERROR`     |

The subagent always returns the structured summary even on failure. The
coordinator — not the subagent — decides what to do next.

## 12. Retry rules

| Step                    | Limit | Behavior on exhaustion                          |
| ----------------------- | ----- | ----------------------------------------------- |
| Individual item create  | 1     | Record failure, continue with other tasks       |
| Plan-file repair        | 1     | Return `FAIL` with `Validation: FAIL`           |

Rate-limit retry: on HTTP 429 (or 403 with rate messaging), wait **5
seconds** and retry the same request **once**. No exponential backoff.

## 13. Coordinator escalation table

The coordinator routes on the subagent's structured verdict:

| Summary state                                        | Coordinator action                                    |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `VERDICT_PREFIX: PASS` with `Validation: PASS`       | Report success and proceed                            |
| `VERDICT_PREFIX: WARN` with `Validation: PASS`       | Report usable output with warnings; surface failed or skipped linkage |
| `VERDICT_PREFIX: BLOCKED`                            | Stop and surface the plan-shape or unsafe-linkage issue |
| `VERDICT_PREFIX: FAIL`                               | Stop and surface the fatal tracker or validation failure |
| `VERDICT_PREFIX: ERROR` or `Validation: FAIL`        | Stop and surface the unexpected failure or local contract failure |

## 14. Divergence register

The following sections are **locked to this spec**. Both skills must express
the same contract; wording may differ but behavior must not.

- Required input shape (section 4)
- Expected plan shape and `Decisions Log` handling (section 5)
- Coordinator dispatch pattern (section 6)
- Creation pipeline steps — core sequence (section 7)
- Plan-file update contract — core columns, per-task inline reference,
  one-row-per-task rule (section 8)
- Structured summary contract — shared fields and population rules (section 9)
- Status rules (section 10)
- Escalation patterns (section 11)
- Retry rules (section 12)
- Coordinator escalation table (section 13)

The following sections are **platform-specific** and are expected to
differ:

- The concrete tracker integration (`gh` vs Jira MCP/REST).
- GitHub write-model detection (steps 4-6 in `task-issue-creator.md`) — no
  Jira equivalent.
- GitHub machine handoff HTML comment and `Write model` column — no Jira
  equivalent.
- GitHub `task-list` traceability path — no Jira equivalent.
- Description format (GitHub-flavored Markdown vs Jira Wiki Markup).
- Column names in the workflow table (`Issue ref` vs `Subtask Key`).
- The `PARENT_KEY` derivation and format (`ISSUE_SLUG` vs `TICKET_KEY`).
- The parent orchestrator references in each skill's `SKILL.md` and
  `phase-4-io-contracts.md`.

Anything else that diverges should either be harmonized or explicitly
noted here as an intentional platform difference.

## 15. Change protocol

When the creation pipeline needs to change, follow this order:

1. **Update this spec first.** Edit the relevant section(s) and the
   divergence register if the change affects what may differ.
2. **Update `creating-jira-subtasks`** to match. Touch `SKILL.md`, the
   reference file, the subagent, and the templates file as needed.
3. **Update `creating-github-child-issues`** to match, using the same edits
   where the content is shared.
4. **Verify alignment.** Re-read both skills' `SKILL.md`,
   `phase-4-io-contracts.md`, subagent files, and templates side by side
   and confirm they express the same contract. Differences must map to an
   entry in the divergence register (section 14).
5. **Do not add a feature to one skill only.** If a behavior is valuable in
   one creation skill, it is valuable in both. Changes that only make sense
   for one platform belong inside the platform-specific subagent, not in the
   shared pipeline.

This spec is intentionally denser than a skill file. It exists to be read
by the human author (or a future agent) at change time, not every task
run. Neither skill loads this file during normal operation.
