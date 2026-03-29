# 02 — Subagent Registry

> Every subagent in the system: orchestrator utilities, phase handlers, and their roles.

---

## Subagent distribution

```mermaid
pie title Subagents by scope (25 total)
    "Orchestrator utilities" : 7
    "Phase 1 — Fetch" : 1
    "Phase 2 — Plan" : 4
    "Phase 3 — Clarify" : 1
    "Phase 4 — Create" : 1
    "Phase 5 — Execute" : 10
    "Phase 5 — Quality gates" : 1
```

> Note: `requirements-verifier` is counted under Phase 5's 10 subagents. The three quality gate subagents (`clean-code-reviewer`, `architecture-reviewer`, `security-auditor`) are also part of Phase 5's 10.

---

## Orchestrator utility subagents (7)

These handle all tool calls, file reads, and command execution on behalf of the orchestrator. The orchestrator dispatches to these instead of doing anything directly.

### preflight-checker

| Property        | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Path            | `./subagents/preflight-checker.md`                                                 |
| Purpose         | Validate environment dependencies (MCPs, skills, CLI tools) before workflow starts |
| When dispatched | Before starting or resuming a workflow                                             |

**What it checks:**

| Dependency                 | Type  | Level       | Phase(s) |
| -------------------------- | ----- | ----------- | -------- |
| Jira MCP                   | MCP   | Required    | 1, 4     |
| git CLI                    | Tool  | Required    | 5        |
| `/commit-work`             | Skill | Recommended | 5        |
| `/humanizer`               | Skill | Recommended | 5        |
| `/find-skills`             | Skill | Recommended | 5        |
| `/clean-code`              | Skill | Recommended | 5        |
| `/architecture-patterns`   | Skill | Recommended | 5        |
| `/security-best-practices` | Skill | Recommended | 5        |
| context7 MCP               | MCP   | Recommended | 5        |

**Verdict logic:**

| Verdict | Condition                                        | Orchestrator action                            |
| ------- | ------------------------------------------------ | ---------------------------------------------- |
| PASS    | All required available                           | Proceed silently                               |
| WARN    | All required available, some recommended missing | Present to user, offer to continue or wait     |
| FAIL    | Any required missing                             | Stop immediately, present install instructions |

**Constraints:** Never installs or configures anything. Report only. Output under 40 lines (PASS) or 60 lines (WARN/FAIL).

---

### artifact-validator

| Property        | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Path            | `./subagents/artifact-validator.md`                                               |
| Purpose         | Check whether phase artifacts exist and are well-formed; return pass/fail summary |
| When dispatched | Before and after every phase                                                      |

**Validation rules:**

| Phase | Direction     | File                  | Checks                                                        |
| ----- | ------------- | --------------------- | ------------------------------------------------------------- |
| 1     | postcondition | `docs/<KEY>.md`       | File exists, contains `## Description`                        |
| 2     | precondition  | `docs/<KEY>.md`       | Same as Phase 1 postcondition                                 |
| 2     | postcondition | `docs/<KEY>-tasks.md` | File exists, contains `## Tasks`, has ≥2 task entries         |
| 3     | precondition  | `docs/<KEY>-tasks.md` | Same as Phase 2 postcondition                                 |
| 3     | postcondition | `docs/<KEY>-tasks.md` | Contains `## Decisions Log`                                   |
| 4     | precondition  | `docs/<KEY>-tasks.md` | Same as Phase 3 postcondition                                 |
| 4     | postcondition | `docs/<KEY>-tasks.md` | Contains `## Jira Subtasks` with ≥1 key matching `[A-Z]+-\d+` |
| 5     | precondition  | `docs/<KEY>-tasks.md` | Same as Phase 4 postcondition                                 |

**Constraints:** Never returns raw file contents. Never modifies files. Output under 10 lines.

---

### progress-tracker

| Property        | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Path            | `./subagents/progress-tracker.md`                                        |
| Purpose         | Read, create, or update the progress file; return current workflow state |
| When dispatched | After every phase and task; on resume to determine starting phase        |

