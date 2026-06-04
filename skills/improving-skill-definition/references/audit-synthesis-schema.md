# Audit Synthesis Report Schema

Load this reference during audit synthesis and validation. It is the canonical
schema for `HANDOFF_DIR/audit-synthesis-report.yaml` (the `AUDIT_REPORT_PATH`
consumed by the editor and validator). Synthesis is observable, not narrative:
every required key below must be present so the validator can confirm
synthesis preserved each audit slice's verdict instead of paraphrasing it.

## Required Top-Level Keys

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

A self-improvement run must also include an `architecture_advisory` block with
a `caveat` string and an `applies_to_gaps_in_inventory` list naming each
inventory gap as `SAFE` or `DEFERRED` per the live-contract self-improvement
safety rule.

## Validation Contract

`skill-package-validator` checks every required top-level key, every
aggregated slice key whose source slice ran, and every
`architecture_advisory` field on self-improvement runs. Missing aggregates,
empty aggregates with non-empty source-slice fields, or absent advisory on a
self-improvement run all return `VALIDATION: FAIL`.
