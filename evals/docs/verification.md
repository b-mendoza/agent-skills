# Verification

> Short-lived current-state reference. Update this file in the same change that alters commands, exit codes, or check behavior.

Run all commands below from `evals/`.

## Free checks

| Task                              | Check                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any TypeScript change             | `pnpm test`, offline Vitest suites with no tokens spent                                                                                              |
| Any change, before completion     | `pnpm lint`, tsc, eslint, oxlint, oxfmt `--check` in parallel                                                                                        |
| Auto-fixable lint/format findings | `pnpm fix`                                                                                                                                           |
| Promptfoo integration             | `pnpm test src/promptfoo/integration.test.ts`, real CLI with an offline provider for filters, repeats, metrics, native exits, JSON/HTML, and history |
| Assertion grading                 | `pnpm test src/promptfoo/assertion.test.ts`, check failures, judge diagnostics, and per-attempt mutation evidence                                    |

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

`pnpm eval` uses promptfoo's native output and exit codes. Observed offline:

- `0`: all executed attempts passed, or the selection was empty.
- `100`: an attempt failed, including assertion failures and provider errors.
- `1`: an invalid CLI option.

Each invocation configures a unique `outputs/runs/<UTC timestamp>-<random>/` with `results.json` and a self-contained `results.html`. The config resolves artifact paths relative to its own directory. JSON contains every attempt's output and observation metadata. Package scripts select shared SQLite history through `PROMPTFOO_CONFIG_DIR=outputs/promptfoo-state`, relative to `evals/`. These outputs are ignored by git. Use `pnpm eval:view` to compare runs. Per-case metrics show pass rates across repeats; each tier-2 attempt also has a native `mutation-scope` assertion and metric in the results, HTML, and history. The eval description identifies the model without changing the test dataset.

The suite runs through the Agent SDK, which bundles its own pinned Claude Code binary rather than using the system `claude`. After bumping the SDK version, expect result changes from the runtime as well as the skill. Run `pnpm eval --filter-pattern '^trigger-positive$' --repeat 1` first, with approval. It exercises project-skill discovery, the Claude Code presets, tool observation, and the budget stop in one cheap case.

## Interpretation

- Green tests are a baseline, not proof: the offline suites cover pure functions and lifecycle, not live model behavior.
- `mutation-scope` means "no observed write through git or the file-writing tools", not "nothing was written". See the gap analysis in [`README.md`](../README.md).
- When checks pass but correctness is uncertain, escalate instead of declaring success.
