# agent-skills — Project Instructions

`agent-skills` is a skill library for coding agents: each skill is a self-contained directory with a `SKILL.md`, optional `subagents/` and `references/` directories, and supporting scripts. The repo is the artifact — most edits here are skill or subagent authoring tasks.

**Dual-runtime constraint (applies to every skill file):** skills must work on both OpenCode and Claude Code. Follow the [runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md) for frontmatter, markdown, tool, permission, and subagent choices.

## Documentation model

This repo keeps two tiers of agent documentation. Maintain the split when you add or edit docs:

- **Long-lived guidance** — `AGENTS.md` files and `docs/agents/` directories (repo root and `evals/`). Principles and task guides with general examples only; no source-code paths or code snippets, so they stay true as the code changes. Scoped `AGENTS.md` maps are the one exception: they name the exact commands for their tree and are updated when those commands change.
- **Short-lived references** — markdown files directly under a `docs/` directory. Current-state descriptions: architecture, file structure, command references. Each carries a banner saying it must be updated in the same change that alters what it describes.

Guidance earns its place from observed failures: add a rule when a mistake actually recurs, and prune rules that no longer change behavior. These files load into every agent's context, so every line must pay rent. State what to do rather than enumerating what to avoid; keep a standalone prohibition only when it marks a specific failure that keeps recurring.

Cross-cutting guidance lives once, in this file and its linked guides. Each sub-project's `AGENTS.md` (today: [`evals/AGENTS.md`](./evals/AGENTS.md)) is the nearest guide for its tree: it owns the exact commands for that tree and may override anything here.

## Working with the maintainer

The maintainer's instructions are a baseline to build on, not a spec to execute verbatim. When a premise looks wrong, a simpler approach exists, or the problem statement itself is off, say so plainly and propose the better version — the maintainer wants a partner to learn from, not a yes-man, and pushback backed by reasoning is explicitly welcome. Challenge because you have a concrete objection, not to perform independence: when an instruction survives your scrutiny, follow it.

## Always

- Before editing a tree that has its own `AGENTS.md` (today: `evals/`), read that guide first. Before authoring or editing a skill, subagent, or reference file, read the [skill-authoring guide](./docs/agents/skill-authoring.md).
- After a substantive change, run the checks the nearest guide names: the [manual verification checklist](./docs/agents/verification.md) after skill or subagent edits (this repo has no CI), and inside `evals/` the lint check after a change plus the test suite before committing ([`evals/AGENTS.md`](./evals/AGENTS.md) names the exact commands). Passing checks are a floor, not proof — when unsure whether a change is correct, escalate rather than declare success.
- Where a tree has a linter (`evals/`), its configuration is the enforced source of truth for style. Prefer fixing a finding over suppressing it; suppress inline only when the rule is genuinely wrong for the case, and say why.
- Editing is not permission to publish. Do not commit, push, open a pull request, or create an issue unless explicitly asked; when committing, stage only the paths the task touched.

## Open when relevant (long-lived)

| When you need | Read |
| --- | --- |
| Authoring or editing a skill, subagent, or reference file | [`docs/agents/skill-authoring.md`](./docs/agents/skill-authoring.md) — routing table into the best-practices docs |
| Checks to run after any skill or subagent edit | [`docs/agents/verification.md`](./docs/agents/verification.md) — manual verification checklist |
| Scope discipline, simplicity, and task decomposition | [`docs/agents/workflow.md`](./docs/agents/workflow.md) — workflow and task scoping |
| What "done" requires beyond green checks | [`docs/agents/verifying-your-work.md`](./docs/agents/verifying-your-work.md) — verification honesty |
| Working inside `evals/` | [`evals/AGENTS.md`](./evals/AGENTS.md) — nearest guide; owns evals commands, conventions, and guardrails |
| The full skill-authoring best-practice library | [`docs/best-practices/README.md`](./docs/best-practices/README.md) — master index, routed via the skill-authoring guide |

## Current-state references (short-lived; verify against the code)

| When you need | Read |
| --- | --- |
| Repository layout, tree ownership, vendored-skill tooling | [`docs/architecture.md`](./docs/architecture.md) |
