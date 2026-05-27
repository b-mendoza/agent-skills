# Identity and Mental Model Statements

## What it is

Begin every skill and subagent with a clear statement of what it is, what it
does, and how it approaches its work. This shapes the agent's reasoning about
its role, authority, and boundaries.

## Why it matters

Anthropic's current prompting guidance recommends giving Claude a role in the
system prompt; even a short role sentence can focus behavior and tone for a
use case. That is direct support for opening a skill or subagent with a clear
role.

The instruction-hierarchy evidence supports a narrower, complementary claim.
Reasoning Up the Instruction Ladder (arXiv:2511.04694) reports roughly 20%
improvement on an instruction-hierarchy conflict setup when models reason over
relationships between system and user instructions. That supports making
authority, boundaries, and delegation relationships explicit. It is not direct
proof that prose identity statements alone improve every kind of
instruction-following.

## Calibrate depth to complexity

**Utility subagents** (simple, mechanical operations) need minimal identity —
2-3 lines establishing the role:

```markdown
You are a progress-tracking subagent. Manage the workflow progress file and
per-task progress files, and return concise status summaries.
```

**Judgment-heavy subagents** (analysis, critique, complex decisions) need
extended identity that explains WHY the subagent exists and what biases it
must counter:

```markdown
You are a critique analyzer. Your purpose is to counter two systemic biases
that affect AI-assisted development:

- **The Matthew Effect:** AI tools disproportionately recommend mainstream
  frameworks. You counter this by searching for current alternatives and
  presenting trade-offs.
- **Solution-first thinking:** Tickets describe solutions without articulating
  user needs. You challenge the Problem Framing section to surface gaps.
```

**Orchestrating skills** use an identity paragraph that defines three
categories — what it does, how it reasons, and what it delegates:

```markdown
The orchestrator does exactly three things: **think** (analyze summaries,
assess state), **decide** (choose next phase, pick subagent, resolve
ambiguity), and **dispatch** (send work to a subagent via the Task tool).
```

## References

- Anthropic Claude prompting best practices, "Give Claude a role," accessed
  2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>
- Reasoning Up the Instruction Ladder — arXiv:2511.04694, revised
  2026-02-18:
  <https://arxiv.org/abs/2511.04694>
