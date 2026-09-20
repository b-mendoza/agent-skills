# validate-by-observation

📝 Prove a skill change with observed behavior in fresh context — tool calls, files, `git status` deltas, exit codes — never with the producing agent's narrative.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

Evidence is what happened: tools called or denied, files created or not, the `git status --porcelain` delta against a baseline captured before the edit, validator exit codes, the status and route taken. The agent that did the work will describe it as compliant, so "I respected scope" says nothing about whether an unrelated file changed. Run every case in fresh context so accumulated conversation state cannot mask a missing instruction or an undeclared dependency, and compare against a baseline (the prior version, or no skill) so the intended behavior changes and nothing else does. Cases cover what the skill claims: its happy paths, should- and should-not-trigger phrasings, malformed inputs, a missing capability proving the declared degraded route fires, and, when it consumes external content, an injection case ([treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)). A change is done when its cases pass; an unexecuted case is intent, not coverage, and an assertion weakened until it passes is worse than none. Hard boundaries are framework controls: permissions, `MUTATION_LIMITS` ([declare-mutation-limits](./declare-mutation-limits.md)), and shipped validators ([validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md)); prompt text is guidance.

Cases can only compare exact fields when the skill is deterministic where it matters, which is what [declare-input-output-contracts](./declare-input-output-contracts.md) requires of contract fields. Inventory the sources of drift at authoring time and remove each from semantics: stable ordering (sort by a named key before emitting or aggregating, so a parallel schedule matches the serial one), a single clock capture (record the timestamp once with timezone and precision, reuse it), exact derivations (canonicalize before comparing, specify the algorithm and the collision rule, resolve a path once before dispatch), and same input, same route. Route divergence between two identical runs is a failure; different wording is not.

Eval mechanics, commands, and case locations for this repository are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md); read it before adding or running a case. A skill with no cases names this rule and the reason in its `SKILL.md`.

## Examples

```markdown
<!-- ❌ narrative as evidence, and semantics left to the clock and the scheduler -->
1. Add "never write outside scope" to the prompt.
2. Run one familiar task in the current conversation.
3. Ask the editor whether it respected scope; it says yes, so the safeguard is validated.
Name the report `report-<current timestamp>.md`. Launch all reviewers in parallel, let each
append when it finishes, and use the resulting order to pick the top finding.
```

```markdown
<!-- ✅ case notes: fresh session, baseline first, observables only -->
Case: trigger-negative. Prompt: "Summarize this PR description." Fixture: `dirty`.
Baseline: `git status --porcelain` captured before the run.
Assert: no Skill invocation for `review-pull-request` in the event stream;
        `git status --porcelain` equals the baseline; no `pr-*-review.md` exists.
Repeat the judgment-heavy cases; `PASS` vs `BLOCKED` across identical runs fails, reworded prose does not.
```

```markdown
<!-- ✅ SKILL.md: contract fields derived exactly -->
1. Capture `RUN_STAMP` once (UTC, seconds) into run state; every path reuses it.
2. Slug: lowercase; replace each run outside `[a-z0-9]` with `-`; trim hyphens; truncate to 40.
   If the path exists, try `-2`, `-3`, and so on. Resolve once, before dispatch.
3. Sort seat packets by the registry's declared order before synthesis, whatever the dispatch schedule.
```

## Related rules

- [declare-input-output-contracts](./declare-input-output-contracts.md)
- [validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md)
- [declare-mutation-limits](./declare-mutation-limits.md)
- [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)
- [describe-when-to-use](./describe-when-to-use.md)
- [route-every-status](./route-every-status.md)
