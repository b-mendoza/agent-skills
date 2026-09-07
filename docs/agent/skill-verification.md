# Verification Checklist

Load this file after editing a `SKILL.md`, subagent definition, or reference file. This repo has no CI pipeline for skill authoring; run every check below manually before declaring the work done (see [empirical validation](../best-practices/empirical-validation.md)).

- Run `skills-ref validate <skill-dir>`; it is required by the [runtime portability matrix](../best-practices/runtime-portability-matrix.md) and checks that the frontmatter parses, `name` matches the directory or basename in kebab-case, and only standard fields are present ([frontmatter contract](../best-practices/frontmatter-contract.md)).
- Confirm `SKILL.md` stays within the line and token limits recorded in the [runtime portability matrix](../best-practices/runtime-portability-matrix.md).
- Confirm any subagent path referenced in a registry table exists on disk and that each subagent's escalation section is a closed enum whose every value the orchestrator routes ([escalation categories](../best-practices/escalation-categories.md)).
- If the skill mutates files, confirm `SKILL.md` declares `MUTATION_LIMITS` and passes them to every dispatched subagent ([mutation scope boundaries](../best-practices/mutation-scope-boundaries.md)).
- If the skill takes a hard-to-reverse, outward-facing, destructive, or costly action, confirm a named checkpoint shows the exact artifact before it ([human-in-the-loop checkpoints](../best-practices/human-in-the-loop-checkpoints.md)).
- If the skill declares critical outputs, confirm each has a named gate with a written predicate and an independent checker ([critical output gates](../best-practices/critical-output-gates.md)).
- If the orchestrator parses or routes on subagent fields, confirm `scripts/validate*` exists, is named in `SKILL.md` and every producing subagent, and run it once with a good payload and once with a bad one ([script-enforced output contracts](../best-practices/script-enforced-output-contracts.md)).
- If the skill writes run-local files, confirm the paths are run-scoped and `git check-ignore --quiet` passes for them ([artifact lifecycle](../best-practices/artifact-lifecycle.md), [handoff file dispatch](../best-practices/handoff-file-dispatch.md)).
- If the skill has cases in [`evals/`](../../evals/), re-run them and commit the updated `evals/report.md`, confirming only the intended behavior changed; if it has none, confirm `SKILL.md` declares that exception ([empirical validation](../best-practices/empirical-validation.md)). Commands, approval rules, and check selection are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md) and its verification reference.

When unsure whether a change is correct, escalate to the user rather than declare success.
