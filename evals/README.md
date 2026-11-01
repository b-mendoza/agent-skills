# evals

> Short-lived current-state reference. Update this file in the same change that alters what it describes (commands, layout, test files, coverage).

Local eval suite for the skills in this repo. It runs the Claude Agent SDK (which bundles its own Claude Code binary) against throwaway fixture repositories and asserts on observable outcomes. No system `claude` executable is required, but ambient Claude credentials must be available — a `claude /login` session or an `ANTHROPIC_API_KEY`.

Evals live here, **outside `skills/`**, on purpose. A skill directory is a distributable unit — consumers install it the way they install a library — and eval infrastructure is no more part of that package than a library's test suite belongs in a consumer's `node_modules`. See [`validate-by-observation`](../docs/best-practices/validate-by-observation.md).

## Running

```bash
# Run these commands from evals/.
pnpm install                                      # once
pnpm eval                                         # everything, 5 attempts per case
pnpm eval --filter-metadata tier=1                 # routing only
pnpm eval --filter-metadata skill=analyzing-recent-project-state # one skill
pnpm eval --filter-pattern '^analyzing-recent-project-state/snapshot-dirty$'      # one case
pnpm eval --repeat 1                               # one attempt per case, still paid
pnpm eval -j 3                                     # override default: up to 3 concurrent attempts
pnpm eval:view                                    # browse and compare saved runs
```

Node 24 strips TypeScript types natively, so the suite runs from source with no build step. Keep the syntax erasable — `erasableSyntaxOnly` is on, so no enums, parameter properties, decorators, or namespaces.

`pnpm eval` invokes promptfoo directly and uses its native terminal output. Each selected case runs `--repeat` times, default 5. The default concurrency cap is 5 attempts across the whole queue, including repeats; `-j` overrides it. Each process has its own cap, so two concurrent default runs can have 10 attempts in flight. Extra arguments go to promptfoo. Set `EVAL_MODEL` to override the model, default `sonnet`.

Native exit codes observed offline: `0` for passing attempts or an empty selection, `100` for any failed attempt, including provider errors, and `1` for an invalid CLI option.

Each invocation configures a unique `outputs/runs/<UTC timestamp>-<random>/` with `results.json` and a self-contained `results.html`. Runs also persist in promptfoo's SQLite database under `outputs/promptfoo-state`. These outputs are ignored by git. Use `pnpm eval:view` to browse history and compare runs. Per-case metrics show pass rates across repeats; read-only tier-2 attempts also carry the `mutation-scope` metric. The eval description records the model without changing the test dataset.

## Checks

```bash
pnpm lint    # tsc, eslint, oxlint, oxfmt --check, in parallel
pnpm fix     # eslint --fix, oxlint --fix, oxfmt --write
pnpm test    # vitest: unit tests for the pure functions, free and offline
```

`pnpm test` is not the eval suite. It covers the parts that can be checked without spending tokens, so a break shows up in seconds instead of after a paid run.

Each suite sits beside the code it exercises as `src/**/<module>.test.ts` (plus `promptfooconfig.test.ts` at the root); `src/cases/registry.test.ts` runs the routing and run-validity matrix over every registered case, so per-skill suites test only skill-specific behavior.

Run it before any paid run.

The toolchain and its config are shared with `metadata-scrubber/frontend`, minus the React-only pieces, so the rules here match the ones you already work under.

## Layout

| Path                             | Contents                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `promptfooconfig.ts`             | Model, provider, native assertions, cases, output paths, repeats and concurrency    |
| `src/promptfoo/`                 | Custom provider, assertion grading, observation metadata validation and case lookup |
| `src/observation/agent-query.ts` | SDK query, message schemas and types, tool observation and git sampling             |
| `src/fixtures/fixtures.ts`       | Throwaway git repos with the requested skills installed under `.claude/skills/`     |
| `src/cases/<skill>.ts`           | A skill's cases and behavioral checks                                               |
| `src/cases/case-contract.ts`     | Shared case types, seed context, and routing and behavioral defaults                |
| `src/cases/registry.ts`          | Explicit suite imports, the combined case list, and `getCase` lookup by ID          |
| `src/cases/shared-checks.ts`     | Reusable observable assertions                                                      |
| `scripts/minimize-reply.ts`      | Shortens a recorded reply while its check outcomes stay the same                    |
| `src/observation/repo-files.ts`  | Requested post-run file snapshots before cleanup                                    |
| `src/**/*.test.ts`               | Offline Vitest suites beside the code they exercise                                 |
| `outputs/`                       | Ignored per-run JSON/HTML artifacts and shared promptfoo history                    |
| `AGENTS.md`, `docs/agent/`       | Agent guide and long-lived guidance                                                 |
| `docs/*.md`                      | Short-lived references and dated historical plans                                   |

