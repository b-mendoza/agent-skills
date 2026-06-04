# Audit Synthesis Validation

Load this reference during Phase 7 validation when checking
`AUDIT_REPORT_PATH`. It defines the observable checks for the audit-synthesis
schema, source-slice aggregates, and self-improvement advisory enforcement.

## Checks

1. Confirm `AUDIT_REPORT_PATH` carries every non-conditional top-level key from
   `audit-synthesis-schema.md`: `version`, `from`, `to`, `intent`,
   `audit_status_summary`, `overall_verdict`, `gap_inventory`, `mutation_plan`,
   `quality_gate_plan`, and `out_of_scope_findings`.
2. Confirm `to` is a mapping with `to.orchestrator` and `to.phase`.
3. Load every source report in `AUDIT_SLICE_REPORT_PATHS`. For each aggregate
   whose source slice ran, compare the aggregate with the corresponding source
   slice field named in `audit-synthesis-schema.md`; if the source field is
   non-empty, the aggregate must be non-empty.
4. When `SELF_IMPROVEMENT_RUN=true`, confirm `architecture_advisory.caveat` is
   non-empty and `architecture_advisory.applies_to_gaps_in_inventory` covers
   every `gap_inventory` gap id exactly once with `SAFE` or `DEFERRED`.
5. When `SELF_IMPROVEMENT_RUN=true`, load `EDITOR_REPORT_PATH` and confirm no
   `changes_made[].approved_gap_or_finding` entry names a gap marked
   `DEFERRED`. No `DEFERRED` gap may appear in `changes_made`; approved
   deferred gaps should appear in `deferred_or_rejected_changes` with a reason
   instead.

Missing required keys, malformed `to`, missing source reports for slices that
ran, empty aggregates with non-empty source fields, malformed advisory entries,
or editor mutation of a `DEFERRED` gap return `VALIDATION: FAIL`.
