# Personality as Operating Posture

## What it is

Every non-trivial skill defines its agent's **operating posture** explicitly.
That posture is not a tone layer. It is the contract for *how the agent
operates*: what it notices, how it reasons about the work, what it treats as
risky, how it validates, when it escalates, and how it communicates those
decisions. Use a dedicated `references/personality.md` file when the posture is
long enough, variable enough, or phase-specific enough to earn a separate
artifact.

This is distinct from, and complementary to,
[`identity-and-mental-model`](./identity-and-mental-model.md). An identity
statement is the opening "what is this and how does it reason" paragraph in
`SKILL.md`. An operating posture may live there when it is compact. A
personality file is a separate, named artifact for multi-section posture
contracts that drive execution across phases.

## Why it matters

Two skills can share the same workflow, the same subagents, the same gates,
and the same output contracts, and still produce different work because their
operating postures differ. A "skeptical reviewer" personality and a
"pragmatic maintainer" personality dispatched against the same audit phases
will catch different gaps, prioritize different fixes, and write different
reports. The personality contract is what makes that difference visible,
intentional, and reviewable, instead of being an emergent property of
whatever phrasing made it into `SKILL.md`.

When personality is left implicit:

- **Behavior drifts.** Different runs of the same workflow disagree about
  what to flag, how harsh to be, and when to escalate.
- **Tone and behavior decouple.** The workflow says "be adversarial" in one
  place and "be calm and reviewable" in another, and the agent picks one at
  random per run.
- **The user cannot choose.** A reviewer who wants "future-reader advocate"
  versus "release engineer" has no surface to express that preference and no
  artifact to point at when the result feels wrong.

A named posture fixes all three. When it is a separate file, it is loadable on
demand, auditable, and gives the user a single artifact to approve, replace, or
refine. When it is compact enough for `SKILL.md`, it should still be explicit
and reviewable.

## What an operating posture defines

An operating posture, whether in `SKILL.md` or
`references/personality.md`, should encode each of the following:

- **Identity.** Who the agent is and whose interest it serves. Identity is
  loyalty, not character — "loyalty to the user's improvement" or "loyalty
  to future readers of the commit log," not "is friendly."
- **Operating posture.** What the agent notices first, what it deprioritizes,
  what it treats as risky, and how it reasons through a decision. This is
  the section that drives most runtime behavior.
- **Trade-offs.** The explicit ranking the agent should apply when two
  legitimate goals conflict. For example: "documentation-grade history
  wins over commit count" or "user safety wins over throughput."
- **Voice.** The communication style for reports, questions, and verdicts.
  Tone is a small fraction of personality; it lives here so that the larger
  posture sections do not get conflated with phrasing.
- **Boundaries.** What the personality refuses to do, especially around
  attacking the user, manufacturing problems, or performing strictness when
  the evidence does not support it.

## Required properties

1. **It is explicit and earned.** The posture must be visible in the skill
   package. Keep it in `SKILL.md` when it is short and always relevant. Move it
   to `references/personality.md` when it is multi-section, phase-specific,
   user-selectable, or large enough that always loading it would add noise.

2. **It is workflow-specific.** A posture does not generalize across skills.
   The posture for `committing-scoped-changes` is not the posture for
   `improving-skill-definition`. Generic posture text is a sign of a missing
   operating contract, not a successful one.

3. **It changes runtime behavior, observably.** A posture is only
   meaningful if you can name a decision the agent makes differently under
   this posture than it would under a different one. Postures that
   only change adjectives in the output fail the
   [`earned-complexity`](./earned-complexity.md) test.

4. **It is consistent with the rest of the package.** `SKILL.md`, the flow
   diagram, subagents, and references must agree with the posture's
   operating posture. A "skeptical reviewer" personality paired with a
   workflow that has no human approval gate is a contradiction; a
   "future-reader advocate" personality paired with a planner that emits
   thin commit bodies is a contradiction.

5. **It is approved by the user when the workflow is non-trivial.** For
   skills that mutate packages, generate persistent artifacts, or interact
   with the user across multiple turns, a posture change is a contract
   change. The workflow should give the user an explicit choice between the
   current posture and a small set of alternatives before applying it.

## When it does not apply

Some skills genuinely do not need a separate personality file. Signals that
the file is `NOT_APPLICABLE`:

- The skill is a thin utility wrapper around a single subagent that runs one
  bounded operation (for example, "format a JSON file" or "fetch a ticket").
- The skill has no judgment surface — its behavior is fully determined by
  inputs and a deterministic output contract.
- The skill's identity statement or compact posture in `SKILL.md` is short
  enough to fully describe operating behavior without a separate artifact.

When a reviewer concludes `NOT_APPLICABLE`, they must say so explicitly with
a one-line reason. Silent omission is treated the same as a missing
posture decision.

## Reviewing a posture

When an operating posture is audited or validated, check:

- **Purpose fit.** The identity and posture align with the skill's stated
  purpose.
- **Audience fit.** The voice and posture match the audience the workflow
  serves.
- **Tone safety.** The posture criticizes artifacts, not people. It
  does not insult intelligence, motive, or competence.
- **Workflow fit.** The operating posture maps onto the actual phases,
  gates, and decisions the workflow has.
- **Operating behavior fit.** You can name at least one decision the agent
  makes differently under this posture than under a plausible
  alternative.
- **Consistency.** `SKILL.md`, the flow diagram, subagents, and references
  do not contradict the posture's decision habits, validation
  bias, escalation style, or communication style.

## References

- [`./identity-and-mental-model.md`](./identity-and-mental-model.md) — the
  opening identity statement in `SKILL.md`; this practice is the broader,
  multi-section contract that extends it.
- [`./earned-complexity.md`](./earned-complexity.md) — a personality file
  must change runtime behavior to earn its place.
- [`./progressive-disclosure.md`](./progressive-disclosure.md) — the
  personality file is loaded just-in-time, not always-on.
