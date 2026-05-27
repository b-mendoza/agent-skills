# Earned Complexity

## What it is

Every instruction, file, subagent, reference, script, and external URL in a
skill package must earn its place by changing runtime behavior or
maintainability in a concrete, observable way. A package is not better
because it has more parts; it is better because each part it has makes the
next run more reliable, more portable, more compact, more maintainable, more
verifiable, more understandable, or more compliant with a named best practice.

## Why it matters

Skill packages drift toward over-engineering. Subagents get added because
"it looks more architected." Reference files get extracted because "we should
use progressive disclosure." Output contracts grow extra fields because "we
might need this later." Each unjustified addition has a cost: more context to
load, more files to keep in sync, more boundaries to fail across, more
surface area for drift. When complexity is not earned, it actively degrades
the package over time.

The corollary is also true: salvageable skills should be patched with the
smallest correct change; fundamentally broken skills should be recommended
for rebuild rather than preserved by accumulation.

## The Material Issue Gate

Make a change only when it fixes a concrete problem in one of:

- **Reliability** — the package executes more deterministically.
- **Portability** — the package runs on a target runtime it could not run on
  before, or stops depending on a runtime-specific behavior.
- **Standalone packaging** — the package no longer relies on absolute paths,
  sibling packages, private config, or unavailable files at runtime.
- **Context efficiency** — the orchestrator loads less while still making
  every required decision.
- **Maintainability** — future changes are observably easier to make
  correctly.
- **Validation** — there is a new observable check that catches a previously
  silent failure mode.
- **User comprehension** — a reader of the package can answer "what does this
  do and why" faster.
- **Best-practices compliance** — a `fail` verdict from the
  [Validation and Escalation](./validation-and-escalation.md) compliance gate
  becomes a `pass` or a documented declared exception.

Leave the package unchanged when proposed edits would only rename, reshuffle,
or polish content without changing one of those dimensions.

## Improvement Decision Tests

Before approving any mutation to a skill, run these tests. If any answer
argues against the edit, prefer `NO_CHANGE` or a smaller fix.

- Would the change make the skill more reliable, portable, standalone,
  compact, maintainable, verifiable, understandable, or compliant with a
  named best practice in a concrete way?
- Would deleting the proposed change make future runs worse?
- Does each subagent return something the orchestrator needs only as a
  bounded verdict or summary, or could the work be inlined without harm?
- Is the content being moved into a reference file genuinely just-in-time,
  or is it only being moved to make the package look more architected?
- Can the package still run without fetching external URLs?
- Is there an observable validation check for the claimed improvement, or
  does the improvement rest on self-report?
- Does the change resolve a named gap or `fail` verdict, or is it
  speculative?

## When to recommend rebuild

Prefer the smallest correct change when the structure is sound. Recommend
rebuilds, subagent removals, merges, phase collapses, or diagram recreation
when the evidence shows the current workflow is fundamentally flawed — not
out of politeness, sunk cost, or fear of saying the package is badly
designed.

Signals that argue for rebuild rather than patch:

- The flow-diagram, `SKILL.md`, and subagents disagree on phases, gates, or
  statuses in ways that cannot be reconciled by surface edits.
- Multiple subagents return overlapping or redundant verdicts, with no
  distinct downstream consumer.
- The package's stated value model is contradicted by its execution
  contracts (for example, "durable commit history" with no structured commit
  body).
- The validator and the workflow's own gates fail to catch the package's
  central failure mode.

## Pairing with other practices

This rule is the lens through which every other best practice is applied.
Progressive disclosure is not a mandate to extract files; it is permission to
extract when extraction earns its place. Subagent-default execution is not a
mandate to dispatch; it is a two-question test that dispatch must pass.
Template extraction has explicit "when NOT to extract" guidance for the same
reason. Earned complexity is the default; ornament is the failure mode.

## References

- [Validation and Escalation](./validation-and-escalation.md)
  — the gate that this rule reinforces.
- [Validation and Escalation](./validation-and-escalation.md) — why observable
  evidence is required to call a change an improvement.
- [Context and Payload Management](./context-and-payload-management.md) — extraction is
  permitted, not required; this rule decides which extractions earn their
  place.
- [`./subagent-default-execution.md`](./subagent-default-execution.md) — the
  per-step two-question test is one application of earned complexity.
