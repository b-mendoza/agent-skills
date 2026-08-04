# Agent Guide — evals

Nearest guide for the eval suite: a self-contained pnpm workspace that runs skills against fixture repos through the Agent SDK.

## Toolchain

- Node `24.19.0` (see [`.nvmrc`](./.nvmrc)); TypeScript runs from source — there is no build step.
- `pnpm` is the package manager (`pnpm install` once, from this directory).

## Always

- Lint check (run after a substantive change): `pnpm lint` (tsc, eslint, oxlint, oxfmt `--check`); `pnpm fix` applies the auto-fixes.
- Test suite (run before committing): `pnpm test` (offline vitest).
- [`report.md`](./report.md) is a committed, generated artifact; only a real eval run rewrites it.
- Eval runs spend real money and require explicit user approval. Answer anything a free check can answer with a free check — see [`docs/verification.md`](./docs/verification.md).

## Open when relevant (long-lived)

- [TypeScript design conventions](docs/agent/conventions.md) — design guidance such as erasable syntax, factory functions, and boundary parsing.
- [Testing — evals specifics](docs/agent/testing-principles.md) — Vitest assertion practices and Agent SDK test boundaries.
- [Delegating evals work](docs/agent/delegation.md) — what to give every subagent dispatched into this suite.

## Current-state references (short-lived; verify against the code)

- [Current layout](docs/current-layout.md) — where code lives, capability ownership, entry and report paths.
- [Verification](docs/verification.md) — which checks to run for which task, free vs. paid, exit codes.
- [Eval-suite README](README.md) — philosophy, tiers, mutation-scope gap, adding a case.

Cross-cutting long-lived guidance (naming, code design, testing, workflow, verification) lives in the [root Agent Guide](../AGENTS.md) and applies to this suite.
