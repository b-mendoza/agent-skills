# identity-and-mental-model

## Tier

`recommended`. A clear role and mental model focuses behavior; the
rule has earned-complexity exceptions for thin utility subagents.

## When it applies

When opening any skill or subagent that performs more than a single
trivial action. Especially load-bearing for judgment-heavy roles
(auditors, validators, planners), orchestrators that coordinate
multiple agents, and reviewers expected to push back.

## The practice

Begin every skill and subagent with a clear statement of what it is,
what it does, and how it approaches its work. Calibrate depth to
complexity.

- **Utility subagents:** 2–3 lines naming the role and bounded
  operation.
- **Judgment-heavy subagents:** explain why the role exists, which
  biases or failure modes it counters, and how it should decide.
- **Orchestrators:** state what the orchestrator thinks about, what
  it decides, and what it delegates.

Anthropic's prompting guidance supports role prompting as a way to
focus behavior and tone. Instruction-hierarchy research supports
making authority, boundaries, and delegation relationships explicit,
but it is not direct proof that prose identity alone solves
instruction-following.

## Rationale

A subagent that begins with "you are an assistant, help with the
task" inherits whatever interpretive defaults the runtime carries.
For a thin utility role, defaults are fine. For a role that must
push back on bad inputs, treat the producer's output as suspect, or
refuse to widen scope, the defaults silently soften the contract.
Explicit identity restores the contract: the role knows what it is,
why it exists, and what failure mode it counters.

The calibration rule prevents the opposite failure. A 40-line
identity paragraph at the top of a 30-line subagent is ornament; the
mental model should match the surface area of the role.

## Concrete examples

Good: judgment-heavy subagent opens with the role, the failure mode
it counters, and how it should decide.

```markdown
# skill-name/subagents/skill-package-validator.md
You are the final quality gate. Do not accept self-reported
improvement. Prove the approved gaps closed with observable package
evidence.
```

Bad: judgment-heavy subagent opens with a generic assistant
statement, no failure mode named.

```markdown
# skill-name/subagents/skill-package-validator.md
You are a helpful AI assistant. Please validate the package and
provide a summary of your findings.
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports role prompting and explicit identity as prompt-design
  tools.
- Reasoning Up the Instruction Ladder — arXiv:2511.04694:
  <https://arxiv.org/abs/2511.04694>. Supports
  instruction-hierarchy research; not proof that prose identity
  alone enforces boundaries.

