# Agent Guide — agent-skills

`agent-skills` is a skill library for coding agents: each skill is a self-contained directory with a `SKILL.md`, optional `subagents/` and `references/` directories, and supporting scripts. The repo is the artifact — most edits here are skill or subagent authoring tasks.

**Dual-runtime constraint (applies to every skill file):** skills must work on both OpenCode and Claude Code. Follow the [runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md) for frontmatter, markdown, tool, permission, and subagent choices.

## Documentation model

This repo keeps two tiers of agent documentation. Maintain the split when you add or edit docs:

- **Long-lived guidance** — `AGENTS.md` files and `docs/agent/` directories. Principles and guidelines with general examples only; no source-code paths or code snippets, so they stay true as the code changes. Scoped `AGENTS.md` maps are the one exception: they name the exact commands for their tree and are updated when those commands change.
- **Short-lived references** — Markdown files under a `docs/` directory (root or sub-project), outside `docs/agent/`; related references may be grouped in a subdirectory. Current-state descriptions: architecture, file structure and conventions, command references. Each carries a banner saying it must be updated when the code changes.

Guidance earns its place through observed failures: add a rule when a mistake happens, and remove rules that no longer affect behavior. These files load into every agent's context, so every line must pay rent. State what to do rather than enumerating what to avoid; keep a standalone prohibition only when it marks a specific failure that keeps happening.

Cross-cutting guidance lives once, in this file and its linked guides. Each sub-project's `AGENTS.md` (today: [`evals/AGENTS.md`](./evals/AGENTS.md)) is the nearest guide for its tree: it owns the exact commands for that tree and may override anything here.

## Working with the user

The user's instructions are a baseline to build on, not a spec to execute verbatim. When a premise looks wrong, a simpler approach exists, or the problem statement itself is off, say so plainly and propose the better version — the user wants a partner to learn from, not a yes-man, and pushback backed by reasoning is explicitly welcome. Challenge because you have a concrete objection, not to perform independence: when an instruction survives your scrutiny, follow it.

## Always

- Before editing a tree that has its own `AGENTS.md` (today: `evals/`), read that guide first. Before authoring or editing a skill, subagent, or reference file, read the [skill-authoring guide](./docs/agent/skill-authoring.md).
- After a substantive change, run the checks the nearest guide names: the [manual verification checklist](./docs/agent/skill-verification.md) after skill or subagent edits (this repo has no CI), and inside `evals/` the lint check after a change plus the test suite before committing ([`evals/AGENTS.md`](./evals/AGENTS.md) names the exact commands). Passing checks are a floor, not proof — when unsure whether a change is correct, escalate rather than declare success.
- Where a tree has a linter (`evals/`), its configuration is the enforced source of truth for style. Prefer fixing a finding over suppressing it; suppress inline only when the rule is genuinely wrong for the case, and say why.
- Editing is not permission to publish. Do not commit, push, open a pull request, or create an issue unless explicitly asked; when committing, stage only the paths the task touched.

## Subagents

Subagents keep the main thread's context focused while allowing independent work to run in parallel. Delegate when a skill or task directs it, and for work that fits one — broad searches or audits across many files, self-contained investigations, subtasks that can run concurrently — keeping the conclusion, not the intermediate file dumps. Give each subagent a bounded objective, a definition of done, and the constraints that scope its work; when unsure whether (or to which subagent) to delegate, ask before dispatching.

## Open when relevant

Long-lived guides:

- [Skill authoring](docs/agent/skill-authoring.md) — routing table into the best-practices docs for authoring tasks.
- [Skill verification checklist](docs/agent/skill-verification.md) — manual checks after skill or subagent edits; this repo has no CI.
- [Naming conventions](docs/agent/naming-conventions.md) — how to name variables, arguments, and functions, with good/bad examples.
- [Code design](docs/agent/code-design.md) — contracts at the boundaries, failing loudly, and comments.
- [Testing principles](docs/agent/testing.md) — what and how to test.
- [Workflow and task scoping](docs/agent/workflow.md) — simplicity, scope discipline, issues, and decomposition.
- [Verifying your work](docs/agent/verification.md) — what "done" requires beyond green tests.
- [Working inside evals/](evals/AGENTS.md) — nearest guide; owns evals commands, conventions, and guardrails.
- [Best-practice library](docs/best-practices/README.md) — master index, routed via the skill-authoring guide.

Current-state references (short-lived; verify against the code):

- [Repository architecture](docs/architecture.md) — layout of the repository and links to each tree's references.
