# runtime-portability-matrix

## Tier

`mandatory`. A skill that silently depends on one runtime will fail when
it is distributed to both; portable skills must declare the boundary.

## When it applies

For any skill that targets both OpenCode and Claude Code, consumes
runtime-specific frontmatter or permissions, dispatches agents, or is
reviewed for cross-runtime portability.

## The practice

Describe the required capability first, then map that capability to each
runtime's syntax. The prose contract is the portable source of truth;
runtime frontmatter, permissions, discovery paths, and dispatch controls
are adapters.

**Portability matrix.**

| Layer | Portable baseline | Claude Code mapping | OpenCode mapping |
| --- | --- | --- | --- |
| Standard Agent Skills frontmatter | Require `name` and `description`. Optionally use `license`, `compatibility`, and string-valued `metadata`. Keep `name` 1–64 characters, kebab-case, and equal to the directory name. Treat `allowed-tools` as experimental, not portable enforcement. | Claude Code accepts the standard fields and adds runtime behavior. | OpenCode recognizes the standard fields except experimental `allowed-tools`; unknown fields are ignored. |
| Claude Code skill extensions | Put required behavior in prose and add these fields only in a labeled Claude adapter. | Extensions include `disable-model-invocation`, `user-invocable`, `paths`, `argument-hint`, `arguments`, `context: fork`, `agent`, and `hooks`. Skill bodies support `$ARGUMENTS`, indexed arguments, and named argument substitution. `Skill(name)` permission rules govern invocation. | Do not rely on Claude extensions. OpenCode ignores unknown skill frontmatter. |
| Claude Code agent frontmatter | Define the role, capabilities, inputs, and outputs independently of agent-file syntax. | Custom agents require `name` and `description`; optional runtime fields include `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, and `initialPrompt`. | These keys do not configure an OpenCode agent. |
| OpenCode skill behavior | Load skills on demand and keep permissions outside the portable instruction contract. | Claude Code uses its Skill tool, permission rules, and skill extensions. | OpenCode discovers standard skills, loads them through `skill`, gates names with `permission.skill`, and can disable the tool per agent with `tools.skill: false`. |
| OpenCode agent frontmatter and permissions | Express the capability before the permission map. | Map capabilities to Claude tool allowlists, denylists, and settings permissions. | Markdown agents use fields such as `description`, `mode`, `model`, `tools`, and `permission`. `mode` is `primary`, `subagent`, or `all`; permission families include `read`, `edit`, `bash`, `task`, `webfetch`, `websearch`, and `skill`. |

**Current runtime facts checked 2026-07-22.** These facts are volatile;
re-check the official sources before changing a portable contract.

- The Agent Skills specification recommends a `SKILL.md` instruction body
  under 5,000 tokens and the broader file under 500 lines. It defines
  `allowed-tools` as experimental. Run `skills-ref validate <skill-dir>`
  for standard structural checks.
- Claude Code discovers custom agents from managed settings, `--agents`,
  project `.claude/agents/`, user `~/.claude/agents/`, and plugin-root
  `agents/`, in that priority order. It does not document a skill-local
  `subagents/` directory as an agent registry.
- A repository's `skill-name/subagents/` directory is therefore a
  co-location convention for dispatch prompts. A runtime uses those files
  only when the orchestrator reads them or an installation adapter copies
  or exposes them through a documented agent registry.
- Claude Code supports nested subagents to five subagent levels. A depth-5
  agent does not receive `Agent`; denying `Agent`, omitting it from a
  `tools` allowlist, or applying settings permission rules can prevent
  delegation. `Agent(type)` filters in an agent's `tools` field constrain
  only a main-thread agent; nested-agent target filtering belongs in
  settings permission rules.
- OpenCode documents `subagent_depth`: the default `1` permits the main
  session to launch one subagent level but prevents that subagent from
  nesting. Higher values permit additional levels, and `0` disables
  launches. `task` permission must also allow the target agent.
- Top-level orchestrator chaining remains the portable default. Nested
  delegation is a runtime-configured optimization because depth and
  permission defaults differ.
- In Claude Code, an invoked skill's rendered content remains in the
  current session. During auto-compaction, the most recent invocation of
  each skill is reattached, capped at 5,000 tokens per skill and 25,000
  tokens across skills, with the newest skills filled first. This does not
  promise persistence into an unrelated new session.
- OpenCode discovers skills from `.opencode/skills/`, `.claude/skills/`,
  and `.agents/skills/` project trees and their documented global
  equivalents. Its skill `name` must match the containing directory.

**Rules.**

1. **Author the contract in plain Markdown.** Use plain relative links and
   standard Agent Skills frontmatter for the shared artifact.
2. **Describe capability before syntax.** State, for example, "read
   repository files but do not edit them," then map that requirement to
   Claude Code and OpenCode separately.
3. **Treat registries as runtime adapters.** Keep skill-local dispatch
   prompts co-located when useful, but do not claim that `subagents/`
   auto-registers them.
4. **Route through the orchestrator by default.** Use required nested
   dispatch only in a declared runtime-specific path whose depth and
   permissions are smoke-tested.
5. **Pass complete handoff contracts.** Include inputs, constraints,
   source paths, output format, stop conditions, and mutation boundaries;
   do not rely on inherited conversation state.
6. **Declare exceptions before execution instructions.** Name every
   Claude-only field, OpenCode-only permission, discovery adapter, or
   runtime-specific dispatch feature at the top level.
7. **Validate structure and behavior.** Run `skills-ref validate` for the
   standard package, then smoke-test discovery, invocation, permissions,
   argument expansion, and any nested dispatch in both runtimes. The
   validator cannot prove runtime-specific behavior.

## Rationale

OpenCode and Claude Code both support skills, agents, tools, permissions,
and delegation, but their configuration surfaces and defaults differ. A
Markdown artifact can appear portable while depending on an ignored field,
an undiscovered agent file, a temporary permission grant, or a nesting
limit that exists only in one installation.

The load-bearing rule is to describe capability first. "Needs read access
without mutation" is a stable contract. `tools: [Read]`,
`disallowedTools: [Edit]`, and `permission.edit: deny` are runtime adapters
that can change without rewriting the workflow's meaning.

## Concrete examples

Good: the shared contract states capabilities, then labels runtime maps.

```markdown
## Runtime compatibility

