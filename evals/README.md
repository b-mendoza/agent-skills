# evals

> Short-lived current-state reference. Update this file in the same change that alters what it describes (commands, layout, test files, coverage).

Local eval suite for the skills in this repo. It runs the Claude Agent SDK (which bundles its own Claude Code binary) against throwaway fixture repositories and asserts on observable outcomes. No system `claude` executable is required, but ambient Claude credentials must be available — a `claude /login` session or an `ANTHROPIC_API_KEY`.

Evals live here, **outside `skills/`**, on purpose. A skill directory is a distributable unit — consumers install it the way they install a library — and eval infrastructure is no more part of that package than a library's test suite belongs in a consumer's `node_modules`. See [`validate-by-observation`](../docs/best-practices/validate-by-observation.md).

## Running

```bash
# Run these commands from evals/.
pnpm install                                      # once
pnpm eval                                         # everything, 5 attempts per case
pnpm eval --filter-metadata tier=1                 # routing only
pnpm eval --filter-pattern '^snapshot-dirty$'      # one case
pnpm eval --repeat 1                               # cheap, low-confidence smoke run
pnpm eval -j 3                                     # override default: up to 3 concurrent attempts
pnpm eval:view                                    # browse and compare saved runs
```

Node 24 strips TypeScript types natively, so the suite runs from source with no build step. Keep the syntax erasable — `erasableSyntaxOnly` is on, so no enums, parameter properties, decorators, or namespaces.

Each selected case runs `--repeat` times, default 5, and reports a **score**, the percent of attempts whose check passed, plus a **status** derived from the same counts: `PASS` for every attempt, `FAIL` for none, `DEGRADED` for a mix, and `NOT_RUN` for cases not executed by this run. A `NOT_RUN` score stays empty rather than reading as zero. The default concurrency cap is 5 attempts across the whole queue, including repeats; `-j` overrides it. Each process has its own cap, so two concurrent default runs can have 10 attempts in flight. Extra arguments go to promptfoo.

Exits `0` when every executed case passes every attempt, `1` when a case fails or is degraded, `2` when no case matched the filter, and `3` on an infrastructure error. Missing or malformed results, any provider error row, subprocess failure, and output-directory failure are infrastructure errors. Set `EVAL_MODEL` to override the model, default `sonnet`.

Each invocation creates `outputs/runs/<UTC timestamp>-<random>/` with `results.json` and a self-contained `results.html`, one row per attempt. Runs also persist in promptfoo's SQLite database under `outputs/promptfoo-state`. These outputs are ignored by git. Use `pnpm eval:view` to browse history and compare runs side by side. Per-case metrics show pass rates across repeats; the eval description records the model without changing the test dataset. The terminal lists each non-PASS case, including skipped `NOT_RUN` cases and the derived `mutation-scope` result. The derived result is not a promptfoo row and does not appear in the HTML or viewer.

## Checks

```bash
pnpm lint    # tsc, eslint, oxlint, oxfmt --check, in parallel
pnpm fix     # eslint --fix, oxlint --fix, oxfmt --write
pnpm test    # vitest: unit tests for the pure functions, free and offline
```

`pnpm test` is not the eval suite. It covers the parts that can be checked without spending tokens, so a break shows up in seconds instead of after a paid run:

Paths below are relative to `src/`, from `find src -name '*.test.ts'`.

