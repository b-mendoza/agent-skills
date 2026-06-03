# subagent-default-execution

## Tier

`recommended`. Inline-vs-dispatch is a per-step decision; mechanical
"always dispatch" or "never dispatch" rules both fail when applied to
the wrong step.

## When it applies

For every step in a skill's execution sequence: whether to do the
step inline in the orchestrator's context or dispatch a subagent and
read back a bounded result.

## The practice

Decide at each step whether to execute inline or dispatch to a
subagent. The decision is based on whether the orchestrator needs
the raw, iterative, conversational, or stateful material from the
step — not on step complexity or tool-call count.

**Scope.** This principle applies to **pre-authored skill
definitions** — orchestration instructions that prescribe when and
where to dispatch. It does not apply to ad-hoc, unconstrained model
behavior. Current Claude Code documentation also warns through its
own decision guidance that the main conversation is often better for
quick targeted work, frequent back-and-forth, shared context, or
latency-sensitive tasks. That guidance addresses dispatch economics,
not a ban on authored subagent workflows.

**The two-question test.** At each step in a skill's execution, ask:

1. **Does the orchestrator need the raw material to coordinate the
   workflow?** This includes iterative user conversation, subjective
   judgment over full evidence, live troubleshooting, or
   intermediate details that change the next route.
2. **Will later routing need raw detail rather than a bounded
   result?** If the orchestrator only needs a status enum, verdict,
   path, id, or concise evidence summary, it does not need the raw
   output in its own context.

If **either answer is yes** — execute inline. The step's output is
working material for the orchestrator.

If **both answers are no** — dispatch to a subagent when the cost
model below also supports delegation. The orchestrator only needs a
bounded result, not the raw details.

**Heuristics.** Shortcuts for applying the two-question test, not
hard rules:

- Steps that fetch large data sets the orchestrator won't reference
  → delegate.
- Steps that produce artifacts (files, tickets, commits) →
  delegate; return a path or key.
- Conversational turns where the orchestrator builds on prior
  exchanges (e.g., clarifying assumptions with the user) → inline.
- Validation checks that return a pass/fail verdict with bounded
  evidence → delegate.
- Validation checks that require the orchestrator to inspect full
  evidence, resolve subjective trade-offs, or continue a live repair
  conversation → inline or split into a delegated evidence pass plus
  inline decision.

**Per-step, not per-skill.** A single skill can mix inline and
delegated steps.

**Decision framework.**

| Choose...         | When...                                                            |
| ----------------- | ------------------------------------------------------------------ |
| **Inline**        | The orchestrator needs raw, iterative, conversational, or stateful |
|                   | material to make the next routing decision.                        |
| **Subagent**      | The step produces output the orchestrator doesn't need in detail — |
|                   | a summary or verdict is sufficient.                                |
| **Skill**         | The step is purely about loading context or decision-making        |
|                   | guidance. It does not execute work — it informs the agent.         |
| **Slash command** | Quick, well-defined action the user invokes explicitly by name.    |

**Cost model.** Before delegating a step, account for both sides of
the tradeoff.

| Factor | Favors inline | Favors subagent |
| --- | --- | --- |
| Raw context volume | Output is short and useful to retain | Output is large and only a summary/verdict matters |
| Continuity | Step depends on ongoing user conversation or prior turns | Step can be described by a complete input contract |
| Latency | User needs tight back-and-forth | Work can run as a bounded, self-contained pass |
| Validation | Orchestrator must inspect details directly | Independent verdict or artifact path is enough |
| Permissions/scope | Same authority is appropriate | Isolation or narrower mutation scope reduces risk |
| Reuse | One-off local step | Contracted behavior will recur across workflows |

**Co-location.** All subagent files live inside the skill folder,
not in a global agents directory.

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

## Rationale

Polluted orchestrator context compounds with every step, but over-
delegation also has real cost. A subagent starts with a fresh
context, may need to reread inputs the orchestrator already knows,
adds dispatch latency, can lose conversational continuity, and
increases the number of contracts the author must maintain.
Delegation earns its place when those costs are outweighed by
context savings, permission isolation, clearer validation, or
reusable structured output.

The two-question test resolves this by anchoring the decision on
what the orchestrator actually needs for routing. If routing needs
the raw material, inline is the right shape; if routing needs only
a verdict, dispatch is the right shape. The cost model adds a
second tie-breaker for the cases where both answers permit either
choice.

## Concrete examples

Good: a single skill mixes inline (conversational turns) and
delegated (artifact-producing) steps.

```markdown
# In skills/clarifying-assumptions/SKILL.md

## Execution
1. (Inline) Q&A turn with user: ask clarifying question about plan.
   Orchestrator needs prior turn context to decide what to ask next.
2. (Inline) Q&A turn with user: refine based on response.
3. (Subagent) Dispatch `critique-analyzer` with the conversation
   transcript; receive a bounded critique report.
4. (Subagent) Dispatch `decision-recorder` with the approved
   decisions; receive an artifact path.
```

Bad: every step is dispatched regardless of context need; a Q&A
turn dispatches a subagent for one question and returns to the
orchestrator with no useful continuity.

```markdown
1. Dispatch `question-asker` to ask one question.
2. Dispatch `response-reader` to read the answer.
3. Dispatch `next-question-decider` to pick the next question.
4. ... (Now the orchestrator has lost all conversational
   continuity; each subagent starts fresh and must re-derive
   context.)
```

## References

- Anthropic sub-agents documentation, accessed 2026-05-27:
  <https://code.claude.com/docs/en/sub-agents>. Supports the
  dispatch tradeoff that subagents isolate context and can restrict
  tools, while the main conversation is often better for shared
  context, quick targeted work, frequent back-and-forth, and
  latency-sensitive tasks.
- Anthropic, "Effective context engineering for AI agents,"
  accessed 2026-05-27:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  Supports the principle that context-bounded steps are the unit of
  delegation.

## Related practices

- [Orchestrator as routing UI](./orchestrator-as-routing-ui.md) —
  the workflow shape this practice applies inside.
- [Context window protection](./context-window-protection.md) —
  one of the major reasons to dispatch.
- [Earned complexity](./earned-complexity.md) — dispatch is not free;
  it has to earn its place.
- [Handoff file dispatch](./handoff-file-dispatch.md) — large
  dispatch payloads cross the boundary via YAML handoffs.
- [Input and output contracts](./input-output-contracts.md) — the
  shape every dispatched subagent must satisfy.
