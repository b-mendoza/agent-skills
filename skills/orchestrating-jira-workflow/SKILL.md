---
name: "orchestrating-jira-workflow"
description: 'Top-level orchestrator for end-to-end Jira ticket workflows. Use this skill when the user says "work on ticket PROJECT-1234", "start the Jira workflow", "handle this ticket end to end", "orchestrate PROJECT-1234", "pick up PROJECT-1234", or provides a Jira ticket key/URL without specifying a particular phase. Also trigger on "resume ticket PROJECT-1234", "where did we leave off on PROJECT-1234", "continue PROJECT-1234", or "what''s the status of PROJECT-1234". This skill coordinates all downstream skills and subagents — it never runs tool calls, CLI commands, file reads, web searches, or MCP calls directly.'
---

# Orchestrating Jira Workflow

## Purpose

Coordinate the complete lifecycle of a Jira ticket through seven sequential
phases. This skill is a **pure coordinator** — it dispatches to subagents and
downstream skills, operates only on concise summaries, and never does heavy
lifting directly.

## Why This Matters

The orchestrator's context window is the most expensive resource in the system.
Every byte of raw file content, git diff, API response, or command output that
leaks into it degrades decision-making for every subsequent step. That is why
delegation is not optional — it is the architecture.

## Inputs

| Input        | Source              | Required | Example                                                     |
| ------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065`                                                  |
| `JIRA_URL`   | User (optional)     | No       | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Extract the ticket key from a full URL if the user provides one.

## Pipeline

```
Phase 1: Fetch           →  docs/<KEY>.md
Phase 2: Plan tasks      →  docs/<KEY>-tasks.md + intermediates
Phase 3: Clarify+Critique→  docs/<KEY>-tasks.md (updated with decisions)
Phase 4: Create subtasks →  Jira subtasks created + plan updated with keys
Phase 5: Plan task exec  →  docs/<KEY>-task-<N>-*.md (4 planning artifacts)
Phase 6: Clarify+Critique→  docs/<KEY>-task-<N>-decisions.md
Phase 7: Execute         →  Code changes, tests, commits
         ↑_______________↓  (Phases 5-6-7 loop per task)
```

## Subagent Registry

Utility subagents handle all tool calls, file reads, and command execution.
Dispatch to these instead of doing anything directly.

| Subagent                | Path                                   | Purpose                                                                               |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `preflight-checker`     | `./subagents/preflight-checker.md`     | Validate environment dependencies (MCPs, skills, tools) before workflow starts        |
| `artifact-validator`    | `./subagents/artifact-validator.md`    | Check whether phase artifacts exist and are well-formed; return pass/fail summary     |
| `progress-tracker`      | `./subagents/progress-tracker.md`      | Read, create, or update progress files (workflow + per-task); return current state    |
| `ticket-status-checker` | `./subagents/ticket-status-checker.md` | Query Jira for current status, assignee, and recent activity on a ticket              |
| `codebase-inspector`    | `./subagents/codebase-inspector.md`    | Report working tree state: branch, uncommitted changes, recent commits                |
| `code-reference-finder` | `./subagents/code-reference-finder.md` | Search the codebase for symbols, patterns, or file references; return concise matches |
| `documentation-finder`  | `./subagents/documentation-finder.md`  | Locate relevant docs, READMEs, or wiki pages for a topic; return summaries            |

### How to Dispatch

Subagent `.md` files are co-located reference documents. To dispatch:

1. Read the subagent's `.md` file from the path in the registry above.
2. Spawn a subagent using the **Task tool**, passing the `.md` content as the
   prompt and the step's inputs as the user message.

   All three supported platforms use the same Task tool pattern:

   | Platform        | Dispatch method                                                                          |
   | --------------- | ---------------------------------------------------------------------------------------- |
   | Claude Code CLI | `Task(prompt=<.md content>, description=<step summary>)`                                 |
   | Cursor IDE      | `Task(subagent_type="generalPurpose", prompt=<.md content + inputs>)`                    |
   | OpenCode CLI    | `Task(prompt=<.md content>, description=<step summary>)` — same semantics as Claude Code |

   On Cursor: use `subagent_type="generalPurpose"` and embed the `.md` content
   directly in the prompt. This is more reliable than defining custom named
   agents, which have known dispatch issues with the Task tool.

3. Collect the returned summary. Use that summary — not raw output — for all
   downstream decisions.

Subagents run sequentially by default. Parallel dispatch is acceptable only for
independent utility calls (e.g., `codebase-inspector` + `documentation-finder`
before a task), never for dependent operations.

## Downstream Skills (Phase Handlers)

Each phase is handled by a dedicated skill. Read its SKILL.md only when
invoking it.

| Phase | Skill                  | Skill Path (relative to skills root) | Purpose                                               |
| ----- | ---------------------- | ------------------------------------ | ----------------------------------------------------- |
| 1     | fetching-jira-ticket   | `../fetching-jira-ticket/SKILL.md`   | Retrieve all ticket data into a Markdown snapshot     |
| 2     | planning-jira-tasks    | `../planning-jira-tasks/SKILL.md`    | Decompose ticket into a prioritized task plan         |
| 3     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` | Critique plan + walk user through questions (upfront) |
| 4     | creating-jira-subtasks | `../creating-jira-subtasks/SKILL.md` | Push planned tasks to Jira as subtasks                |
| 5     | planning-jira-task     | `../planning-jira-task/SKILL.md`     | Plan HOW to execute one task (4 planning artifacts)   |
| 6     | clarifying-assumptions | `../clarifying-assumptions/SKILL.md` | Critique per-task plan + resolve deferred questions   |
| 7     | executing-jira-task    | `../executing-jira-task/SKILL.md`    | Execute one task: implement, test, review, commit     |

