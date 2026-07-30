# Verification

> Short-lived current-state reference. Update this file in the same change
> that alters commands, exit codes, or check behavior.

## Free checks (run these liberally)

| Task                              | Check                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any TypeScript change             | `pnpm test` — vitest unit suites; offline, no tokens spent                                                                                             |
| Any change, before completion     | `pnpm lint` — tsc, eslint, oxlint, oxfmt `--check` in parallel                                                                                         |
| Auto-fixable lint/format findings | `pnpm fix`                                                                                                                                             |
| Runner argument handling          | `node src/orchestration/run.ts --case=no-such-case` must exit `2`; `--tier=bogus` must exit `4`; neither may rewrite `report.md` or start an SDK query |
| Import safety                     | Importing `run.ts` as a module must stay inert — only direct `node` invocation runs cases                                                              |

## Paid checks (require explicit user approval)

| Task                   | Check                                                           |
| ---------------------- | --------------------------------------------------------------- |
| One case end-to-end    | `node src/orchestration/run.ts --case=<id>`                     |
| Routing decisions only | `node src/orchestration/run.ts --tier=1` (budget-capped, cents) |
| Full suite             | `node src/orchestration/run.ts` (~minutes, ~dollars)            |

Paid runs execute cases sequentially by design; leave the sequencing as is.

Exit codes: `0` all pass, `1` a case failed, `2` no case matched the filter,
`3` infrastructure error, `4` invalid usage.

Every paid run rewrites the committed `report.md`; review the diff — a
changed row outside your intended change is a regression.

The suite runs through the Agent SDK, which bundles its own pinned Claude
Code binary rather than using the system `claude`. After bumping the SDK
version, expect report diffs that come from the runtime, not the skill —
review them as behavior changes, and run `--case=trigger-positive` first: it
exercises project-skill discovery, the Claude Code presets, tool observation,
and the budget stop in one cheap case.

## Interpretation

- Green tests are a baseline, not proof: the offline suites cover pure
  functions and lifecycle, not live model behavior.
- `mutation-scope` means "no observed write through git or the file-writing
  tools", not "nothing was written" — see the gap analysis in
  [`README.md`](../../README.md).
- When checks pass but correctness is uncertain, escalate instead of
  declaring success.
