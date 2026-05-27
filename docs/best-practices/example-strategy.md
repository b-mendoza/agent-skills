# Example Strategy

## What it is

Include concrete examples where they reduce ambiguity: format-sensitive
outputs, judgment-heavy decisions, edge cases, and cross-agent handoffs. Small
deterministic utilities may need only one compact example or none when the
contract is already unambiguous.

## Why it matters

Examples serve as implicit output contracts. They show the agent what "good"
looks like more effectively than abstract descriptions. They also reduce
ambiguity in format-sensitive outputs (structured reports, validation summaries,
handoff data).

## What to include

For format-sensitive or judgment-heavy skills and subagents, include:

1. **Dispatch round-trip example** (in the skill) — shows the complete flow
   from input to subagent dispatch to output summary.
2. **Output format example** (in the subagent) — shows the exact output
   structure with realistic data.
3. **Edge case or failure example** — shows how partial failures or unexpected
   inputs are handled.

For thin utility skills, use the smallest example set that removes real
ambiguity. A single realistic input/output example is enough when there is no
branching, no subjective judgment, and no special failure mode.

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

## Related behavioral prompt practices

- [Identity and Mental Model Statements](./identity-and-mental-model.md) —
  examples should reinforce the role and reasoning model declared at the top
  of the skill or subagent.
- [Positive Constraint Framing](./positive-constraint-framing.md) — examples
  should show the preferred allowed behavior before edge cases show what to
  avoid.
- [Instruction Reinforcement](./instruction-reinforcement.md) — long examples
  should not bury critical constraints without a local reminder when the
  boundary is risky.
- [Personality as Operating Posture](./personality-as-operating-posture.md) —
  examples should match the skill's operating posture, not just its output
  format.

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
