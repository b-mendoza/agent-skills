# Restructuring Plan — `evals/src/orchestration/` — 2026-08-04

> Point-in-time planning artifact produced by the `planning-codebase-restructuring` skill. It describes the tree as of 2026-08-04 and must be re-verified against the code before implementation. No files were moved; every implementation action is approval-gated in section 10.

## 1. Preflight summary

Target `/Users/b-mendoza/__pocs/agent-skills` (local; no clone). Scope `evals/src/orchestration/`: 19 flat files — 10 production modules, 1 test-support seam, 8 colocated test files. Business goals (inferred; the user supplied scope only): make orchestration capabilities (run lifecycle, case execution, checks, reporting) legible from directory structure rather than filename prefixes, and clarify capability ownership. Domain language: run, case, check, observation, report, coordination, failure lifecycle; analysis adds tier, fixture, budget, model/configuration. Constraints: planning-only; `pnpm lint` config is the style source of truth; no paid eval runs; tests stay colocated; `evals/report.md` is a generated committed artifact. Success criteria (inferred): structure reveals capabilities; import boundaries match the grouping. Reference: none supplied — `REFERENCE_ASSESSMENT: SKIPPED`; `REFERENCE_REQUIRED: false`. `DISPATCH_MODE: subagent`. Artifact path: this file.

## 2. Current architecture map

`SCOPE_PRESSURE`: not flagged (40 source files in `evals/src`, 4 top-level modules; the whole scope was read directly).

Orchestration is a strict top layer: per the validated architecture map, "no file under `src/cases`, `src/fixtures`, `src/observation`, or `scripts/` imports `#/orchestration/*`" — zero inbound imports, including from the workspace's `scripts/` directory outside `src/`. Outbound imports go to `cases` (5 modules), `observation` (3), and `fixtures` (1).

Three de-facto clusters, visible only in filename prefixes:

- **Run/CLI lifecycle** — `run.ts` (shebang entry, `import.meta.main` guard, provides live layers), `run-arguments.ts` (pure argv parse + case selection), `run-coordination.ts` (sequencing, derived `mutation-scope` row, `EXIT_CODES` 0-4, failure funnel; 221 lines), `run-services.ts` (`RunnerServices` / `RunnerOutput` Effect service tags + live layers, including the `report.md` write), `run-failure-reporting.ts` (residual-`Cause` rendering; pins `effect` 4.0.0-beta internals).
- **Case execution** — `case-execution.ts` (acquire-use-release: fixture → prompt → observation → check; tagged errors), `case-checks.ts` (`evaluate`), `observation-runner.ts` (sole paid Agent SDK seam), `run-configuration.ts` (`EVAL_MODEL` resolution + `EvalConfiguration` layer).
- **Reporting** — `report.ts` (`Result` / `ReportTier` types, `REPORT_PATH`, `renderReport`).

Internal hubs: `report.ts` has four importers for three different reasons; `case-checks.evaluate` has two consumers (`case-execution.ts`, `run-coordination.ts`); `run-configuration.ts` feeds both `report.ts` and `case-execution.ts`.

Load-bearing constraints:

- `report.ts:6` computes `REPORT_PATH` via `new URL("../../report.md", import.meta.url)` — depth-sensitive; moving `report.ts` deeper silently retargets the generated artifact.
- `run-entry.test.ts:23` resolves `./run.ts` relative to itself and spawns it.
- `evals/src/orchestration/run.ts` is hard-coded in `run-arguments.ts:16` (USAGE, asserted by `run-coordination.test.ts:58`), `report.ts:63`, `evals/package.json:12`, `evals/README.md:14-16,59-60`, `evals/docs/current-layout.md:9,20`, `evals/docs/verification.md:12,19-21`, and `docs/best-practices/empirical-validation.md:69`.
- No import-boundary lint rule exists today.
- Test filenames are not 1:1 with modules (`run-entry.test.ts` → `run.ts`, `report-rendering.test.ts` → `report.ts`, `run-failure-lifecycle.test.ts` → `run-coordination.ts`).

