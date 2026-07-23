# earned-complexity

## Tier

`recommended`. Earned complexity is the meta-lens through which every
other practice is applied; routinely violating it produces over-
engineered packages, but it does not by itself cause unsafe runtime
behavior.

## When it applies

Before approving any addition to a skill — a new subagent, a new
reference file, a new output-contract field, a new validation gate,
a new external link, or a new layer of indirection — and during any
audit that asks whether existing complexity is earned.

## The practice

Every instruction, file, subagent, reference, script, and external
URL in a skill package must earn its place by changing runtime
behavior or maintainability in a concrete, observable way.

A package is not better because it has more parts; it is better
because each part it has makes the next run more reliable, more
portable, more compact, more maintainable, more verifiable, more
understandable, or more compliant with a named best practice.

**Is a skill the right artifact?** Before authoring a new skill,
choose the smallest artifact that fits the behavior:

- If the behavior does not recur, handle it directly instead of
  creating a reusable package.
- If the behavior is fully deterministic, prefer a script.
- If the need is stable information without reusable judgment or
  orchestration, prefer a reference document.
- If an existing skill already owns the trigger or workflow, extend
  that skill rather than creating an overlapping one.
- Create a new skill when the behavior recurs and needs reusable
  judgment, orchestration, or a distinct invocation contract.

**Material Issue Gate.** Make a change only when it fixes a
concrete problem in one of:

- **Reliability** — the package executes more deterministically.
- **Portability** — the package runs on a target runtime it could
  not run on before, or stops depending on a runtime-specific
  behavior.
- **Standalone packaging** — the package no longer relies on
  absolute paths, sibling packages, private config, or unavailable
  files at runtime.
- **Context efficiency** — the orchestrator loads less while still
  making every required decision.
- **Maintainability** — future changes are observably easier to
  make correctly.
- **Validation** — there is a new observable check that catches a
  previously silent failure mode.
- **User comprehension** — a reader of the package can answer "what
  does this do and why" faster.
- **Best-practices compliance** — a `fail` verdict from the
  [best-practices compliance gate](./best-practices-compliance-gate.md)
  becomes a `pass` or a documented declared exception.

Leave the package unchanged when proposed edits would only rename,
reshuffle, or polish content without changing one of those
dimensions.

**Improvement Decision Tests.** Before approving any mutation, run
these tests. If any answer argues against the edit, prefer
`NO_CHANGE` or a smaller fix.

- Would the change make the skill more reliable, portable,
  standalone, compact, maintainable, verifiable, understandable, or
  compliant with a named best practice in a concrete way?
- Would deleting the proposed change make future runs worse?
- Does each subagent return something the orchestrator needs only as
  a bounded verdict or summary, or could the work be inlined without
  harm?
- Is the content being moved into a reference file genuinely just-
  in-time, or is it only being moved to make the package look more
  architected?
- Is all content required for the base runtime path available offline,
  with external URLs limited to provenance, background, or declared
  freshness re-checks?
- Is there an observable validation check for the claimed
  improvement, or does the improvement rest on self-report?
- Does the change resolve a named gap or `fail` verdict, or is it
  speculative?

**When to recommend rebuild.** Prefer the smallest correct change
when the structure is sound. Recommend rebuilds, subagent removals,
merges, phase collapses, or diagram recreation when the evidence
shows the current workflow is fundamentally flawed.

Signals that argue for rebuild rather than patch:

- The flow-diagram, `SKILL.md`, and subagents disagree on phases,
  gates, or statuses in ways that cannot be reconciled by surface
  edits.
- Multiple subagents return overlapping or redundant verdicts, with
  no distinct downstream consumer.
- The package's stated value model is contradicted by its execution
  contracts.
- The validator and the workflow's own gates fail to catch the
  package's central failure mode.

## Rationale

Skill packages drift toward over-engineering. Subagents get added
because "it looks more architected." Reference files get extracted
because "we should use progressive disclosure." Output contracts grow
extra fields because "we might need this later." Each unjustified
addition has a cost: more context to load, more files to keep in
sync, more boundaries to fail across, more surface area for drift.
When complexity is not earned, it actively degrades the package over
time.

The corollary is also true: salvageable skills should be patched
with the smallest correct change; fundamentally broken skills should
be recommended for rebuild rather than preserved by accumulation.

## Concrete examples

Good: an audit decides not to extract a 50-line registry because
extraction would not save context (the registry is consulted on every
run anyway).

```markdown
Decision: NO_CHANGE on the subagent registry.

Reasoning:

- Extraction to `references/subagent-registry.md` would load the same
  ~50 lines on every run, just from a second file.
- No improvement in context efficiency, maintainability, or
  reliability.
- The Material Issue Gate fires no dimension; leave the registry in
  SKILL.md.
```

Bad: an audit recommends extracting the registry "for progressive
disclosure" without showing any observable improvement.

```markdown
Recommendation: extract the subagent registry to
`references/subagent-registry.md`.

Reasoning:

- Progressive disclosure is a best practice; we should apply it.
- (No dimension cited; no observable improvement; the orchestrator
  now reads the same content from a second file.)
```

## References

- Don't Repeat Yourself / KISS / YAGNI — Andy Hunt and Dave Thomas,
  _The Pragmatic Programmer_, accessed 2026-06-03:
  <https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/>.
  Supports the general principle that unjustified complexity is the
  default failure mode.
- Martin Fowler, "YAGNI," accessed 2026-06-03:
  <https://martinfowler.com/bliki/Yagni.html>. Supports refusing
  speculative complexity.
