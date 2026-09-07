# Verification Checklist

Load this file after editing a `SKILL.md`, subagent definition, or reference file. This repo has no CI pipeline for skill authoring; run every check below manually before declaring the work done (see [empirical validation](../best-practices/empirical-validation.md)).

- Run `skills-ref validate <skill-dir>`; it is required by the [runtime portability matrix](../best-practices/runtime-portability-matrix.md) and checks that the frontmatter parses, `name` matches the directory or basename in kebab-case, and only standard fields are present ([frontmatter contract](../best-practices/frontmatter-contract.md)).
- Confirm `SKILL.md` stays within the line and token limits recorded in the [runtime portability matrix](../best-practices/runtime-portability-matrix.md).
- Confirm any subagent paths referenced in a registry table actually exist on disk.
- Confirm the YAML frontmatter `name` matches the directory or file name per the [frontmatter contract](../best-practices/frontmatter-contract.md).
- If the skill ships a `scripts/` directory, run the script the way a consumer would invoke it.
- If the skill has cases in [`evals/`](../../evals/), re-run them and commit the updated `evals/report.md`, confirming only the intended behavior changed. Commands, approval rules, and check selection are owned by [`evals/AGENTS.md`](../../evals/AGENTS.md) and its verification reference.

When unsure whether a change is correct, follow [escalation categories](../best-practices/escalation-categories.md) and escalate to the user.
