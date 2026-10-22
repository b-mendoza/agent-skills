# Verification

> Short-lived current-state reference. Update this file in the same change that alters commands, exit codes, or check behavior.

Run all commands below from `evals/`.

## Free checks

| Task                                 | Check                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any TypeScript change                | `pnpm test`, offline Vitest suites with no tokens spent                                                                                                        |
| Any change, before completion        | `pnpm lint`, tsc, eslint, oxlint, oxfmt `--check` in parallel                                                                                                  |
| Auto-fixable lint/format findings    | `pnpm fix`                                                                                                                                                     |
| Runner argument and failure handling | `pnpm test src/orchestration/run.test.ts`, mocked subprocess checks for forwarded arguments, no-match exit `2`, preserved reports, and infrastructure exit `3` |
| Promptfoo integration                | `pnpm test src/promptfoo/integration.test.ts`, real CLI with a local offline provider for filters, repeat overrides, and assertion output                      |
| Import safety                        | `pnpm test src/orchestration/entry.test.ts`, importing the runner must stay inert                                                                              |

## Paid checks

These require explicit user approval.

| Task                   | Check                                                      |
| ---------------------- | ---------------------------------------------------------- |
| One case end-to-end    | `pnpm eval --filter-pattern '^snapshot-dirty$' --repeat 1` |
| Routing decisions only | `pnpm eval --filter-metadata tier=1`                       |
| Full suite             | `pnpm eval`                                                |
| Concurrent run         | `pnpm eval -j 3`                                           |

Cases with a `judge` field additionally run one cheap judge-model query per attempt after the mechanical check passes. Judge cost is cents per attempt and is not folded into the report's cost column, which measures the observed run only.

Each case runs five times by default. Use `--repeat 1` for a cheap, low-confidence smoke run. Default concurrency is one; `-j 3` allows up to three concurrent attempts. Both repeat count and the selected cases affect total cost; concurrency can increase the rate of spending.

Exit codes:

- `0`: every executed case passed every attempt. NOT_RUN rows do not gate.
- `1`: a case failed or was degraded, with some attempts passing and some failing.
- `2`: no case matched the filter; the existing report is preserved.
- `3`: infrastructure error, including missing or malformed promptfoo results, any provider error row, subprocess failure, or report-write failure. Invalid CLI options also reach this path through subprocess failure.

A run with matched cases and valid results rewrites the committed `report.md`; review the diff for regressions outside the intended change. Read the JSON path printed by the runner for every attempt's output and observation metadata. Each invocation creates its own `$TMPDIR/agent-skills-eval-*/results.json`; later runs do not overwrite it. The wrapper disables promptfoo database writes, so `npx promptfoo view` cannot display these runs.

The suite runs through the Agent SDK, which bundles its own pinned Claude Code binary rather than using the system `claude`. After bumping the SDK version, expect report diffs from the runtime as well as the skill. Run `pnpm eval --filter-pattern '^trigger-positive$' --repeat 1` first, with approval. It exercises project-skill discovery, the Claude Code presets, tool observation, and the budget stop in one cheap case.

## Interpretation

- Green tests are a baseline, not proof: the offline suites cover pure functions and lifecycle, not live model behavior.
- `mutation-scope` means "no observed write through git or the file-writing tools", not "nothing was written". See the gap analysis in [`README.md`](../README.md).
- When checks pass but correctness is uncertain, escalate instead of declaring success.
