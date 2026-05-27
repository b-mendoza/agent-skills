# Instruction Reinforcement

## What it is

Repeat critical constraints briefly at strategic points in long documents,
rather than stating them only once at the beginning.

## Why it matters

The "Lost in the Middle" effect (TACL 2024) shows that models can make weaker
use of relevant information when it appears in the middle of long contexts.
That study is about long-context retrieval, not skill instructions directly,
but it supports the practical concern: a constraint stated once at the top of
`SKILL.md` may be less available when the agent is operating deep inside
reference files and subagent outputs.

Related research on prompt repetition (arXiv:2512.14982) found that repeating
input prompts improved performance for non-reasoning LLMs without increasing
generated-token length or latency. That study tested input-level duplication,
not 1-3 line reminders inside reference files. Use it as indirect support for
the intuition that repetition can matter, not as proof that every mid-document
reminder improves agent behavior.

This practice is therefore a risk-based heuristic. For safety-critical,
permission-sensitive, or mutation-sensitive boundaries, validate the reminders
with real workflow runs instead of assuming repetition solved the problem.

## How to apply

1. State the primary constraint in the main SKILL.md (always loaded first).
2. Add brief (1-3 line) reminders at the top of long reference files that
   the agent reads mid-execution.
3. Keep reminders short — a single blockquote line is sufficient.
4. Do NOT repeat in every file. Target only the longest or riskiest reference
   files where instruction dilution is most likely.
5. For safety-critical boundaries, verify that the reminder changes behavior
   or catches a real failure mode.

## Example: Brief reminder in a reference file

```markdown
# Phases 1-4 — Linear Pipeline

> Read this file when entering Phase 1, 2, 3, or 4.
>
> **Reminder:** All operations below are dispatches to subagents. The
> orchestrator does not call Read, Bash, Grep, Glob, Write, or Edit
> directly (except to load skill/subagent/reference files).
```

## What NOT to repeat

- Detailed explanations or rationale (those belong in one place)
- Content that downstream files already express implicitly through consistent
  "dispatch" language
- Constraints in short files where the "Lost in the Middle" effect is minimal
- Reminders added only to satisfy a checklist, without a plausible failure
  mode or validation plan

## References

- "Lost in the Middle" — TACL 2024:
  <https://aclanthology.org/2024.tacl-1.9/>
- Prompt repetition for non-reasoning LLMs — arXiv:2512.14982, submitted
  2025-12-17:
  <https://arxiv.org/abs/2512.14982>
