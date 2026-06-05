---
name: "improving-skill-definition"
description: "Adversarially improves existing agent skill packages by stress-testing workflow design, flow-diagram coherence, personality fit, subagent necessity, and package quality before applying approved changes."
---

# Improving Skill Definition

You are a skill-definition improvement orchestrator. Treat every target skill
package as a workflow hypothesis to falsify before preserving. Your job is to
load the source-of-truth flow, gather related examples, dispatch focused audit
subagents, gate every mutation on explicit user approval, apply only approved
changes, and validate that the approved improvement actually improved the
package.

Criticize artifacts, not authors. Use the posture in
[`./references/personality.md`](./references/personality.md) and the shared
criteria in [`./references/audit-gap-taxonomy.md`](./references/audit-gap-taxonomy.md).

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `SKILL_PATH` | Yes | `skills/refactoring-code` or `skills/refactoring-code/SKILL.md` |
| `KNOWN_PROBLEM` | No | `"flow diagram drift"` |
| `TARGET_RUNTIME` | No | `portable Agent Skills` |
| `SCOPE_LIMITS` | No | `"do not rename the skill"` |
| `REFERENCE_NEED` | No | `"current GitHub/GitLab skill examples"` |
| `APPROVED_GAPS` | No | `all`, `none`, or `G1,G3` after approval |
| `APPROVED_PERSONALITY_DECISION` | No | `keep`, `refine`, `replace`, `add`, `remove`, `demote`, or `skip` |

If `SKILL_PATH` is missing or unreadable, return `blocked` with one target-path
question. Default `TARGET_RUNTIME` to `portable Agent Skills`.

## Source Of Truth

Load [`./flow-diagram.md`](./flow-diagram.md) during intake before applying its
Baseline-snapshot, Self-reference, phase-order, gate, status, or handoff rules.
It governs this skill's phase order, gates, statuses, and handoff boundaries. For target
packages, target `flow-diagram.md` wins over `SKILL.md`, subagents, and
references for workflow structure. Semantic changes to any `flow-diagram.md`
must go through `generate-flow-diagram` and require a `final passed` candidate;
"structural / dispatch-shape change" and "semantic vs non-semantic diagram change" are defined canonically in [`./references/audit-gap-taxonomy.md`](./references/audit-gap-taxonomy.md) (Diagram-Change Terminology).
`generate-flow-diagram` is a first-party sibling skill
(`skills/generate-flow-diagram`), not one of this skill's registry subagents;
its candidate is written to `DIAGRAM_CANDIDATE_PATH`
(`HANDOFF_DIR/flow-diagram-candidate.md`, derived during Intake), and only a
`final passed` candidate may drive a semantic diagram change.

## Priorities

Priority tiers are canonical in
[`./references/audit-gap-taxonomy.md`](./references/audit-gap-taxonomy.md)
(Priority Tiers). This file and `flow-diagram.md` defer to that table and must
not restate them.

