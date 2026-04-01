# Re-Plan Cycle and Error Handling

This file is loaded when Phase 3 critique triggers a re-plan dispatch back
to Phase 2, or when an error occurs during the pipeline. On the happy path,
this file is never read.

## Re-Plan Cycle

If Phase 3 critique triggers a re-plan, the orchestrator re-dispatches this
skill with the same `TICKET_KEY`, plus:

- `RE_PLAN=true` — signals this is a re-dispatch
- `DECISIONS` — the decisions from Phase 3 that require plan changes

On re-plan:

1. **All three pipeline subagents are re-dispatched.** Each receives the
   prior intermediate artifact (already on disk) plus the new decisions.
2. **Intermediate files are overwritten** with updated versions.
3. **Post-pipeline validation runs again** to confirm the updated plan is
   well-formed.

**Maximum re-plan cycles:** 3 iterations. If Phase 3 critique still has
unresolved concerns after 3 cycles, escalate to the user.

## Error Handling

- If any subagent fails, stop the pipeline. Report the failure with the stage
  number and the subagent's error output.
- If a `stage-validator` check fails, retry the subagent ONCE with specific
  feedback from the validator's issues list. If it fails again, stop and
  report.
- Intermediate files are always preserved — they are never deleted, regardless
  of success or failure.
