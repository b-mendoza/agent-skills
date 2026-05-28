---
name: "improving-skill-definition"
description: "Adversarially improves existing agent skill packages by stress-testing workflow design, flow-diagram coherence, personality fit, subagent necessity, and package quality before applying approved changes."
---

# Improve Skill Definition

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
| `APPROVED_PERSONALITY_DECISION` | No | `keep`, `refine`, `replace`, `add`, or `skip` |

If `SKILL_PATH` is missing or unreadable, return `blocked` with one target-path
question. Default `TARGET_RUNTIME` to `portable Agent Skills`.

## Source Of Truth

Load [`./flow-diagram.md`](./flow-diagram.md) after intake. It governs this
skill's phase order, gates, statuses, and handoff boundaries. For target
packages, target `flow-diagram.md` wins over `SKILL.md`, subagents, and
references for workflow structure. Semantic changes to any `flow-diagram.md`
must go through `generate-flow-diagram` and require a `REVIEW: PASS` candidate.

## Priorities

| Tier | Optimize first when tradeoffs conflict |
| ---- | -------------------------------------- |
| High | Source-of-truth flow coherence, approval gates, mutation boundaries, routeable statuses, observable gap closure, mandatory best-practice failures, no unapproved edits |
| Medium | Audit-slice completeness, related-skill evidence, parallel dispatch boundaries, context efficiency, maintainability |
| Low | Prose polish, cosmetic diagram layout, non-blocking examples, optional external reading, style-only renames |

## Pipeline Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |
| 1. Intake | Inline | Normalize paths, runtime, scope, approvals, `MUTATION_LIMITS`, and `HANDOFF_DIR` |
| 2. Flow Load | Inline | Load this flow and personality contract |
| 3. Related Skills Discovery | Handoff dispatch | GitHub/GitLab-only related-skill list and abstractable ideas |
| 4. Audit | Handoff dispatch, parallel when available | Focused audit reports synthesized into one gap inventory |
| 5. Approval | Inline hard gate | Stop for personality decision and `all`, `none`, or gap ids |
| 6. Edit | Handoff dispatch | Apply approved changes only; sync diagrams in the same cycle |
| 7. Validate | Handoff dispatch | Prove gap closure, flow coherence, contracts, priorities, line caps, and hygiene |
| 8. Handoff | Inline | Return `changed`, `no change`, `blocked`, or `error` |

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

Read a subagent file only when dispatching it. Use the handoff-file dispatch
pattern from `docs/best-practices/context-and-payload-management.md`: write
`HANDOFF_DIR/<subagent>-instructions.md`, dispatch a compact pointer prompt,
read `HANDOFF_DIR/<subagent>-report.md`, retain only statuses, ids, paths,
verdicts, URLs, and concise summaries. Delete workflow-created handoff files
only at terminal cleanup; never commit them.

## Status Routing Contract

| Source | Statuses |
| ------ | -------- |
| `related-skills-discoverer` | `RELATED_SKILLS: PASS`, `RELATED_SKILLS: BLOCKED`, `RELATED_SKILLS: ERROR` |
| audit subagents | `<SLICE>_AUDIT: PASS`, `<SLICE>_AUDIT: GAPS_FOUND`, `<SLICE>_AUDIT: BLOCKED`, `<SLICE>_AUDIT: ERROR` |
| `skill-definition-editor` | `EDIT: PASS`, `EDIT: BLOCKED`, `EDIT: ERROR` |
| `skill-package-validator` | `VALIDATION: PASS`, `VALIDATION: FAIL`, `VALIDATION: BLOCKED`, `VALIDATION: ERROR` |

Any `BLOCKED` or `ERROR` routes to the matching final handoff. Any audit
`GAPS_FOUND` or unresolved personality decision routes to approval. `NO_CHANGE`
is allowed only when every applicable audit slice passes, prompt-sufficiency
does not recommend demotion, and personality is already acceptable.

## Critical Outputs

| Gate | Protects | Checker |
| ---- | -------- | ------- |
| `G_HANDOFF_COMPLETENESS` | Every user-facing handoff has required sections from `references/final-report-template.md` | Inline |
| `G_GAP_CLOSURE` | Every approved gap is observably resolved | Validator |
| `G_BEST_PRACTICES_COMPLIANCE` | Applicable best-practices pass or have declared exceptions | Hygiene auditor and validator |
| `G_FLOW_SYNC` | Diagram, `SKILL.md`, registry, statuses, phases, and subagent paths agree | Flow auditor and validator |
| `G_MANDATE_COVERAGE` | Known problem and mandates M1-M8 are gap ids or evidenced `no_op` | Orchestrator synthesis |

## Execution

1. Emit `Phase 1/8 - Intake`; normalize inputs and derive `MUTATION_LIMITS`.
2. Emit `Phase 2/8 - Flow Load`; load this diagram and personality.
3. Emit `Phase 3/8 - Related Skills Discovery`; dispatch `related-skills-discoverer`. Sparse results continue with confidence notes; do not widen beyond GitHub/GitLab.
4. Emit `Phase 4/8 - Audit`; dispatch focused auditors. Run independent slices in parallel when the runtime supports it, otherwise sequentially with the same contracts.
5. Synthesize reports into one approval handoff: workflow, subagent, flow, personality, priority, prompt-sufficiency, line-count, quality-axis verdicts, gap inventory, mutation plan, and gate plan.
6. Emit `Phase 5/8 - Approval`; stop until the user approves a personality decision and `all`, `none`, or specific gap ids.
7. If approved scope is `none`, emit `Phase 8/8 - Handoff` and return `no change`.
8. Confirm approved writes fit `SCOPE_LIMITS` and `MUTATION_LIMITS`; otherwise return `blocked`.
9. Emit `Phase 6/8 - Edit`; dispatch `skill-definition-editor`. Structural workflow edits must include same-cycle `flow-diagram.md` sync from a `generate-flow-diagram` `REVIEW: PASS` candidate.
10. Emit `Phase 7/8 - Validate`; dispatch `skill-package-validator`.
11. On `VALIDATION: FAIL`, re-enter Edit with only validator findings and approved gaps. Use at most three repair cycles.
12. Emit `Phase 8/8 - Handoff`; load `references/final-report-template.md` and return the final decision.

## Mutation Limits And Validation

Write only inside the target skill package unless `SCOPE_LIMITS` explicitly
expands scope. Preserve package directory, frontmatter names, runtime target,
and purpose unless approved. Exclude sibling skills, `.agents/skills/`,
`.claude/skills/`, `skills-lock.json`, secrets, and unrelated dirty files.
During repairs, change only files tied to validator findings and approved gaps.

Audited packages must satisfy stricter caps: `SKILL.md` and subagent
definitions <=150 non-empty lines each; reference files <=250; scripts <=25.
Validator failure is required for unapproved mutation, stale diagrams,
over-limit files, missing priority/status contracts, prompt-sufficiency
omission, broken paths, unresolved approved gaps, or best-practice failures.

## Example

Input: `SKILL_PATH=skills/example`, `KNOWN_PROBLEM="validator misses stale flow"`.
The workflow discovers related skills, audits focused slices, asks the user to
approve personality and gaps, edits only approved files, synchronizes
`flow-diagram.md`, validates the result, and returns `changed` only after gates
pass.
