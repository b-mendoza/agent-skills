# Subtask Creation Playbook

> Read this file after `subtask-creator` has parsed `JIRA_URL` and confirmed
> that `docs/<TICKET_KEY>-tasks.md` exists with numbered task sections.
>
> **Reminder:** keep raw Jira payloads and full plan contents out of the final
> summary. Return only the contract-defined verdict, counts, warnings,
> failures, and linkage table.

This playbook describes **what to do and in what order**. Concrete REST
endpoints, payload field names, ADF JSON shape, and other version-sensitive
syntax live in `./external-sources.md`. Use the active Jira tool's request
format first when offline; fetch the smallest relevant URL only when current
syntax or product behavior is uncertain.

## Execution Steps

1. **Verify the parent ticket.**
   - Use the active Jira tool (or REST v3 issue GET) to fetch the parent
     issue. Capture the verified parent key, project key, status, and summary.
   - Use Jira's returned project key for later create-metadata checks; do not
     infer it from `JIRA_URL` alone.
   - If the parent cannot be fetched, Jira auth fails, or no Jira-capable
     tools are available, return `SUBTASKS: FAIL` with `Validation: NOT_RUN`.
   - For exact endpoint paths or required query fields, see the **Jira REST
     v3 issue endpoints** entry in `./external-sources.md`.

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
   - Detect existing `Jira Subtask: <KEY | Not Created>` lines and existing
     `## Jira Subtasks` table rows.

3. **Verify existing Jira refs are safe to reuse.**
   - For each existing concrete Jira key, fetch the issue and confirm its
     parent is `TICKET_KEY` and its issue type is a configured subtask type.
   - Count verified matches as already linked.
   - If a concrete key is invalid or belongs to another parent, return
     `SUBTASKS: BLOCKED`. This preserves idempotency and prevents duplicate
     subtasks.

4. **Verify Jira create metadata when new subtasks are needed.**
   - Run this step only when at least one task lacks verified traceability.
   - Use the active Jira tool or the current REST v3 project issue-type
     metadata endpoint for the verified project key to identify createable
     issue types whose metadata marks them as subtasks.
   - If no createable subtask issue type exists, or the project reports that
     subtasks are disabled, return `SUBTASKS: FAIL` with `Validation: NOT_RUN`.
   - If multiple createable subtask issue types exist and the plan, caller, or
     local configuration does not provide a deterministic approved choice,
     return `SUBTASKS: BLOCKED` with `Validation: NOT_RUN`.
   - If multiple createable subtask issue types exist and a deterministic
     configured or approved choice exists, use it and record a warning.
   - Fetch create-field metadata for the selected subtask issue type with the
     current project issue-type field metadata endpoint. Required fields must
     be satisfiable from the plan, parent response, default values, or
     metadata. If a required field cannot be supplied safely, return
     `SUBTASKS: FAIL` with `Validation: NOT_RUN`.

5. **Prepare missing subtask payloads.**
   - For each task without a verified Jira key, build the summary:

   ```text
   Task <N>: <Short title from plan>
   ```

   - Read `../subagents/subtask-creator-templates.md` and use its description
     section order (Objective, Requirements, Dependencies, Questions,
     Implementation Notes, Definition of Done, Likely Files).
   - If the active Jira tool requires Atlassian Document Format instead of
     plain text or wiki markup, fetch the **Atlassian Document Format** URL
     from `./external-sources.md` and convert the same sections into ADF
     block nodes without changing their meaning.
   - Use the current clarified plan content as written. The decisions log
     may guide interpretation, but older task text is not resurrected.

6. **Create only missing subtasks.**
   - Create missing subtasks sequentially, one at a time.
   - Pass verified project key, selected subtask issue type, parent ticket key,
     summary, and the description body in the format the active Jira
     transport accepts.
   - For the exact issue-create payload shape and required scopes, see the
     **Jira REST v3 issue endpoints** entry in `./external-sources.md` and
     fetch only when the local cheatsheet is insufficient.
   - Require a Jira-style issue key in the response before counting the
     create as successful.
   - On rate limit, wait 5 seconds and retry the same request once.
   - If one create fails after retry, record it in `Failures` and continue
     with remaining tasks when possible.

7. **Update the plan file idempotently.**
   - Update only `docs/<TICKET_KEY>-tasks.md`.
   - Follow `./phase-4-io-contracts.md` for exact artifact shape.
   - Ensure each task section contains exactly one
     `Jira Subtask: <KEY | Not Created>` line immediately after the task
     heading.
   - Insert or refresh a single `## Jira Subtasks` table after
     `## Ticket Summary` when present; otherwise place it after the first
     top-level heading.
   - Include exactly one row per parsed task.
   - Use the current Jira status when known for verified existing subtasks.
     Use `To Do` for newly created subtasks unless Jira reports a different
     status.

8. **Validate and repair once.**
   - Re-read the updated plan file.
   - Validate against `./phase-4-io-contracts.md`.
   - Confirm a single `## Jira Subtasks` table, the fixed column order, one
     row per task, matching inline lines, and parent-safe Jira keys.
   - If a structural check fails, repair the local markdown once and re-run
     only the failed checks.
   - During repair, create no additional Jira issues.
   - If validation still fails, return `SUBTASKS: FAIL` with
     `Validation: FAIL`.

9. **Summarize.**
   - Use `SUBTASKS: PASS` when every task is linked and validation passed.
   - Use `SUBTASKS: WARN` when validation passed with non-fatal warnings or
     some tasks remain `Not Created` after attempted creates. In that case,
     state that linked tasks are usable but `Not Created` rows need manual
     resolution or rerun before those tasks are selected for execution.
   - Include every contract-required summary line and every parsed task row
     when the plan file was updated.
