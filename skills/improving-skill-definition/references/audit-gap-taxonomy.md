# Audit Gap Taxonomy

Load this reference during audit synthesis, mutation planning, and validation.
It is the shared contract for adversarial skill review.

## Review Posture

Treat the current package as a baseline, not a boundary. For every proposed
structure, artifact, phase, reference, or subagent, answer:

- Why this shape instead of a simpler one?
- Why duplicate an existing artifact instead of reusing it?
- Why not extend the closest existing artifact?
- What evidence falsifies the simpler alternative?

If the answer is only "more organized," classify the idea as
`optional_improvement`, not a material gap.

## Quality Axes

| Axis | A material gap exists when |
| ---- | -------------------------- |
| Robustness | A failure mode can pass silently or lack a recovery route |
| Determinism | A fresh agent cannot identify the next phase, status, owner, or gate |
| Reliability | The package relies on self-report instead of observable evidence |
| Repeatability | Re-running the skill can produce incompatible flow, gap, or edit behavior |
| Effectiveness | The workflow can complete while missing the user's stated goal |

## Priority Tiers

| Tier | Concerns |
| ---- | -------- |
| High | Flow/source-of-truth coherence, approval gates, mutation boundaries, routeable statuses, observable gap closure, mandatory best-practice failures, no unapproved edits |
| Medium | Audit-slice completeness, related-skill evidence, parallel dispatch, context efficiency, maintainability |
| Low | Prose polish, cosmetic diagram layout, non-blocking examples, optional external reading, style-only renames |

When concerns conflict, high-tier closure outranks medium and low. Low-tier
items must not expand scope during repair cycles.

## Gap Types

Use stable ids in discovery order. Recommended type labels:

- `FLOW_SYNC_GATE`
- `ADVERSARIAL_REUSE_LENS`
- `RELATED_SKILLS_DISCOVERY_PHASE`
- `SPLIT_AUDIT_SUBAGENTS`
- `PARALLELISM_AUDIT`
- `STATUS_AND_PRIORITY_CONTRACTS`
- `BASELINE_NOT_BOUNDARY_TAXONOMY`
- `FILE_SIZE_LIMIT_ENFORCEMENT`
- `PROMPT_SUFFICIENCY_AUDIT`
- `BEST_PRACTICE_FAILURE`
- `RECREATE_WORKFLOW`
- `SUBAGENT_REMOVE`
- `SUBAGENT_MERGE`
- `PROMPT_DEMOTION`
- `NO_OP_EVIDENCED`

## Severity

| Severity | Meaning |
| -------- | ------- |
| high | Blocks deterministic or safe execution, approval boundaries, source-of-truth coherence, validation, or mandate coverage |
| medium | Weakens maintainability, context efficiency, audit completeness, or repeatability without immediate unsafe mutation |
| low | Useful polish that should not block unless explicitly requested |

## File Size Caps

Count non-empty lines during audit and validation.

| File kind | Limit | Required remediation |
| --------- | ----- | -------------------- |
| `SKILL.md` | 150 | Split routing detail into references or focused subagents |
| `subagents/*.md` | 150 | Split responsibilities or move shared criteria to references |
| `references/*.md` | 250 | Split by topic or shorten just-in-time content |
| `scripts/*` | 25 | Split helpers, use a deterministic tool, or remove unjustified script logic |

## Prompt Sufficiency

Return `skill justified`, `radical simplification`, or `prompt demotion`.

Prompt demotion is plausible only when all are true:

- The task is single-shot.
- No human approval gate is needed.
- No durable artifact or repair loop is needed.
- No specialist role returns a bounded report.
- No mutation boundary or external-effect validation is needed.

If any condition is false, document why the skill machinery is earned.

## Gap Row Contract

Every material gap must include:

- id, severity, type, affected files
- issue and evidence
- required fix
- quality axes affected
- adversarial alternatives: chosen shape, simpler alternative, reuse/extend answer
- priority tier
- diagram delegation: `yes`, `no`, or `conditional`

Every mandate or known problem must appear as a material gap or as
`NO_OP_EVIDENCED` with falsification evidence.