**Actions:** `read`, `update`, `initialize`

**State inference (when no progress file exists):**

| Artifact found                                | Inferred state  |
| --------------------------------------------- | --------------- |
| `docs/<KEY>-tasks.md` with `## Jira Subtasks` | Phases 1–4 done |
| `docs/<KEY>-tasks.md` with `## Decisions Log` | Phases 1–3 done |
| `docs/<KEY>-tasks.md` with `## Tasks`         | Phases 1–2 done |
| `docs/<KEY>.md` exists                        | Phase 1 done    |
| Nothing                                       | Fresh start     |

**Status values:** `✅ Complete`, `🔄 Active`, `❌ Failed`, `⏭️ Skipped`, `⬜ Pending`

**Constraints:** Never returns the full progress file. Uses UTC timestamps. Output under 5 lines.

---

### ticket-status-checker

| Property        | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Path            | `./subagents/ticket-status-checker.md`                               |
| Purpose         | Query Jira for current status, assignee, and recent activity         |
| When dispatched | Before task execution in Phase 5 when current ticket state is needed |

**Query types:** `status`, `subtasks`, `comments`, `full`

**Constraints:** Never returns raw JSON. Truncates comments to 80 chars. Limits subtask listings to 20. Output under 30 lines (`full`) or 10 lines (others).

---

### codebase-inspector

| Property        | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Path            | `./subagents/codebase-inspector.md`                                       |
| Purpose         | Report working tree state: branch, uncommitted changes, recent commits    |
| When dispatched | Before task execution in Phase 5 when branch/working tree state is needed |

**Query types:** `state`, `recent-commits`, `branch-list`, `diff-summary`

**Constraints:** Never returns raw diff contents or full log output. Output under 15 lines.

---

### code-reference-finder

| Property        | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Path            | `./subagents/code-reference-finder.md`                                            |
| Purpose         | Search codebase for symbols, patterns, or file references; return concise matches |
| When dispatched | Before task execution when relevant code needs to be located                      |

**Search strategies by query type:**

| Query type    | Approach                                |
| ------------- | --------------------------------------- |
| Symbol        | `grep -rn` with word boundaries         |
| Pattern/regex | `grep -rn -E`                           |
| File/path     | `find` or `ls`                          |
| Structural    | Combine `grep` with file-type filtering |

**Constraints:** Never returns full file contents. Matching lines truncated to 120 chars. Limited to 10 most relevant matches. Output under 25 lines.

---

### documentation-finder

| Property        | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Path            | `./subagents/documentation-finder.md`                                    |
| Purpose         | Locate relevant docs, READMEs, or wiki pages; return summaries and paths |
| When dispatched | Before task execution when documentation context is needed               |

**Search priority order:**

1. Project docs (`docs/`, `documentation/`, `README.md`, etc.)
2. Config references (`.env.example`, `docker-compose.yml`, etc.)
3. Inline docs (JSDoc, docstrings, type definitions, OpenAPI specs)
4. Broad keyword search (`grep -rl`)

**Constraints:** Never returns full file contents. Summaries limited to 2–3 sentences per file. Max 8 results. Output under 30 lines.

---

## Phase 1 subagents (1)

### ticket-retriever

| Property | Value                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| Skill    | `fetching-jira-ticket`                                                         |
| Purpose  | Retrieve all ticket data from Jira and write a comprehensive Markdown snapshot |

Handles everything end-to-end: input validation, MCP tool discovery, field retrieval, pagination, error handling, document assembly, file writing, and output validation.

---

## Phase 2 subagents (4)

### task-planner

| Property       | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Skill          | `planning-jira-tasks`                                 |
| Pipeline stage | 1 of 3                                                |
| Purpose        | Decompose ticket into detailed tasks (the WHAT + HOW) |
| Output         | `docs/<KEY>-stage-1-detailed.md`                      |

---

### dependency-prioritizer

| Property       | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Skill          | `planning-jira-tasks`                                                |
| Pipeline stage | 2 of 3                                                               |
| Purpose        | Build dependency graph, score tasks, determine final execution order |
| Output         | `docs/<KEY>-stage-2-prioritized.md`                                  |

