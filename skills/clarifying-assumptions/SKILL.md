---
name: "clarifying-assumptions"
description: 'Walk through a Jira task plan and interactively confirm assumptions, resolve open questions, and validate decisions — using progressive disclosure. Only asks questions relevant to the CURRENT phase or task being executed. Use when the user says "review the plan", "ask me questions", "clarify assumptions", "let''s go through the questions", "grill me on the plan", "validate plan for PROJECT-1234", or anything about reviewing, questioning, or validating a task plan. Also triggered by the orchestrating-jira-workflow skill as Phase 3 of the pipeline, and re-invoked during Phase 5 before each task execution. Requires a task plan at docs/<TICKET_KEY>-tasks.md.'
---

# Clarifying Assumptions

## Purpose

Act as a structured interviewer that walks the user through open questions,
assumptions, and decisions in the task plan — using **progressive disclosure**.
Three goals:

1. **Resolve ambiguity** so downstream execution is unblocked.
2. **Educate** the user on the agent's reasoning so they can steer confidently.
3. **Avoid premature questions** — never ask about tasks that have not been
   reached yet, because by the time we get there, the answers may have changed.

## Progressive Disclosure — The Core Principle

Traditional clarification asks ALL questions upfront. This is wasteful because:

- Answers to later questions often depend on what happens during earlier tasks.
- Context gained during execution changes the relevance of questions.
- Users waste time answering questions about tasks that may not even happen.
- Some questions become irrelevant as the codebase evolves through execution.

Instead, this skill uses a **two-tier disclosure model**:

### Tier 1 — Phase 3 (Upfront Clarification)

During the initial clarification phase, ask ONLY:

