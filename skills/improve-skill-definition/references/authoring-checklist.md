# Authoring Checklist

Read this file before audit and validation, or when applying a checklist-driven
fix. It is a routing overlay onto the canonical best-practices index, not a
parallel rule set.

The source of truth for authoring rules is
[`../../../docs/best-practices/`](../../../docs/best-practices/README.md). When
the index lists a practice, that doc is the rule; this file does not restate
it. The best-practices-compliance gate
([`best-practices-compliance-gate`](../../../docs/best-practices/best-practices-compliance-gate.md))
governs how audit and validation report per-practice verdicts.

## Audit and Validation Routing

When an audit or validation needs to evaluate a target skill against an
authoring concern, load the named best-practice file and apply its rule
directly.

| Concern | Best-practice doc |
| ------- | ----------------- |
| Naming, frontmatter, directory conventions | [`naming-conventions`](../../../docs/best-practices/naming-conventions.md) |
| Section ordering for `SKILL.md` and subagents | [`structural-conventions`](../../../docs/best-practices/structural-conventions.md) |
| Package directory layout | [`quick-reference-skill-structure`](../../../docs/best-practices/quick-reference-skill-structure.md) |
| `SKILL.md` size, three-level architecture, just-in-time loading | [`progressive-disclosure`](../../../docs/best-practices/progressive-disclosure.md) |
| Identity statement and mental model | [`identity-and-mental-model`](../../../docs/best-practices/identity-and-mental-model.md) |
| Inputs and outputs between pipeline stages | [`input-output-contracts`](../../../docs/best-practices/input-output-contracts.md) |
| Failure categories and reporting | [`escalation-patterns`](../../../docs/best-practices/escalation-patterns.md) |
| When to inline vs. dispatch a subagent | [`subagent-default-execution`](../../../docs/best-practices/subagent-default-execution.md) |
| Keeping raw data out of the orchestrator | [`context-window-protection`](../../../docs/best-practices/context-window-protection.md) |
| Large subagent payloads | [`handoff-file-dispatch`](../../../docs/best-practices/handoff-file-dispatch.md) |
| Long templates and reference data | [`template-extraction`](../../../docs/best-practices/template-extraction.md) |
| Positive vs. negative constraint wording | [`positive-constraint-framing`](../../../docs/best-practices/positive-constraint-framing.md) |
| Mid-document constraint reminders | [`instruction-reinforcement`](../../../docs/best-practices/instruction-reinforcement.md) |
| Concrete examples at every level | [`example-strategy`](../../../docs/best-practices/example-strategy.md) |
| Phase boundaries, fix cycles, retry limits | [`validation-loops`](../../../docs/best-practices/validation-loops.md) |
| Validating by behavior change, not self-report | [`empirical-validation`](../../../docs/best-practices/empirical-validation.md) |
| What to commit, keep local, or delete | [`artifact-lifecycle`](../../../docs/best-practices/artifact-lifecycle.md) |
| Running the per-practice compliance gate | [`best-practices-compliance-gate`](../../../docs/best-practices/best-practices-compliance-gate.md) |

When evaluating a concern not named above, consult the
[best-practices index](../../../docs/best-practices/README.md) directly. If
the concern is not covered there, it is workflow-specific — see the rest of
this file or the relevant subagent contract.

## Material Issue Gate and Improvement Decision Tests

These rules are the
[`earned-complexity`](../../../docs/best-practices/earned-complexity.md) best
practice. Apply that doc directly when sizing a mutation, classifying an
observation, or deciding between patch and rebuild. Two workflow-specific
additions this skill applies on top of the canonical rule:

- Every audit and validation must record a best-practices-compliance verdict
  per practice as part of the gate output.
- A `NO_CHANGE` result must explicitly cite the compliance gate verdicts that
  justify leaving the package unchanged.

## No-Change Report Checks

A `NO_CHANGE` result should include files inspected, evidence that contracts,
paths, mutation boundaries, standalone packaging, and disclosure boundaries
are already adequate, the best-practices-compliance gate result with each
applicable practice and verdict, optional improvements rejected, and
validation limits.
