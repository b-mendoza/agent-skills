# Repository Architecture (current state)

> **Short-lived reference.** This file describes the current state of the repository and must be updated whenever that state changes. If this file and the code disagree, the code wins — fix this file.

## Layout

| Path | Contents |
| --- | --- |
| [`skills/`](../skills/) | First-party skills. One directory per skill. |
| [`docs/best-practices/`](./best-practices/) | Per-topic skill-authoring guidance ([index](./best-practices/README.md)). |
| [`docs/agent/`](./agent/) | Long-lived task guides for agents working in this repo. |
| [`evals/`](../evals/) | Local eval suite; runs skills against fixture repos. Has its own [agent guide](../evals/AGENTS.md). |
| [`.agents/skills/`](../.agents/skills/) | Vendored third-party skills (OpenCode discovery). Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`.claude/skills/`](../.claude/skills/) | Mirror of vendored skills (Claude Code discovery). Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`skills-lock.json`](../skills-lock.json) | Pin file for vendored skills. Managed by the [`skills` CLI](https://www.skills.sh/docs). |
| [`opencode.jsonc`](../opencode.jsonc) | OpenCode configuration (MCP server registration only). |
