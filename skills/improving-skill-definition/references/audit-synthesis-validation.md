# Audit Synthesis Validation

Load this reference when checking the synthesis file before approval, edit, or post-edit validation.

## Required Checks

| Check | Pass Condition |
| --- | --- |
| `schema_keys` | Every required top-level key from `audit-synthesis-schema.md` is present |
| `to_mapping` | `to.orchestrator` and `to.phase` are present and non-empty |
| `status_summary` | Every dispatched slice has one status-summary row with report path |
| `status_route` | Overall verdict matches the Audit guard order in `../state-machine.md`. |
| `gap_ids` | Gap ids are stable, unique, and referenced by mutation and gate rows |
| `provenance` | Every gap row has `local`, `external`, or `mixed`; external ideas stay marked |
| `mandate_coverage` | Each mandate is a gap id or evidenced no-op; empty mandates are recorded as vacuous |
| `aggregates` | Aggregate entries cite their source slice or say `not_applicable` with evidence |
| `scope` | Mutation plan rows stay inside `MUTATION_LIMITS` or are marked out-of-scope |
| `diagram_candidate` | Semantic or structural diagram rows require `requires_diagram_candidate: true` |
| `self_improvement` | When active, every gap is exactly `SAFE` or `DEFERRED` with a reason |

## Slice-To-Synthesis Copy Rule

The orchestrator may hold a full slice report only while copying its structured fields into the synthesis. After the synthesis file is written, retain only the slice status, path, verdict, gap ids, no-op ids, URLs, and concise summary.

## Self-Improvement Advisory

When the target package is this skill:

```yaml
architecture_advisory:
  caveat: "Non-empty warning about same-run contract mutation risk"
  gaps:
    - gap_id: "gap-001"
      safety: "SAFE | DEFERRED"
      reason: "Why this can or cannot be changed safely now"
```

The editor may apply only approved `SAFE` gaps. The validator fails Lane A if a `DEFERRED` gap appears in the editor-applied change list. When `SELF_IMPROVEMENT_RUN=true` and the user approved structural redefine gaps (execution SoT / state-machine rewrite), synthesis marks those gaps `SAFE` for same-run application; other gaps may remain `DEFERRED`.

## Lane Assignment

Before approval, gaps may use `lane: undecided-before-approval`. After edit, Lane A checks approved-gap closure; regressions and caps on editor-touched files; mutation-boundary and editor-scope compliance; edited flow/SKILL/registry coherence; diagram candidate validation per `../state-machine.md`; synthesis schema; and self-improvement advisory enforcement. Lane B contains pre-existing defects in untouched files, is reported only as `follow_up_findings`, never causes FAIL, and is never repaired in this run.

## Failure Reporting

For any failed check, report:

```yaml
check: "status_route"
severity: "high|medium|low"
lane: "A|B|schema-before-approval"
evidence_path: ".handoffs/.../audit-synthesis-report.yaml"
detail: "Observed mismatch"
required_fix: "Smallest repair"
```
