# Review Gate Policy

> Read this file before performing clean-code, architecture, or security review.
>
> Reminder: review the task-scoped changed files named in the structured
> reports. If the task scope cannot be distinguished, return `BLOCKED`.

## Evidence-first review

Reviewers follow the same evidence pattern:

1. Read the structured inputs to understand the task and prior verdicts.
2. Inspect the changed files named in `EXECUTION_REPORT` and any documentation
   changes named in `DOCUMENTATION_REPORT`.
3. If unrelated changes make the task-scoped change set ambiguous, return
   `BLOCKED` with the specific ambiguity.
4. Use reports as summaries, not substitutes for reading the code.
5. Return concise findings with clear file locations and concrete remediation.

## Library and framework guidance

When a recommendation depends on current library, framework, or API behavior:

1. Read `./external-sources.md` for optional source links when a general review,
   architecture, security, Git, or tracker reference would otherwise need to be
   pasted into this policy.
2. Consult authoritative project or upstream documentation if it is available
   in the current environment.
3. Use that documentation to validate the recommendation.
4. If no authoritative reference is available, say so explicitly and mark the
   library-specific recommendation as lower confidence instead of inventing
   certainty.

## Severity semantics

- Blocking findings become `NEEDS FIXES`.
- Non-blocking improvement ideas stay in `Suggestions` or `Advisories`.
- Praise specific good decisions in `What Went Well` so the next fix cycle does
  not accidentally undo them.

## Output discipline

- Prefer short tables or bullets over long prose.
- Preserve the fixed section list defined by the reviewer subagent you are running.
- When a required section is empty, emit that section with an explicit `None`
  placeholder instead of omitting it or adding filler text.
- If there are no blockers, say so directly.
