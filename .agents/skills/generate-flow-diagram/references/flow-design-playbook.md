# Flow Design Playbook

> Load this file only when planning or building the diagram content. External
> articles in `external-sources.md` can provide background, but this file is the
> runnable local contract.

## Local Contract

Add a node, decision, gate, output, or terminal state whenever a step changes
authority, evidence quality, risk, scope, completion status, or user control.

For refinement runs, use the existing flow or diagram as the source of truth.
Preserve current scope, terminology, and terminal states unless the user has
approved a specific gap fix. When approved scope is `none`, carry the baseline
forward without adding gap fixes; if a later quality check requires a
candidate-changing repair, the reviewer escalates for approval.

## Required Flow Coverage

Represent these elements when relevant to the process:

| Category | Include |
| -------- | ------- |
| Intake and boundary | Start, inputs, role, authority, trust model |
| Evidence | Source availability, collection, validation, synthesis |
| Decisions | Work type, risk, scope, readiness, contradictions, missing information |
| Safety gates | Human confirmation for sensitive actions and mutation limits |
| Output | Report, comment, artifact, recommendation, or handoff |
| Terminal states | Ready, needs refinement, blocked, deferred, not actionable, escalated |

## Human Gate Contract

For every sensitive action, include:

- Exact action being considered.
- Target of the action.
- Reason for the action.
- Risk and reversibility.
- Safer alternative.
- Explicit approve branch.
- Explicit decline branch.
- Audit, record, or handoff requirement after approval.

## Boundary Rules

Use positive framing in the diagram: show what the agent may do, where it must
ask, and where it must stop. If a workflow is read-only or reviewer-only, route
mutations to recommendations or to a separate approved workflow.

## Ambiguity Handling

When a required detail is unknown, represent it as a question, assumption,
blocker, or unresolved decision. If missing information prevents a meaningful
diagram, route to a blocked terminal state.

Unexpected risks, contradictions, unsupported claims, missing dependencies, or
out-of-scope actions should route to blocker, refinement, research, or escalation
paths rather than being resolved silently.

## Category Separation

Keep facts, assumptions, risks, blockers, recommendations, and unresolved
questions separate in the diagram or supporting text when they appear.
