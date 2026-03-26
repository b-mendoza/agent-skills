# Platform Dispatch Reference

This skill supports multiple AI coding platforms. All three target platforms
have native subagent support. Use the dispatch method that matches your current
environment.

## Detecting Your Platform

| Signal                                                      | Platform     |
| ----------------------------------------------------------- | ------------ |
| `agent` tool is available / `.claude/` directory exists     | Claude Code  |
| Running inside Cursor IDE / `.cursor/` directory exists     | Cursor IDE   |
| Running inside OpenCode CLI / `.opencode/` directory exists | OpenCode CLI |

---

## Claude Code CLI

Claude Code has native subagent support via the `agent` tool. Subagent `.md`
files are read from `.claude/agents/` or co-located within skill directories.

**Dispatch pattern for each stage:**

```
agent task-decomposer "Read docs/<KEY>.md and write the decomposed task list to docs/<KEY>-stage-1-decomposed.md"

agent task-planner "Read docs/<KEY>.md (ticket) and docs/<KEY>-stage-1-decomposed.md (task list), then write detailed tasks to docs/<KEY>-stage-2-detailed.md"

agent dependency-mapper "Read docs/<KEY>-stage-2-detailed.md and write dependency-annotated tasks to docs/<KEY>-stage-3-dependencies.md"

agent task-prioritizer "Read docs/<KEY>-stage-3-dependencies.md and write the prioritized plan to docs/<KEY>-stage-4-prioritized.md"

agent task-validator "Read docs/<KEY>.md (ticket) and docs/<KEY>-stage-4-prioritized.md (plan), then write the validated final plan to docs/<KEY>-tasks.md"
```

Each subagent runs in its own context window and returns only its final result,
keeping the orchestrator's context clean.

---

## Cursor IDE

Cursor 2.4+ has native subagent support. Subagents run in parallel with their
own context windows and can be defined as markdown files under
`.cursor/agents/` (project-level) or `~/.cursor/agents/` (user-level).

Cursor can also load Claude Code-compatible agent definitions from
`~/.claude/agents/`. The co-located subagent files in this skill's `subagents/`
directory work with Cursor's agent system.

**Dispatch approach:**

1. The orchestrating agent reads the subagent registry table and dispatches
   to the appropriate subagent by name or by reading its `.md` file.
2. Each subagent runs in its own context window with isolated tool access.
3. Cursor 2.5+ supports async subagents that can spawn their own subagents.

**Cursor-specific tips:**

- Use `@file` references to pull in subagent `.md` files when needed.
- Cursor's Composer mode works well for multi-file edits across stages.
- Subagents can run in the background while the parent agent continues
  working (async mode in Cursor 2.5+).

---

## OpenCode CLI

OpenCode has native subagent support via the Task tool. It supports both
primary agents and subagents, with agents defined as markdown files or via
`opencode.json` configuration.

Agent files can be placed in:

- `.opencode/agents/` (project-level)
- `~/.config/opencode/agents/` (user-level)

OpenCode also has native skills support (as of v1.0.190), so the SKILL.md
format is recognized directly.

**Dispatch approach:**

1. Subagents can be invoked via the Task tool by the primary agent, or
   manually via `@mention` in messages.
2. Each subagent creates a child session with its own context.
3. Use `session_child_first` to navigate between parent and child sessions.

**OpenCode-specific tips:**

- Control which subagents an agent can invoke via `permission.task` settings.
- Use `hidden: true` for internal subagents that should only be invoked
  programmatically, not shown in the `@` autocomplete menu.
- If running with a model that has a smaller context window, consider running
  each stage as a separate invocation.

---

## Inline Execution (Universal Fallback)

For any platform without native subagent dispatch, or when running in a
context where the agent system isn't available:

```
For each stage:
  1. Read the subagent .md file for this stage
  2. Read the required input file(s)
  3. Follow the subagent's instructions to produce the output
  4. Write the output to the correct stage file path
  5. Run the sanity check from SKILL.md
  6. Proceed to the next stage
```

The subagent files are written to work both as agent definitions (for native
dispatch) and as inline instruction sets (for fallback execution). No
adaptation of the subagent content is needed.
