# Audit Synthesis Report Schema

Load this reference during audit synthesis and validation. It is the canonical
schema for `HANDOFF_DIR/audit-synthesis-report.yaml` (the `AUDIT_REPORT_PATH`
consumed by the editor and validator). Synthesis is observable, not narrative:
every required and conditional key below must be present when applicable so the
validator can confirm synthesis preserved each audit slice's verdict instead of
paraphrasing it.

## Required And Conditional Top-Level Keys

| Key | Source | Purpose |
| --- | ------ | ------- |
| `version` | orchestrator | Integer schema version |
| `from` | orchestrator | Identity mapping `{orchestrator, phase}` |
| `to` | orchestrator | Next handoff target |
| `intent` | orchestrator | One-line synthesis intent |
| `audit_status_summary` | orchestrator | One row per dispatched slice in dispatch order |
| `overall_verdict` | orchestrator | Audit precedence outcome and per-axis verdicts |
| `gap_inventory` | orchestrator | Material gaps with stable ids `G1..Gn` |
| `mutation_plan` | orchestrator | Per-gap concrete editor mutation outline |
| `quality_gate_plan` | orchestrator | Validator checks for `G_GAP_CLOSURE`, `G_FLOW_SYNC`, `G_BEST_PRACTICES_COMPLIANCE`, `G_MANDATE_COVERAGE` |
| `out_of_scope_findings` | orchestrator | `OUT_OF_SCOPE_FINDING` entries deferred to other workflows |
| `architecture_advisory` | orchestrator | Conditional self-improvement advisory; required when `SELF_IMPROVEMENT_RUN=true` |

## Aggregated Slice Keys

The orchestrator preserves observable evidence from focused audit slices by
copying each slice's structured fields into a matching aggregate. The
validator confirms each aggregate is present and non-empty when its source
slice produced one.

| Aggregate Key | Source Slice Field | Slices Contributing |
| ------------- | ------------------ | ------------------- |
| `outcome_matrix_aggregate` | `outcome_matrix` | `contract-priority-auditor` |
| `priority_ranking_aggregate` | `priority_ranking` | `contract-priority-auditor` |
| `parallelism_opportunities_aggregate` | `parallelism_opportunities` | `subagent-architecture-auditor` |
| `subagent_map_aggregate` | `subagent_map` | `subagent-architecture-auditor` |
| `heuristic_table_aggregate` | `heuristic_table` | `prompt-sufficiency-auditor` |
| `no_ops_aggregate` | `no_ops` | every audit slice |
| `alternatives_aggregate` | `alternatives` | `personality-auditor` |

## Architecture Advisory

A self-improvement run (`SELF_IMPROVEMENT_RUN=true`, when `SKILL_PATH` resolves
to this skill package) must also include an `architecture_advisory` block with a
non-empty `caveat` string and an `applies_to_gaps_in_inventory` list. The list
must name every `gap_inventory` gap id exactly once and mark each as `SAFE` or
`DEFERRED` per the live-contract self-improvement safety rule.

## Validation Contract

`skill-package-validator` checks every non-conditional required top-level key,
every aggregated slice key whose source slice ran, and every
`architecture_advisory` field on self-improvement runs. Missing required keys,
missing aggregates, empty aggregates with non-empty source-slice fields, an
absent advisory on a self-improvement run, or advisory entries that do not cover
every inventory gap all return `VALIDATION: FAIL`.
