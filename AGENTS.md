# agent-skills — Project Instructions

`agent-skills` is a skill library for coding agents: each skill is a
self-contained directory with a `SKILL.md`, optional `subagents/` and
`references/` directories, and supporting scripts. The repo is the
artifact — most edits here are skill or subagent authoring tasks.

**Dual-runtime constraint (applies to every skill file):** skills must work
on both OpenCode and Claude Code. Use lowest-common-denominator frontmatter
and plain markdown links — no runtime-specific syntax such as `@path`
imports or runtime-only frontmatter fields. See the
[runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md).

## Commands

- Evals use **pnpm** (`pnpm install` once in `evals/`; `pnpm lint` /
  `pnpm test` from that directory check the eval toolchain).
- Run the eval suite: `node evals/src/orchestration/run.ts`
  (one case: `--case=<id>`).
- Validate a skill: `skills-ref validate <skill-dir>` (when available).

## Repository Layout

| Path                                     | Contents                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| [`skills/`](./skills/)                   | First-party skills. One directory per skill.                       |
| [`docs/best-practices/`](./docs/best-practices/) | Per-topic skill-authoring guidance ([index](./docs/best-practices/README.md)). |
| [`docs/agents/`](./docs/agents/)         | Task guides for agents working in this repo (see below).           |
| [`evals/`](./evals/)                     | Local eval suite; runs skills against fixture repos.               |
| [`.agents/skills/`](./.agents/skills/)   | Vendored third-party skills. Source of truth for OpenCode discovery. |
| [`.claude/skills/`](./.claude/skills/)   | Mirror of vendored skills for Claude Code discovery.               |
| [`skills-lock.json`](./skills-lock.json) | Pin file for vendored skills. Managed by tooling — never hand-edit. |
| [`opencode.jsonc`](./opencode.jsonc)     | OpenCode configuration (MCP server registration only).             |

## Task Guides

Read the guide matching your task before editing; load nothing else until
needed.

| When | Load |
| ---- | ---- |
| Authoring or editing a skill, subagent, or reference file | [`docs/agents/skill-authoring.md`](./docs/agents/skill-authoring.md) — routing table into the best-practices docs |
| After any skill or subagent edit | [`docs/agents/verification.md`](./docs/agents/verification.md) — manual verification checklist (this repo has no CI) |
