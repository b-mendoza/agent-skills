# Instruction Reinforcement

## What it is

Repeat critical constraints briefly at strategic points in long documents,
rather than stating them only once at the beginning.

## Why it matters

The "Lost in the Middle" effect (TACL 2024) demonstrates that instructions
stated once early in context lose influence as more content is processed. This
is especially problematic for orchestrating skills whose context includes
SKILL.md + reference files + subagent outputs — a constraint stated once at the
top faces maximum dilution by mid-execution.

Related research on prompt repetition (arXiv:2512.14982) found that repeating
input queries improved performance across 70 comparisons with 47 wins and
0 losses across Claude, GPT, Gemini, and DeepSeek. That study tested
input-level prompt duplication rather than mid-document reinforcement, but the
underlying attention mechanism — tokens later in context attend to earlier
repetitions — supports the same intuition.

## How to apply

1. State the primary constraint in the main SKILL.md (always loaded first).
2. Add brief (1-3 line) reminders at the top of long reference files that
   the agent reads mid-execution.
3. Keep reminders short — a single blockquote line is sufficient.
4. Do NOT repeat in every file. Target only the longest reference files
   where instruction dilution is most likely.

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

## References

- "Lost in the Middle" — TACL 2024, aclanthology.org/2024.tacl-1.9/
- arXiv:2603.10123 (preprint, March 2026) — lost-in-the-middle as architectural
  constraint
- Anthropic "Effective Context Engineering for AI Agents" — engineering blog,
  September 2025
- Prompt repetition (related) — arXiv:2512.14982 (2025)
- Palantir & ElevenLabs prompt engineering guides
