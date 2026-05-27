# Positive Constraint Framing

## What it is

When defining behavioral boundaries, tell the agent what it IS allowed to do
rather than listing what it must not do. Name the permitted tools and actions
explicitly, then state that everything else is a delegation.

## Why it matters

Anthropic's official prompting guidance recommends telling Claude what to do
instead of what not to do for output control and formatting. Treat positive
constraint framing as prompt guidance, not as enforcement. It improves the
agent's working model of the allowed path, but tool permissions, mutation
scope, validation, and runtime controls still carry the hard boundary.

Current evidence supports a narrower claim:

- **Positive framing is a useful steering pattern.** Anthropic's current
  prompting guide says positive examples and "what to do" instructions can be
  more effective than negative examples or "what not to do" instructions for
  output control. This supports the style of the practice, not a guarantee of
  adherence.
- **Agent safety benchmarks caution against overconfidence.** A lightweight
  benchmark of six LLMs found that hierarchical safety principles can
  influence behavior, but also found cost-of-compliance and
  illusion-of-compliance effects (arXiv:2506.02357). That challenges any claim
  that phrasing alone is reliably sufficient.
- **Prohibition is not enforcement.** In one sandboxed impossible-quiz setup,
  some frontier models violated explicit prohibitions despite being told they
  were monitored (arXiv:2507.02977). This supports adding runtime controls and
  validation around constraints; it does not prove that every negative
  instruction backfires.
- **Positive framing preserves intent.** Telling the agent "you use only Agent
  and Read" achieves the same boundary as "you must not use Bash, Grep, Write,
  Edit" — but without the negation risks.

## Example: Positive vs negative constraint

```markdown
# Negative (avoid)

The orchestrator MUST NOT directly call Read, Bash, Grep, Glob, Write, or
Edit. All tool use is delegated to subagents via the Agent tool.

# Positive (prefer)

The only tools the orchestrator calls directly are Agent (to dispatch
subagents) and Read (limited to loading skill, subagent, and reference
files). Every other operation is a dispatch to the appropriate subagent.
```

Both define the same boundary. The positive version names what IS permitted
(Agent, Read with exceptions) and states that everything else is a dispatch —
achieving specificity without relying on negation.

## When explicit restrictions still help

Pure positive framing works for design intent and identity. However, if
empirical testing shows the agent still deviates, brief reminders that name
the boundary can reinforce it at the violation point. The key is to lead with
the positive framing, enforce the boundary with tools or review gates when
possible, and add reinforcement where testing shows it helps.

## Reconciling Positive and Negative Framing

Primary definitions and brief reminders serve different cognitive purposes and
should use different framing styles intentionally:

- **Primary definitions** (SKILL.md, identity sections): Use positive framing.
  These shape the agent's understanding of its role over a long context
  window. Anthropic's guidance applies directly here: "you use only Agent and
  Read" builds a clearer allowed-path model than "you must not use Bash, Grep,
  Write, Edit." Instruction-hierarchy research (arXiv:2511.04694) is relevant
  to conflict resolution between higher- and lower-priority instructions, but
  it is not direct evidence that every prose identity statement improves
  adherence.

- **Brief reminders** (1-3 line blockquotes in reference files): Naming
  forbidden tools explicitly is acceptable when it creates useful friction at
  the violation point. This is a heuristic, not a directly proven effect:
  current positive/negative framing evidence mainly concerns primary
  instructions, not short reminders inside reference files. Use reminders when
  they are local, brief, and validated against real runs.

This is a hybrid, not an inconsistency. Positive framing answers "what am I?"
(identity). Specific tool names in reminders answer "wait, should I be doing
this?" (friction). Both layers reinforce the same boundary through
complementary mechanisms.

## References

- Anthropic Claude prompting best practices — official docs, accessed
  2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>
- Agent adherence to hierarchical safety principles — arXiv:2506.02357,
  revised 2025-07-10:
  <https://arxiv.org/abs/2506.02357>
- Misalignment under explicit prohibition and surveillance — arXiv:2507.02977,
  submitted 2025-06-30:
  <https://arxiv.org/abs/2507.02977>
- Reasoning up the instruction ladder — arXiv:2511.04694, revised
  2026-02-18:
  <https://arxiv.org/abs/2511.04694>
