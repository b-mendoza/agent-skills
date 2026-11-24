# scope-run-files-to-the-run

📝 Reply inline unless a payload exceeds the inline budget, must survive a turn, or needs to be read by a later step or script. Write needed files under a fresh, proven-ignored `.handoffs/<skill>/<run-id>/`. Keep every file the run writes there and name the directory in the final reply.

🔒 This rule is `mandatory`: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.

A subagent result travels inline as a bounded structured reply (a status, paths, a concise summary) when it fits and no later step or script needs the file. Handoff files let the orchestrator or a subagent recover exact decisions, paths, and evidence after context compaction. Use a dispatch payload only for its dispatch. Create resume state only for a stated persistence need that the runtime's native session retention does not cover. Keeping a payload or resume file does not authorize its later use. A deliverable (source, tests, docs, a requested plan or report) is kept under the user's contract. Secrets, tokens, raw logs, full diffs, and copied third-party payloads are never-write, in any of these: store a path, digest, or redacted fact instead.

Derive the run ID once at intake. If the directory exists, choose a new ID. Before the first write, require `git check-ignore --quiet -- "<path>"` to exit zero; otherwise use an already-ignored location or reclassify the file as a deliverable. Record each created path to track ownership and audit writes. A run may list sibling run names to avoid collisions; their contents are outside its read and write scope. At every terminal, compare the worktree with the intake baseline and report changes outside the declared envelope. Leave the run's payloads, scratch files, receipts, reports, and other run files in place. If the run stopped before creating any files, say so without creating a file just to report a path.

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
7. Compare the terminal worktree with the baseline and report changes outside
   the declared envelope. Leave `$HANDOFF_DIR/task-planner-report.yaml` and
   every other file this run wrote under `$HANDOFF_DIR` in place. Give the user
   the resolved run directory and the separate plan path.
```

## Related rules

- [declare-mutation-limits](./declare-mutation-limits.md)
- [declare-input-output-contracts](./declare-input-output-contracts.md)
- [route-every-status](./route-every-status.md)
- [delegate-by-default](./delegate-by-default.md)