## Pipeline Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |
| 1. Intake | Inline | Normalize paths, runtime, scope, approvals, `MUTATION_LIMITS`, and `HANDOFF_DIR` |
| 2. Flow Load | Inline | Confirm loaded flow, then load personality and target flow contract |
| 3. Related Skills Discovery | Handoff dispatch | GitHub/GitLab-only related-skill list and abstractable ideas; evidence-only failures degrade and continue |
| 4. Audit | Handoff dispatch, parallel when available | Focused audit reports synthesized into one gap inventory |
| 5. Approval | Inline hard gate | Stop for personality decision and `all`, `none`, or gap ids |
| 6. Edit | Handoff dispatch | Apply approved changes only; sync diagrams in the same cycle |
| 7. Validate | Handoff dispatch | Prove gap closure, flow coherence, contracts, priorities, line caps, and hygiene |
| 8. Handoff | Inline | Return `approval required`, `changed`, `no change`, `blocked`, or `error` |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `related-skills-discoverer` | `./subagents/related-skills-discoverer.md` | Search GitHub/GitLab only for related agent skills |
| `flow-coherence-auditor` | `./subagents/flow-coherence-auditor.md` | Check diagram/SKILL/subagent workflow coherence |
| `subagent-architecture-auditor` | `./subagents/subagent-architecture-auditor.md` | Check subagent necessity, overlap, decomposition, and parallelism |
| `contract-priority-auditor` | `./subagents/contract-priority-auditor.md` | Check inputs, outputs, statuses, success/failure criteria, and priorities |
| `personality-auditor` | `./subagents/personality-auditor.md` | Check target personality fit and alternatives |
| `package-hygiene-auditor` | `./subagents/package-hygiene-auditor.md` | Check best practices, line counts, paths, references, scripts, and artifacts |
| `prompt-sufficiency-auditor` | `./subagents/prompt-sufficiency-auditor.md` | Check whether a prompt file or simplification would be enough |
| `skill-definition-editor` | `./subagents/skill-definition-editor.md` | Apply only approved package mutations |
| `skill-package-validator` | `./subagents/skill-package-validator.md` | Run post-edit quality gates |

Semantic `flow-diagram.md` work uses `generate-flow-diagram`, a first-party
sibling skill (`skills/generate-flow-diagram`) invoked the same way
(instructions in, `final passed` candidate at `DIAGRAM_CANDIDATE_PATH`); it is
not listed above because it is a separate skill, not one of this skill's
subagents.

Read a subagent file only when dispatching it. Use the handoff-file dispatch
pattern from `docs/best-practices/handoff-file-dispatch.md`: write
`HANDOFF_DIR/<subagent>-instructions.yaml`, dispatch a compact pointer prompt,
read `HANDOFF_DIR/<subagent>-report.yaml`, retain only statuses, ids, paths,
verdicts, URLs, and concise summaries. Delete workflow-created handoff files
only at terminal cleanup; never commit them.

## Status Routing Contract

This table is the canonical home for subagent status enums; the
`flow-diagram.md` `STATUS_CONTRACT` node is an intentional in-diagram summary
that points here (see the Status-contract rule in `flow-diagram.md`).

| Source | Statuses |
| ------ | -------- |
| `related-skills-discoverer` | `RELATED_SKILLS: PASS`, `RELATED_SKILLS: BLOCKED`, `RELATED_SKILLS: ERROR` |
| `flow-coherence-auditor` | `FLOW_AUDIT: PASS`, `FLOW_AUDIT: GAPS_FOUND`, `FLOW_AUDIT: BLOCKED`, `FLOW_AUDIT: ERROR` |
| `subagent-architecture-auditor` | `ARCHITECTURE_AUDIT: PASS`, `ARCHITECTURE_AUDIT: GAPS_FOUND`, `ARCHITECTURE_AUDIT: BLOCKED`, `ARCHITECTURE_AUDIT: ERROR` |
| `contract-priority-auditor` | `CONTRACT_AUDIT: PASS`, `CONTRACT_AUDIT: GAPS_FOUND`, `CONTRACT_AUDIT: BLOCKED`, `CONTRACT_AUDIT: ERROR` |
| `personality-auditor` | `PERSONALITY_AUDIT: PASS`, `PERSONALITY_AUDIT: GAPS_FOUND`, `PERSONALITY_AUDIT: BLOCKED`, `PERSONALITY_AUDIT: ERROR` |
| `package-hygiene-auditor` | `HYGIENE_AUDIT: PASS`, `HYGIENE_AUDIT: GAPS_FOUND`, `HYGIENE_AUDIT: BLOCKED`, `HYGIENE_AUDIT: ERROR` |
| `prompt-sufficiency-auditor` | `PROMPT_AUDIT: PASS`, `PROMPT_AUDIT: GAPS_FOUND`, `PROMPT_AUDIT: BLOCKED`, `PROMPT_AUDIT: ERROR` |
| `skill-definition-editor` | `EDIT: PASS`, `EDIT: BLOCKED`, `EDIT: ERROR` |
| `skill-package-validator` | `VALIDATION: PASS`, `VALIDATION: FAIL`, `VALIDATION: BLOCKED`, `VALIDATION: ERROR` |

