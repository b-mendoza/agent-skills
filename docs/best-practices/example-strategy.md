# example-strategy

## Tier

`recommended`. Examples are powerful for ambiguity-prone work; thin
utility skills can use one realistic input/output example.

## When it applies

When a skill or subagent produces a format-sensitive output, makes a
judgment-heavy decision, handles cross-agent handoffs, or routinely
faces edge cases that prose alone cannot disambiguate.

## The practice

Use examples where they reduce ambiguity: format-sensitive outputs,
judgment-heavy decisions, edge cases, and cross-agent handoffs.

For format-sensitive or judgment-heavy skills, include:

1. **Dispatch round-trip example:** input, dispatch, subagent output,
   and orchestrator decision.
2. **Output format example:** exact structure with realistic data.
3. **Edge/failure example:** partial failure, blocked state, or
   unexpected input.

For thin utility skills, use the smallest example set that removes
real ambiguity. One realistic input/output example is enough when
there is no branching, subjective judgment, or special failure mode.

Examples should reinforce the role and posture, show the preferred
allowed behavior before edge cases, and avoid burying critical
constraints.

## Rationale

Prose ambiguity tends to surface where the skill expects format-
sensitive output ("a YAML report with these fields") or judgment-
heavy verdicts ("decide whether the workflow is incoherent"). A
single realistic example anchors the prose: the agent stops guessing
at the schema or the verdict vocabulary because the example gave
both.

Edge-case examples close a second failure. A skill that shows only
the happy path implicitly tells the agent "stretch the happy path to
fit edge cases," which is how silent partial-success outputs happen.
A `BLOCKED` example and a `PARTIAL` example tell the agent the
expected shape of the unhappy paths.

## Concrete examples

Good: a dispatch round-trip example, an output-format example, and
an edge-case example, in that order.

```markdown
## Example

Input: `SKILL_PATH=skills/example`, `KNOWN_PROBLEM="validator misses
stale flow"`.

The workflow discovers related skills, audits focused slices, asks
the user to approve personality and gaps, edits only approved files,
synchronizes `flow-diagram.md`, validates the result, and returns
`changed` only after gates pass.

## Output Format Example
```yaml
status: "CONTRACT_AUDIT: PASS"
verdict:
  status_contract_assessment: "All phases carry routeable failure statuses"
  priority_assessment: "defined"
```

## Edge / Failure Example
On a target package whose `flow-diagram.md` is missing, the workflow
returns `CONTRACT_AUDIT: BLOCKED` with `failure_details: "flow-
diagram.md path unreadable"` rather than guessing at coherence from
SKILL.md alone.
```

Bad: vague prose example with no realistic data and no edge case.

```markdown
## Example
Run the skill on any package; it will audit and report. Outputs
follow the contract above.
```

## References

- Anthropic Claude prompting best practices, accessed 2026-05-27:
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>.
  Supports examples as a prompt-design tool for format-sensitive and
  judgment-heavy tasks.
- OpenAI Prompt Engineering Guide, accessed 2026-06-03:
  <https://platform.openai.com/docs/guides/prompt-engineering>.
  Supports few-shot examples for ambiguity-prone tasks.

## Related practices

- [Identity and mental model](./identity-and-mental-model.md) —
  examples reinforce the role.
- [Operating posture](./operating-posture.md) — examples reinforce
  the posture's preferred behavior.
- [Input and output contracts](./input-output-contracts.md) — the
  output-format example demonstrates the contract.
- [Earned complexity](./earned-complexity.md) — examples must earn
  their place by removing real ambiguity.