Safety nets: 8 token-free colocated test files; `vitest.config.ts` (`./**/*.test.ts`) and the `tsconfig` includes are depth-agnostic, so nesting keeps discovery intact; `pnpm lint` = tsc + eslint + oxlint + oxfmt; there is no CI — verification is manual.

## 3. Domain model observations

One bounded context with six evidence-backed capability slices:

1. **Invocation contract** — `run.ts`, `run-arguments.ts`.
2. **Suite coordination** — `run-coordination.ts`.
3. **Failure lifecycle** — `run-failure-reporting.ts` plus the seven tagged error classes and the `isWrappedBoundaryError` / `unwrapBoundaryCause` / `describeSuiteFailure` helpers currently living inside coordination.
4. **Case execution** — `case-execution.ts`, `observation-runner.ts` (adapter to the observation context and sole paid seam), `run-configuration.ts`.
5. **Verdict evaluation** — `case-checks.ts`: shared policy with two consumers, not a peer capability.
6. **Reporting** — `report.ts` plus the composition root in `run-services.ts`.

Test filenames already name these capabilities better than the source filenames do. No evidence supports splitting orchestration into multiple bounded contexts.

## 4. DDD alignment gaps

- `Result` is one anemic type serving three roles — case outcome, coordination row, markdown cell — conflating domain outcome with presentation and explaining `report.ts`'s four importers.
- Tier semantics are minted in three places (`CaseTier` in `cases`, `REPORT_TIER_BY_CASE_TIER` in `case-execution.ts`, the literal `"2*"` in `run-coordination.ts`) with no owning value object.
- The error taxonomy is a de-facto aggregate with no home, split across four files while `isWrappedBoundaryError` must enumerate all seven classes.
- Configuration leaks twice: `run-configuration.ts` resolves `process.env["EVAL_MODEL"]` at import time, and `report.ts` imports the `evalModel` binding directly, bypassing the `EvalConfiguration` layer that `case-execution.ts` uses.
- Effect service tag identity strings hard-code `"evals/orchestration/..."`, coupling service identity to a directory name.

## 5. Screaming Architecture folder proposal

`orchestration/` is the only technically-named top-level module; within it the `run-` prefix carries four meanings (process entry, CLI invocation, suite session, global config). Proposed tree (moves are gated in section 10; nothing here is implemented):

```
evals/src/orchestration/
  run.ts                      # unchanged path — pins package.json, USAGE, docs
  report.ts                   # stays at root: REPORT_PATH is depth-sensitive
  report-rendering.test.ts
  verdict.ts                  # was case-checks.ts; the one sanctioned shared module
  verdict.test.ts             # was case-checks.test.ts
  invocation/
    arguments.ts              # was run-arguments.ts
    arguments.test.ts         # was run-arguments.test.ts
  suite/
    coordination.ts           # was run-coordination.ts, minus failure helpers
    services.ts               # was run-services.ts
    test-support.ts           # was run-coordination-test-support.ts
    coordination.test.ts      # was run-coordination.test.ts
    entry.test.ts             # was run-entry.test.ts (spawns ../run.ts)
  case-execution/
    execution.ts              # was case-execution.ts
    agent-observation.ts      # was observation-runner.ts
    model-configuration.ts    # was run-configuration.ts
    execution.test.ts         # was case-execution.test.ts
    configuration.test.ts     # was run-configuration.test.ts
  failure/
    residual-cause.ts         # was run-failure-reporting.ts
    boundary-errors.ts        # extracted from run-coordination.ts (gate G2)
    failure-lifecycle.test.ts # was run-failure-lifecycle.test.ts
```

Naming rules: the directory carries the capability, the filename carries the role; never reintroduce a prefix that duplicates its directory.

