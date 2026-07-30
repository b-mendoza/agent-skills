# Verification Checklist

Load this file after editing a `SKILL.md`, subagent definition, or reference
file. This repo has no CI pipeline for skill authoring; run every check
below manually before declaring the work done (see
[empirical validation](../best-practices/empirical-validation.md)).

- Run `skills-ref validate <skill-dir>` when the tool is available. It
  checks standard frontmatter and naming (see the
  [runtime portability matrix](../best-practices/runtime-portability-matrix.md)).
- Confirm `SKILL.md` is under 500 lines and its instruction body under
  ~5,000 tokens, per
  [progressive disclosure](../best-practices/progressive-disclosure.md).
- Confirm any subagent paths referenced in a registry table actually exist
  on disk.
- Confirm the YAML frontmatter `name` matches the directory or file name
  per the [frontmatter contract](../best-practices/frontmatter-contract.md).
- If the skill ships a `scripts/` directory, run the script the way a
  consumer would invoke it.
- If the skill has cases in [`evals/`](../../evals/), re-run them and commit
  the updated `evals/report.md`:
  `node evals/src/orchestration/run.ts --case=<id>` for one case, or
  `node evals/src/orchestration/run.ts` for the suite. Confirm only the
  intended behavior changed. The suite needs `pnpm install` in `evals/`
  once; its own toolchain is checked with `pnpm lint` and `pnpm test` from
  that directory.

When unsure whether a change is correct, follow
[escalation categories](../best-practices/escalation-categories.md) and
escalate to the user.
