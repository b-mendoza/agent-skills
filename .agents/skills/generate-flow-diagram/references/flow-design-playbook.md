# Flow Design Playbook

Load this file only when planning or building diagram content. It is the local
contract; external sources are optional background.

## Core Rule

Add a node, decision, gate, output, or terminal state only when it changes
authority, evidence quality, risk, scope, completion status, validation, or user
control.

## Required Flow Coverage

| Category | Include When Relevant |
| -------- | --------------------- |
| Intake and boundary | Start, inputs, role, authority, trust model, mutation limits |
| Evidence | Source availability, collection, validation, synthesis |
| Decisions | Work type, risk, scope, readiness, contradictions, missing information |
| Safety gates | Human confirmation for sensitive actions and file mutation |
| Validation | Independent gates, script/tool checks, reviewer verdicts, repair loop |
| Output | Report, comment, artifact, recommendation, handoff, or written files |
| Terminal states | Ready, blocked, needs input, needs confirmation, write error, repair limit |

## Human Gate Contract

For every sensitive action, include the action, target, reason, risk and
reversibility, safer alternative, explicit approve branch, explicit decline
branch, and audit/handoff requirement after approval.

In decompose mode, the decomposition plan approval is a mandatory human mutation
gate unless the user explicitly supplied `DECOMPOSE_PLAN_APPROVAL=auto`. Even
under `auto`, the plan summary reaches the user and the run report records the
approval path.

## Boundary Rules

Frame diagrams positively: show what the agent may do, where it asks, and where
it stops. Read-only workflows route mutations to recommendations or separately
approved workflows. Decompose writes are shown as a batch after all staged
candidates pass review, never as per-diagram writes.

## Ambiguity Handling

Represent unknown required details as questions, assumptions, blockers, or
unresolved decisions. Contradictions, unsupported claims, missing dependencies,
or out-of-scope actions route to blocker, refinement, research, or escalation
paths; they are not resolved silently.

## Scoped And Decomposed Diagrams

Load this section when `DIAGRAM_SCOPE` is `orchestrator` or `subagent`, or when
`RUN_MODE=decompose`.

### Classification Test

For every node in a whole-package root diagram, ask whether a fresh orchestrator
agent needs this node to decide what to dispatch next.

- Yes: `orchestration-keep`. Keep phases, banners, human/self gates, dispatch
  points, status routing, handoffs, repair-loop control, and terminal states.
- No: `subagent-internal-extract`. Move subagent internal steps, checks,
  branches, clusters, report sections, and self-gates into the owning subagent's
  localized diagram.

### Earned Localized Diagram

`EARNED` means the subagent has at least one inspection-dependent routeable
status, a decision branch that changes instructions, a repair or retry loop,
multiple owned outputs, or a precondition self-gate. Quote evidence.

`NO_OP_EVIDENCED` means the subagent is a single linear sequence with one
routeable status, or a localized diagram would have fewer than about four nodes.
Quote evidence and do not create a localized diagram.

### Slim Root

An orchestrator root shows only routing. Each subagent dispatch is one node that
names the subagent, routeable statuses, and a plain relative link to the
localized diagram when one exists. It never expands subagent internals.

### Localized Subagent

A subagent diagram covers one subagent's entry, internal branches, checks,
self-gates, status emission, and report write. It references the root by plain
relative link and does not restate root phases, gates, or sibling internals.

### No Duplication

A step, node, check, or status lives in exactly one diagram of a package. Other
diagrams cross-link instead of copying. Contradictory or paraphrased copies are
quality-gate failures.