See [current layout](docs/current-layout.md) for module responsibilities and why the provider keeps our SDK runner.

## Tiers

**Tier 1** caps the run with the SDK's `maxBudgetUsd` option so it stops right after the routing decision is visible. This makes "did the skill trigger" cost cents instead of dollars — the `Skill` tool call appears in the message stream before the cap bites.

**Tier 2** is a full behavioral run with an explicit `mutationPolicy`. In the snapshot suite, assertion altitude follows the skill contract's own split: exact checks at machine-parsed boundaries (status lines, the three-line envelope, the snapshot title), conformance checks for report shape (canonical section names at any order, numbering, or heading level; disclosure lines exactly once; no leaked status wrapper or `Inspected:` log), and judge-based grading for semantic quality.

**Deterministic runtime validation.** The snapshot skill ships a shape validator (`skills/analyzing-recent-project-state/scripts/validate-output.sh`) for subagent outputs and payload gates. The eval runs it for escalation envelopes. Report checks use host-side assertions; its tier-2 cases also require a `Bash` call mentioning the validator. That call alone does not prove the final report was validated.

Read the per-run JSON to diagnose failures. It holds every attempt's output and observation metadata, not just failures. The config resolves unique artifact paths relative to its own directory, independent of the working directory. The package scripts select shared history relative to `evals/` and disable telemetry; the config disables caching and sharing. Database writes remain enabled for the viewer.

**Judge-based checks** (`src/observation/judge.ts`) grade an artifact against a binary rubric with an independent small model. This is a deliberate extension of the assert-only-observables rule: the judged artifact is the observable and the judge is a measurement instrument reading it — what stays banned is asking the agent under test whether it complied. Two guards keep verdicts honest: a violation counts only when its quote is mechanically verified to appear verbatim in the artifact (uncited complaints are recorded, never failing), and an unparseable judge reply fails the attempt with a message naming the judge, so grading trouble is never mistaken for a verdict on the skill. Judges run only after a case's mechanical check passes.

**Coverage gap, recorded on purpose:** fixtures register no skill-specific subagents in either runtime's agent registry, so current snapshot cases exercise the skill's _inline_ route. The isolated (dispatched-subagent) route — and with it any "did the orchestrator pass the contracted inputs to the subagent" assertion — is currently untestable here; covering it needs fixtures that register the three subagent definitions and a harness that captures dispatch payloads.

**Approval-gate coverage gap:** runs are single-turn with no human reply. Approval-gated skills are tested only up to the preview or approval request, with no gated target mutation. Some cases allow local reports or staged artifacts. Post-approval execution, including actual commits, PR creation, posting, and applied edits, needs a multi-turn harness that does not exist yet.

**Tracker coverage gap:** external trackers are faked through executables on PATH, currently GitHub's `gh`. These cases do not exercise live services. Jira routes are untested.

`mutation-scope` is a native per-attempt assertion on tier-2 cases declaring `mutationPolicy: "read-only"`, with no extra model invocation. It rejects invalid runs, `git status` deltas, `Write`/`Edit`/`NotebookEdit` calls, and mutating git commands. Its metric appears in native results, HTML, and history.

### What mutation-scope does not catch

The check combines three observations — a before/after `git status` delta, the tool names called, and the text of each `Bash` command. That leaves a real gap, recorded here rather than papered over:

**Arbitrary shell writes are not detected.** Bash command classification only recognizes mutating _git_ commands. A run that writes through the shell — `echo x > f`, `sed -i`, `rm`, `cp`, `tee`, or any interpreter (`python -c "open(...,'w')"`) — reads as clean unless the write happens to show up in `git status`. Writes under `.claude/` never do, because fixtures exclude that directory precisely so the skill's own scaffolding stays invisible.

This is not fixable with a longer regex: shell redirection, wrappers, subprocesses, and writes outside the worktree all escape any command-text pattern, and tokens like `rm` or `>` inside quoted arguments produce false positives that would fail legitimate read-only runs. Closing it properly needs a different mechanism — filesystem tracing, or a sandbox that denies writes and lets the OS report the violation. Until then, read `mutation-scope` as _"no observed write through git or the file-writing tools"_, not as proof that nothing was written.

Two related properties the check _does_ now hold, both of which used to fail silently: a git command that mutates without changing `git status` (`git switch` moving HEAD between clean branches) is caught from the command text, and a `git status` sample that could not be taken at all is reported as evidence rather than compared as if it were clean.

## Adding a case

Create `src/cases/<skill>.ts` exporting `cases`, a `readonly EvalCase[]` from `case-contract.ts`, and a neighboring `<skill>.test.ts`. Add one `import("#/cases/<skill>.ts"),` line in alphabetical order in `registry.ts`. IDs must be globally unique and start with `<skill>/`. For every directory under `skills/` containing `SKILL.md`, the registry test requires `<skill>/trigger-positive` at tier 1, another tier-1 case, and a tier-2 case.

