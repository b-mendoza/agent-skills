# scope-run-files-to-the-run

📝 Write handoff files under a proven-ignored `.handoffs/<skill>/<run-id>/` when state must survive compaction, a later step, or a script; reply inline otherwise and delete only what this run created.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

A subagent result travels inline as a bounded structured reply (a status, paths, a concise summary) unless the payload exceeds the prompt or reply budget, must survive the turn because a later step, session, or repair cycle reads it, or is consumed by a script. Only then does it become a file, and the file's role, not its name or format, decides its lifecycle. Handoff files exist so that when the orchestrator's or a subagent's context is compacted, decisions, paths, and evidence are re-read from disk instead of being summarised away. A dispatch payload (instructions and reports exchanged with a subagent) lives only through its dispatch. Resume state lives only while the stated persistence need exists, and is created only when the runtime's native session retention does not already cover that need. A deliverable (source, tests, docs, a requested plan or report) is kept under the user's contract. Secrets, tokens, raw logs, full diffs, and copied third-party payloads are never-write, in any of these: store a path, digest, or redacted fact instead.

Dispatch payloads and resume state live under one run directory, `.handoffs/<skill>/<run-id>/`, with `run-id` derived once at intake and every created file recorded. Before the first write, `git check-ignore --quiet -- "<path>"` must exit zero; otherwise move the file to an already-ignored location or reclassify it as a deliverable. An intended ignore rule that was not observed is not an ignore rule. A run may list sibling `<run-id>` names to spot stale work but never reads or deletes their contents; cleanup runs only from a terminal status and deletes only the recorded paths, so a shared `rm -rf .handoffs/<skill>/` can no longer destroy a parallel run. Retaining payloads for debugging is an explicit per-run opt-in that names the files and the cleanup condition.

Being a deliverable makes a file eligible for version control and nothing more: staging, committing, and pushing each need their own user and repository authority, and no lifecycle rule performs them. Which paths a run may write at all is owned by [declare-mutation-limits](./declare-mutation-limits.md); the keys inside a payload are owned by [declare-input-output-contracts](./declare-input-output-contracts.md).

## Examples

```markdown
<!-- ❌ -->
Write the planner report to `.handoffs/ticket-planner/report.yaml`. The requested
plan is a temporary artifact, so keep it there too. When finished, run
`rm -rf .handoffs/ticket-planner/` and commit the plan.

<!-- ✅ -->
4. Set `HANDOFF_DIR=.handoffs/ticket-planner/<run-id>/`, `<run-id>` derived once
   at intake (UTC timestamp plus a short suffix; if the directory exists, derive
   again). Require `git check-ignore --quiet -- "$HANDOFF_DIR/probe"` to exit 0,
   else `TICKET_PLANNER: BLOCKED`. Record every file this run creates.
5. Dispatch `task-planner` with `HANDOFF_DIR`; it replies inline with
   `PLAN: PASS | BLOCKED | ERROR` and a summary. Its report is a file only
   because `scripts/validate-plan.sh` parses it:
   `$HANDOFF_DIR/task-planner-report.yaml`.
6. Deliverable: `docs/PROJ-123-tasks.md`. Kept for the user; eligible for
   version control; this skill never stages, commits, or pushes it.
7. On a terminal status, delete only the recorded `$HANDOFF_DIR` files. Sibling
   `.handoffs/ticket-planner/<other-run>/` directories may be listed, never read
   or removed. Debug retention: only when the user names the files to keep.
```

## Related rules

- [declare-mutation-limits](./declare-mutation-limits.md)
- [declare-input-output-contracts](./declare-input-output-contracts.md)
- [route-every-status](./route-every-status.md)
- [delegate-by-default](./delegate-by-default.md)