Dependency tiers, imports flowing strictly toward lower tiers: T1 leaves (`report.ts`, `verdict.ts`, `failure/`, `case-execution/model-configuration.ts`) ← T2 `case-execution/` ← T3 `suite/` ← T4 `run.ts` + `invocation/`. Root shared leaves are importable by any tier; capability directories never import a higher tier.

`verdict.ts` stays at root because nesting it under `case-execution/` would force an upward import from `suite/`. No `utils/` / `common/` / `shared/` catch-all; a second shared-module candidate triggers a design review, not a file add. Effect tag strings remain literally `"evals/orchestration/..."` during moves. `orchestration/` itself is not renamed in this plan (gate G9).

## 6. Complexity reduction opportunities

- No import cycles; the graph is strictly downward, making regrouping low-risk.
- `run-coordination.ts` (221 lines) carries four responsibilities; extracting the boundary-error helpers into `failure/boundary-errors.ts` shrinks its imports from seven modules to four and gives the failure lifecycle a home (gate G2).
- Duplicated safe-stringify fallback in `case-checks.ts` and `run-failure-reporting.ts` with the identical literal `"An unknown error occurred"` (gate G8).
- Framework coupling is concentrated: `run-failure-reporting.ts` is the only module reading `effect` 4.0.0-beta internals and five tests pin its output strings — it moves as-is with logic untouched.
- The `evalModel` dual read path (gate G7) and the three-site tier minting are further cleanups, gated separately.

## 7. Reference assessment

`REFERENCE_ASSESSMENT: SKIPPED` — no `REFERENCE_URL` was supplied; `reference-assessor` was not dispatched. `EVIDENCE_PRECEDENCE_DECISION: not-applicable`. Per-pattern rationale: no external reference patterns were consumed anywhere in this plan; every recommendation traces to local repository evidence or explicit user input. No issue found.

## 8. Migration strategy

Path chosen: small vertical slice, then incremental — six increments, each a move-only (or single-concern) commit, each independently revertable with `git revert`, with a coherent tree at every stopping point.

1. **Slice** — move `run-arguments.ts` + `run-arguments.test.ts` → `invocation/arguments.ts` + `invocation/arguments.test.ts`. One importer, no Effect tag, no depth-sensitive path, no doc-path string: validates the whole mechanic cheaply. Stop point: yes.
2. **Failure home** — move `run-failure-reporting.ts` → `failure/residual-cause.ts`; then, as a separate commit (gate G2), extract the boundary-error helpers from `run-coordination.ts` into `failure/boundary-errors.ts`. Stop point: yes.
3. **Case execution** — move `case-execution.ts`, `observation-runner.ts` (→ `agent-observation.ts`), `run-configuration.ts` (→ `model-configuration.ts`) plus their tests into `case-execution/`. Largest specifier churn, still move-only. Stop point: yes.
4. **Suite** — move `run-coordination.ts`, `run-services.ts`, `run-coordination-test-support.ts`, `run-coordination.test.ts`, and `run-entry.test.ts` into `suite/`, updating `entry.test.ts`'s relative `./run.ts` resolution to the new relative path. Stop point: yes.
5. **Verdict rename** — `case-checks.ts` → `verdict.ts` in place. Stop point: yes.
6. **Docs** — update `evals/docs/current-layout.md` and `evals/README.md:59-60` (gate G10). Terminal.

Rollback note: every increment is one commit; revert restores the previous coherent tree. `run.ts` and `report.ts` never move, so `package.json:12`, the USAGE string, the report header, and external doc references stay valid throughout.

## 9. Validation plan

After every increment, in order:

1. `pnpm lint` — tsc makes every stale `#/orchestration/...` or relative specifier a hard error; eslint/oxlint/oxfmt cover style.
2. `pnpm test` — 8 colocated token-free vitest files; discovery is depth-agnostic.
3. The free rows of `evals/docs/verification.md`: `node src/orchestration/run.ts --case=no-such-case` must exit 2 and `--tier=bogus` must exit 4, neither starting an SDK query.
4. `git status --porcelain evals/report.md` must be empty — the generated artifact must not drift.

