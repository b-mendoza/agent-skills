# evals — Agent Guide

Nearest guide for the eval suite: a self-contained pnpm workspace that runs
skills against fixture repos through the Agent SDK. For work inside
`evals/`, this guide takes precedence over the repo root
[`AGENTS.md`](../AGENTS.md).

## Toolchain

- Node `24.18.0` (see [`.nvmrc`](./.nvmrc)); TypeScript runs from source —
  there is no build step.
- `pnpm` is the package manager (`pnpm install` once, from this directory).

## Always

- Lint check (run after a substantive change): `pnpm lint` (tsc, eslint,
  oxlint, oxfmt `--check`); `pnpm fix` applies the auto-fixes.
- Test suite (run before committing): `pnpm test` (offline vitest).
- [`report.md`](./report.md) is a committed, generated artifact; only a
  real eval run rewrites it.
- Eval runs spend real money and require explicit user approval. Answer
  anything a free check can answer with a free check — see
  [`docs/verification.md`](./docs/verification.md).

## Documentation model

The two-tier split is defined in the repo root
[`AGENTS.md`](../AGENTS.md); maintain it when you add or edit docs here.
In this suite, long-lived guidance is this file and
[`docs/agents/`](./docs/agents/); short-lived references live directly
under [`docs/`](./docs/).

## Open when relevant (long-lived)

| When you need                                   | Read                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| TypeScript design and boundary conventions      | [`docs/agents/conventions.md`](./docs/agents/conventions.md)               |
| How to name variables, arguments, and functions | [`docs/agents/naming-conventions.md`](./docs/agents/naming-conventions.md) |
| What and how to test in the offline suites      | [`docs/agents/testing.md`](./docs/agents/testing.md)                       |
| To delegate evals work to a subagent            | [`docs/agents/delegation.md`](./docs/agents/delegation.md)                 |

## Current-state references (short-lived; verify against the code)

| When you need                                                   | Read                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| Where code lives, capability ownership, entry/report paths      | [`docs/current-layout.md`](./docs/current-layout.md) |
| Which checks to run for which task, free vs. paid, exit codes   | [`docs/verification.md`](./docs/verification.md)     |
| Eval-suite philosophy, tiers, mutation-scope gap, adding a case | [`README.md`](./README.md)                           |

Cross-cutting long-lived guidance (workflow and task scoping, verification
honesty, working with the maintainer) lives in the repo root
[`AGENTS.md`](../AGENTS.md) and applies to this suite.
