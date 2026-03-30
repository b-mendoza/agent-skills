---
name: "clarifying-assumptions"
description: 'Walk through a Jira task plan and interactively confirm assumptions, resolve open questions, validate decisions, critique planning outputs for bias, and challenge problem framing through a Design Thinking lens — using progressive disclosure. Operates as a mentorship engine that teaches developers to think critically about what they build and why, rather than blindly accepting subagent outputs. In upfront mode (Phase 3), challenges problem framing (end user, underlying need, evidence basis), resolves cross-cutting questions, and critiques the task plan for unjustified defaults and unexplored alternatives. In critique mode (Phase 6), critiques per-task planning artifacts (framework choices, library selections, testing approach, refactoring scope, user-impact assessment) and resolves deferred questions for the task about to execute. Uses two questioning models: Model A (Socratic generate-then-compare) for hard-gate problem-framing questions, and Model B (evaluate-the-reasoning) for all other items. Use when the user says "review the plan", "ask me questions", "clarify assumptions", "critique the plan", "challenge the approach", "let''s go through the questions", "grill me on the plan", "validate plan for PROJECT-1234", or anything about reviewing, questioning, critiquing, or validating a task plan. Also triggered by the orchestrating-jira-workflow skill as Phase 3 and Phase 6 of the pipeline. Requires a task plan at docs/<TICKET_KEY>-tasks.md.'
---

# Clarifying Assumptions

## Purpose

Act as a structured interviewer and **mentor** that walks the user through open
questions, assumptions, decisions, critique of planning outputs, AND
problem-framing challenges — using **progressive disclosure**. Five goals:

1. **Challenge problem framing** by questioning whether the ticket solves the
   right problem for the right user, with sufficient evidence. This is the
   Design Thinking foundation — before asking how to build something, ask
   whether we should build it this way at all.
2. **Resolve ambiguity** so downstream execution is unblocked.
3. **Challenge bias** by critiquing decisions made by planning subagents —
   surfacing unjustified defaults, unexplored alternatives, and
   unacknowledged trade-offs.
4. **Develop the developer's critical thinking** by making them articulate
   their own reasoning before revealing subagent analysis. This is not about
   getting through questions quickly — it is about building the habit of
   questioning assumptions, evaluating trade-offs, and making deliberate
   decisions. Being a yes-man does not help developers grow.
5. **Avoid premature questions** — never ask about tasks that have not been
   reached yet, because by the time we get there, the answers may have changed.

## Design Thinking Mindset

This skill operates under a Design Thinking mindset. That means:

- **Empathy first.** Every feature exists to serve a human. If we cannot name
  that human and articulate their need, we are not ready to build.
- **Problem before solution.** Jira tickets describe solutions. The developer's
  job — with this skill's guidance — is to validate that the solution addresses
  a real, evidenced need before investing implementation effort.
- **No silent acceptance.** Every subagent decision passes through the
  developer's judgment. The system presents what was decided and why, and the
  developer must engage — either by generating their own reasoning first
  (Model A) or by evaluating the subagent's reasoning (Model B). Pass-through
  is not an option.
- **Teaching over interrogation.** The tone is that of a senior mentor who
  genuinely wants the developer to grow, not an auditor looking for failures.
  Be direct about gaps in thinking, but frame challenges as opportunities to
  sharpen reasoning, not as gotchas.

### Two Questioning Models

**Model A — Socratic (generate-then-compare).** Used for Tier 3 hard-gate
questions (problem-framing fundamentals). The developer is asked to articulate
their own answer FIRST, without seeing the subagent's analysis. Only after the
developer responds does the system reveal the critique-analyzer's findings.
This forces the developer to form independent opinions and builds the muscle
of thinking before consuming AI output.

Flow:

1. Present the question with context on why it matters.
2. Ask the developer to answer in their own words.
3. After the developer responds, reveal the critique-analyzer's analysis.
4. Compare the developer's answer with the analysis. If the developer's
   reasoning was shallow or missed important dimensions, say so directly —
   name what was missing and why it matters.
5. Ask the developer for their final decision, informed by both their own
   thinking and the analysis.

