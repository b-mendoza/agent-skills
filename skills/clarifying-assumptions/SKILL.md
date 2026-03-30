---
name: "clarifying-assumptions"
description: 'Walk through a Jira task plan and interactively confirm assumptions, resolve open questions, validate decisions, and critique planning outputs for bias — using progressive disclosure. In upfront mode (Phase 3), resolves cross-cutting questions and critiques the task plan for unjustified defaults and unexplored alternatives. In critique mode (Phase 6), critiques per-task planning artifacts (framework choices, library selections, testing approach, refactoring scope) and resolves deferred questions for the task about to execute. Use when the user says "review the plan", "ask me questions", "clarify assumptions", "critique the plan", "challenge the approach", "let''s go through the questions", "grill me on the plan", "validate plan for PROJECT-1234", or anything about reviewing, questioning, critiquing, or validating a task plan. Also triggered by the orchestrating-jira-workflow skill as Phase 3 and Phase 6 of the pipeline. Requires a task plan at docs/<TICKET_KEY>-tasks.md.'
---

# Clarifying Assumptions

## Purpose

Act as a structured interviewer that walks the user through open questions,
assumptions, decisions, AND critique of planning outputs — using
**progressive disclosure**. Four goals:

1. **Resolve ambiguity** so downstream execution is unblocked.
2. **Challenge bias** by critiquing decisions made by planning subagents —
   surfacing unjustified defaults, unexplored alternatives, and
   unacknowledged trade-offs.
3. **Educate** the user on the agent's reasoning so they can steer confidently.
4. **Avoid premature questions** — never ask about tasks that have not been
   reached yet, because by the time we get there, the answers may have changed.

## Progressive Disclosure — The Core Principle

Traditional clarification asks ALL questions upfront. This is wasteful because:

- Answers to later questions often depend on what happens during earlier tasks.
- Context gained during execution changes the relevance of questions.
- Users waste time answering questions about tasks that may not even happen.
- Some questions become irrelevant as the codebase evolves through execution.

Instead, this skill uses a **two-mode disclosure model**:

### Upfront Mode — Phase 3 (After task planning)

During the initial clarification phase, ask ONLY:

1. **Critique items** from the `critique-analyzer` subagent — decisions in the
   task plan that show signs of bias, unjustified defaults, or unexplored
   alternatives. ALL severity levels (HIGH, MEDIUM, LOW) are presented to the
   user.

