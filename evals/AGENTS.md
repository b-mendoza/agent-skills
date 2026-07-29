# evals — Agent Guide

Nearest guide for the eval suite. This file owns evals-specific commands and
conventions; cross-cutting repo rules (skill authoring, verification posture,
vendored-skill handling) stay with the repo root
[`AGENTS.md`](../AGENTS.md) and [`CLAUDE.md`](../CLAUDE.md). When the two
disagree about work inside `evals/`, this guide wins.

## Invariants

- Node `24.18.0` (see [`.nvmrc`](./.nvmrc)); the suite runs TypeScript from
  source with no build step. Keep syntax erasable — `erasableSyntaxOnly` is
  on, so no enums, parameter properties, decorators, or namespaces.
- `pnpm` is the package manager; install once with `pnpm install` from this
  directory. The suite is a self-contained pnpm workspace, not part of any
  skill package.
- [`report.md`](./report.md) is a committed, generated artifact. Only a real
  eval run rewrites it; never hand-edit it.
- Paid runs cost real money and run cases sequentially on purpose. Never
  start one to "check something" a free test can answer.

## Verification posture

Passing tests are a baseline, not proof of correctness.

- After any substantive change: run the affected checks (`pnpm test`,
  `pnpm lint`).
- Before calling work complete: run the full offline checks, and verify
  harness/report behavior empirically where a free check exists (see
  [`docs/agents/verification.md`](./docs/agents/verification.md)).
- Lint configuration is authoritative. Fix findings rather than suppressing
  them; a suppression needs a written justification at the suppression site.
- When correctness is still uncertain after checks pass, escalate to the
  user instead of declaring success.

## Task-linked references

Volatile current-state detail lives in short-lived references, not here:

| When you need                                                   | Read                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Where code lives, capability ownership, entry/report paths      | [`docs/agents/current-layout.md`](./docs/agents/current-layout.md) |
| Which checks to run for which task, free vs. paid               | [`docs/agents/verification.md`](./docs/agents/verification.md)     |
| Eval-suite philosophy, tiers, mutation-scope gap, adding a case | [`README.md`](./README.md)                                         |

Those references must be updated in the same change that moves or renames
what they describe.

## Delegated investigations

When delegating work here to a subagent, give it an explicit objective, the
constraints that apply (especially: no paid runs without approval, no
hand-edits to `report.md`), and a definition of done. If it is unclear
whether delegation fits or which agent should own a task, ask rather than
guess.

## Uncertainty

Ask rather than guess — about paid-run approval, about whether a report diff
is an intended behavior change, and about anything this guide does not cover.
