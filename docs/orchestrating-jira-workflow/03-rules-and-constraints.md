# 03 — Rules and Constraints

> Non-negotiable behavioral constraints for the orchestrator and safety rules for Phase 7 execution.

---

## Orchestrator rules (10 non-negotiable)

These exist because violating any one of them degrades the system in ways that compound across every subsequent step.

---

### Rule 1 — Delegate everything

The orchestrator **must not** perform any tool call, bash command, file read/write, web search, MCP call, or direct task execution under any circumstance. Every action — no matter how small — must be delegated to a subagent.

**Mental model:** A project manager who can only communicate through written memos to specialists. They can think, decide, prioritize, and synthesize — but the moment work needs to happen, they dispatch.

**Common traps:**

| Impulse                                            | Correct dispatch          |
| -------------------------------------------------- | ------------------------- |
| "Let me quickly read the file to see if it exists" | → `artifact-validator`    |
| "I'll just run a git status"                       | → `codebase-inspector`    |
| "Let me check the Jira ticket"                     | → `ticket-status-checker` |
| "I'll update the progress file"                    | → `progress-tracker`      |

---

### Rule 2 — Follow every step in every skill file

When invoking a downstream skill, the orchestrator must follow **every step** defined in that skill's `SKILL.md` — in order, without skipping any.

**Why:** Skill files are carefully designed pipelines where each step depends on the outputs of the previous step.

| Skipping...       | Causes...                            |
| ----------------- | ------------------------------------ |
| Validation        | Bad artifacts propagate downstream   |
| Pre-flight checks | Dependencies are not verified        |
| Documentation     | Reviewers cannot assess completeness |

---

### Rule 3 — Protect the context window aggressively

The orchestrator's context window should contain **only**:

- Decision-relevant summaries from subagents
- The current workflow state (phase, task, status)
- User instructions and confirmations
- Error reports that require orchestrator judgment

The orchestrator **must never** index or store raw file contents, full git diffs, command outputs, API responses, complete execution reports, or full code review reports.

---

### Rule 4 — Verify via subagent

Always use `artifact-validator` to check artifacts. Reading files "to quickly check" is how context pollution starts.

---

### Rule 5 — One phase at a time

Phase dependencies are strict. Partial artifacts cause cascading failures. Never run phases in parallel or skip ahead.

---

### Rule 6 — Explicit handoffs

Pass file paths, ticket keys, and context summaries explicitly to every dispatch. Subagents cannot see conversation history.

---

### Rule 7 — Gate destructive actions

Any phase modifying external systems (Jira writes, git push) requires explicit user confirmation before proceeding.

---

### Rule 8 — Maintain resumability

Update `progress-tracker` after every phase and task. The workflow can be interrupted and resumed without loss at any point.

---

### Rule 9 — Never delete artifacts (NEW)

No orchestration artifact is deleted at any point in the pipeline. This includes:

- Phase 2 intermediate files (`stage-1-detailed.md`, `stage-2-prioritized.md`)
- Phase 5 planning artifacts (`brief.md`, `execution-plan.md`, `test-spec.md`, `refactoring-plan.md`)
- Phase 6 per-task decisions files (`decisions.md`)
- All other `docs/<KEY>*.md` files

Artifacts are overwritten during re-plan cycles (updated versions replace prior versions) but never deleted.

**Why:** Artifacts are consumed by the `critique-analyzer` for critique analysis, by subagents during re-plan cycles (they receive their prior output as context), and serve as debugging aids when issues arise.

---

### Rule 10 — Never commit orchestration artifacts (NEW)

All files matching `docs/<KEY>*.md` are **Category A — orchestration artifacts**. They are updated on disk but MUST NOT be staged (`git add`) or committed to git. Only Category B files (source code, tests, config changes, documentation within source files) are committed.

**Why:** Orchestration artifacts contain planning state, decisions, and intermediate work products that are not part of the project's source code. Committing them would pollute the repository with transient workflow artifacts.

**Who enforces this:** The `documentation-writer` subagent is responsible for committing changes. Its contract explicitly requires excluding Category A files from commits.

---

## Phase 7 safety rules

These apply specifically to the `executing-jira-task` skill.

| Rule                             | Description                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| One task at a time               | Never auto-continue to the next task                                                                                                                |
| Scope discipline                 | Do not implement anything outside the task's scope, even if it seems like a quick win                                                               |
| Fail loudly                      | If any subagent encounters ambiguity or a blocker, surface it to the user immediately rather than making assumptions                                |
| Preserve the plan                | The task plan is the source of truth. If execution reveals the plan needs changes, propose the change to the user — do not silently modify the plan |
| Respect pipeline order           | Do not skip subagent steps or reorder them. Each step depends on the output of the previous one                                                     |
| Limit retries                    | Task-executor: max 3 retry cycles for ambiguity. Targeted fix cycle: max 3 iterations. Full pipeline re-runs require user approval                  |
| Quality gates are non-negotiable | All three quality gates (clean-code, architecture, security) must pass. There is no override, no "good enough"                                      |

---

## Re-plan cycle rules

These apply to the Phase 3 → Phase 2 and Phase 6 → Phase 5 re-plan loops.

| Rule                           | Description                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Maximum 3 iterations           | After 3 re-plan cycles, escalate to the user with accumulated critique                                            |
| User looped in every iteration | Every re-plan iteration presents the updated plan and critique to the user — nothing is auto-resolved             |
| Preserve artifacts             | Prior artifacts are preserved on disk. Re-dispatched subagents receive their prior output plus new decisions      |
| Re-run all subagents           | On re-plan, all subagents in the phase are re-dispatched (not just the ones whose outputs were directly affected) |
| Respect prior decisions        | The `critique-analyzer` does not re-raise concerns that were already consciously resolved by the user             |

---

## Behavioral guardrails (Phase 3 and Phase 6 — clarification and critique)

These govern how the orchestrator/skill interacts with users during clarification and critique phases:

| Guardrail                                         | Description                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| One question per message                          | Never batch multiple questions in a single turn                                                                                |
| Manifest is source of truth                       | Every question comes from it. New questions get added before being asked                                                       |
| Defer, don't discard                              | Questions for future tasks are tagged as deferred, not deleted                                                                 |
| Mentor, not interrogator                          | Frame challenges as growth opportunities. Be direct about gaps in thinking, not punitive                                       |
| Pedagogical stance for problem framing            | Be direct when the developer's reasoning is shallow on Tier 3 items. Name what's missing and why it matters                    |
| Neutral on technology, direct on thinking quality | Stay neutral on Redis vs Memcached. Push back when "our customers" lacks specificity                                           |
| Tier 3 items cannot be skipped                    | Problem-framing fundamentals (end user, need, evidence) are hard gates. Developer must answer                                  |
| Tier 2 skip = visible flag                        | Skipped Tier 2 items are recorded with ⚠️ warning in the decisions file. No pressure, but the gap is documented                |
| Model A for Tier 3, Model B for Tier 2            | Socratic (generate-then-compare) for hard gates; evaluate-the-reasoning for everything else                                    |
| No silent pass-through                            | Every subagent decision the developer will encounter must be actively evaluated by the developer. No decisions pass unexamined |
| Keep blocks scannable                             | Each question readable in under 30 seconds                                                                                     |
| Never ask about what hasn't happened yet          | If relevance depends on a future task outcome, defer the question                                                              |
| Present ALL critique items                        | Every item (problem-framing and technology, all severities) is presented. No filtering, no auto-acknowledging                  |
| Developer growth over speed                       | Socratic exchanges on Tier 3 items may take several turns. That is working as intended                                         |
