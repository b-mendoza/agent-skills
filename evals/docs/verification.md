# Verification

> Short-lived current-state reference. Update this file in the same change that alters commands, exit codes, or check behavior.

Run all commands below from `evals/`.

## Free checks

| Task                                 | Check                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any TypeScript change                | `pnpm test`, offline Vitest suites with no tokens spent                                                                                                                                          |
| Any change, before completion        | `pnpm lint`, tsc, eslint, oxlint, oxfmt `--check` in parallel                                                                                                                                    |
| Auto-fixable lint/format findings    | `pnpm fix`                                                                                                                                                                                       |
| Runner argument and failure handling | `pnpm test src/orchestration/run.test.ts`, mocked subprocess checks for forwarded arguments, unique artifacts, history state, terminal summaries, no-match exit `2`, and infrastructure exit `3` |
| Promptfoo integration                | `pnpm test src/promptfoo/integration.test.ts`, real CLI with a local offline provider for filters, repeat overrides, assertion output, JSON/HTML, and saved history                              |
| Import safety                        | `pnpm test src/orchestration/entry.test.ts`, importing the runner must stay inert; probes block writes and subprocess launches                                                                   |

## Paid checks

These require explicit user approval.

| Task                   | Check                                                      |
| ---------------------- | ---------------------------------------------------------- |
| One case end-to-end    | `pnpm eval --filter-pattern '^snapshot-dirty$' --repeat 1` |
| Routing decisions only | `pnpm eval --filter-metadata tier=1`                       |
| Full suite             | `pnpm eval`                                                |
| Override concurrency   | `pnpm eval -j 3`                                           |

Cases with a `judge` field additionally run one cheap judge-model query per attempt after the mechanical check passes. Judge cost is cents per attempt and is not included in the observed run cost.

Each case runs five times by default. Use `--repeat 1` for a cheap, low-confidence smoke run. Default concurrency is capped at 5 attempts across the whole queue, repeats included; `-j` overrides it, so `-j 3` allows up to three concurrent attempts. Each process has its own cap, so two concurrent default runs can have 10 attempts in flight. Both repeat count and the selected cases affect total cost; concurrency can increase the rate of spending.

Exit codes:

- `0`: every executed case passed every attempt. NOT_RUN rows do not gate.
- `1`: a case failed or was degraded, with some attempts passing and some failing.
- `2`: no case matched the filter; the terminal prints `No cases matched.`
- `3`: infrastructure error, including missing or malformed promptfoo results, any provider error row, subprocess failure, or output-directory failure. Invalid CLI options also reach this path through subprocess failure.

Each invocation creates a unique `outputs/runs/<UTC timestamp>-<random>/` with `results.json` and a self-contained `results.html`, one row per attempt. Read the printed JSON path for every attempt's output and observation metadata. Runs also persist in promptfoo's SQLite database under `outputs/promptfoo-state`; artifact and history paths are absolute and independent of the runner's working directory. These outputs are ignored by git. Use `pnpm eval:view` to compare the new run against the previous one for unintended regressions. Per-case metrics show pass rates across repeats; the eval description identifies the model without changing the test dataset. The terminal explains every non-PASS result, including the derived `mutation-scope` check, which is absent from promptfoo's HTML and viewer rows.

The suite runs through the Agent SDK, which bundles its own pinned Claude Code binary rather than using the system `claude`. After bumping the SDK version, expect result changes from the runtime as well as the skill. Run `pnpm eval --filter-pattern '^trigger-positive$' --repeat 1` first, with approval. It exercises project-skill discovery, the Claude Code presets, tool observation, and the budget stop in one cheap case.

## Interpretation

- Green tests are a baseline, not proof: the offline suites cover pure functions and lifecycle, not live model behavior.
- `mutation-scope` means "no observed write through git or the file-writing tools", not "nothing was written". See the gap analysis in [`README.md`](../README.md).
- When checks pass but correctness is uncertain, escalate instead of declaring success.