| Test file                                            | Pins                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `cases/cases-behavioral.test.ts`                     | Tier-2 assertions: envelopes, report conformance, injection defense                                             |
| `cases/cases.test.ts`                                | Run-validity and routing assertions against synthetic runs                                                      |
| `cases/validate-output-script.test.ts`               | The skill's deterministic validator, per mode, good and bad payloads                                            |
| `fixtures/fixtures.test.ts`                          | Fixture git state, skill copy, exclusion, cleanup                                                               |
| `observation/git-status.test.ts`                     | Clean, not-a-repo, and unreadable sample classification                                                         |
| `observation/harness-failure-lifecycle.test.ts`      | Query, iterator, and cleanup failure handling                                                                   |
| `observation/harness-lifecycle.test.ts`              | Mocked SDK lifecycle: results, errors, abort                                                                    |
| `observation/harness-timeout.test.ts`                | Deadline and abort behavior                                                                                     |
| `observation/judge.test.ts`                          | Judge citation validation and unparseable-reply failure                                                         |
| `observation/mutation-evidence-git-commands.test.ts` | Mutating git commands and read-only lookalikes                                                                  |
| `observation/mutation-evidence.test.ts`              | The read-only detector behind `mutation-scope`                                                                  |
| `orchestration/entry.test.ts`                        | The direct-entry guard on the runner                                                                            |
| `orchestration/run.test.ts`                          | Argument forwarding, unique artifacts, history state, summaries, exit codes, infrastructure failures            |
| `orchestration/verdict.test.ts`                      | Check normalization, scores, statuses, NOT_RUN rows                                                             |
| `promptfoo/integration.test.ts`                      | Real promptfoo CLI with an offline provider: filters, repeat overrides, assertion output, JSON/HTML and history |
| `promptfoo/provider.test.ts`                         | Runner limits, fixture isolation and cleanup, check-before-judge ordering                                       |
| `promptfoo/results.test.ts`                          | Result grouping, skipped cases, derived mutation scope, provider errors                                         |
| `promptfoo/tests.test.ts`                            | Case registry generation with filterable IDs and tiers                                                          |

Run it before any paid run.

The toolchain and its config are shared with `metadata-scrubber/frontend`, minus the React-only pieces, so the rules here match the ones you already work under.

## Layout

| Path                             | Contents                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `promptfooconfig.ts`             | Provider, assertion, generated tests, default repeats and concurrency                                           |
| `src/orchestration/run.ts`       | Inert-on-import entry point; spawns promptfoo, reads JSON, prints summaries and artifact paths, maps exit codes |
| `src/orchestration/`             | Shared verdicts, run coordination, model configuration                                                          |
| `src/promptfoo/`                 | Custom provider, assertion, test generation, observation validation, result aggregation                         |
| `src/observation/agent-query.ts` | Runs an Agent SDK query, observes its typed messages, captures the git delta                                    |
| `src/fixtures/fixtures.ts`       | Builds throwaway git repos with the skill installed under `.claude/skills/`                                     |
| `src/cases/<skill>.ts`           | Canonical source of truth: every eval case and its assertions                                                   |
| `src/**/*.test.ts`               | Offline vitest suites, colocated with the code they pin                                                         |
| `outputs/`                       | Ignored per-run JSON/HTML artifacts and shared promptfoo history                                                |
| `AGENTS.md`, `docs/agent/`       | Agent guide and long-lived agent guidance                                                                       |
| `docs/*.md`                      | Short-lived references and dated historical plans                                                               |

See [current layout](docs/current-layout.md) for module responsibilities and why the provider keeps our SDK runner.

## Tiers

**Tier 1** caps the run with the SDK's `maxBudgetUsd` option so it stops right after the routing decision is visible. This makes "did the skill trigger" cost cents instead of dollars — the `Skill` tool call appears in the message stream before the cap bites.

**Tier 2** is a full behavioral run. Assertion altitude follows the skill contract's own split: exact checks at machine-parsed boundaries (status lines, the three-line envelope, the snapshot title), conformance checks for report shape (canonical section names at any order, numbering, or heading level; disclosure lines exactly once; no leaked status wrapper or `Inspected:` log), and judge-based grading for semantic quality.

**Deterministic runtime validation.** The skill ships its own shape validator (`skills/analyzing-recent-project-state/scripts/validate-output.sh`) that subagents run on their output before returning and the orchestrator runs at its payload gates. The eval checks reuse the same script (`runOutputValidator` in the checks module), so test-time and runtime grade shapes identically, and tier-2 cases assert the validator was actually invoked (a `Bash` call visible in the tool stream). Evals are test-time guarantees; the script is the one that persists at runtime — the suite's job is verifying that mechanism engages, plus everything a script cannot check (routing, semantic quality, injection resistance).