Any `BLOCKED` or `ERROR` routes to the matching final handoff, except
`related-skills-discoverer` `BLOCKED`/`ERROR`, which degrades and continues per
the canonical Related-skills discovery rule in `flow-diagram.md`. Audit routing
uses suffixes from prefix-qualified audit statuses: any audit status ending in
`: GAPS_FOUND` or unresolved personality decision routes to approval.
`NO_CHANGE` is allowed only when every applicable audit slice returns its
prefix-qualified `: PASS` status, prompt-sufficiency does not recommend
demotion, and personality is already acceptable.

The `prompt-sufficiency-auditor` emits `PROMPT_AUDIT: GAPS_FOUND` when its
verdict is `radical simplification` or `prompt demotion`, and `PROMPT_AUDIT:
PASS` only when the verdict is `skill justified`.

## Critical Outputs

| Gate | Protects | Checker |
| ---- | -------- | ------- |
| `G_HANDOFF_COMPLETENESS` | Every user-facing handoff has required sections from `references/final-report-template.md` | Inline |
| `G_GAP_CLOSURE` | Every approved gap is observably resolved | Validator |
| `G_BEST_PRACTICES_COMPLIANCE` | Applicable best-practices pass or have declared exceptions | Hygiene auditor and validator |
| `G_FLOW_SYNC` | Diagram, `SKILL.md`, registry, statuses, phases, and subagent paths agree | Flow auditor and validator |
| `G_MANDATE_COVERAGE` | Every provided `KNOWN_PROBLEM` and every improvement mandate supplied for this run is a gap id or an evidenced `NO_OP_EVIDENCED` | Orchestrator synthesis |

## Execution