## Data Contracts

Each phase produces an artifact that the next phase consumes. Always validate
via `artifact-validator` before advancing.

| Transition | Artifact                           | Validation                                       |
| ---------- | ---------------------------------- | ------------------------------------------------ |
| 1 → 2      | `docs/<KEY>.md`                    | File exists, has `## Description` section        |
| 2 → 3      | `docs/<KEY>-tasks.md`              | File exists, has `## Tasks` section, ≥2 tasks    |
| 3 → 4      | `docs/<KEY>-tasks.md` (updated)    | File has `## Decisions Log` section              |
| 4 → 5      | `docs/<KEY>-tasks.md` (with keys)  | File has `## Jira Subtasks` table with keys      |
| 5 → 6      | `docs/<KEY>-task-<N>-brief.md` + 3 | All 4 planning artifacts exist for the task      |
| 6 → 7      | `docs/<KEY>-task-<N>-decisions.md` | Planning artifacts still exist (Phase 5 outputs) |

---

## Orchestration Rules

These are the non-negotiable behavioral constraints for the orchestrator. They
exist because violating any one of them degrades the system in ways that
compound across every subsequent step.

### Rule 1 — Delegate EVERYTHING

The orchestrator MUST NOT perform any tool call, bash command, file read/write,
web search, MCP call, or direct task execution under any circumstance. Every
action — no matter how small — MUST be delegated to a subagent.

The mental model: you are a project manager who can only communicate through
written memos to specialists. You can think, decide, prioritize, and
synthesize — but the moment work needs to happen, you dispatch.

If you catch yourself thinking "I'll just quickly check this file" or "let me
run this one command" — stop. That impulse is exactly what subagents are for.

Common traps to avoid:

- "Let me quickly read the file to see if it exists" → dispatch `artifact-validator`
- "I'll just run a git status" → dispatch `codebase-inspector`
- "Let me check the Jira ticket" → dispatch `ticket-status-checker`
- "I'll update the progress files" → dispatch `progress-tracker`

### Rule 2 — Follow every step in every skill file

When the orchestrator invokes a downstream skill, it MUST follow every step
defined in that skill's SKILL.md — in order, without skipping any. Skill files
are carefully designed pipelines where each step depends on the outputs of the
previous step.

Skipping steps — even ones that seem unnecessary for a particular task —
creates subtle failures:

- Skipping validation means bad artifacts propagate downstream.
- Skipping pre-flight checks means dependencies are not verified.
- Skipping documentation means reviewers cannot assess completeness.

If a step feels unnecessary, execute it anyway. The subagent will report "nothing
to do" quickly, and the cost is negligible compared to debugging a pipeline
failure caused by a skipped step.

### Rule 3 — Protect the context window aggressively

The orchestrator's context window should contain ONLY:

- Decision-relevant summaries from subagents.
- The current workflow state (phase, task, status).
- User instructions and confirmations.
- Error reports that require orchestrator judgment.

The orchestrator MUST NEVER index or store:

- Raw file contents of any file a subagent has read or changed.
- Full git diffs, command outputs, or API responses.
- Complete execution reports — only their summary verdicts.
- Full code review reports — only their verdict and issue count.
- Any artifact content that is already stored on disk.

