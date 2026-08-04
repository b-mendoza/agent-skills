# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), one directory per capability, tests colocated with the code they pin:

| Path | Capability | Contents |
| --- | --- | --- |
| `src/orchestration/` | Evaluation orchestration | `run.ts` (entry point and direct-run guard), `run-arguments.ts` (flag parsing and case selection), `run-services.ts` (runner service boundaries and their live layers), `run-coordination.ts` (sequencing, derived row, exit codes), `run-failure-reporting.ts` (residual-defect description), `run-configuration.ts` (model capture), `case-execution.ts` (paid case lifecycle and budgets), `observation-runner.ts` (Agent SDK observation service and live layer), `case-checks.ts` (check outcome to report row), `report.ts` (report rendering and output path), `run-coordination-test-support.ts` (synthetic test seam) + contract-focused `run-arguments.test.ts`, `run-coordination.test.ts`, `run-failure-lifecycle.test.ts`, `run-configuration.test.ts`, `case-checks.test.ts`, `case-execution.test.ts`, `report-rendering.test.ts`, and `run-entry.test.ts` |
| `src/fixtures/` | Fixture provisioning | `fixture-errors.ts` (tagged provisioning/cleanup error contracts), `fixtures.ts` (throwaway git repos with the skill installed under `.claude/skills/`, provisioned through the `FixtureProvisioner` service) + `fixtures.test.ts` |
| `src/observation/` | Execution observation | `observation-types.ts` (shared observation contracts), `agent-query-service.ts` (Agent SDK query service and live layer), `agent-query-messages.ts` (SDK message schemas and normalization to a result verdict), `agent-query-stream.ts` (stream settlement and iterator cleanup), `agent-query.ts` (query lifecycle and Promise facade), `git-status.ts` (git sampling service and status classification), `git-command-evidence.ts` (git verb and option classification), `mutation-evidence.ts` (pure assertion helpers), `observation-test-support.ts` and `harness-lifecycle-test-support.ts` (synthetic test seams) + `git-status.test.ts`, `harness-lifecycle.test.ts`, `harness-failure-lifecycle.test.ts`, `mutation-evidence.test.ts`, `mutation-evidence-git-commands.test.ts` |
| `src/cases/` | Behavioral specification | `<skill>.ts` case modules (canonical source of truth for eval cases), `analyzing-recent-project-state-checks.ts` (shared case assertions) + `cases.test.ts` |

Dependency direction: `orchestration → cases, fixtures, observation`; `cases → fixtures` (types only) and `observation`; `fixtures` and `observation` import nothing internal. Keep it that way — no `common/` or `utils/` catch-alls.

At the `evals/` root: configs (`package.json`, `tsconfig.json`, `vitest.config.ts`, lint/format configs, `.nvmrc`, pnpm files), the human-facing [`README.md`](../README.md), and the committed generated [`report.md`](../report.md).

Key paths:

- Entry point: `node src/orchestration/run.ts` from `evals/` (or `pnpm eval`).
- Report output: always `evals/report.md`, regardless of where `run.ts` lives.
- Import alias: `#/*` maps to `./src/*` (see `package.json` `imports` and `tsconfig.json` `paths`).
- Skills under test are resolved from the repo's top-level `skills/` directory.