No paid eval run is required or permitted at any point. Residual gap: no CI exists, so these checks are manual; gate G6 (lint-enforced import boundaries) is the durable follow-up.

## 10. Implementation handoff (every action approval-gated; none performed)

Opt-in gates below name today's filenames; if taken after G1, translate targets through section 5's old→new mapping (e.g. `case-checks.ts` → `verdict.ts`, `run-failure-reporting.ts` → `failure/residual-cause.ts`). Section 5's tree is the authoritative target list for every move.

- **G1 — capability-directory moves and renames** (all file relocations of increments 1-5). Targets: exactly the files in section 5's tree, including `run-entry.test.ts` → `suite/entry.test.ts`, the move `run-failure-reporting.ts` → `failure/residual-cause.ts`, and the in-place rename `case-checks.ts` → `verdict.ts`. Reason: capability legibility (the stated pain). Benefit: structure reveals capabilities; `run-` prefix ambiguity dissolved. Risks and reversibility: stale import specifiers are fully compiler-caught; `entry.test.ts`'s relative spawn path must be updated with its move; each increment is one `git revert`. Validation: section 9 suite per increment. Smaller alternative: stop after increments 1+2 (~15 specifier edits) or rename-in-place without directories.
- **G2 — extract boundary-error helpers** from `run-coordination.ts` into `failure/boundary-errors.ts`. Reason: the failure lifecycle is a capability with no home; coordination has four responsibilities. Benefit: coordination shrinks from seven imports to four; the error taxonomy gains its aggregate home. Risks and reversibility: first non-move change; behavior guarded by `run-failure-lifecycle.test.ts` and `run-coordination.test.ts`; single-commit revert. Validation: section 9. Alternative: move only `run-failure-reporting.ts` and leave the helpers in place.
- **G3 — move `report.ts` into `reporting/`** (default: NOT taken). Reason: directory symmetry. Benefit: the reporting capability becomes visible at directory level. Risks and reversibility: requires editing the depth-sensitive `../../report.md` literal; a wrong edit silently retargets the generated artifact; single-commit revert restores location and literal. Validation: assert resolved `REPORT_PATH` equality before/after; free exit-2 CLI row; `git status --porcelain evals/report.md` empty. Requires G4 first. Alternative: leave at root (the default).
- **G4 — depth-independent `REPORT_PATH` anchor** (workspace-root based). Reason: `import.meta.url` anchoring pins `report.ts` to its nesting depth. Benefit: removes the silent-retarget hazard class; frees future nesting. Risks and reversibility: changes artifact resolution logic; single-commit revert; no data migration. Validation: path-equality assertion before/after; `pnpm test`. Alternative: keep the anchoring and never nest `report.ts`.
- **G5 — rename the four Effect tag identity strings** (`"evals/orchestration/..."`). Reason: decouple service identity from the directory name. Benefit: identity survives any future rename. Risks and reversibility: no test pins the strings, so a rename is silent; assumed internal-only (zero inbound imports); single-commit revert; strings are not persisted outside source. Validation: repo-wide grep for the old strings returns nothing; `pnpm test`. Alternative: leave as historical identifiers (harmless).
- **G6 — add `no-restricted-imports` tier patterns** to `evals/eslint.config.js`. Reason: the "import boundaries match the grouping" criterion is unenforceable today. Benefit: the tier guardrails stop being convention-only — the durable substitute for missing CI. Risks and reversibility: config-only, no runtime effect, no new dependency; single-commit revert. Validation: `pnpm lint` green on the reorganized tree; then temporarily add one deliberately violating import and confirm lint fails before discarding it. Alternative: document the tiers in `current-layout.md` only.
- **G7 — single read path for `evalModel`**: make `report.ts` consume configuration via the `EvalConfiguration` layer instead of the module binding. Reason: two read paths for one value. Benefit: one authoritative configuration source; the import-time env read stops being load-bearing for reporting. Risks and reversibility: touches runtime wiring; guarded by `report-rendering.test.ts` and `run-configuration.test.ts`; single-commit revert. Validation: `pnpm lint` + `pnpm test`. Alternative: leave and document the dual path.
- **G8 — collapse the duplicated safe-stringify** (`case-checks.ts`, `run-failure-reporting.ts`). Reason: duplicated fallback with an identical literal. Benefit: one implementation; removes twin-literal drift risk. Risks and reversibility: creates a second shared module — must pass the design review named in section 5; five tests pin the failure strings; single-commit revert. Validation: `pnpm test` (failure-string and check tests green). Alternative: leave the duplication (two small functions).
- **G9 — rename `orchestration/`** to a capability name (default: NOT taken). Reason: layer-name smell — the only technically-named top-level module. Benefit: completes the Screaming criterion at top level. Risks and reversibility: breaks every hard-coded path string in section 2 (`package.json`, USAGE and its test assertion, report header, README, `verification.md`, and the external `empirical-validation.md`) plus all four tag strings; highest churn, lowest functional benefit; single-commit revert, though the churn spans docs outside `evals/`. Validation: repo-wide grep for `evals/src/orchestration` shows only intended survivors; `pnpm lint` + `pnpm test`; free CLI rows. Alternative: keep the name; the inner tree now screams capabilities.
- **G10 — update docs** `evals/docs/current-layout.md:9,14,20` and `evals/README.md:59-60` in the same change as the moves they describe. Reason and benefit: `current-layout.md` explicitly requires sync; docs stay truthful. Risks and reversibility: none; reverts with the move commit. Validation: manual read-through against the new tree. Alternative: none — sync is mandatory.

