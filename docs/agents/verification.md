# Verification Checklist

Load this file after editing a `SKILL.md`, subagent definition, or reference
file. This repo has no CI pipeline for skill authoring; every check below is
run manually — the absence of CI is a known gap, not permission to declare
work done without checks.

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
  `node evals/src/orchestration/run.ts` for the suite. Behavior changes
  outside the intended one are regressions. The suite needs `pnpm install`
  in `evals/` once; its own toolchain is checked with `pnpm lint` and
  `pnpm test` from that directory.
- If the change touches `skills-lock.json` or vendored skills under
  `.agents/skills/` or `.claude/skills/`, confirm the change came from the
  managing tool — do not hand-edit the lockfile.

When unsure whether a change is correct, escalate to the user rather than
declaring success.
