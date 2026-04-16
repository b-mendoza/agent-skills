# Positive Constraint Framing

## What it is

When defining behavioral boundaries, tell the agent what it IS allowed to do
rather than listing what it must not do. Name the permitted tools and actions
explicitly, then state that everything else is a delegation.

## Why it matters

Anthropic's official prompting guidance recommends "tell Claude what to do
instead of what not to do." Research supports this across multiple dimensions:

- **Positive framing improves agent constraint adherence.** In agentic safety
  evaluations, positively framed principles achieved near-perfect adherence
  across all models, while negatively framed principles showed high variance
  (arXiv:2506.02357, ICML 2025 Technical Governance Workshop).
- **Prohibition can backfire.** Models under goal-directed pressure violate
  explicit prohibitions even when told they are under surveillance
  (arXiv:2507.02977). Practitioner analysis of the "Pink Elephant Problem"
  (eval.16x.engineer, anecdotal — no controlled experiments) suggests that
  suppressing a concept ("MUST NOT call Bash") may activate it.
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
the positive framing and add reinforcement only where proven necessary.

## Reconciling Positive and Negative Framing

Primary definitions and brief reminders serve different cognitive purposes and
should use different framing styles intentionally:

- **Primary definitions** (SKILL.md, identity sections): Use positive framing.
  These shape the agent's understanding of its role over a long context
  window. Anthropic's guidance and the reasoning research (arXiv:2511.04694)
  apply here — "you use only Agent and Read" builds a clearer mental model
  than "you must not use Bash, Grep, Write, Edit."

- **Brief reminders** (1-3 line blockquotes in reference files): Naming
  forbidden tools explicitly is acceptable and may be more effective. The
  agent adherence research (arXiv:2506.02357) and practitioner analysis of
  the Pink Elephant Problem studied primary instructions, not short
  reinforcement triggers. A reminder's job is to
  create friction at the moment the agent is about to reach for a tool it
  shouldn't — and naming that tool ("does not call Bash") fires precisely at
  that moment. The reminder is too short for the "Lost in the Middle" effect
  to dilute, and too brief for ironic process theory to activate sustained
  attention on the forbidden concept.

This is a hybrid, not an inconsistency. Positive framing answers "what am I?"
(identity). Specific tool names in reminders answer "wait, should I be doing
this?" (friction). Both layers reinforce the same boundary through
complementary mechanisms.

## References

- Anthropic Claude prompting best practices — official docs (2025-2026)
- Agent constraint adherence under positive/negative framing — arXiv:2506.02357,
  ICML 2025 Technical Governance Workshop
- Misalignment under prohibition — arXiv:2507.02977 (2025)
- Pink Elephant Problem — eval.16x.engineer (2025, practitioner anecdote)
