# agent-skills — Project Instructions

`agent-skills` is a skill library for coding agents: each skill is a
self-contained directory with a `SKILL.md`, optional `subagents/` and
`references/` directories, and supporting scripts. The repo is the
artifact — most edits here are skill or subagent authoring tasks.

**Dual-runtime constraint (applies to every skill file):** skills must work
on both OpenCode and Claude Code. Follow the
[runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md)
for frontmatter, markdown, tool, permission, and subagent choices.

## Commands

- Validate a skill: `skills-ref validate <skill-dir>` (when available).
- Eval-suite commands (pnpm toolchain, runner, checks) are owned by
  [`evals/AGENTS.md`](./evals/AGENTS.md).

## Documentation model

Agent documentation in this repo keeps two tiers; maintain the split when
you add or edit docs:

- **Long-lived guidance** — `AGENTS.md` files and `docs/agents/`
  directories (repo root and `evals/`). Principles and task guides with
  general examples only, so they stay true as the code changes.
- **Short-lived references** — markdown files directly under a `docs/`
  directory. Current-state descriptions carrying a banner; update them in
  the same change that alters what they describe.

## Repository Layout

| Path                                     | Contents                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| [`skills/`](./skills/)                   | First-party skills. One directory per skill.                       |
| [`docs/best-practices/`](./docs/best-practices/) | Per-topic skill-authoring guidance ([index](./docs/best-practices/README.md)). |
| [`docs/agents/`](./docs/agents/)         | Task guides for agents working in this repo (see below).           |
| [`evals/`](./evals/)                     | Local eval suite; runs skills against fixture repos. Has its own [agent guide](./evals/AGENTS.md). |
| [`.agents/skills/`](./.agents/skills/)   | Vendored third-party skills (OpenCode discovery). Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`.claude/skills/`](./.claude/skills/)   | Mirror of vendored skills (Claude Code discovery). Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`skills-lock.json`](./skills-lock.json) | Pin file for vendored skills. Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`opencode.jsonc`](./opencode.jsonc)     | OpenCode configuration (MCP server registration only).             |

## Task Guides

Read the guide matching your task before editing.

| When | Load |
| ---- | ---- |
| Authoring or editing a skill, subagent, or reference file | [`docs/agents/skill-authoring.md`](./docs/agents/skill-authoring.md) — routing table into the best-practices docs |
| After any skill or subagent edit | [`docs/agents/verification.md`](./docs/agents/verification.md) — manual verification checklist (this repo has no CI) |
| Working inside `evals/` | [`evals/AGENTS.md`](./evals/AGENTS.md) — nearest guide; owns evals commands, conventions, and guardrails |
