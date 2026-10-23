# validate-by-observation

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory, with a recorded no-case exception as described below.

Use after a skill, subagent, or reference change. Prove behavior with observed evidence, not the producing agent's narrative.

## Behavioral evidence

Observe tools called or denied, created files, baseline-to-final `git status --porcelain` changes, validator exit codes, and statuses and routes taken. Run each case in fresh context and compare with the prior version or no-skill baseline. Cover happy paths, should-trigger and near-miss phrasings, malformed inputs, missing capabilities and their degraded routes, and injection when external content is consumed under the [trust rule](./treat-retrieved-content-as-data.md).

A change is done when its cases pass. Unexecuted cases are not coverage; weakening an assertion to pass is not verification. Hard boundaries come from permissions, [mutation limits](./declare-mutation-limits.md), and [shipped validators](./declare-input-output-contracts.md); prompt text is guidance.

Test the [contract's determinism](./declare-input-output-contracts.md#declare) across repeated judgment-heavy cases. Different prose is acceptable; different exact fields, order, or routes for identical inputs is a failure, including parallel versus serial runs.

Read [`evals/AGENTS.md`](../../evals/AGENTS.md) for case locations, commands, approvals, and check selection before adding or running cases. If a skill has no cases, record the exception and reason in the change's report or handoff outside the package.

## Manual checks

There is no CI pipeline for skill authoring. Run these applicable checks after editing a skill, subagent, or reference:

- Run `skills-ref validate <skill-dir>` when available; review frontmatter and `SKILL.md` size against the [runtime matrix](./runtime-portability-matrix.md), including both runtime paths for discovery, invocation, permissions, and any nested dispatch.
- Check skill-directory and subagent-basename identity under the [name and description rule](./describe-when-to-use.md).
- Search all package text, including plain-text paths and code spans, for dependencies on repository files outside the package and other skills named or invoked; apply the [packaging boundary and its allowance](./keep-skills-self-contained.md).
- Check real registry paths and exhaustive closed-status routes under the [routing rule](./keep-routing-in-the-orchestrator.md), including missing, malformed, and unknown results.
- Confirm file-mutating skills declare and propagate limits, action gates preview exact artifacts, and run-local paths are run-scoped with observed `git check-ignore --quiet` success under the [mutation rule](./declare-mutation-limits.md).
- For parsed/routed fields or declared critical outputs, confirm `scripts/validate*` exists, its invocation appears in `SKILL.md` and each producer, and run good and bad payloads under the [contract rule](./declare-input-output-contracts.md). Run every other shipped script as a consumer would, checking help, exit codes, and its smoke or dry-run path.
- Check that additions and extracted files satisfy the [deletion and loading test](./progressive-disclosure.md); run applicable behavioral cases above, or record the no-case exception.

## Example

Bad: ask the editor whether it respected scope and accept "yes" as proof.

```text
Case: trigger-negative. Prompt: "Summarize this PR description."
Fixture: dirty checkout; capture git status --porcelain before the run.
Assert: no review-pull-request Skill invocation in the event stream;
        final status equals baseline; no review artifact created.
Repeat: PASS versus BLOCKED on identical input fails; reworded prose does not.
```
