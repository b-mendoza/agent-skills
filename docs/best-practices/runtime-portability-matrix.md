# runtime-portability-matrix

## Tier

`mandatory`. A skill that silently depends on a single-runtime feature
will fail when distributed across runtimes; portable skills must
declare the boundary.

## When it applies

For any skill that targets both OpenCode and Claude Code, any skill
that consumes runtime-specific frontmatter or tool permissions, and
any review that asks whether a portable skill is actually portable.

## The practice

Portable skills must name which runtime features are common across
OpenCode and Claude Code, which features require runtime-specific
mapping, and which features are unsupported in one target. The skill
contract should use the lowest-common-denominator form unless it
explicitly declares a runtime-specific exception.

**Portability matrix.**

| Concern | Portable default | Claude Code notes | OpenCode notes |
| --- | --- | --- | --- |
| Skill and subagent files | Plain Markdown with minimal YAML frontmatter | Custom subagents use Markdown definitions with fields such as `name`, `description`, `tools`, and `disallowedTools` | Markdown agents can set fields such as `description`, `mode`, and `permission` |
| Frontmatter | Use only fields both targets can ignore safely or understand by convention | `tools` and `disallowedTools` are Claude-specific permission controls | `permission` is OpenCode-specific and gates tool families |
| Links and imports | Use plain relative Markdown links | Avoid assuming runtime-specific import syntax | Avoid assuming runtime-specific import syntax |
| Subagent invocation | Orchestrator or main conversation owns the routing table | Subagents cannot spawn other subagents; nested workflows must chain from the main conversation or use skills | OpenCode uses `task` permission to gate subagent launches |
| Tool permissions | Describe required capability in prose, then map to runtime-specific config | Restrict with `tools` or `disallowedTools`; `Agent(...)` restrictions apply only to agents running as the main thread | Restrict with `permission` keys such as `read`, `edit`, `bash`, `task`, `webfetch`, and `websearch` |
| Context model | Assume delegated agents start without the full active conversation unless the runtime explicitly says otherwise | Non-fork subagents start with isolated context and receive a delegation message | Treat subagent context inheritance as runtime behavior; pass complete input contracts |
| External web access | Declare when a skill needs current external information | Map to available web/search tools in the active environment | Map to `webfetch` or `websearch` permission when present |
| File mutation | Declare mutation boundaries in the skill contract | Restrict write/edit tools where possible | Restrict `edit` permission, which covers write/edit/patch operations |

**Current runtime facts checked 2026-05-27.** These facts are
volatile. Re-check official runtime docs before changing a portable
contract, permission map, or subagent invocation rule.

- Claude Code custom subagents are Markdown files with YAML
  frontmatter. Only `name` and `description` are required, while
  fields such as `tools`, `disallowedTools`, `model`, `permissionMode`,
  `maxTurns`, `skills`, `mcpServers`, `memory`, `background`,
  `effort`, and `isolation` are runtime-specific details that
  portable skills should not require unless they declare a Claude-
  specific mapping.
- Claude Code non-fork subagents start with a fresh, isolated context
  window, but the context is not empty: runtime-provided environment
  details, the delegation prompt, memory files, and other configured
  context may be present. Pass every required input explicitly
  anyway.
- Claude Code subagents cannot spawn other subagents. An agent
  running as the main thread can spawn subagents only when the
  `Agent` tool is allowed.
- OpenCode agents use Markdown definitions with runtime-specific
  frontmatter such as `mode` and `permission`. OpenCode permission
  keys include `read`, `edit`, `bash`, `task`, `webfetch`,
  `websearch`, and related tool-family gates. Portable skills should
  describe capabilities first, then map them to those keys for
  OpenCode.

**Rules.**

1. **Author portable files in plain Markdown.** Do not require
   runtime-specific import syntax, mention expansion, or hidden
   global agent registries in files that must work in both OpenCode
   and Claude Code.
2. **Separate capability from runtime syntax.** First state the
   capability the skill needs, such as "read repository files but do
   not edit them." Then, if needed, provide runtime-specific
   mappings for Claude Code and OpenCode.
3. **Keep routing in the orchestrator for portable workflows.** If a
   workflow needs multiple subagents, the orchestrator or main
   conversation chains them. Do not put required nested dispatch
   inside a subagent unless the skill is explicitly single-runtime
   and documents that exception.
4. **Pass complete contracts across runtime boundaries.** A
   dispatched agent receives the inputs, constraints, output format,
   stop conditions, and source paths it needs. Do not rely on it
   remembering conversation context or files already read by the
   orchestrator.
5. **Declare runtime-specific exceptions at the top level.** If a
   skill uses a Claude-only field, an OpenCode-only permission map,
   or a runtime-specific execution feature, the `SKILL.md` or index
   entry must say so before the execution section.
6. **Revalidate volatile runtime behavior.** When a practice depends
   on current model, tool, permission, or subagent behavior, check
   the official runtime documentation before changing the skill
   contract.

## Rationale

OpenCode and Claude Code both support agentic workflows, subagents,
tools, and permissions, but they do not expose the same configuration
surface. A skill can look portable in Markdown while depending on a
tool name, frontmatter key, or delegation behavior that only one
runtime understands. The matrix turns that hidden assumption into an
authoring check: every entry has a portable default plus the runtime-
specific mapping when one is needed.

The "describe capability first" rule is the load-bearing one. If
the skill body says "use `tools: [Read]`" it has already committed
to one runtime's syntax. If it says "needs the capability to read
files but not edit them" it has stated the contract; the runtime
mapping then sits in a separate block where it can be different per
runtime without changing the contract.

## Concrete examples

Good: skill states the capability in prose and maps it to each
runtime's syntax in a clearly labeled block.

```markdown
## Runtime Compatibility

Portable target: OpenCode and Claude Code.

Required capabilities:
- Read repository files.
- Run bounded inspection commands.
- Do not edit files.
- Dispatch `security-reviewer` from the orchestrator only.

Runtime mapping:
- Claude Code: allow read/search/bash tools; deny write/edit tools;
  do not rely on subagents spawning subagents.
- OpenCode: set `permission.edit: deny`, permit bounded `bash`, and
  allow `task` only for the named review subagent.
```

Bad: the skill bakes runtime-specific syntax into the contract
without naming the underlying capability.

```markdown
## Tools
This skill uses `tools: [Read, Bash]` and `disallowedTools: [Write,
Edit]`.

(Now the skill works on Claude Code only; OpenCode receives a
configuration block it cannot interpret and silently falls back to
default permissions.)
```

## References

- Claude Code Docs, "Create custom subagents," accessed 2026-05-27:
  <https://code.claude.com/docs/en/sub-agents>. Supports the current
  Claude Code notes above, including frontmatter fields, isolated
  context, tool restrictions, chaining, and the nested-subagent
  limit.
- OpenCode Docs, "Agents," accessed 2026-05-27:
  <https://opencode.ai/docs/agents/>. Supports the current OpenCode
  notes above, including `mode: subagent` and permission-family
  mappings.

## Related practices

- [Orchestrator as routing UI](./orchestrator-as-routing-ui.md) —
  portable routing shape for multi-subagent workflows.
- [Mutation scope boundaries](./mutation-scope-boundaries.md) — how
  edit authority is declared before runtime-specific enforcement.
- [External information linking](./external-information-linking.md)
  — runtime docs are the canonical example of volatile sources.
- [Naming conventions](./naming-conventions.md) — frontmatter
  `name` matching the directory is required for runtime lookup.
