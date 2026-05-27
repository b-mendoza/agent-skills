# Behavioral Prompt Contract

## What it is

Define how a skill or subagent describes its role, operating posture,
constraints, reminders, and examples. This practice replaces the former
standalone guidance for identity and mental model statements, personality as
operating posture, positive constraint framing, instruction reinforcement, and
example strategy.

## Why it matters

Skill behavior is not determined only by steps and tools. The opening role,
decision posture, examples, and local reminders shape what the agent notices,
how it interprets authority, how it handles ambiguity, and which boundaries it
respects. The behavioral contract makes those choices explicit and reviewable.

## Identity and mental model

Begin every skill and subagent with a clear statement of what it is, what it
does, and how it approaches its work.

Calibrate depth to complexity:

- **Utility subagents:** 2-3 lines naming the role and bounded operation.
- **Judgment-heavy subagents:** explain why the role exists, which biases or
  failure modes it counters, and how it should decide.
- **Orchestrators:** state what the orchestrator thinks about, what it decides,
  and what it delegates.

Anthropic's prompting guidance supports role prompting as a way to focus
behavior and tone. Instruction-hierarchy research supports making authority,
boundaries, and delegation relationships explicit, but it is not direct proof
that prose identity alone solves instruction-following.

## Operating posture

Every non-trivial skill defines its operating posture explicitly. This is not a
tone layer; it is the contract for how the agent operates.

An operating posture should define:

- **Identity:** whose interest the agent serves.
- **Operating posture:** what it notices first, deprioritizes, treats as risky,
  and how it reasons through decisions.
- **Trade-offs:** how it ranks legitimate goals when they conflict.
- **Voice:** communication style for reports, questions, and verdicts.
- **Boundaries:** what the posture refuses to do.

Keep the posture in `SKILL.md` when it is short and always relevant. Move it to
`references/personality.md` when it is multi-section, phase-specific,
user-selectable, or large enough that always loading it would add noise. A
posture earns its place only when it changes runtime behavior observably; if it
only changes adjectives, it fails the earned-complexity test.

## Positive constraint framing

When defining behavioral boundaries, name what the agent is allowed to do
before naming what it should avoid.

Example:

```markdown
The only tools the orchestrator calls directly are Agent and Read, limited to
loading skill, subagent, and reference files. Every other operation is a
dispatch to the appropriate subagent.
```

Positive framing is prompt guidance, not enforcement. Tool permissions,
mutation scopes, validation gates, and runtime controls still carry hard
boundaries. Use explicit restrictions when safety, permission, or mutation
boundaries need enforcement, but lead with the allowed path so the agent has a
clear working model.

## Instruction reinforcement

Repeat critical constraints briefly at strategic points in long documents when
the risk justifies it.

Rules:

1. State the primary constraint in `SKILL.md`.
2. Add 1-3 line reminders at the top of long or risky reference files.
3. Keep reminders short.
4. Do not repeat in every file.
5. For safety-critical, permission-sensitive, or mutation-sensitive
   boundaries, verify that the reminder changes behavior or catches a real
   failure mode.

This is a risk-based heuristic. Long-context retrieval research and prompt
repetition studies indirectly support the concern that repeated information can
matter, but they do not prove that every mid-document reminder improves agent
behavior.

## Examples

Use examples where they reduce ambiguity: format-sensitive outputs,
judgment-heavy decisions, edge cases, and cross-agent handoffs.

For format-sensitive or judgment-heavy skills, include:

1. **Dispatch round-trip example:** input, dispatch, subagent output, and
   orchestrator decision.
2. **Output format example:** exact structure with realistic data.
3. **Edge/failure example:** partial failure, blocked state, or unexpected
   input.

For thin utility skills, use the smallest example set that removes real
ambiguity. One realistic input/output example is enough when there is no
branching, subjective judgment, or special failure mode.

Examples should reinforce the role and posture, show the preferred allowed
behavior before edge cases, and avoid burying critical constraints.

## References

- [Earned Complexity](./earned-complexity.md) — posture files and examples must
  change behavior or maintainability enough to earn their place.
- [Context and Payload Management](./context-and-payload-management.md) — long
  examples and posture files should load only when needed.
- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>
- "Lost in the Middle" — TACL 2024:
  <https://aclanthology.org/2024.tacl-1.9/>
- Prompt repetition for non-reasoning LLMs — arXiv:2512.14982.
- Reasoning Up the Instruction Ladder — arXiv:2511.04694.
- Agent adherence to hierarchical safety principles — arXiv:2506.02357.
