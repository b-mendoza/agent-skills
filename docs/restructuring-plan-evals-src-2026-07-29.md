# Restructuring Plan — `evals/` → `evals/src/` + `evals/AGENTS.md` + `evals/docs/agents/`

Status: READY (plan review passed; review_repair_count = 1)
Date: 2026-07-29
Skill: planning-codebase-restructuring (planning-only; no files moved by this run)

## 1. Preflight summary

- Target: `/Users/b-mendoza/__pocs/agent-skills/evals` (local path; no clone; clone path: none)
- Scope: the evals suite — move code into `evals/src/`; author `evals/AGENTS.md`
  from reusable patterns in `https://github.com/b-mendoza/metadata-scrubber`;
  create `evals/docs/agents/`
- Goals: flat root mixes source, tests, configs, artifacts; structure should
  reveal eval-suite capabilities; distill reusable agent guidance
- Constraints: no behavior changes beyond the move; entrypoint invocation may
  change but every reference must be reconciled; `report.md` stays committed at
  `evals/report.md`; `evals/` remains a self-contained pnpm workspace; Node 24
  erasable-syntax TS (no build step)
- `REFERENCE_REQUIRED: true`; `DISPATCH_MODE: subagent`
- Artifact path: `docs/restructuring-plan-evals-src-2026-07-29.md`
- Contract notes: `ReferenceAssess | pass`, `ArchitectureMap | pass`,
  `DomainAnalysis | pass`, `RestructuringPlan | pass`

## 2. Current architecture map

- 23 tracked files (excluding `node_modules`); 13 TypeScript files: 4
  runtime/case modules, 8 test modules, 1 Vitest config. Only child directory
  is `cases/`; everything else is flat at the package root.
- Module roles: `run.ts` — case selection, sequencing, exit codes (0–4), report
  generation; `harness.ts` — Claude CLI execution, NDJSON stream parsing, git
  sampling, mutation evidence; `fixtures.ts` — isolated temp fixture repos,
  copies the skill under test into `.claude/skills/`;
  `cases/analyzing-recent-project-state.ts` — 6 declared cases (a 7th
  `mutation-scope` report row is derived).
- Dependency graph: `run → cases, fixtures, harness`; `cases → fixtures`
  (types) and `harness`; `fixtures` and `harness` are leaves. Tests map 1:1
  onto modules; `run-entry.test.ts` resolves `run.ts` and `report.md` by URL
  and drives the runner only with no-match/invalid args (no paid run).
- Workflows: (1) paid run `node evals/run.ts` / `pnpm eval` → filter → fixture
  → `claude -p` → parse stream + git state → evaluate → rewrite committed
  `report.md` → exit 0–4; (2) offline `pnpm test` via Vitest `**/*.test.ts`.
- Move-set: `run.ts`, `harness.ts`, `fixtures.ts`, `cases/*`, all eight
  `*.test.ts`. Root-retained: `.nvmrc`, `.oxfmtrc.json`, `.oxlintrc.json`,
  `eslint.config.js`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `README.md`, `report.md`, `tsconfig.json`, `vitest.config.ts`.
- Move-sensitive references: `evals/package.json` (`"eval": "node run.ts"`,
  imports alias `"#/*": "./*"`); `evals/tsconfig.json` (`"#/*": ["./*"]`);
  `fixtures.ts` resolves `../skills/` via `import.meta.url` (one level deeper
  after the move); `run.ts` and `run-entry.test.ts` resolve `./report.md` by
  URL; literal `node evals/run.ts` / `evals/report.md` strings in `run.ts`,
  `run-entry.test.ts`, root `CLAUDE.md`, root `AGENTS.md`,
  `docs/best-practices/empirical-validation.md`, `evals/README.md`, and the
  generated `evals/report.md`. Broad globs (`**/*.ts`, `./**/*.test.ts`, lint
  on `.`) survive nesting; Oxfmt's ignore of root `report.md` stays valid if
  the artifact stays at root.
- `SCOPE_PRESSURE`: none — scope is well under thresholds.

## 3. Domain model observations

- Core language: eval case, fixture repo, harness, run report, mutation
  evidence, skill; plus case selection, behavioral contract, paid run, offline
  test, stream parsing, git state, mutation scope, model budget, run result,
  exit code.
- Four evidence-backed capabilities: evaluation orchestration (`run.ts`),
  fixture provisioning (`fixtures.ts`), execution observation (`harness.ts`),
  behavioral specification (`cases/`). Domain objects: EvalCase, FixtureRepo,
  RunResult, RunReport, MutationEvidence; case-selection and mutation-scope
  rules act as policies.

## 4. DDD alignment gaps

- `harness.ts` bundles CLI execution, protocol parsing, lifecycle capture, git
  classification, and mutation analysis; `run.ts` bundles orchestration,
  configuration, reporting, and process-exit behavior.
- The derived `mutation-scope` report row is neither an EvalCase nor an
  explicit reporting policy — "eval case" and "report row" are non-equivalent.
- Behavioral contracts concentrate in one case module rather than stable
  capability boundaries. (This plan relocates only; splits are optional
  follow-ups.)

