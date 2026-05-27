# Quality Gates for Critical Outputs

## What it is

A skill that produces outputs other components rely on must include explicit
quality gates that validate those outputs before they propagate. When a gate
fails, the skill enters a targeted fix loop until the gate passes or a retry
cap is reached. The skill author decides which outputs are critical and
declares them in `SKILL.md`; declared critical outputs without a named gate
are an error.

## Why it matters

LLM outputs can be confidently wrong. A subagent can write "1 + 1 = 9" with
the same fluency it writes "1 + 1 = 2," and the orchestrator has no way to
tell the difference from the text alone. Without an explicit gate, that
incorrect output becomes input to the next phase, and every downstream
computation reasons from a poisoned premise. The failure is not the wrong
output — that is recoverable. The failure is the absence of the check that
would have caught it.

Three concrete consequences in practice:

**Silent poisoning.** A subagent that summarizes a Jira ticket and
hallucinates the priority field hands the orchestrator a clean-looking
structured payload with one field wrong. Every later phase that branches on
priority routes incorrectly. The user sees a workflow that finished
"successfully" with the wrong outcome.

**Self-report is not validation.** A subagent that says "I checked the
output" is offering a claim about its own behavior, not evidence about the
output. The same generator that produced the wrong answer is rarely the right
auditor for it. See [Empirical Validation over
Self-Report](./empirical-validation.md) for the broader form of this rule.

**Hidden gates are decorative gates.** Gates that are listed in `SKILL.md`
but never surface in the user-facing handoff cannot be audited. The user
cannot tell whether the gate ran, what it checked, or whether it actually
passed.

## Rules

1. **Each skill declares its critical outputs in `SKILL.md`.** A "Critical
   Outputs" section (or an equivalent named surface — a row in a contract
   table, an entry in the Output Contract, etc.) lists the outputs whose
   correctness downstream consumers depend on. Outputs not listed are
   treated as non-critical and do not require gates.

2. **Each declared critical output has a named gate.** The gate has a unique
   identifier (`G_<NAME>`, e.g., `G_TICKET_FETCH`, `G_PLAN_COMPLETENESS`,
   `G_ATOMIC_HISTORY`) and a verdict set (typically `pass | fail`, sometimes
   extended with `not-applicable` or `blocked`).

3. **Gates are checked by something other than the output's producer.** The
   producing subagent's self-report does not count as a gate verdict. A
   separate validator — a different subagent, an inline structural check, an
   external tool — reads the output and assigns the verdict. This is the
   same separation the orchestrator-vs-subagent contract enforces at the
   architectural level, applied to validation.

4. **Gate failure triggers a bounded fix loop.** When a gate fails, the
   workflow re-runs the producing phase with the validator findings as
   additional input. The number of repair cycles is bounded (typically three);
   after the bound is reached, the workflow returns a blocked handoff with
   the failed checks, the attempted repairs, and the remaining risks. See
   [Validation Loops](./validation-loops.md) for the canonical structure.

5. **Gate verdicts and evidence appear in the final handoff.** The user-facing
   handoff names which gates ran, which passed, which failed, and the
   evidence supporting each verdict (a file path plus line range, a quoted
   snippet, a tool exit code, a one-line reason for `not-applicable`).
   Hidden gates are decorative gates.

6. **A skill that produces critical outputs without a gate is incomplete.**
   The audit and validation phases of [Best-Practices Compliance as a Quality
   Gate](./best-practices-compliance-gate.md) treat missing gates on declared
   critical outputs as a `fail` verdict and a material gap.

## Example

`committing-scoped-changes` declares atomic-commit history as a critical
output and protects it with the `G_ATOMIC_HISTORY` gate. The gate is checked
by `scoped-commit-executor`'s artifact verification step (a separate phase
from the planner that proposed the commits) and has six enumerated observable
checks. On gate failure, the workflow re-enters the planning phase with the
failed-check evidence, up to a cap of three replan cycles, before escalating
to a human gate.

`orchestrating-jira-workflow` declares preflight and postcondition artifacts
as critical at each phase and protects them with dispatches to
`artifact-validator` (a dedicated subagent), with the gate verdict surfaced
in every phase's progress update.

## When it is overkill

- Prose summaries written for the user with no downstream programmatic
  consumer.
- Recommendations and opinions that the user will weigh themselves; a gate
  that checks "is this a good opinion" is a category error.
- Single-step utility skills with one execution path and no internal handoff
  between phases; the user is the validator.

## References

- [Empirical Validation over Self-Report](./empirical-validation.md) — the
  broader principle that validation requires observed behavior, not claims.
- [Validation Loops](./validation-loops.md) — phase boundaries, fix cycles,
  retry limits; the canonical structure for gate-failure repair.
- [Escalation Patterns](./escalation-patterns.md) — failure categories and
  reporting formats when gates fail beyond their retry cap.
- [Best-Practices Compliance as a Quality Gate](./best-practices-compliance-gate.md)
  — the meta-gate that audits whether a skill itself follows this practice.
