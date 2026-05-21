# Flow Design Playbook

> Load this file only when planning or building the diagram content. External
> articles in `external-sources.md` can provide rationale, but this file is the
> runnable local contract.

## Core Model

A useful agent-flow diagram is an operating contract, not decoration. Include a
node, decision, gate, output, or terminal state whenever a step changes trust,
scope, safety, evidence quality, completion status, or user authority.

## Required Flow Coverage

Represent these elements when relevant to the process:

- Start or intake.
- Boundary, authority, and trust model.
- Context snapshot or input collection.
- Access or evidence availability decision.
- Classification by work type, risk, scope, or readiness category.
- Validation checks for objective, success proof, affected parties, scope, dependencies, risks, evidence, technical claims, alternatives, priority, and need for spike, review, research, or escalation.
- Evidence synthesis.
- Decisions for contradictory evidence, invalid claims, missing information, oversized scope, dependencies, and escalation.
- Human confirmation gates for sensitive actions.
- Output, report, comment, or artifact drafting.
- Final readiness or completion decision.
- Terminal states such as ready, needs refinement, blocked, deferred, not actionable, or escalated.

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

Separate these categories in the diagram or supporting text when they are
present: facts, assumptions, risks, blockers, recommendations, and unresolved
questions.