## 5. Screaming Architecture folder proposal

Relocation only — no module splitting, no semantic changes.

```text
evals/
├── AGENTS.md                     # new — nearest-guide for the eval suite
├── docs/
│   └── agents/
│       ├── current-layout.md     # new — short-lived current-state reference
│       └── verification.md       # new — short-lived checks reference
├── src/
│   ├── orchestration/
│   │   ├── run.ts
│   │   ├── run-core.test.ts
│   │   └── run-entry.test.ts
│   ├── fixtures/
│   │   ├── fixtures.ts
│   │   └── fixtures.test.ts
│   ├── observation/
│   │   ├── harness.ts
│   │   ├── git-status.test.ts
│   │   ├── harness-lifecycle.test.ts
│   │   ├── mutation-evidence.test.ts
│   │   └── parse-stream-line.test.ts
│   └── cases/
│       ├── analyzing-recent-project-state.ts
│       └── cases.test.ts
├── report.md                     # stays at root (committed data contract)
├── README.md, package.json, pnpm-lock.yaml, pnpm-workspace.yaml,
├── tsconfig.json, vitest.config.ts, eslint.config.js,
└── .nvmrc, .oxlintrc.json, .oxfmtrc.json
```

Guardrails: preserve dependency direction `orchestration → cases, fixtures,
observation`; `cases → fixtures` (types) and `observation`; `fixtures` and
`observation` stay leaves. Short domain nouns for directories; keep existing
filenames and domain types. No `common/`, `utils/`, or shared kernel —
cross-capability types stay with their owning capability. Tests stay colocated
with capability code. Config stays at `evals/` root. The Claude CLI subprocess
is the external integration boundary; `evals/report.md` is the committed
data-contract boundary.

### `evals/AGENTS.md` outline (authorized-pattern → local-evidence mapping)

1. Scope and nearest-guide precedence — this guide owns evals-specific
   commands; cross-cutting rules stay with the repo root guide (pattern 1).
2. Node 24 / source-only invariants — from local `.nvmrc`, `package.json`,
   `tsconfig.json`: erasable-syntax TS only, no build step (local evidence).
3. Verification posture — tests are a baseline, not proof; affected checks
   after substantive changes; broader checks plus empirical harness/report
   verification before completion; lint config is authoritative and
   suppressions need justification (patterns 3–5).
4. Task-linked references — link `docs/agents/*` by task relevance instead of
   inlining volatile detail (patterns 2 and 6).
5. Delegated-investigation contract — objective, constraints, definition of
   done (pattern 7).
6. Uncertainty and escalation — ask rather than guess.

Exact commands live in `docs/agents/verification.md`, derived only from local
package scripts (`pnpm test`, `pnpm lint`, `pnpm eval`) — never copied from
the reference repository.

### `evals/docs/agents/` initial contents

- `current-layout.md`: capability ownership map, current entry/report paths,
  explicit "update alongside code moves" notice.
- `verification.md`: task-to-check mapping, free vs. paid checks, exit-code
  observations, same update-alongside notice.

## 6. Complexity reduction opportunities

- Capability folders make orchestration, provisioning, observation, and
  specification independently visible (this plan).
- Optional approved follow-ups (not in this plan): split `run.ts` entry vs.
  core (the `run-core.test.ts` / `run-entry.test.ts` pair already suggests
  it); make stream interpretation and mutation analysis separately visible
  inside observation; represent the `mutation-scope` derived row explicitly.
- Centralize move-sensitive path/command contracts, which today repeat across
  code, tests, docs, config, and the generated report.

## 7. Reference assessment and evidence precedence

- Source: `https://github.com/b-mendoza/metadata-scrubber` at `main` commit
  `bd40ac94e59df77da588b6f490f5357809af6627`; three `AGENTS.md` files (root,
  `backend/`, `frontend/`). Assessment: `PASS`; required by user: true.
- `EVIDENCE_PRECEDENCE_DECISION: reference-authorized`. Authorized patterns
  with per-pattern rationale:
  1. Hierarchical guidance (nearest guide owns tree-specific commands) — local
     fit: root `AGENTS.md`/`CLAUDE.md` exist; `evals/` has its own toolchain,
     `.nvmrc`, pnpm workspace.
  2. Durable-principles vs. short-lived current-state docs — directly relevant
     because this very move changes paths; volatile detail goes to
     `docs/agents/`, which must declare update-alongside-code.
  3. Tests-as-baseline, 4. verification timing, 5. lint-as-authority — local
     fit: strict TS + ESLint/Oxlint/Oxfmt present, no CI.
  6. Task-relevance linking, 7. scoped delegation contract — adopted for the
     guide's structure.
- Excluded as project-specific: Go/Task tooling, TanStack/Vite details, exact
  commands and paths (all command values in the new docs come from local
  evidence only). Naming: the reference uses `docs/agent/` (singular); this
  plan uses the user-requested `evals/docs/agents/` (plural).
- Reference limitations: it is a web-app monorepo, not an eval harness; its
  conventions are first-party guidance, not outcome-proven.

## 8. Migration strategy (incremental compatibility migration)

