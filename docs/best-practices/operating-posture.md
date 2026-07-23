# operating-posture

## Tier

`recommended`. Non-trivial roles benefit when their decision policy
is explicit; thin utility roles with no meaningful judgment do not need
one.

## When it applies

For non-trivial skills and subagents, especially audit, validation,
review, planning, refactoring, and orchestration roles whose outcomes
depend on attention order, competing goals, or refusal boundaries.

## The practice

This practice owns decision policy and trade-offs. The opening role
statement itself is owned by
[identity-and-mental-model](./identity-and-mental-model.md).

Define the role's downstream operating policy:

- **Attention order:** what it notices or verifies first, and what it
  deliberately deprioritizes.
- **Trade-offs:** how it ranks legitimate goals when they conflict.
- **Risk and refusals:** what it treats as unacceptable and what it
  refuses to approve or do.
- **Voice:** how it communicates questions, evidence, uncertainty, and
  verdicts.

A posture earns its place only when it changes an observable decision:
which signal is checked first, which trade-off wins under conflict, or
what the role refuses. For every posture bullet, name the decision it
changes. If a bullet changes only adjectives, delete it.

Keep a short, always-relevant posture in `SKILL.md` or the subagent
contract. Move a long, phase-specific, or selectable posture to a
focused reference file with an explicit load condition.

## Rationale

General-purpose runtime behavior tends toward agreeable,
accommodating, and risk-averse choices. That is useful for many tasks
but can defeat an adversarial auditor, validator, or reviewer whose job
is to falsify claims, preserve scope, or withhold approval. An explicit
posture makes those downstream choices inspectable instead of leaving
them to generic defaults.

The observable-decision rule is load-bearing. "Be careful and
thorough" does not tell an agent whether to trust a producer's summary,
inspect evidence first, preserve a flawed design, or block approval.
Decision-bearing bullets do.

## Concrete examples

Good: every bullet names a decision that changes behavior.

```markdown
## Operating Posture

1. Check observable package evidence before reading the producer's
   self-assessment.
2. When preserving the current design conflicts with closing a
   confirmed gap, close the gap; minimize edits only after correctness.
3. Refuse approval when a required claim lacks observable evidence.
4. State the verdict first, then the evidence and remaining uncertainty.
```

The bullets change, respectively, the first signal, the conflict
ranking, the refusal boundary, and the reporting voice.

Bad: adjectives change tone without selecting any action or verdict.

```markdown
## Operating Posture

Be friendly, thorough, detail-oriented, and passionate about quality.
Always be helpful and professional.
```

## References

- Anthropic Claude prompting best practices, accessed 2026-07-22:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports explicit behavioral instructions, motivation, communication
  style, success criteria, and reversibility-based action boundaries.
  It does not by itself prove a universal default posture for every
  runtime.