1. **Cross-cutting questions** that affect the entire plan (e.g., "Which API
   version should we use?" or "What authentication strategy?"). These are
   blocking for planning and must be resolved before any execution begins.

2. **Assumptions that affect architecture** — confirmed or revised now because
   changing them later would require reworking completed tasks.

3. **Validation report FAILs** — these block execution entirely.

4. **Questions for Task 1 only** — since Task 1 will be executed first, its
   per-task questions are relevant now. All other per-task questions are
   deferred.

Do NOT ask per-task questions for Tasks 2, 3, 4, etc. during Phase 3. Tag
them as `[DEFERRED — will ask before Task N execution]` in the manifest.

### Tier 2 — Phase 5 (Just-In-Time Clarification)

Before each task execution in Phase 5, the orchestrator checks whether the
task about to execute has unresolved questions or assumptions. If it does,
the orchestrator invokes this skill in **just-in-time mode** with the specific
task number.

In just-in-time mode:

- Only ask questions tagged for the specific task about to execute.
- Review whether any deferred questions have become irrelevant due to decisions
  made or code changes during earlier task executions.
- Present questions that are still relevant.
- Mark irrelevant questions as `[RESOLVED — no longer applicable: <reason>]`.

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

| Input         | Source              | Required | Example                                  |
| ------------- | ------------------- | -------- | ---------------------------------------- |
| `TICKET_KEY`  | User / `$ARGUMENTS` | Yes      | `JNS-6065`                               |
| `MODE`        | Orchestrator        | No       | `upfront` or `just-in-time`              |
| `TASK_NUMBER` | Orchestrator        | No       | `3` (required if MODE is `just-in-time`) |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run the **planning-jira-tasks** skill first.

Default `MODE` is `upfront` when called during Phase 3.

### Input contract (from upstream skill)

The input file must contain these sections (produced by `planning-jira-tasks`).
If any are missing, the plan was not generated correctly — stop and ask the user
to re-run planning.

| Required section                     | Used for                                         |
| ------------------------------------ | ------------------------------------------------ |
| `## Assumptions and Constraints`     | Items to present for user confirmation           |
| `## Cross-Cutting Open Questions`    | High-impact questions that affect multiple tasks |
| `## Tasks` with per-task subsections | Per-task questions and implicit assumptions      |
| `## Validation Report`               | WARN/FAIL items become clarification questions   |
| `## Dependency Graph`                | Impact maps for dependency-related questions     |

## Output

The same task plan file at `docs/<TICKET_KEY>-tasks.md`, updated in-place, with:

- A `## Decisions Log` table appended (or updated if it already exists)
- Assumptions annotated (`✅ Confirmed` / `❌ Revised: <new text>`)
- Per-task questions resolved (`~~<question>~~ → <answer>`)
- Updated `Implementation notes` where answers changed the approach
- Deferred questions tagged with `[DEFERRED — will ask before Task N execution]`

### Output contract (consumed by downstream skills)

| Addition                                                | Required by            | Why                                                        |
| ------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `## Decisions Log` table                                | creating-jira-subtasks | Subtask descriptions reflect resolved decisions            |
| Annotated assumptions                                   | executing-jira-task    | Executor needs confirmed assumptions, not open Qs          |
| Resolved per-task questions                             | executing-jira-task    | Pre-flight check verifies no unresolved questions          |
| Updated `Implementation notes` (where approach changed) | executing-jira-task    | Executor follows the updated approach                      |
| Deferred question tags                                  | orchestrator (Phase 5) | Orchestrator knows which questions to ask before each task |

## Subagent Registry

| Subagent            | Path                               | Purpose                                                               |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `decision-recorder` | `./subagents/decision-recorder.md` | Applies all file edits (Decisions Log, annotations, tags) + validates |

Before dispatching, read the subagent file to understand its input/output
contract. The path is relative to this skill's directory.

**Why only file writes are delegated:** This skill is conversational — it
needs the user's full conversation history for multi-turn Q&A. The Q&A loop
and plan parsing run inline because the skill needs manifest content in context
to ask questions. File writes are delegated because they are separable from the
conversation and would pollute the context with raw file I/O.

---

## Core Principles

These three principles shape every interaction in this skill. They're ordered by
impact — if you remember nothing else, remember these.

### 1. Ask only what is relevant NOW

In `upfront` mode: ask cross-cutting questions, architectural assumptions,
validation failures, and Task 1 questions only. Tag everything else as deferred.

In `just-in-time` mode: ask only questions for the specific task about to
execute. Discard questions that are no longer relevant.

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
  user to reply with a number. Example:

  ```
  1. Repository pattern
  2. Direct database access
  3. CQRS
  4. Other (I'll describe)

  Reply with a number (or type your own answer):
  ```

When a question has discrete options plus a possible free-text path, present the
options first. If the user picks "Other," follow up for details.

For confirmation questions (assumptions), use: `1. ✅ Confirm as-is`,
`2. ❌ Revise`, `3. ⏭️ Skip`.

### 3. Give visual context proportional to the question's complexity

Every question should have enough context for the user to answer confidently.
The right amount depends on what's being asked:

| Question type                     | Appropriate context                                                           |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Simple confirmation               | 1-2 sentences on what the assumption is and where it came from                |
| Choice between technical options  | Comparison table showing trade-offs, or a code snippet showing the difference |
| Architecture / data flow decision | Diagram (mermaid or ASCII) showing how options differ                         |
| Question with downstream impact   | Brief impact note: "This affects Tasks 3, 5, and 7"                           |

Don't pad simple confirmations with diagrams they don't need. Do invest in
visuals when the question involves trade-offs, structural differences, or
cascading effects. The goal is understanding, not decoration.

**Choosing the right visual:**

| Visual type     | Best for                                                | Format                      |
| --------------- | ------------------------------------------------------- | --------------------------- |
| Markdown table  | Comparing options side by side (works everywhere)       | Markdown table              |
| Code snippet    | When the question affects specific code, configs, APIs  | Fenced code block with lang |
| Mermaid diagram | Architecture, data flow, dependencies (if env supports) | Mermaid code block          |
| Before / after  | When the answer changes the plan structure              | Two code blocks or tables   |

---

## Execution — Upfront Mode (Phase 3)

### Phase 1 — Build and present the question manifest

#### 1a. Read and categorize all items

Read `docs/<TICKET_KEY>-tasks.md` and build the complete list of items needing
user input:

| Category                      | Where to find them                                      | Tier                                    |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------- |
| **Validation FAILs**          | `## Validation Report` — unresolved FAIL items          | Tier 1                                  |
| **Cross-cutting questions**   | `## Cross-Cutting Open Questions` section               | Tier 1                                  |
| **Architectural assumptions** | `## Assumptions and Constraints` section                | Tier 1                                  |
| **Task 1 questions**          | `Questions to answer before starting` in Task 1         | Tier 1                                  |
| **Task 2+ questions**         | `Questions to answer before starting` in Tasks 2+       | DEFERRED                                |
| **Task 2+ assumptions**       | Implicit assumptions in Tasks 2+ `Implementation notes` | DEFERRED                                |
| **Dependency risks**          | `Dependencies / prerequisites` that seem uncertain      | Tier 1 if affects Task 1, else DEFERRED |
| **Validation warnings**       | `## Validation Report` — WARN items                     | Tier 1 if cross-cutting, else DEFERRED  |

#### 1b. Prioritize Tier 1 items

Order Tier 1 items so blocking issues surface first:

1. Unresolved FAILs from the validation report (they block execution)
2. Cross-cutting questions (they unblock the most tasks)
3. Assumptions affecting architectural decisions
4. Task 1 questions, ordered by priority
5. Cross-cutting validation warnings

#### 1c. Present the manifest

Show the complete numbered list to the user, clearly marking deferred items:

```markdown
## Question Manifest for <TICKET_KEY>

I've analyzed the task plan and found **<N> items** total.
**<M> questions** are relevant now (Tier 1). The remaining **<N-M>** will be
asked just before their respective tasks are executed.

### Questions for now (Tier 1)

| #   | Category           | Short description                 | Affects tasks | Input type     |
| --- | ------------------ | --------------------------------- | ------------- | -------------- |
| 1   | 🔴 Blocking        | Missing API version specification | 3, 5, 7       | Single select  |
| 2   | 🟡 Cross-cutting   | Authentication strategy           | 2, 4, 6       | Single select  |
| 3   | 🔵 Assumption      | Database migration strategy       | 1             | Confirm/revise |
| 4   | ⚪ Task 1 question | Caching layer needed?             | 1             | Yes/No         |

### Deferred questions (will ask before each task)

| Task | # deferred questions | Will ask before executing task |
| ---- | -------------------- | ------------------------------ |
| 2    | 2                    | Before Task 2 execution        |
| 3    | 1                    | Before Task 3 execution        |
| 5    | 3                    | Before Task 5 execution        |

**Estimated time for Tier 1:** ~<N> minutes (most questions have pre-defined options).

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

Include:

- **What this relates to:** 1-2 sentences on where in the plan this came from.
- **Visual context:** Table, code snippet, diagram, or impact note — whatever
  makes the difference between options most obvious.
- **Why this matters:** 1-2 sentences on what changes downstream (skip if the
  impact is obvious or self-contained).

#### 2c. Ask using the best available input method (see Principle 2)

For discrete options, use interactive selection or numbered options. For
free-text questions, ask in plain text but still provide context first.

#### 2d. Record the answer

After the user responds:

1. **Acknowledge** in one sentence.
2. **State downstream impact** if the answer changes something — e.g., "This
   means Task 3's implementation notes will shift from REST to GraphQL."
3. **Move on.** Don't elaborate or re-ask.

**On "skip":** Record as unresolved with the fallback assumption. Move on.

**On "revise":** Follow up with: "What should the revised assumption be?"
Record the new text.

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
- `DECISIONS` — the full list of resolved decisions from Phase 2
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
## Clarification Complete (Tier 1) — <TICKET_KEY>

| Metric                    | Count |
| ------------------------- | ----- |
| Tier 1 questions resolved | <N>   |
| Assumptions confirmed     | <N>   |
| Assumptions revised       | <N>   |
| Items skipped             | <N>   |
| Questions deferred        | <N>   |
| New questions added       | <N>   |

**Key changes to the plan:**

- <list material changes, if any>

**Deferred questions:** <N> questions will be asked just-in-time before their
respective tasks are executed.

The task plan at `docs/<TICKET_KEY>-tasks.md` has been updated with all decisions.
```

Then ask what's next:

```
1. Create subtasks in Jira
2. Review the updated plan first
3. I have more questions
```

---

## Execution — Just-In-Time Mode (Phase 5, before each task)

This mode is invoked by the orchestrator before executing a specific task.

### 1. Load deferred questions for this task

Read `docs/<TICKET_KEY>-tasks.md` and extract:

- Questions tagged `[DEFERRED — will ask before Task <TASK_NUMBER> execution]`
- Any unresolved assumptions specific to this task
- Any new questions added by previous task executions

### 2. Filter for relevance

Review each deferred question against the CURRENT state of the codebase and
plan. Some questions may no longer be relevant because:

- A decision made during a previous task execution resolved the question.
- The codebase has changed in a way that makes one option clearly correct.
- The task's scope has narrowed or shifted during earlier execution.

Mark irrelevant questions as:
`[RESOLVED — no longer applicable: <reason>]`

### 3. Present remaining questions

If questions remain:

```markdown
## Just-In-Time Clarification — Task <N>: <Title>

Before executing this task, <M> question(s) need your input:

| #   | Short description | Input type     |
| --- | ----------------- | -------------- |
| 1   | <description>     | Single select  |
| 2   | <description>     | Confirm/revise |
```

Walk through each question using the same one-at-a-time protocol from
upfront mode (progress indicator, context, interactive selection, acknowledge).

If no questions remain (all were resolved or became irrelevant):

```
All deferred questions for Task <N> have been resolved by prior decisions
or are no longer applicable. Ready to execute.
```

### 4. Delegate file updates

Dispatch `decision-recorder` with:

- `TICKET_KEY`
- `MODE=jit`
- `TASK_NUMBER=<N>`
- `DECISIONS` — any decisions resolved during step 3
- `IMPLEMENTATION_UPDATES` — any implementation notes that changed
- `RESOLVED_IRRELEVANT` — questions marked irrelevant in step 2 (with reasons)

The subagent handles all file edits:

- Updates the Decisions Log with new entries (marking `Phase resolved` as
  `Phase 5 — Task <N>`).
- Resolves the task's `Questions to answer before starting` section.
- Tags irrelevant questions with `[RESOLVED — no longer applicable: <reason>]`.
- Updates `Implementation notes` if any answers changed the approach.
- Validates all updates were applied correctly.

If the subagent reports warnings (updates that could not be applied), note
them but do not block — they are informational.

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
  lean toward X because..." not "You should do X."
- **Keep each question block scannable** — readable in under 30 seconds. Let the
  visuals carry the weight; don't duplicate them in prose.
- **Never ask about what hasn't happened yet.** If a question's relevance
  depends on the outcome of a future task, it must be deferred.