G1–G2 (plus G10's doc sync) are the recommended plan; G3–G9 are opt-in and each stands alone.

## 11. Document references consulted

`evals/AGENTS.md`, `evals/docs/current-layout.md`, `evals/docs/verification.md`, `evals/docs/agent/delegation.md`, `evals/README.md`, `evals/package.json`, `evals/tsconfig.json`, `evals/vitest.config.ts`, `evals/eslint.config.js`, `evals/.oxlintrc.json`, `docs/best-practices/empirical-validation.md`, root `AGENTS.md` / `CLAUDE.md`. External method sources: none fetched.

## 12. Risks, assumptions, blockers, open questions, security notes

Assumptions (all flagged): business goals and success criteria were inferred from the skill's purpose and the repo's docs, not stated by the user; Effect tag strings are internal-only; tier/fixture/budget/model are legitimate ubiquitous language; `REPORT_PATH` re-anchoring would be permitted if ever needed (the default plan avoids it).

Risks: no CI — every validation step is manual and skippable; `run-failure-reporting.ts` pins `effect` 4.0.0-beta internals (move it, never touch its logic in the same change); a tag-string rename would be silent (no pinning test).

Contradictions surfaced upstream: the stated domain language omitted tier/fixture/budget/model; nesting `case-checks.ts` under `case-execution/` would force an upward import (resolved: `verdict.ts` stays at root); "coordination" is both a capability and the current catch-all (resolved by the G2 extraction); "observation" currently names both the `src/observation` module and `observation-runner.ts` — resolved by renaming the runner `case-execution/agent-observation.ts`, so the term again refers only to the observation context.

Blockers: none.

Open questions (safe defaults recorded, none blocking): G4 anchor policy, G5 tag-string contract status, G9 directory rename, and the alternative of relocating the derived mutation-scope row into case-execution-adjacent code so `evaluate` has a single consumer (moves real behavior; out of scope here).

Security notes: no issue found — no embedded agent-directed directives in any repository content read; no external content consumed.