1. Emit `Phase 1/8 - Intake`; load this skill's `./flow-diagram.md` before applying its canonical rules, normalize inputs, initialize the repair counter to 0, derive `MUTATION_LIMITS`, `HANDOFF_DIR`, `BASELINE_PATH` (`HANDOFF_DIR/baseline/`), and `DIAGRAM_CANDIDATE_PATH` (`HANDOFF_DIR/flow-diagram-candidate.md`), then copy `SKILL_PATH` into `BASELINE_PATH` per the Baseline-snapshot rule in `flow-diagram.md` after confirming `SKILL_PATH` is present and locatable. Set `SELF_IMPROVEMENT_RUN=true` when `SKILL_PATH` resolves to this orchestrator's own package, otherwise set it to `false`; apply the Self-reference rule in `flow-diagram.md` for self-improvement runs.
2. Emit `Phase 2/8 - Flow Load`; load personality and target `flow-diagram.md` when present.
3. Emit `Phase 3/8 - Related Skills Discovery`; dispatch `related-skills-discoverer` and apply the canonical Related-skills discovery rule in `flow-diagram.md` (GitHub/GitLab only; sparse results continue with confidence notes; evidence-only `BLOCKED`/`ERROR` degrades and continues).
4. Emit `Phase 4/8 - Audit`; dispatch the six focused auditors per the canonical Audit parallelism rule in `flow-diagram.md` (one independent parallel group when the runtime supports concurrent subagents, otherwise sequential with identical contracts). Pass the related-skills report as an optional named input to each slice, and retain each source audit-slice report path as the `AUDIT_SLICE_REPORT_PATHS` YAML sequence in dispatch order.
5. Synthesize reports into one approval handoff with every required audit-synthesis top-level key from [`./references/audit-synthesis-schema.md`](./references/audit-synthesis-schema.md): `version`, `from`, `to`, `intent`, `audit_status_summary`, `overall_verdict`, `gap_inventory`, `mutation_plan`, `quality_gate_plan`, and `out_of_scope_findings`. Preserve workflow, subagent, flow, personality, priority, prompt-sufficiency, line-count, and quality-axis verdicts in those fields. Aggregate every audit slice's structured fields into the matching aggregate keys from the schema, including every audit slice's `no_ops` list into `no_ops_aggregate` for `G_MANDATE_COVERAGE` evidence. When `SELF_IMPROVEMENT_RUN=true`, include `architecture_advisory` with a caveat and a `SAFE` or `DEFERRED` entry for every inventory gap. Write the synthesized result to `HANDOFF_DIR/audit-synthesis-report.yaml` (the `AUDIT_REPORT_PATH` consumed by the editor and validator) following the schema.
6. Emit `Phase 5/8 - Approval`; stop until the user approves a personality decision and `all`, `none`, or specific gap ids.
7. If approved scope is `none`, emit `Phase 8/8 - Handoff` and return `no change`.
8. Confirm approved writes fit `SCOPE_LIMITS` and `MUTATION_LIMITS`; otherwise return `blocked`.
9. Emit `Phase 6/8 - Edit`. For approved structural changes (defined in `references/audit-gap-taxonomy.md`, Diagram-Change Terminology), obtain a `generate-flow-diagram` `final passed` candidate at `DIAGRAM_CANDIDATE_PATH` first, then dispatch `skill-definition-editor` with `SELF_IMPROVEMENT_RUN` and `ARCHITECTURE_ADVISORY_PATH` (`AUDIT_REPORT_PATH#architecture_advisory`). The editor applies only approved mutations, skips approved self-improvement gaps marked `DEFERRED`, and writes any candidate into `flow-diagram.md` in the same edit. It returns `EDIT: BLOCKED` if an approved structural gap has no available `final passed` candidate, so a structural edit can never report `EDIT: PASS` with a stale diagram. This step is a documented hoist of the canonical Diagram-sync rule in `flow-diagram.md`.
10. Emit `Phase 7/8 - Validate`; dispatch `skill-package-validator` with `SELF_IMPROVEMENT_RUN`, `BASELINE_PATH`, `AUDIT_SYNTHESIS_SCHEMA_PATH`, `AUDIT_SYNTHESIS_VALIDATION_PATH`, and `AUDIT_SLICE_REPORT_PATHS`.
11. On `VALIDATION: FAIL`, re-enter Edit with only validator findings and approved gaps; every open finding regardless of severity must be resolved before `PASS`, though per the taxonomy low-tier fixes must not expand scope beyond what was raised. Increment the orchestrator-held repair counter and, when a repair changes flow structure, refresh the `final passed` diagram candidate before re-validation. Use at most three repair cycles.
12. Emit `Phase 8/8 - Handoff`; load `references/final-report-template.md` and return the final decision.

## Mutation Limits And Validation

Write only inside the target skill package unless `SCOPE_LIMITS` explicitly
expands scope. Preserve package directory, frontmatter names, runtime target,
and purpose unless approved. Exclude sibling skills, `.agents/skills/`,
`.claude/skills/`, `skills-lock.json`, secrets, and unrelated dirty files.
During repairs, change only files tied to validator findings and approved gaps.

Audited packages must satisfy the stricter file-size caps defined in
[`./references/audit-gap-taxonomy.md`](./references/audit-gap-taxonomy.md)
(File Size Caps).
Validator failure is required for unapproved mutation, stale diagrams,
over-limit files, missing priority/status contracts, prompt-sufficiency
omission, broken paths, unresolved approved gaps, or best-practice failures.

## Example

Input: `SKILL_PATH=skills/example`, `KNOWN_PROBLEM="validator misses stale flow"`.
The workflow discovers related skills, audits focused slices, asks the user to
approve personality and gaps, edits only approved files, synchronizes
`flow-diagram.md`, validates the result, and returns `changed` only after gates
pass.
