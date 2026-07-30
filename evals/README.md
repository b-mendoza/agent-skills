# evals

Local eval suite for the skills in this repo. It runs the Claude Agent SDK
(which bundles its own Claude Code binary) against throwaway fixture
repositories and asserts on observable outcomes. No system `claude` executable
is required, but ambient Claude credentials must be available — a `claude
/login` session or an `ANTHROPIC_API_KEY`.

Evals live here, **outside `skills/`**, on purpose. A skill directory is a
distributable unit — consumers install it the way they install a library — and
eval infrastructure is no more part of that package than a library's test suite
belongs in a consumer's `node_modules`. See
[`empirical-validation`](../docs/best-practices/empirical-validation.md) rule 1.

## Running

```bash
pnpm install                         # once, from this directory

node evals/src/orchestration/run.ts                    # everything (~5 min, ~$2)
node evals/src/orchestration/run.ts --tier=1           # routing only (~30s, ~$0.30)
node evals/src/orchestration/run.ts --case=path-error  # one case
```

Node 24 strips TypeScript types natively, so the suite runs from source with no
build step. Keep the syntax erasable — `erasableSyntaxOnly` is on, so no enums,
parameter properties, decorators, or namespaces.

Exits `0` when every case passes, `1` when a case fails, `2` when no case
matched the filter, `3` on an infrastructure error, and `4` on invalid command
line usage. Set `EVAL_MODEL` to override the model (default `sonnet`).

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
| `mutation-evidence.test.ts` | The read-only detector behind `mutation-scope`                |
| `git-status.test.ts`        | Clean vs. not-a-repo vs. unreadable sample classification     |
| `harness-lifecycle.test.ts` | Query lifecycle against a mocked SDK: results, errors, abort  |
| `fixtures.test.ts`          | Fixture invariants: git state, skill copy, exclusion, cleanup |
| `run-core.test.ts`          | Flag parsing, check normalization, report rendering           |
| `cases.test.ts`             | The case assertions themselves, against synthetic runs        |

Run it before any paid run.

The toolchain and its config are shared with `metadata-scrubber/frontend`, minus
the React-only pieces, so the rules here match the ones you already work under.

## Layout

| Path                         | Contents                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `src/orchestration/run.ts`   | Entry point: selects cases, runs them sequentially, writes the report        |
| `src/observation/harness.ts` | Runs an Agent SDK query, observes its typed messages, captures the git delta |
| `src/fixtures/fixtures.ts`   | Builds throwaway git repos with the skill installed under `.claude/skills/`  |
| `src/cases/<skill>.ts`       | Canonical source of truth: every eval case and its assertions                |
| `src/**/*.test.ts`           | Offline vitest suites, colocated with the code they pin                      |
| `report.md`                  | Generated every run; committed                                               |
| `AGENTS.md`, `docs/agents/`  | Agent guide and long-lived agent guidance                                    |
| `docs/*.md`                  | Short-lived current-state references (layout, verification)                  |

## Tiers

**Tier 1** caps the run with the SDK's `maxBudgetUsd` option so it stops right
after the routing decision is visible. This makes "did the skill trigger" cost
cents instead of dollars — the `Skill` tool call appears in the message stream
before the cap bites.

**Tier 2** is a full behavioral run, asserting on the final output contract.

`mutation-scope` is derived from the tier-2 observations rather than paying for
its own invocation: it asserts no run left a `git status` delta, called
`Write`/`Edit`/`NotebookEdit`, or ran a mutating git command.

### What mutation-scope does not catch

The check combines three observations — a before/after `git status` delta, the
tool names called, and the text of each `Bash` command. That leaves a real gap,
recorded here rather than papered over:

**Arbitrary shell writes are not detected.** `bashEvidence` only recognizes
mutating _git_ commands. A run that writes through the shell — `echo x > f`,
`sed -i`, `rm`, `cp`, `tee`, or any interpreter (`python -c "open(...,'w')"`) —
reads as clean unless the write happens to show up in `git status`. Writes under
`.claude/` never do, because fixtures exclude that directory precisely so the
skill's own scaffolding stays invisible.

This is not fixable with a longer regex: shell redirection, wrappers,
subprocesses, and writes outside the worktree all escape any command-text
pattern, and tokens like `rm` or `>` inside quoted arguments produce false
positives that would fail legitimate read-only runs. Closing it properly needs
a different mechanism — filesystem tracing, or a sandbox that denies writes and
lets the OS report the violation. Until then, read `mutation-scope` as _"no
observed write through git or the file-writing tools"_, not as proof that
nothing was written.

Two related properties the check _does_ now hold, both of which used to fail
silently: a git command that mutates without changing `git status` (`git switch`
moving HEAD between clean branches) is caught from the command text, and a
`git status` sample that could not be taken at all is reported as evidence
rather than compared as if it were clean.

## Adding a case

Add it to `src/cases/<skill>.ts`. A case declares its fixture, prompt, budget, wall
clock, and a `check` that throws to fail and returns a short observed-outcome
string for the report.

`src/cases/<skill>.ts` is the canonical source of truth. A case belongs here only if
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
