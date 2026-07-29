# evals

Local eval suite for the skills in this repo. It invokes the installed agent
CLIs against throwaway fixture repositories and asserts on observable outcomes.

Evals live here, **outside `skills/`**, on purpose. A skill directory is a
distributable unit — consumers install it the way they install a library — and
eval infrastructure is no more part of that package than a library's test suite
belongs in a consumer's `node_modules`. See
[`empirical-validation`](../docs/best-practices/empirical-validation.md) rule 1.

## Running

```bash
pnpm install                         # once, from this directory

node evals/run.ts                    # everything (~5 min, ~$2)
node evals/run.ts --tier=1           # routing only (~30s, ~$0.30)
node evals/run.ts --case=path-error  # one case
```

Node 24 strips TypeScript types natively, so the suite runs from source with no
build step. Keep the syntax erasable — `erasableSyntaxOnly` is on, so no enums,
parameter properties, decorators, or namespaces.

Exits `0` when every case passes, `1` when a case fails, `2` when no case
matched the filter, and `3` on an infrastructure error. Set `EVAL_MODEL` to
override the model (default `haiku`).

Each run rewrites [`report.md`](./report.md), which is committed so a behavior
change shows up in `git diff`.

## Checks

```bash
pnpm lint    # tsc, eslint, oxlint, oxfmt --check, in parallel
pnpm fix     # eslint --fix, oxlint --fix, oxfmt --write
pnpm test    # vitest: unit tests for the pure functions, free and offline
```

`pnpm test` is not the eval suite. It covers the parts that can be checked
without spending tokens, so a break shows up in seconds instead of after a
paid run:

| Test file                   | Pins                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `parse-stream-line.test.ts` | The NDJSON parser's tolerance contract                        |
| `mutation-evidence.test.ts` | The read-only detector behind `mutation-scope`                |
| `fixtures.test.ts`          | Fixture invariants: git state, skill copy, exclusion, cleanup |
| `run-core.test.ts`          | Flag parsing, check normalization, report rendering           |

Run it before any paid run.

The toolchain and its config are shared with `metadata-scrubber/frontend`, minus
the React-only pieces, so the rules here match the ones you already work under.

## Layout

| Path               | Contents                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| `run.ts`           | Entry point: selects cases, runs them sequentially, writes the report       |
| `harness.ts`       | Spawns the CLI, parses the NDJSON event stream, captures the git delta      |
| `fixtures.ts`      | Builds throwaway git repos with the skill installed under `.claude/skills/` |
| `cases/<skill>.ts` | Canonical source of truth: every eval case and its assertions               |
| `*.test.ts`        | Offline vitest suites; see the Checks table above                           |
| `report.md`        | Generated every run; committed                                              |

## Tiers

**Tier 1** caps the run with `--max-budget-usd` so it stops right after the
routing decision is visible. This makes "did the skill trigger" cost cents
instead of dollars — the `Skill` tool call is emitted before the cap bites.

**Tier 2** is a full behavioral run, asserting on the final output contract.

`mutation-scope` is derived from the tier-2 observations rather than paying for
its own invocation: it asserts no run wrote a file, called `Write`/`Edit`, or ran
a mutating git command.

## Adding a case

Add it to `cases/<skill>.ts`. A case declares its fixture, prompt, budget, wall
clock, and a `check` that throws to fail and returns a short observed-outcome
string for the report.

`cases/<skill>.ts` is the canonical source of truth. A case belongs here only if
it runs and asserts something observable; there is no parallel list of aspirational
cases, because a case nothing executes proves nothing.

Two rules, both from the mandatory practice:

- **Assert only observables** — tool calls, literal output text, git deltas.
  Never assert that the agent said it complied.
- **Do not weaken an assertion to automate it.** If the only cheap check would
  also pass on wrong output, the case is not ready to add. Leave it out rather
  than shipping a green check that means nothing.

When adding an assertion, verify it fails on wrong input before trusting it
green — a check that never fails is not a check.

## Coverage

Skills with a suite: `analyzing-recent-project-state` (7 cases). The other
skills have none yet.