2. **Cross-cutting questions** that affect the entire plan (e.g., "Which API
   version should we use?" or "What authentication strategy?"). These are
   blocking for planning and must be resolved before any execution begins.

3. **Assumptions that affect architecture** — confirmed or revised now because
   changing them later would require reworking completed tasks.

4. **Validation report FAILs** — these block execution entirely.

5. **Questions for Task 1 only** — since Task 1 will be executed first, its
   per-task questions are relevant now. All other per-task questions are
   deferred.

Do NOT ask per-task questions for Tasks 2, 3, 4, etc. during Phase 3. Tag
them as `[DEFERRED — will ask before Task N execution]` in the manifest.

### Critique Mode — Phase 6 (After per-task planning)

Before each task execution, this skill:

1. **Dispatches the `critique-analyzer`** to review the per-task planning
   artifacts (execution plan, test spec, refactoring plan) for framework bias,
   unjustified defaults, and unexplored alternatives. ALL critique items are
   presented to the user.

2. **Resolves deferred questions** for the specific task about to execute.
   Reviews whether any deferred questions have become irrelevant due to
   decisions made or code changes during earlier task executions.

3. **Records all decisions** in a per-task decisions file
   (`docs/<KEY>-task-<N>-decisions.md`) with a reference added to the main
   `## Decisions Log` in the task plan.

If critique reveals decisions that should change, the user's resolutions are
recorded and the orchestrator triggers a re-plan cycle in Phase 5 (maximum 3
iterations, user looped in every time).

## Platform Adaptation

This skill runs across multiple environments (Claude.ai, Claude Code CLI,
Cursor IDE, OpenCode CLI, and others). The SKILL.md format is a cross-platform
open standard, but tool availability differs by environment.

**Interactive input:** Most platforms provide an interactive selection tool
(Claude.ai has `ask_user_input`, Claude Code has `AskUserQuestion`, Cursor has
its own ask-question tool). At the start of execution, check whether any
interactive input tool is available. If one exists, use it for every discrete
choice. If none is available, fall back to numbered text options and ask the
user to reply with a number. Both paths work — the goal is minimal friction.

**Visual context:** Prefer markdown tables as the default visual (universally
supported across all platforms). Use mermaid diagrams only when the environment
renders them inline (Claude.ai and Cursor do; OpenCode's TUI does not) and the
question genuinely involves architecture, data flow, or dependency structure.
ASCII diagrams are an acceptable fallback in terminal environments.

## Inputs

| Input         | Source              | Required | Example                                 |
| ------------- | ------------------- | -------- | --------------------------------------- |
| `TICKET_KEY`  | User / `$ARGUMENTS` | Yes      | `JNS-6065`                              |
| `MODE`        | Orchestrator        | Yes      | `upfront` or `critique`                 |
| `TASK_NUMBER` | Orchestrator        | No       | `3` (required for `critique` mode)      |
| `ITERATION`   | Orchestrator        | No       | `1`, `2`, or `3` (for re-plan tracking) |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run the **planning-jira-tasks** skill first.

For `critique` mode, the per-task planning artifacts must exist:

- `docs/<KEY>-task-<N>-brief.md`
- `docs/<KEY>-task-<N>-execution-plan.md`
- `docs/<KEY>-task-<N>-test-spec.md`
- `docs/<KEY>-task-<N>-refactoring-plan.md`

If any are missing, tell the user to run the **planning-jira-task** skill first.

### Input contract (from upstream skills)

**For upfront mode**, the input file must contain these sections (produced by
`planning-jira-tasks`):

| Required section                     | Used for                                         |
| ------------------------------------ | ------------------------------------------------ |
| `## Assumptions and Constraints`     | Items to present for user confirmation           |
| `## Cross-Cutting Open Questions`    | High-impact questions that affect multiple tasks |
| `## Tasks` with per-task subsections | Per-task questions and implicit assumptions      |
| `## Validation Report`               | WARN/FAIL items become clarification questions   |
| `## Dependency Graph`                | Impact maps for dependency-related questions     |

**Additionally for upfront mode**, the `critique-analyzer` reads the planning
intermediates:

- `docs/<KEY>-stage-1-detailed.md`
- `docs/<KEY>-stage-2-prioritized.md`

**For critique mode**, the `critique-analyzer` reads the per-task planning
artifacts listed in the Inputs section above.

## Output

### Upfront mode output

The same task plan file at `docs/<TICKET_KEY>-tasks.md`, updated in-place, with:

- A `## Decisions Log` table appended (or updated if it already exists)
- Assumptions annotated (`✅ Confirmed` / `❌ Revised: <new text>`)
- Per-task questions resolved (`~~<question>~~ → <answer>`)
- Updated `Implementation notes` where answers changed the approach
- Deferred questions tagged with `[DEFERRED — will ask before Task N execution]`

### Critique mode output

A per-task decisions file at `docs/<TICKET_KEY>-task-<N>-decisions.md`,
containing all decisions resolved during this phase (both critique resolutions
and deferred question resolutions). A reference is added to the main
`## Decisions Log` in `docs/<TICKET_KEY>-tasks.md`.

### Output contract (consumed by downstream skills)

| Addition                                                 | Required by            | Why                                                        |
| -------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `## Decisions Log` table (with per-task file references) | creating-jira-subtasks | Subtask descriptions reflect resolved decisions            |
| Annotated assumptions                                    | executing-jira-task    | Executor needs confirmed assumptions, not open Qs          |
| Resolved per-task questions                              | executing-jira-task    | Pre-flight check verifies no unresolved questions          |
| Updated `Implementation notes` (where approach changed)  | executing-jira-task    | Executor follows the updated approach                      |
| Deferred question tags                                   | orchestrator (Phase 6) | Orchestrator knows which questions to ask before each task |
| Per-task decisions file                                  | planning-jira-task     | Re-plan cycle uses decisions to update artifacts           |
| `RE_PLAN_NEEDED` flag in output                          | orchestrator           | Signals the orchestrator to trigger a re-plan cycle        |

## Subagent Registry

| Subagent            | Path                               | Purpose                                                                                |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `critique-analyzer` | `./subagents/critique-analyzer.md` | Reads planning artifacts, searches web, cross-checks codebase, produces critique items |
| `decision-recorder` | `./subagents/decision-recorder.md` | Applies all file edits (Decisions Log, annotations, tags) + validates                  |

Before dispatching, read the subagent file to understand its input/output
contract. The path is relative to this skill's directory.

**Why `critique-analyzer` is dispatched but Q&A runs inline:** The critique
analysis requires web search, codebase inspection, and artifact analysis —
these are separable concerns. The Q&A loop runs inline because the skill needs
the user's full conversation history for multi-turn interaction. The
`critique-analyzer` produces structured critique items; this skill presents
them to the user alongside other questions using the same progressive
disclosure protocol.

---

## Core Principles

These three principles shape every interaction in this skill. They are ordered
by impact — if you remember nothing else, remember these.

### 1. Ask only what is relevant NOW

In `upfront` mode: ask critique items, cross-cutting questions, architectural
assumptions, validation failures, and Task 1 questions only. Tag everything
else as deferred.

In `critique` mode: ask critique items for the specific task's planning
artifacts, plus deferred questions for that task. Discard questions that are
no longer relevant.

If an answer reveals a new question about a FUTURE task, do not ask it now.
Tag it as deferred for that task. If the new question is about the CURRENT
task or is cross-cutting, ask it immediately.

### 2. Use interactive selection for every discrete choice

When the user must pick from a set of options, use the most frictionless input
method available:

- **If an interactive input tool is available** (e.g., `ask_user_input`,
  `AskUserQuestion`, or equivalent): Use it. Single-select for one answer from
  2-4 options, multi-select for multiple valid answers, rank/prioritize for
  ordering.
- **If no interactive tool is available:** Present numbered options and ask the
  user to reply with a number.

For critique items specifically, the options should include:

1. `✅ Keep current approach` — the user agrees with the planner's decision
2. `🔄 Switch to <alternative>` — one option per alternative the critic named
3. `🔍 I need more information` — the user wants to investigate further
4. `⏭️ Acknowledge but proceed` — the user sees the concern but consciously
   chooses to proceed as-is (logged as an override)

### 3. Give visual context proportional to the question's complexity

| Question type                     | Appropriate context                                                           |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Simple confirmation               | 1-2 sentences on what the assumption is and where it came from                |
| Choice between technical options  | Comparison table showing trade-offs, or a code snippet showing the difference |
| Architecture / data flow decision | Diagram (mermaid or ASCII) showing how options differ                         |
| Question with downstream impact   | Brief impact note: "This affects Tasks 3, 5, and 7"                           |
| Critique item                     | The critique-analyzer's trade-off table + web search findings                 |

---

## Execution — Upfront Mode (Phase 3)

### Phase 1 — Dispatch critique-analyzer and build manifest

#### 1a. Dispatch critique-analyzer

Read `./subagents/critique-analyzer.md` and dispatch the critique-analyzer
subagent with:

- `MODE=upfront`
- `TICKET_KEY`
- `ARTIFACTS` — list of file paths:
  - `docs/<KEY>-tasks.md`
  - `docs/<KEY>-stage-1-detailed.md`
  - `docs/<KEY>-stage-2-prioritized.md`

Collect its output as the `CRITIQUE_REPORT`.

#### 1b. Read and categorize all items

Read `docs/<TICKET_KEY>-tasks.md` and build the complete list of items needing
user input, combining both traditional clarification items AND critique items:

| Category                      | Where to find them                                      | Tier                                    |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------- |
| **Critique items (HIGH)**     | `CRITIQUE_REPORT` — HIGH severity items                 | Tier 1                                  |
| **Validation FAILs**          | `## Validation Report` — unresolved FAIL items          | Tier 1                                  |
| **Critique items (MEDIUM)**   | `CRITIQUE_REPORT` — MEDIUM severity items               | Tier 1                                  |
| **Cross-cutting questions**   | `## Cross-Cutting Open Questions` section               | Tier 1                                  |
| **Architectural assumptions** | `## Assumptions and Constraints` section                | Tier 1                                  |
| **Critique items (LOW)**      | `CRITIQUE_REPORT` — LOW severity items                  | Tier 1                                  |
| **Task 1 questions**          | `Questions to answer before starting` in Task 1         | Tier 1                                  |
| **Task 2+ questions**         | `Questions to answer before starting` in Tasks 2+       | DEFERRED                                |
| **Task 2+ assumptions**       | Implicit assumptions in Tasks 2+ `Implementation notes` | DEFERRED                                |
| **Dependency risks**          | `Dependencies / prerequisites` that seem uncertain      | Tier 1 if affects Task 1, else DEFERRED |
| **Validation warnings**       | `## Validation Report` — WARN items                     | Tier 1 if cross-cutting, else DEFERRED  |

#### 1c. Prioritize Tier 1 items

Order Tier 1 items so blocking issues and critique surface first:

1. Critique items with HIGH severity (potential bias or significant trade-offs)
2. Unresolved FAILs from the validation report (they block execution)
3. Critique items with MEDIUM severity
4. Cross-cutting questions (they unblock the most tasks)
5. Assumptions affecting architectural decisions
6. Critique items with LOW severity
7. Task 1 questions, ordered by priority
8. Cross-cutting validation warnings

#### 1d. Present the manifest

Show the complete numbered list to the user, clearly marking critique items
and deferred items:

```markdown
## Question Manifest for <TICKET_KEY>

I've analyzed the task plan and found **<N> items** total.
**<M> questions** are relevant now (Tier 1), including **<C> critique items**
challenging decisions made by the planning agents. The remaining **<N-M>**
will be asked just before their respective tasks are executed.

### Questions for now (Tier 1)

| #   | Category             | Short description                 | Affects tasks | Input type     |
| --- | -------------------- | --------------------------------- | ------------- | -------------- |
| 1   | 🔴 Critique (HIGH)   | Express chosen without rationale  | 3, 5          | Alternatives   |
| 2   | 🔴 Blocking          | Missing API version specification | 3, 5, 7       | Single select  |
| 3   | 🟡 Critique (MEDIUM) | Jest when project uses Vitest     | 2, 4          | Alternatives   |
| 4   | 🟡 Cross-cutting     | Authentication strategy           | 2, 4, 6       | Single select  |
| 5   | 🔵 Assumption        | Database migration strategy       | 1             | Confirm/revise |
| 6   | ⚪ Critique (LOW)    | CSS-in-JS vs utility classes      | 1             | Alternatives   |
| 7   | ⚪ Task 1 question   | Caching layer needed?             | 1             | Yes/No         |

### Deferred questions (will ask before each task)

| Task | # deferred questions | Will ask before executing task |
| ---- | -------------------- | ------------------------------ |
| 2    | 2                    | Before Task 2 execution        |
| 3    | 1                    | Before Task 3 execution        |
| 5    | 3                    | Before Task 5 execution        |

**Estimated time for Tier 1:** ~<N> minutes (most questions have pre-defined
options).

No surprise questions during this session. Deferred questions will be asked
one task at a time during execution, when context is fresh.
```

Then ask whether the user is ready to start, or wants to reorder, skip, or
add anything.

### Phase 2 — Walk through Tier 1 questions one at a time

For each question in the Tier 1 manifest:

#### 2a. Show progress

```
Question <current>/<total Tier 1> — [<category emoji> <category>]
```

#### 2b. Provide context (proportional to complexity — see Principle 3)

**For critique items**, present:

- **What was decided:** The planning subagent's decision, from which artifact.
- **Why the critic flagged it:** The critique-analyzer's reasoning (bias
  evidence, missing rationale, unexplored alternatives).
- **Trade-off table:** The critique-analyzer's comparison table showing
  pros/cons for each option in the context of this project.
- **Web search findings:** What the critic found about current ecosystem status.
- **What would need to be true:** Conditions for the chosen option to be right
  vs. conditions for an alternative to be better.

**For non-critique items**, include:

- **What this relates to:** 1-2 sentences on where in the plan this came from.
- **Visual context:** Table, code snippet, diagram, or impact note — whatever
  makes the difference between options most obvious.
- **Why this matters:** 1-2 sentences on what changes downstream (skip if the
  impact is obvious or self-contained).

#### 2c. Ask using the best available input method (see Principle 2)

For critique items, always include these options:

1. `✅ Keep current approach` — proceed with the planner's decision
2. `🔄 Switch to <alternative>` — one per named alternative
3. `🔍 I need more information` — will pause for discussion
4. `⏭️ Acknowledge but proceed` — logged as a conscious override

For non-critique items, use the standard options (confirm/revise/skip).

#### 2d. Record the answer

After the user responds:

1. **Acknowledge** in one sentence.
2. **State downstream impact** if the answer changes something — e.g., "This
   means Task 3's implementation notes will shift from REST to GraphQL."
3. **Track whether a re-plan is needed.** If the user chose to switch to an
   alternative on a critique item, flag this decision as requiring a re-plan.
4. **Move on.** Don't elaborate or re-ask.

**On "keep current approach":** Record as confirmed. No re-plan needed.

**On "switch to alternative":** Record the switch. Flag `RE_PLAN_NEEDED=true`.

**On "acknowledge but proceed":** Record as an override — the user consciously
chose to proceed despite the concern. No re-plan needed. This is documented
in the Decisions Log for future reference.

**On "I need more information":** Pause and let the user ask questions or
discuss. Resume when they are ready to decide.

**On "skip":** Record as unresolved with the fallback assumption. Move on.

**On an answer that reveals a new question about the CURRENT task or
cross-cutting:** Don't ask it now. Say: _"Your answer raised a new
consideration. I'm adding it as Question <N+1>."_ When the original manifest
is done, present the new questions for confirmation first.

**On an answer that reveals a new question about a FUTURE task:** Tag it as
deferred. Say: _"This raises a question for Task <N>. I'll ask it when we
get there."_

### Phase 3 — Delegate file updates and summarize

#### 3a. Dispatch `decision-recorder`

After all Tier 1 questions have been walked through, collect the accumulated
decisions, deferred questions, and implementation note updates into structured
lists (see the `decision-recorder` subagent's input contract for the exact
format).

Read `./subagents/decision-recorder.md` and dispatch the subagent with:

- `TICKET_KEY`
- `MODE=upfront`
- `DECISIONS` — the full list of resolved decisions from Phase 2 (including
  critique resolutions)
- `DEFERRED_QUESTIONS` — questions tagged for future tasks
- `IMPLEMENTATION_UPDATES` — any implementation notes that changed due to
  answers

The subagent handles all file edits:

- Appends or updates the `## Decisions Log` table.
- Annotates assumptions (✅ Confirmed / ❌ Revised / ⏭️ Skipped).
- Strikes through resolved questions with answers.
- Tags deferred questions with `[DEFERRED — will ask before Task N execution]`.
- Updates `Implementation notes` where answers changed the approach.
- Validates all updates were applied correctly.
- Returns a validation summary.

#### 3b. Handle the result

Check the subagent's summary:

- **If validation is PASS:** Proceed to the final summary.
- **If validation is WARN:** Review the warnings. If updates could not be
  applied (e.g., question text not found), note this in the user summary. The
  warnings do not block — they are informational.

#### 3c. Final summary

```markdown
## Clarification Complete (Phase 3) — <TICKET_KEY>

| Metric                    | Count    |
| ------------------------- | -------- |
| Tier 1 questions resolved | <N>      |
| Critique items resolved   | <N>      |
| — Kept current approach   | <N>      |
| — Switched to alternative | <N>      |
| — Acknowledged (override) | <N>      |
| Assumptions confirmed     | <N>      |
| Assumptions revised       | <N>      |
| Items skipped             | <N>      |
| Questions deferred        | <N>      |
| New questions added       | <N>      |
| **Re-plan needed**        | <Yes/No> |

**Key changes to the plan:**

- <list material changes, if any>

**Deferred questions:** <N> questions will be asked just-in-time before their
respective tasks are executed.

The task plan at `docs/<TICKET_KEY>-tasks.md` has been updated with all decisions.
```

If `RE_PLAN_NEEDED` is true, the orchestrator will trigger a re-plan cycle in
Phase 2 before proceeding.

Then ask what's next:

```
1. Create subtasks in Jira
2. Review the updated plan first
3. I have more questions
```

---

## Execution — Critique Mode (Phase 6)

This mode is invoked by the orchestrator after Phase 5 (per-task planning)
produces execution artifacts for a specific task.

### 1. Dispatch critique-analyzer

Read `./subagents/critique-analyzer.md` and dispatch the critique-analyzer
subagent with:

- `MODE=critique`
- `TICKET_KEY`
- `TASK_NUMBER`
- `ARTIFACTS` — list of file paths:
  - `docs/<KEY>-task-<N>-brief.md`
  - `docs/<KEY>-task-<N>-execution-plan.md`
  - `docs/<KEY>-task-<N>-test-spec.md`
  - `docs/<KEY>-task-<N>-refactoring-plan.md`
- `PRIOR_DECISIONS` — path to `docs/<KEY>-task-<N>-decisions.md` if this is
  iteration 2 or 3 (so the critic does not re-raise resolved concerns)

Collect its output as the `CRITIQUE_REPORT`.

### 2. Load deferred questions for this task

Read `docs/<TICKET_KEY>-tasks.md` and extract:

- Questions tagged `[DEFERRED — will ask before Task <TASK_NUMBER> execution]`
- Any unresolved assumptions specific to this task
- Any new questions added by previous task executions

### 3. Filter deferred questions for relevance

Review each deferred question against the CURRENT state of the codebase and
plan. Some questions may no longer be relevant because:

- A decision made during a previous task execution resolved the question.
- The codebase has changed in a way that makes one option clearly correct.
- The task's scope has narrowed or shifted during earlier execution.

Mark irrelevant questions as:
`[RESOLVED — no longer applicable: <reason>]`

### 4. Build the manifest

Combine critique items and remaining deferred questions into a single manifest:

```markdown
## Critique & Clarification Manifest — Task <N>: <Title>

Before executing this task, **<M> items** need your input:
**<C> critique items** challenging the planners' approach,
**<Q> deferred questions** from earlier phases.

| #   | Category             | Short description                 | Input type    |
| --- | -------------------- | --------------------------------- | ------------- |
| 1   | 🔴 Critique (HIGH)   | Express chosen, project uses Hono | Alternatives  |
| 2   | 🟡 Critique (MEDIUM) | Jest when Vitest already in use   | Alternatives  |
| 3   | ⚪ Deferred question | Caching strategy for this task    | Single select |
```

If no questions remain (all critique items are clean, all deferred questions
were resolved or became irrelevant):

```
All items for Task <N> have been resolved. No critique concerns. Ready to execute.
```

### 5. Walk through items one at a time

Same protocol as upfront mode Phase 2 (progress indicator, context, interactive
selection, acknowledge, track re-plan need).

### 6. Create per-task decisions file

After all items have been walked through, create the per-task decisions file at
`docs/<TICKET_KEY>-task-<N>-decisions.md`:

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

### Deferred Question Resolutions

| #   | Question         | Answer                  | Impact on plan |
| --- | ---------------- | ----------------------- | -------------- |
| 1   | Caching strategy | Use Redis with 5min TTL | Updates impl   |

### Implementation Updates Required

- <list any changes to implementation notes, approach, or plan>

### Re-Plan Needed

<Yes — decisions #1 require re-planning | No — all decisions compatible with current plan>
```

### 7. Dispatch decision-recorder

Read `./subagents/decision-recorder.md` and dispatch with:

- `TICKET_KEY`
- `MODE=critique`
- `TASK_NUMBER=<N>`
- `DECISIONS` — all decisions from step 5
- `IMPLEMENTATION_UPDATES` — any implementation notes that changed
- `RESOLVED_IRRELEVANT` — questions marked irrelevant in step 3
- `PER_TASK_DECISIONS_FILE` — path to the file created in step 6

The subagent handles:

- Adding a reference row to the main `## Decisions Log` pointing to the
  per-task decisions file:
  `| <N> | Critique — Task <N> | See docs/<KEY>-task-<N>-decisions.md | <summary> | Phase 6 — Task <N> |`
- Resolving the task's `Questions to answer before starting` section.
- Tagging irrelevant questions with `[RESOLVED — no longer applicable: <reason>]`.
- Updating `Implementation notes` if any answers changed the approach.
- Validating all updates were applied correctly.

### 8. Final summary

```markdown
## Critique & Clarification Complete (Phase 6) — Task <N>

| Metric                      | Count    |
| --------------------------- | -------- | --- | --- |
| Critique items resolved     | <N>      |
| — Kept current approach     | <N>      |
| — Switched to alternative   | <N>      |
| — Acknowledged (override)   | <N>      |
| Deferred questions resolved | <N>      |
| Questions now irrelevant    | <N>      |
| **Re-plan needed**          | <Yes/No> |
| **Iteration**               | <1       | 2   | 3>  |

**Key changes:**

- <list material changes, if any>

**Decisions file:** `docs/<KEY>-task-<N>-decisions.md`
```

If `RE_PLAN_NEEDED` is true, the orchestrator will trigger a re-plan cycle
in Phase 5 (re-dispatch all planning subagents with the decisions file).

If `RE_PLAN_NEEDED` is false, the orchestrator proceeds to Phase 7 (execution).

---

## Behavioral Guardrails

- **One question per message.** Never batch multiple questions in a single turn.
- **The manifest is the source of truth.** Every question comes from it. New
  questions get added to it before being asked.
- **Defer, don't discard.** Questions for future tasks are tagged as deferred,
  not deleted. They will be reviewed for relevance when their task comes up.
- **Be a teacher, not an interrogator.** Context should help the user understand
  the problem space, not just answer your question.
- **Respect "skip."** Note the fallback, move on, no pressure.
- **Stay neutral on options.** If you have a recommendation, frame it as "I'd
  lean toward X because..." not "You should do X." Exception: the
  critique-analyzer's output is deliberately opinionated — present its views
  faithfully but let the user decide.
- **Keep each question block scannable** — readable in under 30 seconds. Let the
  visuals carry the weight; don't duplicate them in prose.
- **Never ask about what hasn't happened yet.** If a question's relevance
  depends on the outcome of a future task, it must be deferred.
- **Present ALL critique items.** Every critique item (HIGH, MEDIUM, and LOW)
  is presented to the user. No filtering, no auto-acknowledging. The user sees
  everything and makes every decision.