A case declares `skill`, `tier`, `fixture`, `intent`, `prompt`, `budgetUsd`, `wallClockMs`, and `check`. Routing cases can spread `routingDefaults` and behavioral cases `behavioralDefaults`; use `checkPositiveRouting(observation, skill)` or `checkNegativeRouting(observation, skill)` from `shared-checks.ts`. Keep any skill-specific completed-output rejection in the suite. A behavioral case must declare `mutationPolicy: "read-only"` or `"allowed"`. The latter skips `mutation-scope`, so its `check` must verify the expected writes. `judge` remains optional and runs only after `check` passes.

Optional setup and file checks:

- `extraSkills: ["sibling-skill"]` installs additional first-party skills alongside `skill`.
- `seed: ({ repoPath, binPath }) => { ... }` runs synchronously after the base repo and skills exist, before observation starts. Plant files or commits in `repoPath`. Put executable fake CLIs in `binPath`; the provider prepends it to the agent's PATH while inheriting ambient credentials. The bin directory is outside the repo and is removed with the fixture.
- `snapshotPaths: ["reports/result.md", "deleted.txt"]` captures those repo-relative text files before cleanup into schema-validated `observation.repoFiles`. Values are UTF-8 strings or `null` for absent paths. Absolute/traversal paths, symlinks, and non-files fail the attempt. The file helpers `assertFileExists`, `assertFileAbsent`, and `assertFileMatches` require a captured path; an unrequested path cannot pass as absent.
- A trailing slash requests a recursive directory snapshot, for example `snapshotPaths: ["reports/"]`. Each regular descendant is stored under its repo-relative path. The `"reports/"` key is `""` when the directory exists, or `null` when absent. `capturedFilesUnder(observation, "reports/")` requires that marker and returns descendant contents, or `{}` for an absent or empty directory. Directory captures reject symlinks and non-regular entries and stop above 200 files or 1 MiB per file.
- `findBashCalls(observation, pattern)` finds lexical command matches, not successful execution. `assertNoMutation` wraps the existing mutation evidence detector.

The case list is executable coverage, not a list of aspirational cases.

Two rules, both from the mandatory practice:

- **Assert only observables** — tool calls, literal output text, git deltas. Never assert that the agent said it complied.
- **Do not weaken an assertion to automate it.** If the only cheap check would also pass on wrong output, the case is not ready to add. Leave it out rather than shipping a green check that means nothing.

When adding an assertion, verify it fails on wrong input before trusting it green — a check that never fails is not a check.

## Coverage

All 28 skills have registered suites. Counts describe available cases, not live-run pass rates.

| Skill                              | Routing, tier 1 | Behavioral, tier 2 |
| ---------------------------------- | --------------: | -----------------: |
| `analyzing-recent-project-state`   |               5 |                  5 |
| `clarifying-assumptions`           |               2 |                  2 |
| `committing-scoped-changes`        |               2 |                  3 |
| `council-of-advisors`              |               2 |                  2 |
| `creating-work-item-children`      |               2 |                  2 |
| `diagnosing-root-causes`           |               2 |                  3 |
| `executing-work-item-task`         |               2 |                  2 |
| `fetching-work-item`               |               2 |                  2 |
| `generate-flow-diagram`            |               2 |                  2 |
| `generate-handoff-document`        |               2 |                  2 |
| `improving-skill-definition`       |               2 |                  2 |
| `improving-test-suites`            |               2 |                  2 |
| `orchestrating-workflow`           |               2 |                  2 |
| `planning-codebase-restructuring`  |               2 |                  2 |
| `planning-task-execution`          |               2 |                  2 |
| `planning-work-item-tasks`         |               2 |                  2 |
| `pr-creator`                       |               2 |                  2 |
| `prompt-structurer`                |               2 |                  2 |
| `recency-guard`                    |               2 |                  2 |
| `refactoring-code`                 |               2 |                  2 |
| `refine-task`                      |               2 |                  2 |
| `reporting-skill-issues`           |               2 |                  2 |
| `responding-to-pr-review-comments` |               2 |                  2 |
| `review-pull-request`              |               2 |                  2 |
| `review-software-engineer-cv`      |               2 |                  2 |
| `rewriting-code-strictly`          |               2 |                  2 |
| `validate-implementation-plan`     |               2 |                  2 |
| `workflow-skill-architect`         |               2 |                  3 |
| **Total**                          |          **59** |             **62** |

One attempt per case sums to $2.95 in tier-1 `budgetUsd` and $116.10 in tier-2 `budgetUsd`, or $119.05 combined. These are configured SDK budget caps, not observed costs; judge calls are additional. The default five repeats multiply these totals by five.
