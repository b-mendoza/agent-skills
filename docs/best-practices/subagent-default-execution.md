# Subagent-Default Execution

## What it is

Decide at each step whether to execute inline or dispatch to a subagent. The
decision is based on whether the step's output serves the orchestrator's
reasoning — not on step complexity or tool-call count.

**Important scope note:** This principle applies to **pre-authored skill
definitions** — orchestration instructions that prescribe when and where to
dispatch. It does not apply to ad-hoc, unconstrained model behavior. Anthropic's
Claude 4 best-practices documentation (platform.claude.com) warns that Opus 4.6
over-spawns subagents in open-ended coding tasks; that guidance addresses the
model's autonomous behavior, not pre-authored workflows where dispatch decisions
are made by the skill author.

## Why it matters

The cost of an unnecessary subagent is negligible (one extra dispatch). The cost
of polluted orchestrator context compounds with every step. But over-delegation
has its own cost: dispatch overhead, loss of conversational continuity, and
unnecessary complexity for simple operations. The right default depends on the
workflow.

## The two-question test

At each step in a skill's execution, ask:

1. **Will executing this inline help the orchestrator perform its
   coordination or decision-making better?** Does the orchestrator need to
   see, react to, or build upon the step's output in real time?
2. **Is the step's output information the orchestrator needs to retain for
   future steps?** Will the orchestrator reference this context when making
   later decisions?

If **either answer is yes** — execute inline. The step's output is working
material for the orchestrator.

If **both answers are no** — dispatch to a subagent. The orchestrator only
needs a summary, not the raw details.

## Heuristics

These are shortcuts for applying the two-question test, not hard rules:

- Steps that fetch large data sets the orchestrator won't reference → delegate.
- Steps that produce artifacts (files, tickets, commits) → delegate; return
  a path or key.
- Conversational turns where the orchestrator builds on prior exchanges
  (e.g., clarifying assumptions with the user) → inline.
- Validation checks that return a pass/fail verdict → delegate.

## Per-step, not per-skill

A single skill can mix inline and delegated steps. For example,
`clarifying-assumptions` runs Q&A turns inline (the orchestrator needs the
conversation history to coordinate) but dispatches to `critique-analyzer` and
`decision-recorder` (those produce artifacts the orchestrator doesn't need in
detail). Apply the two-question test at each step independently.

## Decision framework

| Choose...         | When...                                                            |
| ----------------- | ------------------------------------------------------------------ |
| **Inline**        | The step's output serves the orchestrator's reasoning or must be   |
|                   | retained for future coordination decisions.                        |
| **Subagent**      | The step produces output the orchestrator doesn't need in detail — |
|                   | a summary or verdict is sufficient.                                |
| **Skill**         | The step is purely about loading context or decision-making        |
|                   | guidance. It does not execute work — it informs the agent.         |
| **Slash command** | Quick, well-defined action the user invokes explicitly by name.    |

## Co-location

All subagent files live inside the skill folder, not in a global agents
directory. This keeps skills self-contained and portable:

```
skill-name/
├── SKILL.md
├── subagents/
│   ├── subagent-1.md
│   ├── subagent-2.md
│   └── subagent-3.md
├── references/
└── scripts/
```

## References

- Anthropic sub-agents documentation — code.claude.com/docs/en/sub-agents