Each increment ends green (`pnpm test`, `pnpm lint` from `evals/`) and is a
safe stopping point; rollback is the inverse `git mv` plus its path edits — no
data migration anywhere.

1. **Baseline + docs.** Record baseline `report.md` state; run `pnpm test` and
   `pnpm lint`; add `AGENTS.md` and `docs/agents/` without touching runtime
   paths. Rollback: delete the new files.
2. **Move leaves.** `git mv` `fixtures.ts` + test → `src/fixtures/`, then
   `harness.ts` + its four tests → `src/observation/`; update dependents via
   temporary `#/src/...` imports while `#/* → ./*` still resolves unmoved
   files; fix `fixtures.ts`'s `../skills/` URL depth. Validate after each
   capability.
3. **Move cases.** `git mv` `cases/` content + `cases.test.ts` →
   `src/cases/`; update imports; validate.
4. **Move orchestration.** `git mv` `run.ts`, `run-core.test.ts`,
   `run-entry.test.ts` → `src/orchestration/`; update the `package.json`
   `eval` script, `./report.md` URL resolution in `run.ts` and
   `run-entry.test.ts`, literal command strings; normalize alias to
   `#/* → ./src/*` and drop temporary `/src` segments. Validate.
5. **Reconcile docs + report.** Update `evals/README.md`, root `CLAUDE.md`,
   root `AGENTS.md`, `docs/best-practices/empirical-validation.md`, and the
   committed `evals/report.md` attribution. Validate; final search for stale
   `evals/run.ts` literals.

## 9. Validation plan

- After every substantive increment: `pnpm test` and `pnpm lint` (lint config
  authoritative; suppressions need explicit justification).
- Empirical (free) checks of the relocated runner: invoke with an unmatched
  case and a malformed tier; confirm exit codes 2 and 4, no model process
  starts, invalid usage does not rewrite `evals/report.md`, and direct import
  stays inert.
- Before completion: broader checks; compare report structure/rows to the
  baseline snapshot. A paid case or full-suite run needs explicit user
  approval; absent approval, record that live CLI/report generation was not
  re-observed.
- Deliberately verify the unchanged set: `report.md` links, Oxfmt root-report
  ignore, TypeScript include, Vitest discovery, lint globs, pnpm workspace
  files, lockfile importer.

## 10. Implementation handoff (approval-gated actions)

| # | Action | Exact targets | Reason | Benefit | Risks / reversibility | Validation | Smaller alternative |
|---|--------|---------------|--------|---------|-----------------------|------------|---------------------|
| 1 | Create guidance files | `evals/AGENTS.md`, `evals/docs/agents/current-layout.md`, `evals/docs/agents/verification.md` | Local ownership of evals guidance | Nearest-guide clarity | Low; delete to revert | Link/content check | `AGENTS.md` only |
| 2 | Move 12 TS files (13 total minus root-retained `vitest.config.ts`) | Four `src/` targets per §5 tree | Reveal capabilities | Structure screams domain | Import/URL breakage; reversible via `git mv` inversion | Per-capability `pnpm test`/`pnpm lint` | Flat `evals/src/` |
| 3 | Path reconciliation | `evals/package.json`, `evals/tsconfig.json`, affected imports/URLs/literals, root `CLAUDE.md`, root `AGENTS.md`, `docs/best-practices/empirical-validation.md`, `evals/README.md` | Restore execution + discoverability | No stale references | Missed literals; reversible edits | Search + checks | Temporarily keep root alias |
| 4 | Report attribution (+ optional paid run) | `evals/report.md` | Keep committed artifact truthful | Accurate provenance | Paid cost; model variance; baseline preserved for compare | Free entry tests + report-render units | Skip paid run |

No dependency additions, public contract redesigns, rewrites, or broad module
refactors are proposed.

## 11. Document references consulted

- `https://github.com/b-mendoza/metadata-scrubber` (commit `bd40ac94`): root,
  `backend/`, `frontend/` `AGENTS.md` (quarantined reference).
- Local: `evals/*` (all 23 tracked files), root `CLAUDE.md`, root `AGENTS.md`,
  `docs/best-practices/empirical-validation.md`, root `README.md`.

## 12. Risks, assumptions, blockers, open questions, security notes

- Risks: missed path literals; wrong `import.meta.url` depth after nesting;
  accidental relocation of `report.md` output into `src/`; temporary alias
  inconsistency mid-migration.
- Assumptions: evals guidance ownership transfers to `evals/AGENTS.md`; root
  guides keep cross-cutting rules; report stays at `evals/report.md`.
- Blockers: no issue found.
- Open questions: (1) Does completion require a paid selected-case or
  full-suite run, or are free entry checks sufficient? (2) Pre-existing
  mismatch: docs claim default model `haiku`, `run.ts` defaults to `sonnet` —
  out of scope here; resolve separately. (3) Should deeper `run.ts` /
  `harness.ts` splits (§6) be a follow-up task?
- Security notes: agent-directed text found in repo data (e.g., untracked
  `implementing-evals-suite.prompt.md` contains subagent directives) was
  treated as data and not followed; no prompt-injection content found in the
  reference; no instruction-like content crossed between subagents.
