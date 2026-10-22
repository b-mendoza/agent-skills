# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), grouped by capability. Tests sit beside the code they exercise.

## Orchestration

`src/orchestration/` contains seven production modules, without nested directories:

| Module             | Responsibility                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `run.ts`           | Direct Node entry point. Its import guard prevents paid runs on import.                                                      |
| `cli.ts`           | Equals-form argument parsing, case selection, exit codes, and the infrastructure-error diagnostic.                           |
| `suite.ts`         | Sequential cases and attempts, attempt-grouped derived mutation checks, NOT_RUN rows, and report writing.                    |
| `execution.ts`     | One attempt: acquire a real fixture, observe the agent, check the result, optionally judge, persist FAIL text, and clean up. |
| `verdict.ts`       | Attempt/result types, check-failure normalization, scores, aggregation, and NOT_RUN results.                                 |
| `report.ts`        | Markdown rendering, progress-line formatting, and the fixed production report path.                                          |
| `configuration.ts` | Import-time `EVAL_MODEL` capture, defaulting to `sonnet` for absent or empty values.                                         |

Tests cover parsing in `arguments.test.ts`, CLI behavior in `cli.test.ts`, sequencing and derived rows in `suite.test.ts` and `suite-derived.test.ts`, execution and judging in `execution.test.ts` and `execution-judge.test.ts`, and infrastructure failures in `failure-lifecycle.test.ts`. `entry.test.ts` runs safe subprocess probes. `verdict.test.ts` and `report-rendering.test.ts` cover pure result policies and formatting.

Execution calls ordinary functions directly. Tests mock the Agent SDK query and use real temporary fixtures. The optional report-path argument exists for tests; the CLI has no output-path flag.

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

Dependency direction is `orchestration → cases, fixtures, observation`; cases also use fixtures' types/planted facts and observation's checks/judge. Fixtures and observation never import orchestration. Within orchestration, `run → cli → suite → execution`; suite and execution use verdict data, report consumes verdict data, and report/execution share configuration. No service registry or injected runtime layers sit between these functions.

At the `evals/` root are toolchain configs, [`README.md`](../README.md), and committed generated [`report.md`](../report.md).

- Entry point: `node src/orchestration/run.ts` from `evals/`, or `pnpm eval`. A matching selection spends money and requires approval.
- Production report: `evals/report.md`, independent of the working directory.
- Failure artifacts: `$TMPDIR/agent-skills-eval-failures/<caseId>-<n>.txt`, only for FAIL attempts. Write failures log to stderr without changing the attempt.
- Import alias: `#/*` maps to `./src/*` through package imports and TypeScript paths.
- Skills under test come from the repository's top-level `skills/` directory.