---

### task-validator

| Property       | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Skill          | `planning-jira-tasks`                                 |
| Pipeline stage | 3 of 3                                                |
| Purpose        | QA gate running 19 validation checks against the plan |
| Output         | `docs/<KEY>-tasks.md` (final plan)                    |

---

### stage-validator

| Property       | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Skill          | `planning-jira-tasks`                                 |
| Pipeline stage | Runs after every stage                                |
| Purpose        | Pre-flight, inter-stage, and post-pipeline validation |

---

## Phase 3 subagents (1)

### decision-recorder

| Property | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Skill    | `clarifying-assumptions`                                                      |
| Purpose  | Apply all file edits (Decisions Log, annotations, deferred tags) and validate |

Handles: appending/updating the `## Decisions Log` table, annotating assumptions, striking through resolved questions, tagging deferred questions, updating implementation notes, and validating all updates.

---

## Phase 4 subagents (1)

### subtask-creator

| Property | Value                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| Skill    | `creating-jira-subtasks`                                                               |
| Purpose  | Parse plan → lookup parent → build payloads → create subtasks → update plan → validate |

Handles the complete lifecycle: plan parsing, parent ticket lookup, wiki markup payload construction, sequential creation with retry, failure logging, plan file updates, and output validation.

---

## Phase 5 subagents (10)

### execution-prepper

| Property      | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                    |
| Pipeline step | 1                                                                                        |
| Purpose       | Validate task, set up branch, transition Jira to "In Progress", assemble execution brief |
| Output        | `docs/<KEY>-task-<N>-brief.md`                                                           |

---

### execution-planner

| Property      | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                              |
| Pipeline step | 2                                                                                  |
| Purpose       | Analyze the task, inspect codebase, produce execution plan with recommended skills |
| Depends on    | `/find-skills` (recommended)                                                       |

---

### test-strategist

| Property      | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                   |
| Pipeline step | 3                                                                                       |
| Purpose       | Define behavior-driven tests based on business requirements, not implementation details |

---

### refactoring-advisor

| Property      | Value                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                            |
| Pipeline step | 4                                                                                |
| Purpose       | Evaluate whether existing code needs refactoring before or during task execution |

---

### task-executor

| Property      | Value                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                                               |
| Pipeline step | 5                                                                                                                   |
| Purpose       | Perform actual implementation. Operates under a **cautious execution model** — stops and escalates on any ambiguity |
| Depends on    | Execution brief, execution plan, test spec, refactoring plan                                                        |

---

### documentation-writer

| Property      | Value                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                                 |
| Pipeline step | 6                                                                                                     |
| Purpose       | Document changes, commit all work as atomic commits, update plan with status, transition Jira subtask |
| Depends on    | `/commit-work` (recommended), `/humanizer` (recommended)                                              |

---

### requirements-verifier

| Property      | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                     |
| Pipeline step | 7 (pre-gate)                                                                              |
| Purpose       | Cross-check every Definition of Done item against actual changes before quality gates run |

---

### clean-code-reviewer (Quality Gate 1/3)

| Property      | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Skill         | `executing-jira-task`                                   |
| Pipeline step | 8                                                       |
| Purpose       | Review for Clean Code and SOLID principles compliance   |
| Depends on    | `/clean-code` (recommended), context7 MCP (recommended) |

---

### architecture-reviewer (Quality Gate 2/3)

| Property      | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                                          |
| Pipeline step | 9                                                                                              |
| Purpose       | Review for DDD and functional programming principles. Explicitly does NOT enforce OOP patterns |
| Depends on    | `/architecture-patterns` (recommended), context7 MCP (recommended)                             |

---

### security-auditor (Quality Gate 3/3)

| Property      | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Skill         | `executing-jira-task`                                                       |
| Pipeline step | 10                                                                          |
| Purpose       | Audit for security vulnerabilities, credential leaks, and insecure patterns |
| Depends on    | `/security-best-practices` (recommended), context7 MCP (recommended)        |
