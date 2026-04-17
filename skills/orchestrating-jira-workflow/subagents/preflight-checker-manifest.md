# Preflight Checker — Dependency Manifest

> This file contains the full dependency manifest for the preflight checker.
> Read this when performing a preflight check to know exactly what to verify.
>
> Reminder: preflight reports availability only. It does not install, connect,
> or repair dependencies.

---

## Classification

All dependencies are **Required**. A passing preflight verifies that every
requested dependency is available, with `UNKNOWN` reserved only for inherently
ambiguous checks. Any requested dependency confirmed as `MISSING` produces a
`FAIL` verdict. There is no optional/recommended tier. This is enforced both
here (preflight) and by each subagent at runtime (defense-in-depth).

---

## Phase 1 — Fetch Work Item (`fetching-jira-ticket`)

| Dependency | Type | Used by          | How to check                           | Install / configure                       |
| ---------- | ---- | ---------------- | -------------------------------------- | ----------------------------------------- |
| Jira MCP   | MCP  | ticket-retriever | Attempt to list Jira-related MCP tools | Connect Jira MCP in your IDE/CLI settings |

---

## Phase 2 — Plan Tasks (`planning-jira-tasks`)

| Dependency     | Type  | Used by                              | How to check                                        | Install / configure                             |
| -------------- | ----- | ------------------------------------ | --------------------------------------------------- | ----------------------------------------------- |
| /writing-plans | Skill | task-planner, dependency-prioritizer | Run `/find-skills writing-plans` or check skill dir | `skills install obra/superpowers/writing-plans` |

---

## Phase 3 — Clarify + Critique (`clarifying-assumptions`, upfront)

| Dependency               | Type  | Used by               | How to check                                        | Install / configure             |
| ------------------------ | ----- | --------------------- | --------------------------------------------------- | ------------------------------- |
| `clarifying-assumptions` | Skill | Phase 3 orchestration | `skills/.../clarifying-assumptions/SKILL.md` exists | Add skill at expected repo path |

No external dependencies beyond the skill file. Conversational skill; inline
execution.

---

## Phase 4 — Create Child Items (`creating-jira-subtasks`)

| Dependency | Type | Used by         | How to check          | Install / configure |
| ---------- | ---- | --------------- | --------------------- | ------------------- |
| Jira MCP   | MCP  | subtask-creator | Same check as Phase 1 | Same as Phase 1     |

---

## Phase 5 — Plan Task Execution (`planning-jira-task`)

| Dependency               | Type  | Used by                                                 | How to check                                                  | Install / configure                                       |
| ------------------------ | ----- | ------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| git CLI                  | Tool  | execution-prepper (branch management)                   | Run `git --version`                                           | Install git                                               |
| /find-skills             | Skill | execution-planner                                       | Try invoking `/find-skills` with a test query                 | `skills install vercel-labs/skills/find-skills`           |
| /writing-plans           | Skill | execution-planner, test-strategist, refactoring-advisor | Run `/find-skills writing-plans` or check skill dir           | `skills install obra/superpowers/writing-plans`           |
| /test-driven-development | Skill | test-strategist                                         | Run `/find-skills test-driven-development` or check skill dir | `skills install obra/superpowers/test-driven-development` |
| /vitest                  | Skill | test-strategist                                         | Run `/find-skills vitest` or check skill dir                  | `skills install antfu/skills/vitest`                      |

---

## Phase 6 — Clarify + Critique (`clarifying-assumptions`, critique mode)

| Dependency               | Type  | Used by               | How to check                                        | Install / configure             |
| ------------------------ | ----- | --------------------- | --------------------------------------------------- | ------------------------------- |
| `clarifying-assumptions` | Skill | Phase 6 orchestration | `skills/.../clarifying-assumptions/SKILL.md` exists | Add skill at expected repo path |

No external dependencies beyond the skill file. Conversational skill; inline
execution.

---

## Phase 7 — Kick Off + Execute (`executing-jira-task`)

| Dependency                   | Type  | Used by                | How to check                                                      | Install / configure                                                             |
| ---------------------------- | ----- | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| /commit-work                 | Skill | documentation-writer   | Run `/find-skills commit-work` or check skill dir                 | `skills install softaworks/agent-toolkit/commit-work`                           |
| /humanizer                   | Skill | documentation-writer   | Run `/find-skills humanizer` or check skill dir                   | `skills install blader/humanizer`                                               |
| /executing-plans             | Skill | task-executor          | Run `/find-skills executing-plans` or check skill dir             | `skills install obra/superpowers/executing-plans`                               |
| /clean-code                  | Skill | clean-code-reviewer    | Run `/find-skills clean-code` or check skill dir                  | `skills install sickn33/antigravity-awesome-skills/clean-code`                  |
| /architecture-patterns       | Skill | architecture-reviewer  | Run `/find-skills architecture-patterns` or check skill dir       | `skills install wshobson/agents/architecture-patterns`                          |
| /api-security-best-practices | Skill | security-auditor       | Run `/find-skills api-security-best-practices` or check skill dir | `skills install sickn33/antigravity-awesome-skills/api-security-best-practices` |
| context7 MCP                 | MCP   | Quality gate reviewers | Attempt to list context7 MCP tools                                | Connect context7 MCP in your IDE/CLI settings                                   |

---

## Quick Reference — All Dependencies

| Dependency                   | Type  | Phase(s) |
| ---------------------------- | ----- | -------- |
| Jira MCP                     | MCP   | 1, 4     |
| git CLI                      | Tool  | 5        |
| /writing-plans               | Skill | 2, 5     |
| `clarifying-assumptions`     | Skill | 3, 6     |
| /find-skills                 | Skill | 5        |
| /test-driven-development     | Skill | 5        |
| /vitest                      | Skill | 5        |
| /commit-work                 | Skill | 7        |
| /humanizer                   | Skill | 7        |
| /executing-plans             | Skill | 7        |
| /clean-code                  | Skill | 7        |
| /architecture-patterns       | Skill | 7        |
| /api-security-best-practices | Skill | 7        |

`context7` is **recommended but not required** for Phase 7 review quality. The
reviewers are written to use it when available and to lower confidence when it
is not. Do not fail preflight solely because `context7` is unavailable.

**Total: 14 dependencies** (1 MCP, 1 CLI tool, 12 skills)
