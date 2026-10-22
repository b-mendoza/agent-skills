# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), grouped by capability. Tests sit beside the code they exercise.

## Orchestration

| Module             | Responsibility                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run.ts`           | Direct Node entry point with an inert-import guard. Spawns promptfoo, forwards arguments, reads JSON results, writes the report, and maps exit codes. |
| `execution.ts`     | One attempt: acquire a real fixture, observe the agent, check the result, optionally judge, persist FAIL text, and clean up.                          |
| `verdict.ts`       | Attempt/result types, check-failure normalization, scores, aggregation, and NOT_RUN results.                                                          |
| `report.ts`        | Markdown rendering, progress-line formatting, and the fixed production report path.                                                                   |
| `configuration.ts` | Import-time `EVAL_MODEL` capture, defaulting to `sonnet` for absent or empty values.                                                                  |

`run.test.ts` covers argument forwarding, fixed subprocess flags, report writing, and infrastructure failures with a mocked subprocess. `entry.test.ts` runs safe subprocess probes. `verdict.test.ts` and `report-rendering.test.ts` cover result policies and formatting. Optional report and JSON paths on `runCli` keep tests away from production artifacts.

## Promptfoo integration

[`promptfooconfig.ts`](../promptfooconfig.ts) configures promptfoo 0.124.1 with five repeats and concurrency one. Promptfoo owns case filtering, repetitions, scheduling, and JSON export. The wrapper fixes the config and output path and disables caching, database writes, sharing, and telemetry.

| Module in `src/promptfoo/` | Responsibility                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider.ts`              | Builds a fixture, calls `observeClaude` with the case's prompt and limits, returns output plus observation metadata and repeat index, and cleans up.                               |
| `assertion.ts`             | Runs the mechanical case check, then an optional judge through the shared verdict functions.                                                                                       |
| `tests.ts`                 | Generates promptfoo tests from the exported `cases`, with case IDs as descriptions and tier metadata for filtering.                                                                |
| `observation.ts`           | Validates observation metadata and resolves case IDs.                                                                                                                              |
| `results.ts`               | Parses promptfoo JSON, rejects provider errors, aggregates attempts into per-case results, fills NOT_RUN rows, derives mutation scope by repeat index, and maps result exit codes. |

We keep our own SDK runner because promptfoo's built-in Claude provider loses tool-call metadata when the SDK throws at a budget stop. Tier-1 routing checks need those tool calls even when the budget ends the run.

`provider.test.ts` covers fixtures, runner limits, cleanup, concurrency isolation, and check-before-judge ordering. `tests.test.ts` checks generated cases; `results.test.ts` checks parsing and aggregation. `integration.test.ts` runs the real promptfoo CLI with a local offline provider to verify filtering, repetitions, and assertion output without model calls.

## Fixtures

`src/fixtures/fixtures.ts` owns synchronous `makeFixture`, fixture types, and planted facts. It builds isolated git/non-git directories, copies the skill under `.claude/skills/`, and returns a cleanup function that removes the entire temporary root. Filesystem and git errors propagate without wrappers. `fixtures.test.ts` checks the real filesystem and git state.

## Observation

| Module in `src/observation/`  | Responsibility                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `observation-types.ts`        | Run options, normalized observations, tool calls, and result verdicts.                               |
| `agent-query.ts`              | SDK query, deadline/abort, first-result settlement, iterator cleanup, and before/after git sampling. |
| `agent-query-messages.ts`     | SDK message validation and normalization.                                                            |
| `git-status.ts`               | Synchronous git sampling and worktree/no-worktree/unreadable classification.                         |
| `git-command-evidence.ts`     | Git command and option classification.                                                               |
| `mutation-evidence.ts`        | Mutation evidence and skill-invocation extraction.                                                   |
| `judge.ts`                    | Independent SDK judge query, prompt construction, response parsing, and citation validation.         |
| `observation-test-support.ts` | Plain observation/message builders and scripted async message streams for tests.                     |

Tests are `git-status.test.ts`, `harness-lifecycle.test.ts`, `harness-failure-lifecycle.test.ts`, `harness-timeout.test.ts`, `mutation-evidence.test.ts`, `mutation-evidence-git-commands.test.ts`, and `judge.test.ts`.

## Cases

`src/cases/analyzing-recent-project-state.ts` defines the ordered registry, case contracts, and rubrics. `analyzing-recent-project-state-checks.ts` owns shared assertions. `case-test-support.ts` supplies valid report data and case lookup for `cases.test.ts` and `cases-behavioral.test.ts`. `validate-output-script.test.ts` exercises the skill's own shell validator.

## Dependencies and paths

`run.ts` uses promptfoo result conversion and report rendering. The promptfoo adapters use cases, fixtures, observation, and shared orchestration verdicts/configuration. Cases also use fixtures' types/planted facts and observation's checks/judge. Fixtures and observation do not import orchestration.

At the `evals/` root are toolchain configs, `promptfooconfig.ts`, [`README.md`](../README.md), and committed generated [`report.md`](../report.md).

- Entry point: `pnpm eval` from `evals/`. A matching selection spends money and requires approval.
- Production report: `evals/report.md`, independent of the working directory. No-match runs preserve it.
- Attempt evidence: a unique `$TMPDIR/agent-skills-eval-*/results.json` per invocation, with its path printed by the runner. It contains every attempt's output and observation metadata; later runs do not overwrite it. There are no separate failure-text files.
- Import alias: `#/*` maps to `./src/*` through package imports and TypeScript paths.
- Skills under test come from the repository's top-level `skills/` directory.