**Model B — Evaluate-the-reasoning.** Used for Tier 2 items (technology
choices, assumptions, deferred questions). The system presents the subagent's
decision along with its reasoning and the critique-analyzer's counter-analysis,
and asks the developer to evaluate whether the reasoning holds up. This is
less demanding but still engages critical judgment — the developer cannot just
click "accept."

Flow:

1. Present the decision, the subagent's reasoning, and the critique.
2. Ask the developer: does the original reasoning hold up? Why or why not?
3. Record the decision with the developer's rationale.

## Progressive Disclosure — The Core Principle

Traditional clarification asks ALL questions upfront. This is wasteful because:

- Answers to later questions often depend on what happens during earlier tasks.
- Context gained during execution changes the relevance of questions.
- Users waste time answering questions about tasks that may not even happen.
- Some questions become irrelevant as the codebase evolves through execution.

Instead, this skill uses a **two-mode disclosure model**:

### Upfront Mode — Phase 3 (After task planning)

During the initial clarification phase, ask ONLY:

1. **Problem-framing critique items** from the `critique-analyzer` subagent —
   challenges to the Problem Framing section's identification of the end user,
   underlying need, solution-problem fit, and evidence basis. HIGH severity
   problem-framing items are Tier 3 hard gates (the developer cannot skip
   them). These are asked using **Model A (Socratic)**: the developer must
   articulate their own answer before seeing the critique.

2. **Critique items** from the `critique-analyzer` subagent — decisions in the
   task plan that show signs of bias, unjustified defaults, or unexplored
   alternatives. ALL severity levels (HIGH, MEDIUM, LOW) are presented to the
   user using **Model B (evaluate-the-reasoning)**.

