# evals — Agent Guide

Nearest guide for the eval suite: a self-contained pnpm workspace that runs
skills against fixture repos through the Agent SDK. For work inside
`evals/`, this guide takes precedence over the repo root
[`AGENTS.md`](../AGENTS.md).

## Toolchain

- Node `24.18.0` (see [`.nvmrc`](./.nvmrc)); TypeScript runs from source —
  there is no build step.
- `pnpm` is the package manager (`pnpm install` once, from this directory).
- Checks: `pnpm test` (offline vitest), `pnpm lint` (tsc, eslint, oxlint,
  oxfmt `--check`), `pnpm fix` (auto-fixes).

## Guardrails (apply to every task)

- [`report.md`](./report.md) is a committed, generated artifact; only a
  real eval run rewrites it.
- Eval runs spend real money and require explicit user approval. Answer
  anything a free check can answer with a free check — see
  [`docs/agents/verification.md`](./docs/agents/verification.md).

## Task-linked references

Read the reference matching your task before editing. Update a reference in
the same change that moves or renames what it describes.

| When you need                                                   | Read                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Where code lives, capability ownership, entry/report paths      | [`docs/agents/current-layout.md`](./docs/agents/current-layout.md) |
| TypeScript and lint conventions                                 | [`docs/agents/conventions.md`](./docs/agents/conventions.md)       |
| Which checks to run for which task, free vs. paid, exit codes   | [`docs/agents/verification.md`](./docs/agents/verification.md)     |
| To delegate evals work to a subagent                            | [`docs/agents/delegation.md`](./docs/agents/delegation.md)         |
| Eval-suite philosophy, tiers, mutation-scope gap, adding a case | [`README.md`](./README.md)                                         |
