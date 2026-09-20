# Verification Checklist

Load this file after editing a `SKILL.md`, subagent definition, or reference file. This repo has no CI pipeline for skill authoring; run every check below manually before declaring the work done (see [validate by observation](../best-practices/validate-by-observation.md)).

- Run `skills-ref validate <skill-dir>` when the tool is available; it checks that the frontmatter is valid and follows the naming conventions ([runtime portability matrix](../best-practices/runtime-portability-matrix.md)). Check manually that each subagent file's `name` equals its basename ([name-matches-directory](../best-practices/name-matches-directory.md)).
- Confirm `SKILL.md` stays within the size guidance recorded in the [runtime portability matrix](../best-practices/runtime-portability-matrix.md).
- Confirm any subagent path referenced in a registry table exists on disk and that each subagent's escalation section is a closed enum whose every value the orchestrator routes ([route every status](../best-practices/route-every-status.md)).
- If the skill mutates files, confirm `SKILL.md` declares `MUTATION_LIMITS` and passes them to every dispatched subagent ([declare mutation limits](../best-practices/declare-mutation-limits.md)).
- If the skill takes a hard-to-reverse, outward-facing, destructive, or costly action, confirm a named checkpoint shows the exact artifact before it ([checkpoint irreversible actions](../best-practices/checkpoint-irreversible-actions.md)).
- If the orchestrator parses or routes on subagent fields, or the skill declares critical outputs, confirm `scripts/validate*` exists, is named in `SKILL.md` and every producing subagent, and run it once with a good payload and once with a bad one ([validate routed fields with a script](../best-practices/validate-routed-fields-with-a-script.md)).
- If the skill writes run-local files, confirm the paths are run-scoped and `git check-ignore --quiet` passes for them ([scope run files to the run](../best-practices/scope-run-files-to-the-run.md)).
- If the skill ships other files under `scripts/`, run each the way a consumer would and check its usage line and exit codes ([validate routed fields with a script](../best-practices/validate-routed-fields-with-a-script.md)).
- If the skill has cases in [`evals/`](../../evals/), re-run them and leave the regenerated `evals/report.md` in the working tree for the user to commit, confirming only the intended behavior changed; if it has none, confirm `SKILL.md` declares that exception ([validate by observation](../best-practices/validate-by-observation.md)). Commands, approval rules, and check selection are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md) and its verification reference.

When unsure whether a change is correct, escalate to the user rather than declare success.
