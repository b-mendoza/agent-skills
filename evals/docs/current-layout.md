# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), grouped by capability. Tests sit beside the code they exercise.

## Promptfoo integration

`pnpm eval` invokes promptfoo directly. [`promptfooconfig.ts`](../promptfooconfig.ts) consumes the shared case registry and owns import-time `EVAL_MODEL` capture with absent/empty fallback to `sonnet`, unique JSON/HTML output paths, five repeats, and a default concurrency cap of five attempts. `-j` overrides concurrency. Promptfoo owns filtering, scheduling, terminal output, exports, and history. The config disables caching and sharing; the package scripts disable telemetry and select shared history.

Each case has a `case/{{caseId}}` metric. Every read-only tier-2 attempt also has a native `mutation-scope` assertion and metric. The model appears in the eval description without changing the test dataset.

| Module in `src/promptfoo/` | Responsibility                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider.ts`              | Installs case-specific skills and seeds, passes limits and bin PATH to `observeClaude`, snapshots requested files, returns metadata, and cleans up. |
| `assertion.ts`             | Normalizes check failures, runs the mechanical check before an optional judge, and grades per-attempt mutation evidence.                            |
| `observation.ts`           | Validates observation metadata using the shared observation schema and resolves case IDs.                                                           |

We keep our own SDK runner because promptfoo's built-in Claude provider loses tool-call metadata when the SDK throws at a budget stop. Tier-1 routing checks need those tool calls even when the budget ends the run.

`provider.test.ts` covers per-case skills, seeds, PATH wiring, snapshots, and cleanup after snapshot failures. `assertion.test.ts` covers runner limits, fixture isolation, grading, failure normalization, and judge ordering. `integration.test.ts` uses the real promptfoo CLI with a local offline provider for filters, repeats, metrics, native exit codes, JSON/HTML artifacts, and shared history.

## Fixtures

`src/fixtures/fixtures.ts` owns synchronous `makeFixture`, fixture types, and planted facts. It builds isolated git/non-git directories, copies all requested skills under `.claude/skills/`, creates a sibling `bin/`, runs the optional synchronous seed, and returns a cleanup function that removes the temporary root. `fixtures.test.ts` checks real filesystem and git state, multi-skill installation, seeded commits, fake CLIs, and cleanup on provisioning or seed failure. The bin directory is outside the repo; `.claude/` remains excluded from git status.

## Observation

| Module in `src/observation/`  | Responsibility                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-query.ts`              | Run options, message schemas and derived types, streaming SDK query, normalization, deadlines, background-task settlement, input/iterator cleanup, and git sampling. |
| `repo-files.ts`               | Captures requested files and trailing-slash directory trees before cleanup; enforces directory bounds and rejects unsafe paths and entries.                          |
| `mutation-evidence.ts`        | Git sampling and status schema, mutation evidence, and skill-invocation extraction.                                                                                  |
| `git-command-evidence.ts`     | Git command and option classification.                                                                                                                               |
| `judge.ts`                    | Independent no-tools SDK query, prompt construction, reply parsing, citation validation, and live summary or cited-violation failure.                                |
| `observation-test-support.ts` | Observation/message builders and scripted async streams for tests.                                                                                                   |

`observeClaude` sends one user message through an async input stream and keeps input open while it reads SDK output. It replaces background-task membership with each `system/background_tasks_changed` snapshot, initially empty for the fresh CLI process. Task-start/update/notification edges do not change that membership because their ordering relative to snapshots is unspecified. A result with live background tasks is provisional; grading waits for a later result with an empty live set, after the CLI handles task completion notifications. An empty snapshot alone never settles the run. The selected result supplies the final text, error/subtype, and cumulative session cost; result costs are not summed. Input closes on every exit, followed by bounded iterator cleanup. The original wall-clock abort and three-second grace period bound background waits too. A stream that ends without an eligible final result fails closed rather than grading an earlier provisional reply.

`agent-query.test.ts` covers stream content, query policy, failures, cleanup, and deadlines. `agent-query-background.test.ts` covers open input, background-task snapshots, follow-up results and tool calls, cumulative costs, and background timeouts. `agent-query-env.test.ts` covers PATH and ambient environment inheritance. File snapshots and judging have their own suites; `mutation-evidence.test.ts` covers git sampling and mutation detection.

## Cases

Each of the 28 skills has a `src/cases/<skill>.ts` exporting `cases` with prompts, checks, and optional judge rubrics. Neighboring `<skill>.test.ts` files test those checks and seeds offline. Suites can split helpers into `<skill>-checks.ts` and `<skill>-fixtures.ts`; work-item suites also reuse fixture helpers across skills. The original snapshot suite uses `cases.test.ts` and `case-test-support.ts`, plus `validate-output-script.test.ts` for its shell validator.

Shared modules:

- `case-contract.ts` owns `EvalCase`, tier constants, routing defaults, prompt context, and the re-exported seed context. Behavioral cases explicitly choose `mutationPolicy: "read-only" | "allowed"`. Optional `extraSkills`, `seed`, and `snapshotPaths` support sibling skills, planted state, fake CLIs, and captured files or directory trees.
- `registry.ts` combines explicitly imported per-skill arrays and exports `CaseId`. Registration uses one import expression per skill in alphabetical order. `registry.test.ts` checks unique namespaced IDs, referenced skill directories, and mutation policies. Every top-level skill with `SKILL.md` must have a tier-1 `<skill>/trigger-positive`, another tier-1 case, and a tier-2 case.
- `shared-checks.ts` owns run-validity, routing, mutation, Bash-call, and file-snapshot checks. `capturedFilesUnder` reads descendants of an explicitly captured trailing-slash directory. `shared-checks.test.ts` supplies passing and failing observations.
- `src/observation/repo-files.ts` captures requested files and directory trees before fixture cleanup. Directory snapshots retain an existence marker and are bounded to 200 files and 1 MiB per file.

## Dependencies and paths

Promptfoo adapters use cases, fixtures, and observation. Cases use fixture facts and observation's mutation checks and judge. Observation and fixtures do not import the adapters.

- Entry point: `pnpm eval` from `evals/`. A matching selection spends money and requires approval.
- Artifacts: the config resolves `outputs/runs/<UTC timestamp>-<random>/results.json` and `results.html` relative to its own directory. JSON contains every attempt's output and observation metadata. Each invocation uses fresh paths.
- History: the package scripts set `PROMPTFOO_CONFIG_DIR=outputs/promptfoo-state`, relative to `evals/`. Run `pnpm eval:view` there to compare saved runs. Mutation-scope metrics appear in native results and the viewer.
- Import alias: `#/*` maps to `./src/*` through package imports and TypeScript paths.
- Skills under test come from the repository's top-level `skills/` directory.
