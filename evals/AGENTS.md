# Agent guide for evals

Nearest guide for the self-contained pnpm eval workspace. The [root guide](../AGENTS.md) supplies cross-cutting design, testing, workflow, and delegation rules.

## Commands and approval

Run these commands from this directory. Paid evals require explicit user approval; answer anything a free check can answer without spending tokens.

| Command                                                      | Purpose                                               |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `pnpm install`                                               | Install dependencies once                             |
| `pnpm lint`                                                  | Run tsc, eslint, oxlint, and oxfmt checks in parallel |
| `pnpm fix`                                                   | Apply eslint, oxlint, and oxfmt auto-fixes            |
| `pnpm test`                                                  | Run offline Vitest checks                             |
| `pnpm eval`                                                  | Run the full paid suite                               |
| `pnpm eval --filter-metadata tier=1`                         | Check routing only                                    |
| `pnpm eval --filter-pattern '^snapshot-dirty$'`              | Run one case                                          |
| `pnpm eval --repeat 1`                                       | Low-confidence smoke run                              |
| `pnpm eval -j 3`                                             | Limit this process to three concurrent attempts       |
| `pnpm eval --filter-pattern '^trigger-positive$' --repeat 1` | First approved smoke run after an SDK upgrade         |
| `pnpm eval:view`                                             | Browse and compare saved runs                         |

Run lint after substantive changes and before completion. Run tests after TypeScript changes, before committing, and before paid evaluation.

## Stack-specific rules

- Write erasable TypeScript. Prefer factories over classes when either fits, and use function-property interface methods.
- Use Vitest partial-object matching for the call fields our code controls.
- Isolate output and history directories for offline CLI checks, including work delegated to subagents.

## Reference

[Verification](docs/verification.md) owns current runtime settings, results, coverage limits, and case authoring details.
