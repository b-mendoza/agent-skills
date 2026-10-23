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

`pnpm eval` invokes promptfoo directly and uses its native terminal output. Each selected case runs `--repeat` times, default 5. The default concurrency cap is 5 attempts across the whole queue, including repeats; `-j` overrides it. Each process has its own cap, so two concurrent default runs can have 10 attempts in flight. Extra arguments go to promptfoo. Set `EVAL_MODEL` to override the model, default `sonnet`.

Native exit codes observed offline: `0` for passing attempts or an empty selection, `100` for any failed attempt, including provider errors, and `1` for an invalid CLI option.

Each invocation configures a unique `outputs/runs/<UTC timestamp>-<random>/` with `results.json` and a self-contained `results.html`. Runs also persist in promptfoo's SQLite database under `outputs/promptfoo-state`. These outputs are ignored by git. Use `pnpm eval:view` to browse history and compare runs. Per-case metrics show pass rates across repeats; tier-2 attempts also carry the `mutation-scope` metric. The eval description records the model without changing the test dataset.

## Checks

```bash
pnpm lint    # tsc, eslint, oxlint, oxfmt --check, in parallel
pnpm fix     # eslint --fix, oxlint --fix, oxfmt --write
pnpm test    # vitest: unit tests for the pure functions, free and offline
```

`pnpm test` is not the eval suite. It covers the parts that can be checked without spending tokens, so a break shows up in seconds instead of after a paid run:

Paths below are relative to `src/`, from `find src -name '*.test.ts'`.

| Test file                                            | Pins                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cases/cases-behavioral.test.ts`                     | Tier-2 assertions: envelopes, report conformance, injection defense          |
| `cases/cases.test.ts`                                | Run validity, routing, and per-attempt mutation scope                        |
| `cases/validate-output-script.test.ts`               | The skill's deterministic validator, per mode, good and bad payloads         |
| `fixtures/fixtures.test.ts`                          | Fixture git state, skill copy, exclusion, cleanup                            |
| `observation/agent-query-lifecycle.test.ts`          | Query failures, iterator cleanup, deadlines, and abort behavior              |
| `observation/agent-query.test.ts`                    | SDK policy, stream validation, tool calls, results, and git sampling         |
| `observation/git-status.test.ts`                     | Clean, not-a-repo, and unreadable sample classification                      |
| `observation/judge.test.ts`                          | Judge citation validation and unparseable-reply failure                      |
| `observation/mutation-evidence-git-commands.test.ts` | Mutating git commands and read-only lookalikes                               |
| `observation/mutation-evidence.test.ts`              | The read-only detector behind `mutation-scope`                               |
| `promptfoo/assertion.test.ts`                        | Check normalization, judge failures, and native mutation assertion           |
| `promptfoo/integration.test.ts`                      | Offline native CLI: filters, repeats, metrics, exits, JSON/HTML, and history |
| `promptfoo/provider.test.ts`                         | Runner limits, fixture isolation and cleanup, check-before-judge ordering    |

Run it before any paid run.

The toolchain and its config are shared with `metadata-scrubber/frontend`, minus the React-only pieces, so the rules here match the ones you already work under.

## Layout

| Path                             | Contents                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `promptfooconfig.ts`             | Model, provider, native assertions, cases, output paths, repeats and concurrency    |
| `src/promptfoo/`                 | Custom provider, assertion grading, observation metadata validation and case lookup |
| `src/observation/agent-query.ts` | SDK query, message schemas and types, tool observation and git sampling             |
| `src/fixtures/fixtures.ts`       | Throwaway git repos with the skill installed under `.claude/skills/`                |
| `src/cases/<skill>.ts`           | Canonical case registry and assertions                                              |
| `src/**/*.test.ts`               | Offline Vitest suites beside the code they exercise                                 |
| `outputs/`                       | Ignored per-run JSON/HTML artifacts and shared promptfoo history                    |
| `AGENTS.md`, `docs/agent/`       | Agent guide and long-lived guidance                                                 |
| `docs/*.md`                      | Short-lived references and dated historical plans                                   |

See [current layout](docs/current-layout.md) for module responsibilities and why the provider keeps our SDK runner.

## Tiers

**Tier 1** caps the run with the SDK's `maxBudgetUsd` option so it stops right after the routing decision is visible. This makes "did the skill trigger" cost cents instead of dollars — the `Skill` tool call appears in the message stream before the cap bites.

**Tier 2** is a full behavioral run. Assertion altitude follows the skill contract's own split: exact checks at machine-parsed boundaries (status lines, the three-line envelope, the snapshot title), conformance checks for report shape (canonical section names at any order, numbering, or heading level; disclosure lines exactly once; no leaked status wrapper or `Inspected:` log), and judge-based grading for semantic quality.

**Deterministic runtime validation.** The skill ships a shape validator (`skills/analyzing-recent-project-state/scripts/validate-output.sh`) for subagent outputs and payload gates. The eval runs it for escalation envelopes. Report checks use host-side assertions; tier-2 cases also require a `Bash` call mentioning the validator. That call alone does not prove the final report was validated.

Read the per-run JSON to diagnose failures. It holds every attempt's output and observation metadata, not just failures. The config resolves unique artifact paths relative to its own directory, independent of the working directory. The package scripts select shared history relative to `evals/` and disable telemetry; the config disables caching and sharing. Database writes remain enabled for the viewer.

**Judge-based checks** (`src/observation/judge.ts`) grade an artifact against a binary rubric with an independent small model. This is a deliberate extension of the assert-only-observables rule: the judged artifact is the observable and the judge is a measurement instrument reading it — what stays banned is asking the agent under test whether it complied. Two guards keep verdicts honest: a violation counts only when its quote is mechanically verified to appear verbatim in the artifact (uncited complaints are recorded, never failing), and an unparseable judge reply fails the attempt with a message naming the judge, so grading trouble is never mistaken for a verdict on the skill. Judges run only after a case's mechanical check passes.

**Coverage gap, recorded on purpose:** fixtures install the skill but register no subagents in either runtime's agent registry, so every behavioral run exercises the skill's _inline_ route. The isolated (dispatched-subagent) route — and with it any "did the orchestrator pass the contracted inputs to the subagent" assertion — is currently untestable here; covering it needs fixtures that register the three subagent definitions and a harness that captures dispatch payloads.

`mutation-scope` is a native per-attempt assertion on every tier-2 case, with no extra model invocation. It rejects invalid runs, `git status` deltas, `Write`/`Edit`/`NotebookEdit` calls, and mutating git commands. Its metric appears in native results, HTML, and history.

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

Skills with a suite: `analyzing-recent-project-state` (10 cases, with a `mutation-scope` assertion on each tier-2 attempt: 5 routing, including two sibling-boundary negatives; 5 behavioral, including a judged full-report case and an injection-defense case). The other skills have none yet.
