# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), one directory per capability, tests colocated with the code they pin:

| Path | Capability | Contents |
| --- | --- | --- |
| `src/orchestration/` | Evaluation orchestration | Root: `run.ts` (entry point and direct-run guard), `report.ts` (result/attempt contracts, report rendering, output path), `verdict.ts` (check outcome to attempt data, attempt aggregation into scored rows, NOT_RUN rows; shared by `suite/` and `case-execution/`) + `report-rendering.test.ts`, `verdict.test.ts`. `invocation/`: `arguments.ts` (flag parsing — `--tier`, `--case`, `--attempts` — and case selection) + `arguments.test.ts`. `suite/`: `coordination.ts` (attempt sequencing, aggregation, derived row, NOT_RUN rows, exit codes), `services.ts` (runner service boundaries and their live layers), `test-support.ts` (synthetic test seam) + `coordination.test.ts`, `entry.test.ts`. `case-execution/`: `execution.ts` (paid single-attempt lifecycle and budgets), `agent-observation.ts` (Agent SDK observation service and live layer), `model-configuration.ts` (model capture), `failure-artifacts.ts` (persists failing attempts' final text under `$TMPDIR/agent-skills-eval-failures/`) + `execution.test.ts`, `configuration.test.ts`. `failure/`: `residual-cause.ts` (residual-defect description), `boundary-errors.ts` (boundary-error unwrapping to a printable message) + `failure-lifecycle.test.ts` |
| `src/fixtures/` | Fixture provisioning | `fixture-errors.ts` (tagged provisioning/cleanup error contracts), `fixtures.ts` (throwaway git repos with the skill installed under `.claude/skills/`, provisioned through the `FixtureProvisioner` service) + `fixtures.test.ts` |
| `src/observation/` | Execution observation | `observation-types.ts` (shared observation contracts), `agent-query-service.ts` (Agent SDK query service and live layer), `agent-query-messages.ts` (SDK message schemas and normalization to a result verdict), `agent-query-stream.ts` (stream settlement and iterator cleanup), `agent-query.ts` (query lifecycle and Promise facade), `git-status.ts` (git sampling service and status classification), `git-command-evidence.ts` (git verb and option classification), `mutation-evidence.ts` (pure assertion helpers), `judge.ts` (rubric-based artifact grading with citation validation; live SDK-backed judge query), `observation-test-support.ts` and `harness-lifecycle-test-support.ts` (synthetic test seams) + `git-status.test.ts`, `harness-lifecycle.test.ts`, `harness-failure-lifecycle.test.ts`, `mutation-evidence.test.ts`, `mutation-evidence-git-commands.test.ts`, `judge.test.ts` |
| `src/cases/` | Behavioral specification | `<skill>.ts` case modules (canonical source of truth for eval cases), `analyzing-recent-project-state-checks.ts` (shared case assertions) + `cases.test.ts` |

Dependency direction: `orchestration → cases, fixtures, observation`; `cases → fixtures` (types plus the exported planted-fact constants) and `observation`; `fixtures` and `observation` import nothing internal. Keep it that way — no `common/` or `utils/` catch-alls. Inside `orchestration/`: `run.ts` sits on top (imports `invocation/` and `suite/`); `suite/` imports every capability directory plus the root modules; `case-execution/` imports `verdict.ts` and `report.ts`, which any directory may import. Two deliberate cross-edges, recorded in the restructuring plan: `failure/boundary-errors.ts` imports the error classes it unwraps from `case-execution/execution.ts` and `suite/services.ts`, and `report.ts` reads the model through `case-execution/model-configuration.ts` (the open G7 cleanup). The module graph is acyclic.

At the `evals/` root: configs (`package.json`, `tsconfig.json`, `vitest.config.ts`, lint/format configs, `.nvmrc`, pnpm files), the human-facing [`README.md`](../README.md), and the committed generated [`report.md`](../report.md).

Key paths:

- Entry point: `node src/orchestration/run.ts` from `evals/` (or `pnpm eval`).
- Report output: always `evals/report.md`, regardless of where `run.ts` lives.
- Import alias: `#/*` maps to `./src/*` (see `package.json` `imports` and `tsconfig.json` `paths`).
- Skills under test are resolved from the repo's top-level `skills/` directory.
