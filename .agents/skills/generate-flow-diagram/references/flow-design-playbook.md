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

## Scoped and Decomposed Diagrams

Load this section when `DIAGRAM_SCOPE` is `orchestrator` or `subagent`, or for
a `RUN_MODE=decompose` run. The goal of decomposition is measured by what the
root no longer contains, not by how many files exist: a fresh orchestrator
agent should read the root and see only what it needs to decide what to
dispatch next.

### Classification Test

For every node in a whole-package root diagram, ask: *does a fresh orchestrator
agent need this to decide what to dispatch next?*

- **Yes → orchestration-keep.** Phases, banner emission, human and self gates,
  dispatch points, orchestration-level status routing, handoffs, repair-loop
  control, and terminal states stay in the root.
- **No → subagent-internal-extract.** A subagent's internal steps, internal
  checks, internal branches, clusters, or report-section enumeration belong in
  that subagent's localized diagram, tagged with the owning subagent.

### Earned-Decision Contract

Each subagent earns its own localized diagram or is recorded as a no-op.

- **EARNED** when it has at least one of: more than one inspection-dependent
  routeable status; a decision branch that changes which instructions run; a
  repair, retry, or re-dispatch loop; routing between multiple owned outputs;
  or a precondition self-gate that can divert flow.
- **NO_OP_EVIDENCED** when its instructions are a single linear sequence with
  one routeable status, or a localized diagram would have fewer than about four
  nodes. The record must quote a specific instruction, status, or branch as
  evidence.

Either way the root slims: an EARNED subagent's internals move into its
localized diagram; a NO_OP_EVIDENCED subagent's root node is already a single
dispatch reference with no step enumeration.

### Slimming the Root

When authoring a `DIAGRAM_SCOPE=orchestrator` root, drop every
subagent-internal-extract node and collapse each subagent dispatch to a single
node. The dispatch node names the subagent and the routeable statuses the
orchestrator branches on; the surrounding Markdown carries a plain relative
link to that subagent's localized diagram. Never expand a dispatch into the
subagent's step-by-step internals.

### Authoring a Localized Subagent Diagram

A `DIAGRAM_SCOPE=subagent` diagram covers only the named subagent: its entry,
internal decision branches, internal checks or clusters, repair or precondition
self-gates, routeable status emission, and report write. It never restates
orchestrator phases, banners, gates, or another subagent's internals; it
references them only by cross-link.

### No Duplication Across Diagrams

A step, node, check, or status lives in exactly one diagram of a package. Other
diagrams reference it by cross-link, never by copy. Use plain relative Markdown
links for cross-links so they stay portable across runtimes and renderers.
