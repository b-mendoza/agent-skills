# Phases 1–4 — Linear Pipeline

> Read this file when entering Phase 1, 2, 3, or 4. It covers the linear
> pipeline from ticket fetch through subtask creation.
>
> After Phase 4 completes, read `./task-loop.md` to begin the per-task loop.

For each phase, follow the standard execution cycle from the SKILL.md:
**announce → validate preconditions → invoke skill → validate output → update
progress → gate check.**

---

## Phase 1 — Fetch Ticket

**Skill:** `fetching-jira-ticket` (at `../fetching-jira-ticket/SKILL.md`)

1. Read the skill's SKILL.md.
2. Invoke it with the `JIRA_URL`. The skill extracts `TICKET_KEY` from the
   URL and dispatches its `ticket-retriever` subagent, which writes the
   comprehensive ticket snapshot to `docs/<KEY>.md`.
3. Validate output — dispatch `artifact-validator`:

   ```
   TICKET_KEY: <KEY>
   PHASE: 1
   DIRECTION: postcondition
   ```

   Expected: file exists, contains `## Description`.

4. Update progress — dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: update
   PHASE: 1
   STATUS: complete
   SUMMARY: "Ticket fetched — N comments, N subtasks found"
   ```

**Gate:** Automatic → proceed to Phase 2.

---

## Phase 2 — Plan Tasks

**Skill:** `planning-jira-tasks` (at `../planning-jira-tasks/SKILL.md`)

1. Read the skill's SKILL.md.
2. Invoke it with `TICKET_KEY` and the path to `docs/<KEY>.md`.
3. The skill runs a three-stage pipeline (task-planner →
   dependency-prioritizer → task-validator) and produces `docs/<KEY>-tasks.md`
   plus preserved intermediates.
4. Validate output — dispatch `artifact-validator`:

   ```
   TICKET_KEY: <KEY>
   PHASE: 2
   DIRECTION: postcondition
   ```

   Expected: file exists, contains `## Tasks`, has ≥2 task entries.

5. Update progress — dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: update
   PHASE: 2
   STATUS: complete
   SUMMARY: "N tasks planned, execution order determined"
   ```

**Gate:** Automatic → proceed to Phase 3.

---

## Phase 3 — Clarify Assumptions + Critique Plan

**Skill:** `clarifying-assumptions` (at `../clarifying-assumptions/SKILL.md`)
**Mode:** `upfront`

This is where the orchestrator facilitates the critique and clarification
process. The skill handles the Q&A with the user — the orchestrator's job is
to invoke it correctly and handle the gate and re-plan cycle.

1. Read the skill's SKILL.md.
2. Invoke it with:
   - `MODE=upfront`
   - `TICKET_KEY`
   - Path to `docs/<KEY>-tasks.md`
   - Paths to stage intermediates (`docs/<KEY>-stage-1-detailed.md`,
     `docs/<KEY>-stage-2-prioritized.md`)
3. The skill dispatches its `critique-analyzer`, then walks the user through
   all items (problem-framing critique, technology critique, open questions,
   assumptions) one at a time.

### Re-plan cycle

If the skill reports `RE_PLAN_NEEDED=true` (the user agreed with a critique
and decided to change approach):

1. Re-dispatch Phase 2 (`planning-jira-tasks`) with the same inputs plus the
   new decisions from the critique.
2. All Phase 2 subagents re-run. They receive their prior artifacts (on disk)
   plus the decisions and produce updated versions.
3. After Phase 2 completes, re-dispatch Phase 3 to critique the updated plan.
4. The `critique-analyzer` respects prior decisions — it does not re-raise
   concerns the user already consciously resolved.

**Limit:** Maximum 3 re-plan iterations. After 3, present accumulated critique
to the user and ask how to proceed.

<example>
Re-plan cycle in practice:

Phase 3 (iteration 1):
critique-analyzer: "The plan defaults to Redis for caching without
project-specific justification. Alternatives: in-memory LRU (lower ops
cost), Cloudflare KV (edge performance)."
User: "Good point — let's use in-memory LRU for now."
→ RE_PLAN_NEEDED=true

Phase 2 (re-dispatch):
All subagents re-run with the decision: "Use in-memory LRU instead of Redis."
Updated plan reflects the change.

Phase 3 (iteration 2):
critique-analyzer: No new concerns (Redis decision already resolved).
User confirms plan.
→ RE_PLAN_NEEDED=false → advance to gate
</example>

4. Validate output — dispatch `artifact-validator`:

   ```
   TICKET_KEY: <KEY>
   PHASE: 3
   DIRECTION: postcondition
   ```

   Expected: file contains `## Decisions Log`.

5. Update progress — dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: update
   PHASE: 3
   STATUS: complete
   SUMMARY: "N/N questions resolved, N critique items addressed"
   ```

**Gate:** User confirmation required — this transition creates Jira subtasks
(external system writes). Present these options:

```
Plan is ready. How would you like to proceed?

1. Create subtasks in Jira now
2. Review the plan first (I'll show you the summary)
3. Stop here — I'll create subtasks manually
```

Only proceed to Phase 4 if the user chooses option 1.

---

## Phase 4 — Create Jira Subtasks

**Skill:** `creating-jira-subtasks` (at `../creating-jira-subtasks/SKILL.md`)

1. Read the skill's SKILL.md.
2. Invoke it with `TICKET_KEY` and `docs/<KEY>-tasks.md`.
3. The skill dispatches its `subtask-creator` subagent, which creates Jira
   subtasks and updates the plan file with subtask keys.
4. Validate output — dispatch `artifact-validator`:

   ```
   TICKET_KEY: <KEY>
   PHASE: 4
   DIRECTION: postcondition
   ```

   Expected: file contains `## Jira Subtasks` with ≥1 key matching
   `[A-Z]+-\d+`.

5. Update progress — dispatch `progress-tracker`:

   ```
   TICKET_KEY: <KEY>
   ACTION: update
   PHASE: 4
   STATUS: complete
   SUMMARY: "N subtasks created in Jira"
   TASKS: [list of task numbers and titles]
   ```

   The `TASKS` input pre-populates the Task Execution table in the main
   progress file.

**Gate:** User selects which task to execute first. Present the task list and
let the user choose — never auto-start.

<example>
Subtasks created in Jira. Which task would you like to work on first?

| #   | Title                    | Dependencies | Priority |
| --- | ------------------------ | ------------ | -------- |
| 1   | Add input validation     | None         | High     |
| 2   | Implement caching layer  | Task 1       | High     |
| 3   | Update API documentation | None         | Medium   |

Pick a task number, or say "show me the full plan" for more detail.
</example>

---

## Next Step

After the user selects a task, read `./task-loop.md` to begin the per-task
execution loop (Phases 5–6–7).
