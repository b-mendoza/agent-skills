# Critique Mode — Phase 6 Execution Playbook

> **Loaded just-in-time** when the skill is dispatched with `MODE=critique`.
> This playbook is self-contained — all protocols are duplicated here so you
> never need to cross-reference another file mid-execution.

---

## 1. Design Thinking Mindset

Before executing any step, internalize these principles. They override every
default, template, and heuristic in this playbook.

**Empathy first.** Every feature exists to serve a human. If we cannot name
that human and articulate their need, we are not ready to build. This is not
a feel-good platitude — it is the primary filter for every question we ask
and every decision we record. A technically elegant solution that serves no
identifiable user is waste.

**Problem before solution.** Jira tickets describe solutions. The developer's
job — with this skill's guidance — is to validate that the solution addresses
a real, evidenced need before investing implementation effort. We do not ask
"how do we build this?" until we can answer "why does this need to exist?" and
"for whom?" If the ticket says "add Redis caching," we first ask what user
problem slow responses create, how frequently it occurs, and whether caching
is the right lever.

**No silent acceptance.** Every subagent decision passes through the
developer's judgment. The system presents what was decided and why, and the
developer must engage — either by generating their own reasoning first
(Model A) or by evaluating the subagent's reasoning (Model B). Pass-through
is not an option. A developer who rubber-stamps every recommendation is not
using this skill — they are bypassing it. If a developer says "looks good"
without articulating why, prompt them to elaborate.

**Teaching over interrogation.** The tone is that of a senior mentor who
genuinely wants the developer to grow, not an auditor looking for failures.
Be direct about gaps in thinking, but frame challenges as opportunities to
sharpen reasoning, not as gotchas. "Have you considered what happens when
the cache is cold?" is mentoring. "You forgot about cold caches" is
auditing. Both surface the same gap; only the first one builds capability.

These four principles are not suggestions. They are constraints. When in
doubt about how to phrase a question, present a trade-off, or record a
decision, return to these principles and let them guide you.

---

## 2. Progressive Disclosure — Critique Context

Critique mode runs **after Phase 5** (per-task planning) produces execution
artifacts for a specific task. It is the final quality gate before code is
written.

What critique mode covers:

- **Reviews per-task planning artifacts** — execution plan, test spec, and
  refactoring plan — for framework bias, unjustified defaults, and
  unexplored alternatives.
- **Resolves deferred questions** from Phase 3 that are specific to this
  task. These were explicitly tagged for resolution before execution begins.
- **Evaluates user-impact** of implementation decisions against the Problem
  Framing established in Phase 3. Every technical choice has a user-facing
  consequence; critique mode makes those consequences explicit.
- **Filters irrelevant questions.** Questions that became irrelevant through
  earlier decisions (previous task executions, codebase changes, scope
  shifts) are identified and removed, not re-asked.

---

## 3. Step 1 — Dispatch critique-analyzer

Read `./subagents/critique-analyzer.md` and dispatch a subagent with:

| Parameter        | Value                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODE             | `critique`                                                                                                                                                                               |
| TICKET_KEY       | The Jira ticket key (e.g., `PROJ-123`)                                                                                                                                                   |
| TASK_NUMBER      | The task number being critiqued (e.g., `2`)                                                                                                                                              |
| ARTIFACTS        | List of file paths: `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md`                |
| PRIOR_DECISIONS  | Path to `docs/<KEY>-task-<N>-decisions.md` if this is iteration 2 or 3 (omit on first pass)                                                                                             |

Collect the subagent's output as **CRITIQUE_REPORT**. This report contains
severity-ranked critique items, trade-off tables, web search findings, and
user-impact concerns extracted from the execution plan.

---

## 4. Step 2 — Load deferred questions for this task

Read `docs/<TICKET_KEY>-tasks.md` and extract:

- Questions tagged `[DEFERRED — will ask before Task <TASK_NUMBER> execution]`
- Any unresolved assumptions specific to this task
- Any new questions added by previous task executions (these appear when
  executing Task 1 surfaces a question relevant to Task 3, for example)

Collect these as **DEFERRED_QUESTIONS**. Preserve the original wording and
context from the tasks file — do not rephrase yet.

---

## 5. Step 3 — Filter deferred questions for relevance

Review each deferred question against the **current** state of the codebase
and plan. Some may no longer be relevant because:

- A decision made during a previous task execution resolved the question
- The codebase changed in a way that makes one option clearly correct
- The task's scope narrowed or shifted during earlier execution

Mark irrelevant questions as:
`[RESOLVED — no longer applicable: <reason>]`

Keep the remaining questions in **DEFERRED_QUESTIONS** for inclusion in the
manifest.

---

## 6. Step 4 — Build the manifest

Combine critique items (including user-impact concerns) and remaining
deferred questions into a single manifest. Sort by severity: HIGH critiques
first, then user-impact items, then MEDIUM critiques, then deferred
questions.

Present the manifest to the developer:

```markdown
## Critique & Clarification Manifest — Task <N>: <Title>

Before executing this task, **<M> items** need your input:
**<C> critique items** challenging the planners' approach (including
**<U> user-impact concerns** from the execution plan),
**<Q> deferred questions** from earlier phases.

All items use **Model B** (evaluate-the-reasoning) — I'll show you what
was decided, why, and the critique. Your job is to evaluate whether the
reasoning holds up.

| #   | Category             | Short description                  | Model   | Skippable |
| --- | -------------------- | ---------------------------------- | ------- | --------- |
| 1   | 🔴 Critique (HIGH)   | Express chosen, project uses Hono  | Model B | Yes ⚠️    |
| 2   | 🟡 User impact       | 5min stale data from Redis caching | Model B | Yes ⚠️    |
| 3   | 🟡 Critique (MEDIUM) | Jest when Vitest already in use    | Model B | Yes ⚠️    |
| 4   | ⚪ Deferred question | Caching strategy for this task     | Model B | Yes ⚠️    |
```

If no questions remain after filtering:

```
All items for Task <N> have been resolved. No critique concerns. Ready to execute.
```

Skip directly to Step 8 (final summary) with all counts at zero.

---

## 7. Step 5 — Walk through items one at a time

For each item in the manifest, follow this protocol exactly.

### Show progress

```
Question <current>/<total> — [<category emoji> <category>]
```

### Model B protocol (evaluate-the-reasoning)

1. **Present the decision and its reasoning.** Show what the subagent decided
   and why. Quote directly from the artifact so the developer sees the
   original language, not a paraphrase.

2. **Present the critique.** Show the critique-analyzer's counter-analysis,
   trade-off table, and web search findings. Make the strongest case for the
   alternative — do not soften it.

3. **Ask the developer to evaluate.** "Does the original reasoning hold up
   given these trade-offs? Why or why not?" — this is not a yes/no question.
   The developer must articulate their evaluation. If they give a one-word
   answer, prompt: "Can you explain your reasoning? What makes you confident
   that <original choice> is the right call despite <critique point>?"

4. **Record the decision with rationale.** Capture the developer's reasoning
   verbatim — this goes into the decisions file.

### For user-impact items specifically

Present the execution-planner's User Impact Assessment row and ask:

> "This implementation choice means **<consequence>** for the end user.
> Given what we established about who the user is and what they need
> (from Phase 3), is this trade-off acceptable? Why or why not?"

Connect every user-impact question back to the Problem Framing decisions.
If the developer cannot articulate why the trade-off is acceptable in terms
of the user's needs, that is a signal the decision needs more thought.

### Recording responses

- **On "keep current approach":** Record as confirmed. No re-plan needed.
- **On "switch to alternative":** Record the switch. Flag `RE_PLAN_NEEDED=true`.
- **On "acknowledge but proceed":** Record as override. No re-plan needed.
  Documented in Decisions Log.
- **On "I need more information":** Pause for discussion. Resume when ready.
- **On "skip":** Record with ⚠️ warning: "Skipped without evaluation —
  proceeding on assumption: <fallback>." Move on.

### Critique item options

Always present these options after the evaluation prompt:

1. `✅ Keep current approach`
2. `🔄 Switch to <alternative>` — one option per named alternative from the
   critique report
3. `🔍 I need more information`
4. `⏭️ Acknowledge but proceed`

---

## 8. Step 6 — Create per-task decisions file

After all items have been walked through, create the file at
`docs/<TICKET_KEY>-task-<N>-decisions.md`.

Use this template:

```markdown
## Per-Task Decisions — Task <N>: <Title>

> TICKET_KEY: <KEY>
> Phase: 6 — Critique
> Iteration: <1|2|3>
> Date: <YYYY-MM-DD HH:MM UTC>

### Critique Resolutions

| #   | Severity | Decision challenged | Resolution        | Rationale                              |
| --- | -------- | ------------------- | ----------------- | -------------------------------------- |
| 1   | HIGH     | Express.js for API  | Switch to Fastify | Project already uses Fastify elsewhere |
| 2   | MEDIUM   | Jest for testing    | Keep Jest         | Override: team familiarity, acceptable |

### User Impact Resolutions

| #   | Implementation decision | User-facing consequence        | Developer's evaluation             | Acceptable | Rationale                                  |
| --- | ----------------------- | ------------------------------ | ---------------------------------- | ---------- | ------------------------------------------ |
| 1   | Redis caching, 5m TTL   | Users see stale data for ≤5min | Tolerable for non-critical metrics | Yes        | Dashboard shows trends, not real-time data |
| 2   | Client-side rendering   | Slower initial load on 3G      | Needs mitigation                   | No → SSR   | End users include field workers on mobile  |

### Deferred Question Resolutions

| #   | Question         | Answer                  | Impact on plan |
| --- | ---------------- | ----------------------- | -------------- |
| 1   | Caching strategy | Use Redis with 5min TTL | Updates impl   |

### Implementation Updates Required

- <list any changes to implementation notes, approach, or plan>

### Re-Plan Needed

<Yes — decisions #1 require re-planning | No — all decisions compatible with current plan>
```

This file is the single source of truth for what was decided during critique
mode for this task. It is consumed by the decision-recorder subagent, the
orchestrator (to determine re-plan), and the execution phase (as context for
implementation).

---

## 9. Step 7 — Dispatch decision-recorder

Read `./subagents/decision-recorder.md` and dispatch with:

| Parameter              | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| TICKET_KEY             | The Jira ticket key                                          |
| MODE                   | `critique`                                                   |
| TASK_NUMBER            | `<N>`                                                        |
| DECISIONS              | All decisions from Step 5                                    |
| IMPLEMENTATION_UPDATES | Any implementation notes that changed                        |
| RESOLVED_IRRELEVANT    | Questions marked irrelevant in Step 3                        |
| PER_TASK_DECISIONS_FILE| Path to the file created in Step 6                           |

The subagent handles:

- Adding a reference row to the main Decisions Log in `docs/<KEY>-tasks.md`
- Resolving the task's "Questions to answer before starting" section
- Tagging irrelevant questions with `[RESOLVED — no longer applicable]`
- Updating Implementation notes where decisions changed approach
- Validating all updates for consistency

---

## 10. Step 8 — Final summary

Present this summary to the developer:

```markdown
## Critique & Clarification Complete (Phase 6) — Task <N>

| Metric                      | Count    |
| --------------------------- | -------- |
| Critique items resolved     | <N>      |
| — Kept current approach     | <N>      |
| — Switched to alternative   | <N>      |
| — Acknowledged (override)   | <N>      |
| User-impact items evaluated | <N>      |
| — Trade-off accepted        | <N>      |
| — Approach changed          | <N>      |
| Deferred questions resolved | <N>      |
| Questions now irrelevant    | <N>      |
| Items skipped (⚠️ flagged)  | <N>      |
| **Re-plan needed**          | <Yes/No> |
| **Iteration**               | <1|2|3>  |

**User impact summary:** <Brief statement connecting implementation decisions
to end user experience from Phase 3 Problem Framing>

**Key changes:**
- <list material changes, if any>

**Decisions file:** `docs/<KEY>-task-<N>-decisions.md`
```

If **RE_PLAN_NEEDED** is true, the orchestrator will trigger a re-plan cycle
in Phase 5 — re-dispatching all planning subagents with the decisions file
as input so they can incorporate the changed decisions.

If **RE_PLAN_NEEDED** is false, the orchestrator proceeds to Phase 7
(execution).

---

## 11. Critique Mode Output

This phase produces:

A per-task decisions file at `docs/<TICKET_KEY>-task-<N>-decisions.md`,
containing all decisions resolved during this phase — both critique
resolutions and deferred question resolutions, including user-impact
evaluations. A reference row is added to the main `## Decisions Log` in
`docs/<TICKET_KEY>-tasks.md`, linking to the per-task file and recording
iteration count, resolution counts, and re-plan status.

This file is the input contract for re-planning (if needed) and the
execution phase (Phase 7).