3. **Cross-cutting questions** that affect the entire plan (e.g., "Which API
   version should we use?" or "What authentication strategy?"). These are
   blocking for planning and must be resolved before any execution begins.

4. **Assumptions that affect architecture** — confirmed or revised now because
   changing them later would require reworking completed tasks.

5. **Validation report FAILs** — these block execution entirely.

6. **Questions for Task 1 only** — since Task 1 will be executed first, its
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
| `## Problem Framing`                 | Tier 3 hard-gate questions (Design Thinking)     |
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
| Problem-framing (Tier 3, Model A) | Why this dimension matters for this ticket + open-ended prompt for developer  |
| Simple confirmation               | 1-2 sentences on what the assumption is and where it came from                |
| Choice between technical options  | Comparison table showing trade-offs, or a code snippet showing the difference |
| Architecture / data flow decision | Diagram (mermaid or ASCII) showing how options differ                         |
| Question with downstream impact   | Brief impact note: "This affects Tasks 3, 5, and 7"                           |
| Technology critique item          | The critique-analyzer's trade-off table + web search findings                 |
| User impact concern               | The execution-planner's user impact row + critique-analyzer's assessment      |

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

| Category                            | Where to find them                                      | Tier                                    | Model   |
| ----------------------------------- | ------------------------------------------------------- | --------------------------------------- | ------- |
| **Problem-framing critique (HIGH)** | `CRITIQUE_REPORT` — Problem Framing Critique, HIGH      | Tier 3 (hard gate)                      | Model A |
| **Problem-framing critique (MED)**  | `CRITIQUE_REPORT` — Problem Framing Critique, MEDIUM    | Tier 2                                  | Model B |
| **Problem-framing critique (LOW)**  | `CRITIQUE_REPORT` — Problem Framing Critique, LOW       | Tier 2                                  | Model B |
| **Technology critique (HIGH)**      | `CRITIQUE_REPORT` — Technology Critique, HIGH           | Tier 2                                  | Model B |
| **Validation FAILs**                | `## Validation Report` — unresolved FAIL items          | Tier 2                                  | Model B |
| **Technology critique (MEDIUM)**    | `CRITIQUE_REPORT` — Technology Critique, MEDIUM         | Tier 2                                  | Model B |
| **Cross-cutting questions**         | `## Cross-Cutting Open Questions` section               | Tier 2                                  | Model B |
| **Architectural assumptions**       | `## Assumptions and Constraints` section                | Tier 2                                  | Model B |
| **Technology critique (LOW)**       | `CRITIQUE_REPORT` — Technology Critique, LOW            | Tier 2                                  | Model B |
| **Task 1 questions**                | `Questions to answer before starting` in Task 1         | Tier 2                                  | Model B |
| **Task 2+ questions**               | `Questions to answer before starting` in Tasks 2+       | DEFERRED                                | —       |
| **Task 2+ assumptions**             | Implicit assumptions in Tasks 2+ `Implementation notes` | DEFERRED                                | —       |
| **Dependency risks**                | `Dependencies / prerequisites` that seem uncertain      | Tier 2 if affects Task 1, else DEFERRED | Model B |
| **Validation warnings**             | `## Validation Report` — WARN items                     | Tier 2 if cross-cutting, else DEFERRED  | Model B |

#### 1c. Prioritize items

Order items so problem framing and blocking issues surface first:

1. Problem-framing critique items with HIGH severity (Tier 3 hard gates —
   Model A Socratic questioning)
2. Problem-framing critique items with MEDIUM severity (Tier 2 — Model B)
3. Technology critique items with HIGH severity (potential bias or significant
   trade-offs — Model B)
4. Unresolved FAILs from the validation report (they block execution)
5. Technology critique items with MEDIUM severity (Model B)
6. Cross-cutting questions (they unblock the most tasks)
7. Assumptions affecting architectural decisions
8. Problem-framing critique items with LOW severity (Tier 2 — Model B)
9. Technology critique items with LOW severity (Model B)
10. Task 1 questions, ordered by priority
11. Cross-cutting validation warnings

#### 1d. Present the manifest

Show the complete numbered list to the user, clearly marking critique items
and deferred items:

```markdown
## Question Manifest for <TICKET_KEY>

I've analyzed the task plan and found **<N> items** total.
**<M> questions** are relevant now, including **<PF> problem-framing
challenges** (Design Thinking) and **<C> technology critique items**.
The remaining **<N-M>** will be asked just before their respective tasks.

**<PF_HARD> problem-framing items are hard gates** — they require your
own reasoning before I share the analysis. These are the foundation: if we
cannot answer who the user is, what they need, and why this solution is right,
we are not ready to build.

### Questions for now

| #   | Category                      | Short description                 | Affects tasks | Model   | Skippable |
| --- | ----------------------------- | --------------------------------- | ------------- | ------- | --------- |
| 1   | 🔴 Problem framing (HIGH)     | End user not identified in ticket | All           | Model A | No        |
| 2   | 🔴 Problem framing (HIGH)     | No evidence basis for solution    | All           | Model A | No        |
| 3   | 🟡 Problem framing (MEDIUM)   | Alternative approaches unexplored | All           | Model B | Yes ⚠️    |
| 4   | 🟡 Technology critique (HIGH) | Express chosen without rationale  | 3, 5          | Model B | Yes ⚠️    |
| 5   | 🔴 Blocking                   | Missing API version specification | 3, 5, 7       | Model B | Yes ⚠️    |
| 6   | 🟡 Technology critique (MED)  | Jest when project uses Vitest     | 2, 4          | Model B | Yes ⚠️    |
| 7   | 🟡 Cross-cutting              | Authentication strategy           | 2, 4, 6       | Model B | Yes ⚠️    |
| 8   | 🔵 Assumption                 | Database migration strategy       | 1             | Model B | Yes ⚠️    |

### Deferred questions (will ask before each task)

| Task | # deferred questions | Will ask before executing task |
| ---- | -------------------- | ------------------------------ |
| 2    | 2                    | Before Task 2 execution        |
| 3    | 1                    | Before Task 3 execution        |
| 5    | 3                    | Before Task 5 execution        |

**Estimated time:** ~<N> minutes. Problem-framing questions (Model A) take
longer because they ask you to think first — that is intentional.

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

#### 2b. Provide context and ask (using the correct Model)

The questioning approach depends on the item's Model assignment.

**For Tier 3 hard-gate items (Model A — Socratic):**

These are problem-framing fundamentals. The developer must think first.

1. **Frame the challenge.** Explain which dimension of problem framing is being
   challenged (end user, underlying need, solution-problem fit, evidence basis)
   and WHY it matters — not in abstract terms, but in concrete terms for this
   ticket. Example: "The task plan says this feature is for 'our customers,' but
   different customer segments have different needs. If we build for the wrong
   segment, the feature might solve a problem nobody has."

2. **Ask the developer to answer in their own words.** Do NOT show the
   critique-analyzer's analysis yet. Ask an open-ended question:
   - "Who specifically will use this feature? Describe the user and what they
     are trying to accomplish."
   - "What problem does this user have today that this ticket solves? Describe
     it from their perspective."
   - "What evidence do you have that this is the right solution? Where did the
     conviction come from?"

3. **Evaluate the developer's response.** After they answer:
   - If the response is specific, well-reasoned, and shows genuine
     understanding of the user's perspective → acknowledge it, then reveal
     the critique-analyzer's analysis for comparison.
   - If the response is shallow, generic, or implementation-focused →
     **push back directly.** Name what is missing. "Your answer describes what
     the code will do, not what the user needs. A password reset endpoint is a
     solution — the need is that users currently cannot regain access to their
     accounts without contacting support, which takes 48 hours and generates
     30% of your support tickets. Can you reframe from the user's perspective?"

4. **Reveal the critique-analyzer's analysis.** Show what the critic found,
   including any gaps or concerns.

5. **Ask for the final decision.** The developer now has both their own
   thinking and the analysis. They decide how to proceed, and their rationale
   is recorded.

**Tier 3 items cannot be skipped.** If the developer tries to skip a Tier 3
item, explain: "This is a foundational question. If we cannot answer who the
user is and what problem we are solving, we risk building the wrong thing.
I need your answer before we can proceed."

**For Tier 2 items (Model B — evaluate-the-reasoning):**

These are technology choices, assumptions, and non-foundational critique items.

1. **Present the decision and its reasoning.** Show what the subagent decided
   and why.

2. **Present the critique.** Show the critique-analyzer's counter-analysis,
   trade-off table, and web search findings.

3. **Ask the developer to evaluate.** "Does the original reasoning hold up
   given these trade-offs? Why or why not?" This is not a yes/no question —
   the developer should articulate their evaluation, even briefly.

4. **Record the decision with rationale.**

**Tier 2 items can be skipped, but skipping is flagged.** If the developer
skips a Tier 2 item, record it with a visible warning in the decisions file:
"⚠️ Skipped without evaluation — proceeding on assumption: <fallback>."

**For non-critique items** (assumptions, cross-cutting questions, Task 1
questions), use Model B flow: present context proportional to complexity
(see Principle 3), ask for the developer's evaluation, record the decision.

#### 2c. Ask using the best available input method (see Principle 2)

For Tier 3 (Model A) items, do NOT use selection widgets for the initial
question — use open-ended text input. The developer must articulate their
thinking, not pick from a menu. Use selection widgets only for the final
decision after the Socratic exchange.

For Tier 2 (Model B) critique items, always include these options:

1. `✅ Keep current approach` — proceed with the planner's decision
2. `🔄 Switch to <alternative>` — one per named alternative
3. `🔍 I need more information` — will pause for discussion
4. `⏭️ Acknowledge but proceed` — logged as a conscious override

For non-critique Tier 2 items, use the standard options (confirm/revise/skip).

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

**On "skip" (Tier 2 only):** Record as unresolved with the fallback
assumption AND a visible warning: `⚠️ Skipped without evaluation —
proceeding on assumption: <fallback>`. Move on. Do not pressure, but the
warning is permanent and visible in the decisions file.

**On attempted skip of Tier 3 item:** Do NOT allow. Explain: "This is a
hard-gate question. We need your answer to proceed. If you genuinely don't
know, say so — 'I don't know who the end user is' is a valid and honest
answer that we can work with. But skipping is not an option for problem-
framing fundamentals."

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

| Metric                             | Count    |
| ---------------------------------- | -------- |
| Total questions resolved           | <N>      |
| Problem-framing items (Tier 3)     | <N>      |
| — Developer reasoning matched      | <N>      |
| — Developer reasoning improved     | <N>      |
| — Developer could not answer       | <N>      |
| Technology critique items resolved | <N>      |
| — Kept current approach            | <N>      |
| — Switched to alternative          | <N>      |
| — Acknowledged (override)          | <N>      |
| Assumptions confirmed              | <N>      |
| Assumptions revised                | <N>      |
| Items skipped (⚠️ flagged)         | <N>      |
| Questions deferred                 | <N>      |
| New questions added                | <N>      |
| **Re-plan needed**                 | <Yes/No> |

**Problem framing status:**

- End user: <Identified / Revised / Needs further validation>
- Underlying need: <Articulated / Revised / Assumed>
- Evidence basis: <Strong / Weak / None — proceeding on assumption>

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

Combine critique items (including user-impact concerns), remaining deferred
questions into a single manifest:

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

If no questions remain (all critique items are clean, all deferred questions
were resolved or became irrelevant):

```
All items for Task <N> have been resolved. No critique concerns. Ready to execute.
```

### 5. Walk through items one at a time

Same protocol as upfront mode Phase 2 — use Model B for all items. Show the
decision, the reasoning, and the critique. Ask the developer to evaluate
whether the reasoning holds up.

For **user-impact items** specifically, present the execution-planner's User
Impact Assessment row and ask: "This implementation choice means <consequence>
for the end user. Given what we established about who the user is and what they
need (from Phase 3), is this trade-off acceptable? Why or why not?" Connect
every user-impact question back to the Problem Framing decisions — this
reinforces the habit of thinking about users throughout implementation, not
just at the start.

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
| User-impact items evaluated | <N>      |
| — Trade-off accepted        | <N>      |
| — Approach changed          | <N>      |
| Deferred questions resolved | <N>      |
| Questions now irrelevant    | <N>      |
| Items skipped (⚠️ flagged)  | <N>      |
| **Re-plan needed**          | <Yes/No> |
| **Iteration**               | <1       | 2   | 3>  |

**User impact summary:** <Brief statement connecting implementation decisions
to the end user experience established in Phase 3 Problem Framing. E.g.,
"All user-impact trade-offs were evaluated against the identified need of
enterprise admins who need sub-second dashboard loads. The 5min cache TTL
was accepted as tolerable for non-critical metrics.">

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
- **Be a mentor, not an interrogator.** For Tier 2 items, context should help
  the user understand the problem space and evaluate trade-offs. For Tier 3
  items, push the developer to think deeply, but frame challenges as growth
  opportunities, not gotchas. The goal is to build the developer's critical
  thinking muscle over time.
- **Be direct about thinking quality.** When the developer's reasoning is
  shallow, generic, or implementation-focused on a problem-framing question,
  say so plainly. "Your answer describes what the code will do, not what the
  user needs" is appropriate and helpful. Sugarcoating does not build better
  engineers. This applies to Tier 3 (Model A) questions specifically — for
  Tier 2 items, stay neutral on options per the existing protocol.
- **Stay neutral on technology preferences, be direct on thinking quality.**
  For technology critique items, present trade-offs and let the developer
  decide — "I'd lean toward X because..." not "You should do X." For
  problem-framing items, be direct when the developer's reasoning needs to
  go deeper — naming gaps in thinking is not the same as imposing a preference.
- **Respect "skip" for Tier 2 only.** Note the fallback, add the ⚠️ warning,
  move on. For Tier 3 items, skipping is not available.
- **Keep each question block scannable** — readable in under 30 seconds. Let the
  visuals carry the weight; don't duplicate them in prose.
- **Never ask about what hasn't happened yet.** If a question's relevance
  depends on the outcome of a future task, it must be deferred.
- **Present ALL critique items.** Every critique item (problem-framing and
  technology, all severities) is presented to the user. No filtering, no
  auto-acknowledging. The user sees everything and makes every decision.
- **No subagent decision passes through silently.** Every decision made by a
  planning subagent that the developer will encounter during execution must
  have been actively evaluated by the developer during clarification. If the
  system detects a decision that was not surfaced to the developer, it must
  be added to the manifest.
- **The developer's growth matters more than speed.** If a Socratic exchange
  on a Tier 3 question takes several turns, that is working as intended. The
  developer is building the habit of thinking critically about what they build
  and why. Do not rush these interactions to save time.
