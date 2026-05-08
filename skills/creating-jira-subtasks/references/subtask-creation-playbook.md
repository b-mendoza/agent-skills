# Subtask Creation Playbook

Read this file after `subtask-creator` has parsed `JIRA_URL` and confirmed that
`docs/<TICKET_KEY>-tasks.md` exists with numbered task sections.

> Keep raw Jira payloads and full plan contents out of the final summary. Return
> only the contract-defined verdict, counts, warnings, failures, and linkage
> table.

## Execution Steps

1. **Verify the parent ticket**
   - Fetch the parent issue using `JIRA_URL` or `TICKET_KEY`.
   - Extract the verified parent key, project key, status, and available subtask
     issue type for the project.
   - Use Jira's returned project key and subtask issue type for create requests.
   - If the parent cannot be fetched, Jira auth fails, or no Jira-capable tools
     are available, return `SUBTASKS: FAIL` with `Validation: NOT_RUN`.

2. **Parse plan tasks and existing linkage**
   - Treat each `## Task <N>:` section as one Phase 4 task.
   - Parse the title plus these subsections when present: `Objective`,
     `Relevant requirements and context`, `Dependencies / prerequisites`,
     `Questions to answer before starting`, `Implementation notes`,
     `Definition of done`, and `Likely files / artifacts affected`.
   - Preserve `Priority` when present. Use `Unknown` when absent.
   - Preserve `## Execution Order Summary` if present; use numbered task
     sections as the parse boundary.
   - Record whether `## Decisions Log` exists. Missing decisions log is
     warning-eligible, not blocking, when tasks remain parseable.
   - Detect existing `Jira Subtask: <KEY | Not Created>` lines and existing
     `## Jira Subtasks` table rows.

3. **Verify existing Jira refs are safe to reuse**
   - For each existing concrete Jira key, verify the issue exists and its parent
     is `TICKET_KEY`.
   - Count verified matches as already linked.
   - If a concrete key is invalid or belongs to another parent, return
     `SUBTASKS: BLOCKED`. This preserves idempotency and prevents duplicate
     subtasks.

4. **Prepare missing subtask payloads**
   - For each task without a verified Jira key, build the summary:

```text
Task <N>: <Short title from plan>
```

   - Read `../subagents/subtask-creator-templates.md` and use the Jira
     description fragment as the semantic section order.
   - If the active Jira tool requires Atlassian Document Format instead of plain
     text or wiki markup, read `./external-sources.md`, fetch the ADF source, and
     convert the same sections without changing their meaning.
   - Use the current clarified plan content as written. The decisions log may
     guide interpretation, but older task text is not resurrected.

5. **Create only missing subtasks**
   - Create missing subtasks sequentially, one at a time.
   - Pass project key, verified subtask issue type, parent ticket key, summary,
     and description/body fields required by the active Jira transport.
   - Require a Jira-style issue key in the response before counting the create as
     successful.
   - On rate limit, wait 5 seconds and retry the same request once.
   - If one create fails after retry, record it in `Failures` and continue with
     remaining tasks when possible.

6. **Update the plan file idempotently**
   - Update only `docs/<TICKET_KEY>-tasks.md`.
   - Follow `./phase-4-io-contracts.md` for exact artifact shape.
   - Ensure each task section contains exactly one `Jira Subtask: <KEY | Not Created>`
     line immediately after the task heading.
   - Insert or refresh a single `## Jira Subtasks` table after `## Ticket Summary`
     when present; otherwise place it after the first top-level heading.
   - Include exactly one row per parsed task.
   - Use current Jira status when known for verified existing subtasks. Use
     `To Do` for newly created subtasks unless Jira reports a different status.

7. **Validate and repair once**
   - Re-read the updated plan file.
   - Validate against `./phase-4-io-contracts.md`.
   - Confirm a single `## Jira Subtasks` table, fixed column order, one row per
     task, matching inline lines, and parent-safe Jira keys.
   - If a structural check fails, repair the local markdown once and re-run only
     the failed checks.
   - During repair, create no additional Jira issues.
   - If validation still fails, return `SUBTASKS: FAIL` with `Validation: FAIL`.

8. **Summarize**
   - Use `SUBTASKS: PASS` when every task is linked and validation passed.
   - Use `SUBTASKS: WARN` when validation passed with non-fatal warnings or some
     tasks remain `Not Created` after attempted creates.
   - Include every contract-required summary line and every parsed task row when
     the plan file was updated.
