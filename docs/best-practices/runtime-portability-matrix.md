# runtime-portability-matrix

📍 Current-state reference: the runtime facts a portable skill depends on (frontmatter, limits, discovery, permissions, dispatch) and the portable baseline for each, re-checked on the date shown.

📍 This file is a `reference`: current-state runtime facts re-checked on the date shown; a runtime-specific field, permission, or dispatch assumption not declared here is a material gap.

> Facts checked 2026-09-19 against the official docs linked at the end. If this file and the docs disagree, fix this file.

| Feature | Agent Skills spec | Claude Code | OpenCode | Portable baseline |
| --- | --- | --- | --- | --- |
| Required frontmatter | `name`, `description` | `name` optional, defaults to directory name | `name` required, must match the directory containing `SKILL.md` | Always write both. |
| `name` shape and length | 1–64 chars; equals the parent directory name | Anthropic platform adds: no XML tags, no reserved words `anthropic`/`claude` (platform limit; harmless to follow; CLI/OpenCode enforcement not documented) | Directory identity enforced | Kebab-case, ≤ 64 chars, equal to the directory (skill) or file basename (subagent); avoid the reserved words. |
| `description` length | 1–1024 chars | `description` + `when_to_use` truncated at 1,536 chars in the skill listing; platform: non-empty, no XML tags | Standard field | ≤ 1024 chars; put routing text in `description`, never only in `when_to_use`. |
| Optional spec fields | `license`, `compatibility` (≤ 500 chars), `metadata`; `allowed-tools` is Experimental | Accepts them; non-spec keys error on claude.ai/API paths | Recognizes standard fields; unknown fields ignored | Use the three optional fields freely; treat `allowed-tools` as advisory, never as enforcement. |
| Size guidance | Instructions < 5,000 tokens recommended; `SKILL.md` under 500 lines | Same | Same | Stay inside both caps; move detail to `references/`. |
| Skill discovery paths | — | Managed-settings `.claude/skills/`; `~/.claude/skills/`; project `.claude/skills/` from the start directory up to the repository root (nested ones below it load on first file access); `.claude/skills/` in `--add-dir` directories; plugin `skills/` as `/plugin:skill` | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` and `~/` equivalents | Install under `.claude/skills/<name>/`; both runtimes read it. `.agents/skills/` and `.opencode/skills/` are OpenCode-only. |
| Runtime skill extensions | None | `when_to_use`, `disable-model-invocation`, `user-invocable`, `paths`, `argument-hint`, `agent`, `hooks`, `context: fork`, `model`, `background`, `metadata`; `$ARGUMENTS` substitution | Ignored (unknown frontmatter) | Required behavior lives in prose; add a Claude field only under a declared exception and never rely on `$ARGUMENTS` alone. |
| Skill invocation gating | — | `Skill(name)` permission rules | `permission.skill` gates names; `tools.skill: false` disables the skill tool per agent | Do not assume a skill is loadable; report `TOOLS_MISSING` when the host refuses. |
| Context after compaction | — | Most recent invocation of each skill re-attached, first 5,000 tokens each, combined budget 25,000 tokens | Not documented | Never rely on skill text surviving compaction; carry state in run-scoped files. |
| Agent registration | — | Priority: managed settings (1) > `--agents` flag (2) > project `.claude/agents/` (3, scanned from the working directory up to the repository root) > user `~/.claude/agents/` (4) > plugin `agents/` (5), loaded as `<plugin>:<agent>` | Markdown agents in `.opencode/agents/` (project) and `~/.config/opencode/agents/` (global); the file name is the agent name | Register in the runtime's documented registry; name the adapter in the skill. |
| Agent frontmatter | — | Required `name` (identity; the filename need not match), `description`; optional `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt`, `experimental` | Required `description`; optional `mode` (`primary`\|`subagent`\|`all`, default `all`), `model`, `prompt`, `temperature`, `top_p`, `steps` (`maxSteps` deprecated), `disable`, `hidden`, `color`, `permission`; `tools` deprecated in favour of `permission`; unknown keys pass through to the provider as model options (checked 2026-09-19) | State role, capabilities, inputs, outputs in prose; runtime keys are adapters. Write `name` equal to the basename so both identities agree. |
| `subagents/` inside a skill folder | Not defined | Not an agent registry | Not an agent registry | A repository co-location convention for dispatch prompts; the orchestrator reads the file or an installer copies it into a registry. This file owns that fact. |
| Nesting depth | — | Subagents may spawn subagents up to three layers below the main conversation by default; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes it, `1` turns nesting off; doc advises the main conversation for quick, targeted changes | `subagent_depth` default `1` (primaries launch subagents; those may not); `2` adds one level; `0` prevents all launches | Central orchestration is the portable default; nesting is a per-runtime optimisation behind a declared, smoke-tested path. |
| Permission model | — | Tool allow/deny lists, `Skill(name)`, settings permission rules | Families `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task`, `external_directory`, `webfetch`, `websearch`, `lsp`, `skill`, `question`, `doom_loop`; `permission.task` selects launchable subagents; legacy `tools` booleans deprecated as of v1.1.1 | Describe the capability ("read, never edit"), then map it per runtime. |
| `SKILL_DIR` resolution | — | `${CLAUDE_SKILL_DIR}` substituted in `SKILL.md` text and in `allowed-tools` Bash rules; not substituted inside subagent files | No variable exported | State: "`SKILL_DIR` is the directory containing this SKILL.md: `${CLAUDE_SKILL_DIR}` where the host substitutes it; otherwise the first existing `<workspace>/.claude/skills/<name>`, `<workspace>/.agents/skills/<name>`, `<workspace>/.opencode/skills/<name>`; if none, stop with `TOOLS_MISSING`." |
| No subagent tool available | — | `Agent` tool may be denied or withheld at the depth limit | `task` permission may deny; `subagent_depth: 0` | The orchestrator executes the subagent file's instructions in its own context and reports degraded isolation. |
| Structural validation | `skills-ref validate path/to/skill` checks that `SKILL.md` frontmatter is valid and follows all naming conventions (demonstration reference implementation) | Not provided | Validates `name` against directory at load | Run `skills-ref validate` when available; it does not observe runtime behavior, so smoke-test both runtimes. |

## Rules

1. Author the shared artifact in plain Markdown with standard frontmatter; describe each capability before mapping it to runtime syntax.
2. Declare every Claude-only field, OpenCode-only permission, discovery adapter, or runtime-specific dispatch feature at the top level, before execution instructions.
3. Treat agent registries as runtime adapters: co-locate dispatch prompts in `subagents/` when useful, and never claim the runtime registers them.
4. Route dispatch through the orchestrator by default; use nested dispatch only inside a declared runtime-specific path whose depth and permissions were smoke-tested.
5. Resolve `SKILL_DIR` with the baseline sentence above and pass it to every dispatch.
6. When the host offers no subagent tool, execute the subagent file inline and report degraded isolation instead of stopping.
7. Validate structure with `skills-ref validate` when available, then smoke-test discovery, invocation, permissions, and any nested dispatch in both runtimes.
8. Re-check the linked docs and update the date line before changing any number or field list here; other rules link this file rather than restating facts.

## Examples

```yaml
# ❌ skills/auditing-dependencies/SKILL.md — Claude-only fields presented as the portable contract
---
name: "auditing-dependencies"
description: "Audits a lockfile for vulnerable dependencies. Use when the user asks to check, scan, or audit dependencies."
when_to_use: "Also use when a CI job fails on a vulnerability scan."
context: fork
agent: dependency-auditor
---
Place `dependency-auditor.md` in this skill's `subagents/`; the runtime registers it and it spawns `advisory-fetcher` itself.
```

```markdown
<!-- ✅ same skill: portable baseline, one declared runtime exception -->
---
name: "auditing-dependencies"
description: "Audits a lockfile for vulnerable dependencies. Use when the user asks to check, scan, or audit dependencies, or when a CI vulnerability scan fails."
---
## Runtime compatibility
Portable target: Claude Code and OpenCode. Capabilities: read repository files, run bounded shell commands, never edit. `dependency-auditor` is dispatched from this orchestrator only; `advisory-fetcher` is a second orchestrator dispatch, not a nested spawn.
`SKILL_DIR` is the directory containing this SKILL.md: `${CLAUDE_SKILL_DIR}` where the host substitutes it; otherwise the first existing `<workspace>/.claude/skills/auditing-dependencies`, `<workspace>/.agents/skills/auditing-dependencies`, `<workspace>/.opencode/skills/auditing-dependencies`; if none, stop with `AUDITING_DEPENDENCIES: TOOLS_MISSING`.
Declared exception, Claude Code only: `disable-model-invocation: true` in frontmatter; register `subagents/dependency-auditor.md` under `.claude/agents/`. OpenCode: register under `.opencode/agents/` with `permission.edit: deny` and `permission.task` allowing `dependency-auditor` only. No subagent tool: run the subagent file inline and report degraded isolation.
```

## Sources

- <https://agentskills.io/specification> — `name` 1–64 chars matching the directory, `description` 1–1024 chars, < 5,000 tokens / 500 lines, `allowed-tools` Experimental, `license`/`compatibility`/`metadata`; checked 2026-09-19.
- <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview> — platform limits: no XML tags, reserved words `anthropic`/`claude`, description non-empty ≤ 1024; checked 2026-09-19.
- <https://github.com/agentskills/agentskills/tree/main/skills-ref> — `skills-ref validate path/to/skill` exists as a demonstration reference implementation; checked 2026-09-19.
- <https://code.claude.com/docs/en/skills> — discovery locations (managed, personal, project up to the repository root, nested, `--add-dir`, plugin), optional `name`, 1,536-char listing truncation, 5,000/25,000-token compaction budget, extension fields, `$ARGUMENTS`, `${CLAUDE_SKILL_DIR}`, `Skill(name)` rules; checked 2026-09-19.
- <https://code.claude.com/docs/en/sub-agents> — supported frontmatter field table, `name` as identity independent of filename, three-layer default nesting, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, agent discovery priority; checked 2026-09-19.
- <https://code.claude.com/docs/en/plugins-reference> — plugin agents in plugin-root `agents/`, loaded as `<plugin>:<agent>`; checked 2026-09-19.
- <https://opencode.ai/docs/skills/> — discovery paths, directory-name identity, `permission.skill`, `tools.skill: false`, unknown fields ignored; checked 2026-09-19.
- <https://opencode.ai/docs/config/> — `subagent_depth` default `1`, `2`, `0`; checked 2026-09-19.
- <https://opencode.ai/docs/permissions/> — permission families, `permission.task`, legacy `tools` booleans deprecated as of v1.1.1; checked 2026-09-19.
- <https://opencode.ai/docs/agents/> — markdown agent locations, file name as agent name, frontmatter `description`, `mode` (`primary`|`subagent`|`all`, default `all`), `model`, `prompt`, `temperature`, `top_p`, `steps`, `disable`, `hidden`, `color`, `permission`, `tools` deprecated; checked 2026-09-19.
