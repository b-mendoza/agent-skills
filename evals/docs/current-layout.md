# Current layout

> Short-lived current-state reference. Update this file in the same change that moves, renames, or re-owns anything it describes.

Source lives under [`src/`](../src/), one directory per capability, tests colocated with the code they pin:

| Path | Capability | Contents |
| --- | --- | --- |
| `src/orchestration/` | Evaluation orchestration | `run.ts` (entry point, selection, sequencing, exit codes), `run-configuration.ts` (model capture), `case-execution.ts` (paid case lifecycle and budgets), `report.ts` (report rendering and output path) + contract-focused `run-arguments.test.ts`, `run-coordination.test.ts`, `run-results.test.ts`, and `run-entry.test.ts` |
| `src/fixtures/` | Fixture provisioning | `fixtures.ts` (throwaway git repos with the skill installed under `.claude/skills/`) + `fixtures.test.ts` |
| `src/observation/` | Execution observation | `harness.ts` (runs an Agent SDK query, observes its typed message stream, samples git state, gathers mutation evidence), `observation-test-support.ts` (shared synthetic observations) + `git-status.test.ts`, `harness-lifecycle.test.ts`, `mutation-evidence.test.ts` |
| `src/cases/` | Behavioral specification | `<skill>.ts` case modules (canonical source of truth for eval cases), `analyzing-recent-project-state-checks.ts` (shared case assertions) + `cases.test.ts` |

Dependency direction: `orchestration → cases, fixtures, observation`; `cases → fixtures` (types only) and `observation`; `fixtures` and `observation` import nothing internal. Keep it that way — no `common/` or `utils/` catch-alls.

At the `evals/` root: configs (`package.json`, `tsconfig.json`, `vitest.config.ts`, lint/format configs, `.nvmrc`, pnpm files), the human-facing [`README.md`](../README.md), and the committed generated [`report.md`](../report.md).

Key paths:

- Entry point: `node src/orchestration/run.ts` from `evals/` (or `pnpm eval`).
- Report output: always `evals/report.md`, regardless of where `run.ts` lives.
- Import alias: `#/*` maps to `./src/*` (see `package.json` `imports` and `tsconfig.json` `paths`).
- Skills under test are resolved from the repo's top-level `skills/` directory.
