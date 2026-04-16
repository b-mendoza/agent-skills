# Example Strategy

## What it is

Include concrete examples at every level of the skill/subagent hierarchy to
show expected quality, format, and edge cases.

## Why it matters

Examples serve as implicit output contracts. They show the agent what "good"
looks like more effectively than abstract descriptions. They also reduce
ambiguity in format-sensitive outputs (structured reports, validation summaries,
handoff data).

## What to include

Every improved skill or subagent should have:

1. **Dispatch round-trip example** (in the skill) — shows the complete flow
   from input to subagent dispatch to output summary.
2. **Output format example** (in the subagent) — shows the exact output
   structure with realistic data.
3. **Edge case or failure example** — shows how partial failures or unexpected
   inputs are handled.

## Example: Dispatch round-trip

```markdown
<example>
Input: JIRA_URL = https://workspace.atlassian.net/browse/PROJ-123

1. Orchestrator dispatches ticket-retriever with JIRA_URL
2. Subagent returns:
   FETCH: PASS
   File: docs/PROJ-123.md
   Sections: Description, Acceptance Criteria, Comments (5)

3. Orchestrator uses summary to decide: proceed to Phase 2

</example>
```

## Example: Subagent output format

```markdown
<example>
VALIDATION: FAIL
Phase: 2 | Direction: postcondition
File: docs/PROJ-123-tasks.md
Checks:
  - File exists: OK
  - Contains ## Tasks: OK
  - Has 2+ task entries: FAIL - found 1 task entry
</example>
```
