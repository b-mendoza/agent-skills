# Progressive Disclosure

## What it is

Structure skill content into layers that load only when needed, rather than
front-loading everything into a single file. This protects the agent's context
window from irrelevant information and follows the 80/20 rule: show 20% of
content prominently, reveal the rest on demand.

## Why it matters

Large skill files degrade agent performance. Research shows that models struggle
to follow instructions reliably when context grows long (AGENTIF benchmark,
arXiv:2505.16944 — best models follow fewer than 30% of agentic instructions
perfectly, with performance degrading as instructions grow longer). Splitting
content into layers keeps each decision point focused on only the information
needed at that moment.

## Three-level architecture

| Level | What loads                          | When                                | Size guidance      |
| ----- | ----------------------------------- | ----------------------------------- | ------------------ |
| 0     | SKILL.md body                       | When the skill triggers             | Under 500 lines    |
| 1     | Reference files (`references/`)     | Just-in-time, per phase or mode     | Unlimited          |
| 2     | Subagent definitions (`subagents/`) | Only when dispatching that subagent | Unlimited per file |

## What belongs at each level

**Level 0 (always loaded):** Core identity, behavioral description, input/output
contracts, subagent registry, phase guide or routing table. This is the
information the agent needs for every decision.

**Level 1 (just-in-time):** Mode-specific execution instructions, detailed phase
playbooks, error recovery procedures, data contract specifications. Loaded when
the agent enters that specific mode or phase.

**Level 2 (on-dispatch):** Individual subagent definitions. Read only when the
agent is about to dispatch that specific subagent. Never preloaded.

## Example: Phase guide as a routing table

Instead of inlining 500+ lines of phase-specific instructions, SKILL.md
contains a compact lookup table that tells the agent which reference file to
load:

```markdown
## Phase Guide

| Phase range | Reference file                   |
| ----------- | -------------------------------- |
| 1-4         | `./references/phases-1-4.md`     |
| 5-7         | `./references/task-loop.md`      |
| Error       | `./references/error-handling.md` |
```

The agent reads the appropriate file only when entering that phase range.

## When to use fewer levels

Not every skill needs three levels. Simple skills (single dispatch, compact
instructions) work fine with just Level 0. Reserve multi-level disclosure for
skills with:

- Multiple mutually exclusive modes (e.g., "upfront mode" vs "critique mode")
- Extended multi-phase workflows
- Large output templates or reference data
- Complex error recovery procedures

## References

- AGENTIF benchmark — arXiv:2505.16944, NeurIPS 2025 D&B Spotlight
- "Lost in the Middle" — TACL 2024, aclanthology.org/2024.tacl-1.9/