When a subagent returns a result, extract the verdict, summary, and any data
needed for the next dispatch decision. Discard everything else. If you need
details later, dispatch a subagent to retrieve them.

### Rule 4 — Verify via subagent

Always use `artifact-validator` to check artifacts. Reading files "to quickly
check" is how context pollution starts.

### Rule 5 — One phase at a time

Phase dependencies are strict. Partial artifacts cause cascading failures.

### Rule 6 — Explicit handoffs

Pass file paths, ticket keys, and context summaries explicitly to every
dispatch. Subagents cannot see conversation history.

### Rule 7 — Gate destructive actions

Any phase modifying external systems (Jira writes, git push) requires explicit
user confirmation.

### Rule 8 — Maintain resumability

Update `progress-tracker` after every phase and task. The workflow can be
interrupted and resumed without loss.

---

## Execution

### 1. Preflight Environment Check

Dispatch `preflight-checker` with the `TICKET_KEY` and the phases that will
run (all phases for a fresh start, or only the remaining phases if resuming).

**If verdict is FAIL:** Stop immediately. Present the missing required
dependencies and their install/configure instructions to the user. Do not
proceed until the user confirms the dependencies are installed and asks to
resume.

**If verdict is WARN:** Present the missing recommended dependencies to the
user with their impact descriptions. Ask whether to proceed or wait:

- "Continue without these — I understand the trade-offs"
- "Let me install them first — I'll resume when ready"

**If verdict is PASS:** Proceed silently — do not narrate the preflight
results unless the user asks.

**On resume:** When a workflow resumes from a checkpoint, run the preflight
check again but only for the phases that remain. Dependencies for completed
phases do not need to be re-checked.

### 2. Determine Starting Phase

Dispatch `progress-tracker` with action `read` and the `TICKET_KEY`.

| Progress indicates…                          | Resume from         |
| -------------------------------------------- | ------------------- |
| No artifacts found                           | Phase 1             |
| Phase 1 complete, Phase 2 not started        | Phase 2             |
| Phases 1–2 complete, Phase 3 not done        | Phase 3             |
| Phases 1–3 complete, Phase 4 not done        | Phase 4             |
| Phases 1–4 complete, no tasks started        | Phase 5 (pick task) |
| Task N at Phase 5 complete, Phase 6 not done | Phase 6, Task N     |
| Task N at Phase 6 complete, Phase 7 not done | Phase 7, Task N     |
| Task N complete, other tasks remaining       | Phase 5 (pick task) |

Tell the user what was found and which phase will start. If resuming past
Phase 1, ask for confirmation before proceeding.

### 3. Execute Phases Sequentially

For each phase, follow this cycle:

**a. Announce**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase <N>/7 — <Phase name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**b. Validate preconditions** — dispatch `artifact-validator`. Proceed only on
pass.

**c. Invoke the downstream skill** — read its SKILL.md and follow its contract.
Pass inputs explicitly: file paths, ticket key, and any context summaries from
subagents. Never rely on conversation history for critical data.

**d. Validate output** — dispatch `artifact-validator` to confirm the phase
artifact was produced correctly.

**e. Update progress** — dispatch `progress-tracker` with the phase number,
status, and a one-line outcome summary.

**f. Gate before advancing**

| Transition | Gate                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| 1 → 2      | Automatic                                                                        |
| 2 → 3      | Automatic                                                                        |
| 3 → 4      | User confirmation required — this creates Jira subtasks (external system writes) |
| 3 → 2      | Re-plan cycle — critique triggered changes (max 3 iterations)                    |
| 4 → 5      | User chooses which task to execute first — never auto-start                      |
| 5 → 6      | Automatic — critique is part of the per-task planning flow                       |
| 6 → 7      | User confirmation required — confirms plan is ready for implementation           |
| 6 → 5      | Re-plan cycle — critique triggered changes (max 3 iterations)                    |
| Within 5-7 | After each task, user chooses next — never auto-continue                         |

For the Phase 3 → 4 gate, offer:

- "Create subtasks now"
- "Review the plan first"
- "Stop here — I'll create subtasks manually"

### 4. Task Execution Loop (Phases 5-6-7)

Phases 5, 6, and 7 run as a loop for each task. The user selects which task
to work on, and it passes through all three phases before the next task
begins.

**a. Task selection**

