# validate-by-observation

📝 Prove a skill change with observed behavior in fresh context — tool calls, files, `git status` deltas, exit codes — never with the producing agent's narrative.

🔒 This rule is `mandatory`: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.

Evidence is what happened: tools called or denied, files created or not, the `git status --porcelain` delta against a baseline captured before the edit, validator exit codes, the status and route taken. The agent that did the work will describe it as compliant, so "I respected scope" says nothing about whether an unrelated file changed. Run every case in fresh context so accumulated conversation state cannot mask a missing instruction or an undeclared dependency, and compare against a baseline (the prior version, or no skill) so the intended behavior changes and nothing else does. Cases cover what the skill claims: its happy paths, should- and should-not-trigger phrasings, malformed inputs, a missing capability proving the declared degraded route fires, and, when it consumes external content, an injection case ([treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)). A change is done when its cases pass; an unexecuted case is intent, not coverage, and an assertion weakened until it passes is worse than none. Hard boundaries are framework controls: permissions, `MUTATION_LIMITS` ([declare-mutation-limits](./declare-mutation-limits.md)), and shipped validators ([declare-input-output-contracts](./declare-input-output-contracts.md#validate)); prompt text is guidance.

Test the [contract's determinism](./declare-input-output-contracts.md#declare) across repeated judgment-heavy cases. Different prose is acceptable; different exact fields, order, or routes for identical inputs is a failure, including parallel versus serial runs.

Eval mechanics, commands, and case locations for this repository are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md); read it before adding or running a case. For a skill with no cases, record the exception to this rule and the reason in the change's report or handoff outside the skill package.

## Manual checks

There is no CI pipeline for skill authoring. Run these applicable checks after editing a skill, subagent, or reference:

- Run `skills-ref validate <skill-dir>` when available; review frontmatter and `SKILL.md` size against the [runtime matrix](./runtime-portability-matrix.md), including both runtime paths for discovery, invocation, permissions, and any nested dispatch.
- Check skill-directory and subagent-basename identity under the [name and description rule](./describe-when-to-use.md).
- Search all package text, including plain-text paths and code spans, for dependencies on repository files outside the package and other skills named or invoked; apply the [packaging boundary and its allowance](./keep-skills-self-contained.md).
- Check real registry paths and exhaustive closed-status routes under the [routing rule](./keep-routing-in-the-orchestrator.md), including missing, malformed, and unknown results.
- Confirm file-mutating skills declare and propagate limits, action gates preview exact artifacts, and run-local paths are run-scoped with observed `git check-ignore --quiet` success under the [mutation rule](./declare-mutation-limits.md).
- For parsed/routed fields or declared critical outputs, confirm `scripts/validate*` exists, its invocation appears in `SKILL.md` and each producer, and run good and bad payloads under the [contract rule](./declare-input-output-contracts.md). Run every other shipped script as a consumer would, checking help, exit codes, and its smoke or dry-run path.
- Check that additions and extracted files satisfy the [deletion and loading test](./progressive-disclosure.md); run applicable behavioral cases above, or record the no-case exception.

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
