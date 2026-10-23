# Verification

> Short-lived current-state reference. Update this file in the same change that alters runtime, results, or check behavior.

Commands, check timing, and paid-run approval live in the [agent guide](../AGENTS.md).

## Runtime and results

Node `24.19.0` strips TypeScript types, so the suite runs from source without a build step. `erasableSyntaxOnly` excludes enums, constructor parameter properties, decorators, and namespaces. The import alias `#/*` maps to `./src/*` through package imports and TypeScript paths.

The Agent SDK bundles its own pinned Claude Code binary; no system `claude` executable is required. Ambient credentials must be available through a Claude login session or `ANTHROPIC_API_KEY`. An SDK upgrade changes the runtime as well as potentially changing results. The approved upgrade smoke run in the agent guide checks project-skill discovery, Claude Code presets, tool observation, and a budget stop.

[The config](../promptfooconfig.ts) captures `EVAL_MODEL` at import time, with absent or empty values falling back to `sonnet`. Promptfoo handles filtering, scheduling, terminal output, exports, and history; extra eval arguments pass through to it. Each selected case runs five times by default. Repeat and concurrency overrides are in the agent guide. Concurrency is capped at five attempts across the queue, including repeats, per process; two default runs can have ten attempts in flight. Repeats and case selection affect total cost; concurrency affects the rate of spending.

Each invocation gets unique `outputs/runs/<UTC timestamp>-<random>/results.json` and `results.html` paths, resolved relative to the config rather than the caller's directory. The self-contained HTML and JSON include native results; JSON holds every attempt's output and observation metadata, not just failures. Package scripts select shared SQLite history with `PROMPTFOO_CONFIG_DIR=outputs/promptfoo-state`, relative to the eval workspace. Outputs are git-ignored. Scripts disable telemetry; the config disables caching and sharing but leaves database writes enabled for the viewer.

The model appears in the eval description without changing the test dataset. `case/<id>` metrics report pass rates across repeats; tier-2 attempts also carry `mutation-scope` in native results, HTML, and history.

Observed native exit codes are `0` for passing attempts or an empty selection, `100` for any failed attempt including provider errors, and `1` for an invalid CLI option. The offline integration checks assert passing and failing `0`/`100` outcomes. Empty-selection and invalid-option exits are historical observations, not current test assertions; history persistence is also not asserted.

The [provider](../src/promptfoo/provider.ts) creates an isolated fixture, runs the case with its prompt and limits, returns output with validated observation metadata and repeat index, and cleans up. The [assertions](../src/promptfoo/assertion.ts) `grade` and `mutationScope` live in a module without a default export, because promptfoo resolves `file://…:name` against the default export when one exists. We retain a custom SDK runner because promptfoo's built-in Claude provider loses tool-call metadata when the SDK throws at a budget stop. Tier-1 routing assertions still need those calls.

Fixtures copy the repository's top-level skill into `.claude/skills/` under a temporary root, set up the required git state or missing-path scenario, and remove the root on cleanup. Adapters depend on cases, fixtures, and observation. Cases use fixture facts and observation checks; fixtures and observation do not import adapters.

## What offline checks establish

Offline tests cover case validity, routing including sibling-skill negatives, report conformance and injection defense, validator acceptance and rejection, fixture state and cleanup, SDK query policy and stream handling, deadlines and iterator cleanup, git sampling and command classification, mutation evidence, judge parsing and citations, and grading failures and ordering. They also cover runner limits, fixture isolation, and judge wiring without live model calls.

The real promptfoo CLI runs against a local offline provider to check filters, repeats, the configured concurrency cap, metrics, provider-error handling, `0`/`100` exits, and JSON/HTML exports. These checks do not establish live model behavior.

## Tiers and judging

Tier 1 uses the SDK's `maxBudgetUsd` cap to stop after routing becomes visible. The `Skill` call appears in the message stream before the budget stop, making routing checks cost cents rather than a full behavioral run.

Tier 2 runs the full behavior. Exact assertions cover machine-parsed status lines, the three-line envelope, and snapshot title. Conformance assertions accept canonical report sections in any order, numbering, or heading level, require disclosure lines exactly once, and reject leaked status wrappers or `Inspected:` logs. Judges assess semantic quality.

The skill's [shape validator](../../skills/analyzing-recent-project-state/scripts/validate-output.sh) checks subagent outputs and payload gates. Evals run it for escalation envelopes. Reports use host-side assertions; tier-2 cases require a recognized validator invocation, which still does not prove that the final report was validated.

A judge reads the observable artifact against a binary rubric, rather than asking the tested agent whether it complied. Each judged case runs an independent `haiku` query with no tools and one turn, only after its mechanical check passes. A violation fails only when its quoted text occurs verbatim in the artifact; uncited complaints are recorded without failing. An unparseable reply fails with a message naming the judge, distinguishing grading trouble from a skill verdict. Judge cost is separate from observed run cost and adds cents per judged attempt.

Fixtures install the skill but register no subagents in either runtime's agent registry, so behavioral cases exercise only the inline route. Testing dispatched-subagent behavior and contracted dispatch inputs requires fixtures registering the three subagent definitions plus capture of dispatch payloads.

## Mutation-scope limits

Every tier-2 attempt gets a native `mutation-scope` assertion without another model call. It rejects invalid runs, before/after `git status` deltas, `Write`/`Edit`/`NotebookEdit` calls, and mutating git commands. Command inspection catches mutations that leave status clean, such as switching HEAD between clean branches. Unavailable status samples count as evidence rather than as clean results.

Arbitrary shell writes escape command classification unless they change git status. Redirection, `sed -i`, `rm`, `cp`, `tee`, and interpreter writes are examples. Writes under `.claude/` never appear in status because fixtures exclude that directory to hide skill scaffolding.

A longer regex cannot close this gap: wrappers, subprocesses, and writes outside the worktree evade command-text checks, while write-like tokens in quoted arguments can produce false positives. Closing it requires filesystem tracing or a write-denying sandbox that reports violations. Read `mutation-scope` as "no observed write through git or file-writing tools", not an OS-level guarantee that nothing was written.

## Adding a case

Keep each skill's registry and checks together in `src/cases/<skill>.ts`; the [current registry](../src/cases/analyzing-recent-project-state.ts) is canonical. A case declares its fixture, prompt, budget, wall-clock limit, and a check that throws to fail or returns a short observed-outcome string for results. Add executable cases, not a parallel list of aspirations.

Assert observable tool calls, literal output, or git deltas, never the agent's claim of compliance. Do not weaken a check to automate it: leave a case out if its cheap assertion would also pass on wrong output. Prove each new assertion rejects wrong input before trusting a passing result.