Portable target: Claude Code and OpenCode.

Required capabilities:

- Read repository files and run bounded inspection commands.
- Do not edit files.
- Dispatch `security-reviewer` through the top-level orchestrator.

Runtime mapping:

- Claude Code: register the reviewer under `.claude/agents/`; allow read,
  search, and bounded shell tools; deny mutation tools.
- OpenCode: register the reviewer under `.opencode/agents/`; set
  `permission.edit: deny`; allow `task` only for `security-reviewer`.
```

Bad: the shared contract assumes one runtime's registry and nesting model.

```markdown
Place `reviewer.md` in this skill's `subagents/` directory. The runtime
will register it automatically, and it will spawn the next reviewer.
```

## References

- Agent Skills specification, accessed 2026-07-22:
  <https://agentskills.io/specification>. Supports the standard
  frontmatter, naming constraints, progressive-disclosure guidance, and
  `allowed-tools` status.
- Agent Skills `skills-ref`, accessed 2026-07-22:
  <https://github.com/agentskills/agentskills/tree/main/skills-ref>.
  Supports `skills-ref validate path/to/skill`.
- Claude Code Docs, "Extend Claude with skills," accessed 2026-07-22:
  <https://code.claude.com/docs/en/skills>. Supports skill discovery,
  extensions, substitutions, permissions, lifecycle, and compaction.
- Claude Code Docs, "Create custom subagents," accessed 2026-07-22:
  <https://code.claude.com/docs/en/sub-agents>. Supports agent discovery,
  frontmatter, nested spawning, tool restrictions, and depth limits.
- Claude Code Docs, "Plugins reference," accessed 2026-07-22:
  <https://code.claude.com/docs/en/plugins-reference>. Supports plugin
  `agents/` discovery and skills-directory plugin boundaries.
- OpenCode Docs, "Skills," accessed 2026-07-22:
  <https://opencode.ai/docs/skills/>. Supports discovery, frontmatter
  validation, `permission.skill`, and `tools.skill` behavior.
- OpenCode Docs, "Agents," accessed 2026-07-22:
  <https://opencode.ai/docs/agents/>. Supports agent modes, frontmatter,
  permissions, and task-based dispatch.
- OpenCode Docs, "Config," accessed 2026-07-22:
  <https://opencode.ai/docs/config/>. Supports configurable
  `subagent_depth` and its default.
- OpenCode Docs, "Permissions," accessed 2026-07-22:
  <https://opencode.ai/docs/permissions/>. Supports `skill` and `task`
  permission rules, wildcard matching, and agent-specific overrides.
