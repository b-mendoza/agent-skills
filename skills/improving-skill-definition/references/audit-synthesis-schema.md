# Audit Synthesis Schema

Load this reference when writing or validating `audit-synthesis-report.yaml`. The synthesis is the canonical compact ledger used for approval, edit, and validation.

## Required Top-Level Keys

```yaml
version: 1
from:
  orchestrator: "improving-skill-definition"
  phase: "audit"
to:
  orchestrator: "improving-skill-definition"
  phase: "approval|edit|validate|handoff"
intent: "Synthesize focused audit slice reports into one approval and edit ledger"
audit_status_summary: []
overall_verdict: "PASS | GAPS_FOUND | BLOCKED | ERROR"
gap_inventory: []
mutation_plan: []
quality_gate_plan: []
out_of_scope_findings: []
outcome_matrix_aggregate: []
priority_ranking_aggregate: []
parallelism_opportunities_aggregate: []
subagent_map_aggregate: []
heuristic_table_aggregate: []
alternatives_aggregate: []
no_ops_aggregate: []
```

`to` is always a mapping with `orchestrator` and `phase`; do not collapse it to a string. All slice statuses are prefix-qualified.

## Status Summary Rows

```yaml
- slice: "flow-coherence-auditor"
  status: "FLOW_AUDIT: GAPS_FOUND"
  report_path: ".handoffs/improving-skill-definition/<run-id>/flow-coherence-auditor-report.yaml"
  verdict: "routeable summary"
  gap_ids: ["gap-001"]
  no_op_ids: []
```

## Gap Inventory Rows

Use the row contract in `audit-gap-taxonomy.md`. `provenance` is required and is one of `local`, `external`, or `mixed`. Externally-derived suggestions must stay marked through approval and final handoff.

For self-improvement runs, each gap also has:

```yaml
self_improvement_safety: "SAFE | DEFERRED"
self_improvement_reason: "Why this can or cannot be safely changed in this run"
```

## Mutation Plan Rows

```yaml
- gap_id: "gap-001"
  proposed_files: ["SKILL.md", "subagents/skill-package-validator.md"]
  change_kind: "cosmetic | semantic | structural | contract | reference | deletion"
  requires_diagram_candidate: true
  scope_notes: "Why this is inside MUTATION_LIMITS"
  approved: false
```

## Quality Gate Plan Rows

```yaml
- gate: "G_GAP_CLOSURE"
  checker: "skill-package-validator Lane A"
  evidence_required: "Baseline diff shows approved gap resolved"
  blocks_validation: true
```

## Aggregate Keys

| Key | Source Slice | Contents |
| --- | --- | --- |
| `outcome_matrix_aggregate` | contract-priority | Statuses, routes, outputs, and missing outcomes |
| `priority_ranking_aggregate` | contract-priority, all slices | Ordered fixes by severity, lane, and dependency |
| `parallelism_opportunities_aggregate` | subagent-architecture | Safe parallel groups and sequential dependencies |
| `subagent_map_aggregate` | subagent-architecture | Subagent purpose, inputs, outputs, overlaps, and removals |
| `heuristic_table_aggregate` | prompt-sufficiency, hygiene | Skill-vs-prompt and package-hygiene heuristics |
| `alternatives_aggregate` | personality, architecture, prompt | Considered alternatives with evidence |
| `no_ops_aggregate` | all slices | Mandates or suspected issues falsified with evidence |

## Out-Of-Scope Findings

Use this for Lane B or explicitly forbidden scope. Include evidence, why the workflow must not edit it in this run, and the suggested future run.

## Completion Rules

- `overall_verdict: PASS` only when every audit slice status ends `: PASS`.
- `overall_verdict: GAPS_FOUND` when any slice ends `: GAPS_FOUND` and none are `: BLOCKED` or `: ERROR`.
- `BLOCKED` and `ERROR` preserve the failing slice path and recovery action.
- Every `IMPROVEMENT_MANDATES` entry appears as a gap id or in `no_ops_aggregate` as `NO_OP_EVIDENCED`; an empty list records `mandate_coverage: vacuous`.
