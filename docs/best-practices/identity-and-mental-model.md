# Identity and Mental Model Statements

## What it is

Begin every skill and subagent with a clear statement of what it is, what it
does, and how it approaches its work. This shapes the agent's reasoning about
its role, authority, and boundaries.

## Why it matters

Models respond better to reasoning than to commands (arXiv:2511.04694 — ~20%
improvement when models explicitly reason about instruction relationships).
An identity statement gives the agent a positive mental model of its role,
which improves instruction-following throughout the execution.

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

- Reasoning Up the Instruction Ladder — arXiv:2511.04694
