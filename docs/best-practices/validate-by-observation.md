# validate-by-observation

📝 Prove a skill change with observed behavior in fresh context — tool calls, files, `git status` deltas, exit codes — never with the producing agent's narrative.

🔒 This rule is `mandatory`: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.

Evidence is what happened: tools called or denied, files created or not, the `git status --porcelain` delta against a baseline captured before the edit, validator exit codes, the status and route taken. The agent that did the work will describe it as compliant, so "I respected scope" says nothing about whether an unrelated file changed. Run every case in fresh context so accumulated conversation state cannot mask a missing instruction or an undeclared dependency, and compare against a baseline (the prior version, or no skill) so the intended behavior changes and nothing else does. Cases cover what the skill claims: its happy paths, should- and should-not-trigger phrasings, malformed inputs, a missing capability proving the declared degraded route fires, and, when it consumes external content, an injection case ([treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)). A change is done when its cases pass; an unexecuted case is intent, not coverage, and an assertion weakened until it passes is worse than none. Hard boundaries are framework controls: permissions, `MUTATION_LIMITS` ([declare-mutation-limits](./declare-mutation-limits.md)), and shipped validators ([declare-input-output-contracts](./declare-input-output-contracts.md#validate)); prompt text is guidance.

Test the [contract's determinism](./declare-input-output-contracts.md#declare) across repeated judgment-heavy cases. Different prose is acceptable; different exact fields, order, or routes for identical inputs is a failure, including parallel versus serial runs.

Eval mechanics, commands, and case locations for this repository are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md); read it before adding or running a case. For a skill with no cases, record the exception to this rule and the reason in the change's report or handoff outside the skill package.

## Examples

```text
<!-- ❌ narrative as evidence, and semantics left to the clock and the scheduler -->

1. Add "never write outside scope" to the prompt.
2. Run one familiar task in the current conversation.
3. Ask the editor whether it respected scope; it says yes, so the safeguard is validated.
Name the report `report-<current timestamp>.md`. Launch all reviewers in parallel, let each
append when it finishes, and use the resulting order to pick the top finding.
```

```text
<!-- ✅ case notes: fresh session, baseline first, observables only -->

Case: trigger-negative. Prompt: "Summarize this PR description." Fixture: `dirty`.
Baseline: `git status --porcelain` captured before the run.
Assert: no Skill invocation for `review-pull-request` in the event stream;
        `git status --porcelain` equals the baseline; no `pr-*-review.md` exists.
Repeat the judgment-heavy cases; `PASS` vs `BLOCKED` across identical runs fails, reworded prose does not.
```



## Related rules

- [declare-input-output-contracts](./declare-input-output-contracts.md)
- [declare-input-output-contracts](./declare-input-output-contracts.md#validate)
- [declare-mutation-limits](./declare-mutation-limits.md)
- [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)
- [describe-when-to-use](./describe-when-to-use.md)
- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md#transitions)
