# Review Gate Policy

> Read this file before performing clean-code, architecture, or security review.
>
> Reminder: review committed code only. If the working tree is dirty, return
> `BLOCKED` and let the orchestrator resolve it first.

## Evidence-first review

Reviewers follow the same evidence pattern:

1. Read the structured inputs to understand the task and prior verdicts.
2. Verify the working tree is clean before reviewing.
3. Inspect the changed files named in `EXECUTION_REPORT`.
4. Use reports as summaries, not substitutes for reading the code.
5. Return concise findings with clear file locations and concrete remediation.

## Library and framework guidance

When a recommendation depends on current library, framework, or API behavior:

1. Consult authoritative project or upstream documentation if it is available
   in the current environment.
2. Use that documentation to validate the recommendation.
3. If no authoritative reference is available, say so explicitly and mark the
   library-specific recommendation as lower confidence instead of inventing
   certainty.

## Severity semantics

- Blocking findings become `NEEDS FIXES`.
- Non-blocking improvement ideas stay in `Suggestions` or `Advisories`.
- Praise specific good decisions in `What Went Well` so the next fix cycle does
  not accidentally undo them.

## Output discipline

- Prefer short tables or bullets over long prose.
- Skip empty issue sections instead of filling them with filler text.
- If there are no blockers, say so directly.
