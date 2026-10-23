# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), grouped by capability. Tests sit beside the code they exercise.

## Promptfoo integration

`pnpm eval` invokes promptfoo directly. [`promptfooconfig.ts`](../promptfooconfig.ts) owns the case list, import-time `EVAL_MODEL` capture with absent/empty fallback to `sonnet`, unique JSON/HTML output paths, five repeats, and a default concurrency cap of five attempts. `-j` overrides concurrency. Promptfoo owns filtering, scheduling, terminal output, exports, and history. The config disables caching and sharing; the package scripts disable telemetry and select shared history.

Each case has a `case/{{caseId}}` metric. Every tier-2 attempt also has a native `mutation-scope` assertion and metric. The model appears in the eval description without changing the test dataset.

| Module in `src/promptfoo/` | Responsibility                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider.ts`              | Builds a fixture, calls `observeClaude` with the case's prompt and limits, returns output plus observation metadata and repeat index, and cleans up. |
| `assertion.ts`             | Normalizes check failures, runs the mechanical check before an optional judge, and grades per-attempt mutation evidence.                             |
| `observation.ts`           | Validates observation metadata using the shared observation schema and resolves case IDs.                                                            |

We keep our own SDK runner because promptfoo's built-in Claude provider loses tool-call metadata when the SDK throws at a budget stop. Tier-1 routing checks need those tool calls even when the budget ends the run.

`provider.test.ts` covers fixtures, runner limits, cleanup, concurrency isolation, and check-before-judge ordering. `assertion.test.ts` covers grading and failure normalization. `integration.test.ts` uses the real promptfoo CLI with a local offline provider for filters, repeats, metrics, native exit codes, JSON/HTML artifacts, and shared history.

## Fixtures

`src/fixtures/fixtures.ts` owns synchronous `makeFixture`, fixture types, and planted facts. It builds isolated git/non-git directories, copies the skill under `.claude/skills/`, and returns a cleanup function that removes the temporary root. `fixtures.test.ts` checks real filesystem and git state.

## Observation

| Module in `src/observation/`  | Responsibility                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-query.ts`              | Run options, message schemas and derived types, SDK query, normalization, deadlines, first-result settlement, iterator cleanup, and before/after git sampling. |
| `mutation-evidence.ts`        | Git sampling and status schema, mutation evidence, and skill-invocation extraction.                                                                            |
| `git-command-evidence.ts`     | Git command and option classification.                                                                                                                         |
| `judge.ts`                    | Independent SDK judge query, prompt construction, response parsing, and citation validation.                                                                   |
| `observation-test-support.ts` | Observation/message builders and scripted async streams for tests.                                                                                             |

`agent-query.test.ts` covers stream content and query policy; `agent-query-lifecycle.test.ts` covers failures, cleanup, and deadlines. Git sampling, mutation evidence, git command classification, and judging have their own suites.

## Cases

`src/cases/analyzing-recent-project-state.ts` defines the ordered registry, case contracts, and rubrics. `analyzing-recent-project-state-checks.ts` owns shared assertions. `case-test-support.ts` supplies synthetic observations and report fixtures for `cases.test.ts` and `cases-behavioral.test.ts`. `validate-output-script.test.ts` exercises the skill's shell validator.

## Dependencies and paths

Promptfoo adapters use cases, fixtures, and observation. Cases use fixture facts and observation's mutation checks and judge. Observation and fixtures do not import the adapters.

- Entry point: `pnpm eval` from `evals/`. A matching selection spends money and requires approval.
- Artifacts: the config resolves `outputs/runs/<UTC timestamp>-<random>/results.json` and `results.html` relative to its own directory. JSON contains every attempt's output and observation metadata. Each invocation uses fresh paths.
- History: the package scripts set `PROMPTFOO_CONFIG_DIR=outputs/promptfoo-state`, relative to `evals/`. Run `pnpm eval:view` there to compare saved runs. Mutation-scope metrics appear in native results and the viewer.
- Import alias: `#/*` maps to `./src/*` through package imports and TypeScript paths.
- Skills under test come from the repository's top-level `skills/` directory.