Read the JSON path printed by the runner to diagnose failures. It holds every attempt's output and observation metadata, not just failures. Later runs cannot overwrite it. The runner resolves artifact and history paths relative to the suite, independent of the working directory. It disables caching, sharing, and telemetry, but keeps database writes enabled for the viewer.

**Judge-based checks** (`src/observation/judge.ts`) grade an artifact against a binary rubric with an independent small model. This is a deliberate extension of the assert-only-observables rule: the judged artifact is the observable and the judge is a measurement instrument reading it — what stays banned is asking the agent under test whether it complied. Two guards keep verdicts honest: a violation counts only when its quote is mechanically verified to appear verbatim in the artifact (uncited complaints are recorded, never failing), and an unparseable judge reply fails the attempt with a message naming the judge, so grading trouble is never mistaken for a verdict on the skill. Judges run only after a case's mechanical check passes.

**Coverage gap, recorded on purpose:** fixtures install the skill but register no subagents in either runtime's agent registry, so every behavioral run exercises the skill's _inline_ route. The isolated (dispatched-subagent) route — and with it any "did the orchestrator pass the contracted inputs to the subagent" assertion — is currently untestable here; covering it needs fixtures that register the three subagent definitions and a harness that captures dispatch payloads.

`mutation-scope` is derived from the tier-2 observations rather than paying for its own invocation: it asserts no run left a `git status` delta, called `Write`/`Edit`/`NotebookEdit`, or ran a mutating git command.

### What mutation-scope does not catch

The check combines three observations — a before/after `git status` delta, the tool names called, and the text of each `Bash` command. That leaves a real gap, recorded here rather than papered over:

**Arbitrary shell writes are not detected.** Bash command classification only recognizes mutating _git_ commands. A run that writes through the shell — `echo x > f`, `sed -i`, `rm`, `cp`, `tee`, or any interpreter (`python -c "open(...,'w')"`) — reads as clean unless the write happens to show up in `git status`. Writes under `.claude/` never do, because fixtures exclude that directory precisely so the skill's own scaffolding stays invisible.

This is not fixable with a longer regex: shell redirection, wrappers, subprocesses, and writes outside the worktree all escape any command-text pattern, and tokens like `rm` or `>` inside quoted arguments produce false positives that would fail legitimate read-only runs. Closing it properly needs a different mechanism — filesystem tracing, or a sandbox that denies writes and lets the OS report the violation. Until then, read `mutation-scope` as _"no observed write through git or the file-writing tools"_, not as proof that nothing was written.

Two related properties the check _does_ now hold, both of which used to fail silently: a git command that mutates without changing `git status` (`git switch` moving HEAD between clean branches) is caught from the command text, and a `git status` sample that could not be taken at all is reported as evidence rather than compared as if it were clean.

## Adding a case

Add it to `src/cases/<skill>.ts`. A case declares its fixture, prompt, budget, wall clock, and a `check` that throws to fail and returns a short observed-outcome string for the results.

`src/cases/<skill>.ts` is the canonical source of truth. A case belongs here only if it runs and asserts something observable; there is no parallel list of aspirational cases, because a case nothing executes proves nothing.

Two rules, both from the mandatory practice:

- **Assert only observables** — tool calls, literal output text, git deltas. Never assert that the agent said it complied.
- **Do not weaken an assertion to automate it.** If the only cheap check would also pass on wrong output, the case is not ready to add. Leave it out rather than shipping a green check that means nothing.

When adding an assertion, verify it fails on wrong input before trusting it green — a check that never fails is not a check.

## Coverage

Skills with a suite: `analyzing-recent-project-state` (10 cases plus the derived `mutation-scope` row: 5 routing, including two sibling-boundary negatives; 5 behavioral, including a judged full-report case and an injection-defense case). The other skills have none yet.
