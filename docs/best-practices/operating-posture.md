# operating-posture

## Tier

`recommended`. Required for non-trivial skills where decision
behavior matters more than tone; thin utility skills do not need a
posture.

## When it applies

For every non-trivial skill, especially audit, validation, review,
planning, refactoring, and orchestration skills whose decisions are
shaped by which signals they notice and how they trade off competing
goals.

## The practice

Every non-trivial skill defines its operating posture explicitly.
This is not a tone layer; it is the contract for how the agent
operates.

An operating posture should define:

- **Identity:** whose interest the agent serves.
- **Operating posture:** what it notices first, deprioritizes,
  treats as risky, and how it reasons through decisions.
- **Trade-offs:** how it ranks legitimate goals when they conflict.
- **Voice:** communication style for reports, questions, and
  verdicts.
- **Boundaries:** what the posture refuses to do.

Keep the posture in `SKILL.md` when it is short and always relevant.
Move it to `references/personality.md` when it is multi-section,
phase-specific, user-selectable, or large enough that always loading
it would add noise. A posture earns its place only when it changes
runtime behavior observably; if it only changes adjectives, it fails
the [earned complexity](./earned-complexity.md) test.

## Rationale

A skill without an explicit posture inherits whatever the runtime
defaults to. The default tends toward agreeable, accommodating, and
risk-averse — fine for a translator, hostile to the purpose of an
adversarial auditor whose job is to falsify a workflow. The posture
makes the contract visible: this role pushes back, this role refuses
to widen scope, this role treats the producer's output as suspect.

The "earned by observable behavior" rule is the load-bearing one. A
posture that says "be careful and thorough" without changing any
concrete decision the agent makes is decoration. A posture earns its
place when it changes which signal the agent notices first, which
trade-off it picks under conflict, or what it refuses to do.

## Concrete examples

Good: posture names identity, behavior, voice, and boundaries; each
bullet is a behavior, not an adjective.

```markdown
# In skills/improving-skill-definition/references/personality.md

## Identity

You are a harsh friend, skeptical investor, and educator for skill
workflows. Your loyalty is to the user's improvement, not the
existing design.

## Operating Posture

1. Treat the current package as a baseline, not a boundary.
2. Falsify the workflow before preserving it.
3. Prefer the smallest correct fix for a salvageable design.

## Voice

Be direct, specific, and educational. Name the failure mode: fake
subagent boundary, decorative gate, ambiguous phase.
```

Bad: posture restates tone adjectives without changing any
observable behavior.

```markdown
## Personality

Be friendly, thorough, and detail-oriented. Care about quality.
Always be helpful to the user.
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports role and posture prompting as prompt-design tools.
- Agent adherence to hierarchical safety principles —
  arXiv:2506.02357:
  <https://arxiv.org/abs/2506.02357>. Supports the importance of
  explicit instruction hierarchy in agents.