1. Dispatch `progress-tracker` with action `read` → get remaining tasks.
2. Present remaining tasks to the user.
3. User selects the next task.
4. **Pre-task context** — dispatch relevant utility subagents:

   | Situation                        | Dispatch to             |
   | -------------------------------- | ----------------------- |
   | Need current ticket status       | `ticket-status-checker` |
   | Need working tree / branch state | `codebase-inspector`    |
   | Need to find relevant code       | `code-reference-finder` |
   | Need docs or config context      | `documentation-finder`  |

5. Dispatch `progress-tracker` with action `initialize_task` for the selected
   task number → creates `docs/<KEY>-task-<N>-progress.md`.

**b. Phase 5 — Plan task execution**

1. Announce Phase 5/7.
2. Validate preconditions via `artifact-validator`.
3. Invoke `planning-jira-task` skill, passing `TICKET_KEY` and `TASK_NUMBER`.
   Follow every step defined in the SKILL.md.
4. Validate output via `artifact-validator` (4 planning artifacts exist).
5. Dispatch `progress-tracker` with action `update_task` to mark Phase 5
   complete for this task.

**c. Phase 6 — Clarify + Critique execution plan**

1. Announce Phase 6/7.
2. Validate preconditions via `artifact-validator` (all 4 planning artifacts).
3. Invoke `clarifying-assumptions` skill with `MODE=critique`,
   `TICKET_KEY`, and `TASK_NUMBER`. Follow every step.
4. **Re-plan handling:** If the skill reports `RE_PLAN_NEEDED=true`, re-dispatch
   Phase 5 (all 4 planning subagents re-run with prior artifacts + decisions).
   Maximum 3 re-plan cycles, user looped in every iteration.
5. Validate output via `artifact-validator`.
6. Dispatch `progress-tracker` with action `update_task` to mark Phase 6
   complete for this task.
7. **Gate:** Ask the user to confirm the plan is ready for implementation.

**d. Phase 7 — Execute task**

1. Announce Phase 7/7.
2. Validate preconditions via `artifact-validator`.
3. Invoke `executing-jira-task` skill, passing `TICKET_KEY`, `TASK_NUMBER`,
   and context summaries from pre-task utility dispatches. Follow every step.
4. **Quality gate handling is delegated to executing-jira-task.** The skill
   manages its own targeted fix cycle internally: when a quality gate fails,
   it re-dispatches only the task-executor and documentation-writer, then
   re-runs only the failing gates. The orchestrator only acts if the fix cycle
   limit (3 attempts) is exhausted — present feedback to the user and ask:
   - Accept the current state and move on.
   - Provide guidance for a different approach.
   - Request a full pipeline re-run from Phase 5 (for fundamental approach
     failures only).
5. Dispatch `progress-tracker` with action `update_task` to mark Phase 7
   complete for this task.
6. Dispatch `progress-tracker` with action `update` to refresh the main
   progress file's Task Execution table.

**e. Loop**

Return to step (a) for the next task. Continue until all tasks are complete
or the user stops.

### 5. Final Summary

When all tasks are complete (or the user stops), dispatch `progress-tracker`
for the final state, then present:

```markdown
## Workflow Summary — <TICKET_KEY>

| Phase | Status      | Key outcome                            |
| ----- | ----------- | -------------------------------------- |
| 1     | ✅ Complete | Ticket fetched (N comments)            |
| 2     | ✅ Complete | N tasks planned                        |
| 3     | ✅ Complete | N/N questions resolved, N critiqued    |
| 4     | ✅ Complete | N subtasks created in Jira             |
| 5–7   | ✅ Complete | N/N tasks planned, critiqued, executed |

Per-task detail in docs/<TICKET_KEY>-task-<N>-progress.md.
All artifacts are in docs/<TICKET_KEY>\*.
```

## Error Handling

| Error type               | Response                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill failure**        | Record via `progress-tracker`. Report to user: retry, skip, or abort.                                                                         |
| **Missing artifact**     | `artifact-validator` reports failure → do NOT proceed. Tell user which phase needs to run/re-run and offer it.                                |
| **Jira MCP unavailable** | Tell user to connect it. Offer to resume when ready.                                                                                          |
| **Subagent failure**     | Non-critical (e.g., `documentation-finder`): proceed without. Critical (e.g., `artifact-validator`): halt.                                    |
| **User interruption**    | Progress files ensure resumability. Tell user: "Say 'resume ticket <KEY>' to pick up where we left off."                                      |
| **Quality gate failure** | Handled internally by executing-jira-task via targeted fix cycles. Orchestrator acts only if fix cycle limit is exhausted — escalate to user. |
