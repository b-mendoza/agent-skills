# Validation Loops

## What it is

Build validation into every phase boundary: verify preconditions before
starting work and postconditions after completing it. When output quality
matters, use a run-check-fix-recheck cycle with explicit retry limits.

## Standard phase execution cycle

Every phase follows this pattern — no step skipped:

```
1. Announce     — display the phase banner
2. Validate     — check preconditions (dispatch validator)
3. Execute      — invoke the skill or subagent
4. Validate     — check postconditions (dispatch validator)
5. Update       — record progress
6. Gate check   — decide: advance, re-plan, or escalate
```

## Targeted fix cycles

When quality gates fail, re-run only the failing gate — not the entire
pipeline:

```
1. Collect feedback from failing gate(s) — specific issues, file paths
2. Re-dispatch executor with ONLY the flagged issues
3. Re-run ONLY previously failing gates
4. Max 3 fix cycles per task
5. If limit exhausted, escalate to user
```

## Why targeted, not full-pipeline

Full pipeline reruns waste context and time on already-passing stages. Targeted
fix cycles preserve momentum and focus on the actual issue. The retry limit
prevents infinite loops when a fix introduces new problems.
