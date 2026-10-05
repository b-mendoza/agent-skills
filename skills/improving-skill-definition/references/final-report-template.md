# Final Report Template

Load this reference immediately before emitting an approval, changed, no-change, blocked, or error handoff.

## Shared Rules

- Return exactly one decision: `approval required`, `changed`, `no change`, `blocked`, or `error`.
- Include `ignored_preapproval` and `follow_up_findings` when non-empty.
- Externally-derived gaps are visibly marked with provenance.
- Emission checklist: before emitting, list every required heading for the chosen decision (from this file), selecting by origin (`Approval` or `ParserApproval`) for `approval required`, and mark each `present` or `absent`. An absent required heading means the message is repaired before emission — never emitted with the gap. End the message with `sections present` showing the completed checklist. This deterministic check replaces free-form self-attestation; no later agent validates the final message, so the checklist is the emission gate.
- Record parser decision/method/exit under `Validation Evidence` when changed, `Reason` for no change, `Blocking Reason` when blocked, or `Known Context` on error.

## Approval Required

Required headings: for `Approval`, use the set below; for `ParserApproval`, replace `Personality Decision Needed` and its options with `Approved Scope` showing the already-approved personality decision and gap ids only when retained run context is valid; when missing, malformed, or unbound to this run, show `unavailable` and state that re-invocation repeats `Approval` before any parser preview. Never reconstruct scope from earlier messages or prior runs.

```text
## Decision
approval required

## Audit Summary
Per-slice statuses, overall verdict, reduced-confidence notes.

## Gap Inventory
Table: id, severity, provenance, summary, evidence, proposed mutation.

## Personality Decision Needed
Recommended decision and options: keep, refine, replace, add, remove, demote, skip.

## Approval Request
For `Approval`, reply with one personality decision and exactly one of all, none, or listed gap ids. For `ParserApproval`, re-preview the exact parser command and request only `APPROVED`, `REVISE`, or `ABORT`.

## Constraints And Disclosures
Bundled diagram validation and its parser-unavailable `inspected-only` fallback, ignored_preapproval, self-improvement caveats.

## Preserved Run Directory
HANDOFF_DIR path preserved for resumption.

## Sections Present
```

For a malformed `Approval` reply re-ask, include `Valid gap ids` and `Malformed part`. For `ParserApproval` re-asks, follow the exact-command re-preview contract in `../state-machine.md`.

## Changed

Required headings:

```text
## Decision
changed

## Approved Scope
Personality decision, approved gap ids, repair cycles used.

## Files Changed
Created, modified, deleted, no-op, and deferred items by gap or finding id.

## Validation Evidence
Lane A checks, baseline diff summary, gate results, `VALIDATION: PASS` path.

## Follow-Up Findings
Lane B findings not repaired in this run, or `none`.

## Cleanup
Workflow-created files removed or remaining empty directory note.

## Sections Present
```

## No Change

For `EDIT: NO_CHANGE`, include the editor's per-item classification under `Reason`.

Required headings: `Decision`, `Reason`, `Audit Evidence`, `Mandate Coverage`, `Ignored Preapproval`, `Cleanup`, `Sections Present`.

## Blocked

Required headings:

```text
## Decision
blocked

## Blocking Reason
Named phase, status, and smallest recovery action or question.

## Completed Checks
What was already audited, edited, or validated.

## Preserved Evidence
If mutation_applied=true: baseline path, editor report, validator report, and:
`diff -r BASELINE_PATH SKILL_PATH`

## Commit Warning
If evidence was preserved after mutation: do not commit preserved handoff files.

## Follow-Up Findings
Lane B findings when available.

## Sections Present
```

If `mutation_applied=false`, state that workflow files were cleaned up.

## Error

Required headings: `Decision`, `Failed Condition`, `Known Context`, `Recovery Action`, `Preserved Evidence`, `Cleanup`, `Sections Present`.

## Personality Alternatives

When personality verdict is negative (`NEEDS_REFINEMENT`, `MISSING_BUT_RECOMMENDED`, `UNNECESSARY_OR_OVERBUILT`, or `CONFLICTS_WITH_SKILL`), include at least five target-specific alternatives. When verdict is `FITS_PURPOSE` or `NOT_APPLICABLE`, include at least two considered-and-rejected alternatives with evidence; do not invent padding.
