# Task Issue Creation Playbook

> Read this file after `task-issue-creator` has parsed `ISSUE_URL` and confirmed
> that `docs/<ISSUE_SLUG>-tasks.md` exists with numbered task sections.
>
> **Reminder:** keep raw `gh` JSON, REST responses, and full plan contents out
> of the final summary. Return only the contract-defined verdict, counts,
> write-path metadata, warnings, failures, and linkage table.

This playbook describes **what to do and in what order**. Concrete CLI flags,
REST headers, payload field names, and other version-sensitive syntax live in
`./external-sources.md`. Use installed `gh` help first when offline; fetch the
smallest relevant URL only when current syntax or product behavior is uncertain.

## Execution Steps

1. **Verify the parent issue.**
   - Look up `OWNER/REPO#PARENT_NUMBER` via `gh issue view` and capture
     `number`, `state`, and `title`.
   - If the parent cannot be fetched because of auth, 404, repo mismatch, or
     missing `gh`, return `TASK_ISSUES: FAIL` with `Validation: NOT_RUN`.
   - For exact `gh issue view` flags or `--json` field names, see the
     **GitHub CLI manual** entries in `./external-sources.md`.

2. **Parse plan tasks and existing linkage.**
   - Treat each `## Task <N>:` section as one Phase 4 task.
   - Parse the title plus these subsections when present: `Objective`,
     `Relevant requirements and context`, `Dependencies / prerequisites`,
     `Questions to answer before starting`, `Implementation notes`,
     `Definition of done`, and `Likely files / artifacts affected`.
   - Preserve `Priority` when present; use `Unknown` when absent.
   - Preserve `## Execution Order Summary` if present; use numbered task
     sections as the parse boundary.
   - Record whether `## Decisions Log` exists. Missing decisions log is
     warning-eligible, not blocking, when tasks remain parseable.
   - Detect existing `GitHub Task Issue: ...` lines and existing
     `## GitHub Task Issues` table rows.

3. **Verify existing refs are safe to reuse.**
   - For each concrete `owner/repo#num` in the plan, fetch the issue's
     `number`, `state`, `title`, and `body` via `gh issue view`.
   - Reuse the ref when the body or GitHub-reported parent relationship is
     consistent with `ISSUE_URL` or `OWNER/REPO#PARENT_NUMBER`.
   - If an existing ref clearly belongs to another parent or unrelated epic,
     return `TASK_ISSUES: BLOCKED`. This preserves idempotency and prevents
     duplicate child issues.

4. **Choose the write path.**
   - Prefer **native sub-issues** when confirmed by the current environment.
   - Capability probe order:
      1. Installed `gh issue create` capability for parent/sub-issue support.
      2. Installed `gh` extensions that support sub-issue creation.
      3. GitHub REST sub-issue support for the parent issue.
   - Exact probe commands, REST paths, headers, payload fields, and current
     status-code meanings live in `./external-sources.md`.
   - Record a short `Capability:` string, such as
     `native unavailable; using linked-issue`.

5. **Prepare missing task issue payloads.**
   - For each task without a verified concrete issue ref, build the title:

   ```text
   Task <N>: <Short title from plan>
   ```

   - Read `../subagents/task-issue-creator-templates.md` and use the GitHub
     issue body fragment.
   - Substitute `PARENT_URL` with canonical `ISSUE_URL` and include the parent
     traceability section even when a native relationship is also created.

6. **Create or link only missing work items.**
   - For `native-sub-issue`, create the child issue first, then link it with
     the current GitHub REST sub-issue operation from `./external-sources.md`.
   - For `linked-issue`, create the child issue and rely on the parent
     URL/reference in the child body.
   - If concrete issue creation is impossible for a specific task, fall back
     to `task-list` traceability for that task only.
   - Create one issue at a time. Require a definite `OWNER/REPO#number`
     before counting a concrete create as successful.
   - On rate limit, wait 5 seconds and retry the same request once. If it
     still fails, record it in `Failures` and continue when possible.

7. **Update the plan file idempotently.**
   - Update only `docs/<ISSUE_SLUG>-tasks.md`.
   - Follow `./phase-4-io-contracts.md` for exact artifact shape.
   - Insert or replace one `## GitHub Task Issues` section after
     `## Issue Summary` when present; otherwise place it after the first
     top-level heading.
   - Include the machine handoff comment and one workflow-table row per
     parsed task.
   - Ensure each task section contains exactly one `GitHub Task Issue: ...`
     line immediately after the task heading.

8. **Validate and repair once.**
   - Re-read the updated plan file.
   - Validate against `./phase-4-io-contracts.md`.
   - Confirm a single `## GitHub Task Issues` section, the required handoff
     comment, the fixed column order, one row per task, and matching inline
     lines.
   - If a structural check fails, repair the local markdown once and re-run
     only the failed checks.
   - During repair, create no additional GitHub issues.
   - If validation still fails, return `TASK_ISSUES: FAIL` with
     `Validation: FAIL`.

9. **Summarize.**
   - Use `TASK_ISSUES: PASS` when every task has valid traceability and
     validation passed.
   - Use `TASK_ISSUES: WARN` when validation passed with non-fatal warnings,
     mixed/degraded linkage, `task-list` fallback, or `Not Created` rows.
   - Include every contract-required summary line and every parsed task row
     when the plan file was updated.
