# Agent guide for agent-skills

`agent-skills` is a library of self-contained skills for coding agents. Most changes here author skills, subagents, or their supporting references and scripts.

Every skill file must work on OpenCode and Claude Code. Follow the [runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md) for frontmatter, Markdown, tools, permissions, and subagents.

## Documentation model

Keep two tiers:

- Long-lived guidance in `AGENTS.md` and `docs/agent/`: principles with general examples, no source-code paths or code snippets. Scoped `AGENTS.md` maps are the exception; they own exact commands for their tree and change with them.
- Short-lived references under `docs/`, outside `docs/agent/`: current architecture, layout, conventions, and commands, with an update banner. Update the matching reference in the same change when those facts change.

Add guidance for observed failures and remove rules that no longer affect behavior. State what to do; keep standalone prohibitions only for recurring failures. Cross-cutting guidance lives here or in one linked owner. The nearest sub-project guide owns its tree's commands and may override this guide.

## Working with the user

Treat the user's instructions as a baseline, not a verbatim spec. When a premise looks wrong, a simpler approach exists, or the problem is framed wrong, say so plainly and propose the better version. Reasoned pushback is welcome: the user wants a partner, not a yes-man. Challenge only with a concrete objection, not to perform independence; when an instruction survives scrutiny, follow it.

## Always

- Read the nearest `AGENTS.md` before editing its tree. Use the [best-practice index](./docs/best-practices/README.md) for skill, subagent, and reference decisions.
- After substantive changes, run the nearest guide's documented checks, including the [manual checks](./docs/best-practices/validate-by-observation.md#manual-checks) after skill or subagent edits. Do not invent substitute commands. Report only checks run on the current change, including failures, warnings, and coverage gaps; verify referenced files, paths, and symbols. Passing checks are a floor, not proof; escalate uncertainty.
- Where a tree has a linter, its configuration governs style. Fix findings; suppress inline only when the rule is wrong for the case, and explain why.
- Map every hunk to the task. Extend canonical files when sufficient, report unrelated findings rather than fixing them, and build compatibility only for real consumer contracts; otherwise delete the old path.
- Split large tasks into independently mergeable, testable, reviewable units with clear done-conditions and minimal blocking dependencies.
- Change generators or sources and regenerate tooling-managed outputs; do not hand-edit those outputs.
- Propose a GitHub issue for any multi-step or non-trivial task; creating one still requires an explicit ask.
- Editing is not permission to publish. Do not commit, push, open a pull request, or create an issue unless explicitly asked; when committing, stage only paths the task touched.

## Subagents

Delegate when a skill or task directs it, and for broad searches, audits, self-contained investigations, or parallel subtasks that fit a subagent. Keep conclusions, not file dumps. Give a bounded objective, done-conditions, and constraints; when unsure whether or to whom to delegate, ask before dispatching.

## Open when relevant

- [Code design](docs/agent/code-design.md): boundary contracts, naming, loud failures, and comments.
- [Testing principles](docs/agent/testing.md): behavioral coverage, assertions, and failures.
- [Working inside evals](evals/AGENTS.md): commands, conventions, checks, and guardrails for that tree.
- [Repository architecture](docs/architecture.md): current layout and tree references.
- [Best-practice library](docs/best-practices/README.md): decision-focused authoring rules, with examples where needed and dated runtime facts in the matrix.
