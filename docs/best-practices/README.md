# Best Practices for Writing Skills and Subagent Definitions

This directory holds detailed guidance for authoring and editing the skills in
this repo. Every practice below is grounded in real-world testing, LLM
research, and architectural review. They are format-agnostic and apply to any
skill/subagent system regardless of platform.

The top-level [`CLAUDE.md`](../../CLAUDE.md) carries only one-line summaries
and pointers to these files. Read the relevant file when you are about to
author or edit a skill, subagent, or reference document — not before.

## Index

1. [Progressive Disclosure](./progressive-disclosure.md) — layer skill content
   so only the necessary parts load into context.
2. [Context Window Protection](./context-window-protection.md) — keep raw
   data out of the orchestrator's context.
3. [Subagent-Default Execution](./subagent-default-execution.md) — when to
   inline vs. delegate per step.
4. [Positive Constraint Framing](./positive-constraint-framing.md) — name what
   is permitted; reserve negation for safety boundaries. Includes
   reconciliation with brief in-file reminders.
5. [Instruction Reinforcement](./instruction-reinforcement.md) — short
   reminders at the top of long reference files.
6. [Structural Conventions](./structural-conventions.md) — section ordering
   for skills and subagents.
7. [Input and Output Contracts](./input-output-contracts.md) — explicit data
   boundaries between pipeline stages.
8. [Escalation Patterns](./escalation-patterns.md) — failure categories and
   reporting formats per subagent type.
9. [Template Extraction](./template-extraction.md) — when to move large
   templates into separate co-located files.
10. [Identity and Mental Model Statements](./identity-and-mental-model.md) —
    open every skill and subagent with what-it-is and why-it-exists.
11. [Example Strategy](./example-strategy.md) — concrete examples at every
    level.
12. [Validation Loops](./validation-loops.md) — phase boundaries, fix cycles,
    retry limits.
13. [Naming Conventions](./naming-conventions.md) — gerunds for skills, role
    nouns for subagents.
14. [Artifact Lifecycle Management](./artifact-lifecycle.md) — what to commit,
    what to preserve, what to delete.
15. [Empirical Validation over Self-Report](./empirical-validation.md) —
    validate fixes by behavior change, not by asking the agent.

## Supporting reference

- [Quick Reference: Skill File Structure](./quick-reference-skill-structure.md)
  — folder layout for a typical skill.
