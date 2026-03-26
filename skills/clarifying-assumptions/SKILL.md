---
name: "clarifying-assumptions"
description: 'Walk through a Jira task plan and interactively ask the user to confirm assumptions, resolve open questions, and validate decisions. Use when the user says "review the plan", "ask me questions", "clarify assumptions", "let''s go through the questions", "grill me on the plan", or "validate plan for PROJECT-1234". Also triggered by the orchestrating-jira-workflow skill as Phase 3 of the end-to-end pipeline. Requires that a task plan exists at docs/<TICKET_KEY>-tasks.md. This skill is conversational — it asks ONE question at a time and waits for a response before continuing.'
---

# Clarifying Assumptions

## Purpose

Act as a structured interviewer that walks the user through every open question,
assumption, and decision in the task plan — one at a time. This serves three
goals:

1. **Resolve ambiguity** so downstream execution is unblocked.
2. **Educate the user** on the agent's reasoning so they build understanding of
   the implementation approach and can steer it confidently.
3. **Create a shared mental model** between the agent and user using visual aids
   and interactive prompts.

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

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run the **planning-jira-tasks** skill first.

### Input contract (produced by upstream skill)

The input file `docs/<TICKET_KEY>-tasks.md` must contain these sections
(produced by the `planning-jira-tasks` skill). If any are missing, the plan
was not generated correctly — stop and ask the user to re-run planning.

| Required section                     | Used in phase            | Why                                          |
| ------------------------------------ | ------------------------ | -------------------------------------------- |
| `## Assumptions and Constraints`     | Phase 1 (manifest)       | Items to present for user confirmation       |
| `## Cross-Cutting Open Questions`    | Phase 1 (manifest)       | High-impact questions that affect many tasks |
| `## Tasks` with per-task subsections | Phase 1 (manifest)       | Per-task questions and implicit assumptions  |
| `## Validation Report`               | Phase 1 (manifest)       | WARN/FAIL items become clarification Qs      |
| `## Dependency Graph`                | Phase 2 (visual context) | Impact maps for dependency questions         |

## Output

- The same task plan file at `docs/<TICKET_KEY>-tasks.md`, updated in-place.
- A `## Decisions Log` section appended to the plan file.

### Output contract (consumed by downstream skills)

After this skill completes, the plan file must contain these additions for
downstream skills to function correctly:

| Addition                                                        | Required by            | Why                                               |
| --------------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `## Decisions Log` table                                        | creating-jira-subtasks | Subtask descriptions reflect resolved decisions   |
| Assumptions annotated (`✅ Confirmed` / `❌ Revised`)           | executing-subtask      | Executor needs confirmed assumptions, not open Qs |
| Per-task questions resolved (strikethrough + answer)            | executing-subtask      | Pre-flight check verifies no unresolved questions |
| Updated `Implementation notes` (where answers changed approach) | executing-subtask      | Executor follows the updated approach             |

## Subagent Registry

This skill has no subagents. It runs entirely inline because it is
conversational — it requires the user's full conversation history to function
(multi-turn Q&A with interactive prompts). Delegating to a subagent would lose
the conversation context.

---

## Core Principles

These three principles shape every interaction in this skill. They're ordered by
impact — if you remember nothing else, remember these.

### 1. Build the complete question manifest before asking anything

Before the first question, read the entire task plan, extract every item that
needs user input, and present the full numbered list. The user should see
everything upfront so there are no surprises.

If an answer reveals a new question, don't ask it on the spot. Say: _"Your
answer raised a new consideration. I'll add it as Question N+1 at the end."_
Update the manifest and show the addition before asking the new question.

The manifest is a contract. The user knows exactly how many questions remain and
what's coming. This predictability matters — ad hoc questions lead to drift and
frustration.

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

## Execution Phases

This skill runs in three distinct phases. Each phase must complete before the
next begins.

### Phase 1 — Build and present the question manifest

#### 1a. Read and inventory all items

Read `docs/<TICKET_KEY>-tasks.md` and build an internal list of every item that
needs user input. Categorize them:

| Category                    | Where to find them                                   |
| --------------------------- | ---------------------------------------------------- |
| **Cross-cutting questions** | `## Cross-Cutting Open Questions` section            |
| **Assumptions**             | `## Assumptions and Constraints` section             |
| **Per-task questions**      | `Questions to answer before starting` in each task   |
| **Per-task assumptions**    | Implicit assumptions in `Implementation notes`       |
| **Dependency risks**        | `Dependencies / prerequisites` that seem uncertain   |
| **Validation warnings**     | `## Validation Report` — any WARN or unresolved FAIL |

#### 1b. Prioritize the list

Order items so that:

1. Unresolved FAILs from the validation report come first (they block execution).
2. Cross-cutting questions come next (they unblock the most tasks).
3. Assumptions that affect architectural decisions come next.
4. Per-task questions follow, ordered by task number.
5. Validation warnings and low-impact confirmations come last.

#### 1c. Present the question manifest

Present the COMPLETE manifest to the user using this format:

````markdown
## Question Manifest for <TICKET_KEY>

I've analyzed the task plan and identified **<N> items** that need your input
before we can proceed with implementation. Here's the full list, organized by
impact:

```mermaid
pie title Questions by Category
    "Blocking issues" : <N>
    "Cross-cutting questions" : <N>
    "Assumptions to confirm" : <N>
    "Per-task questions" : <N>
    "Validation warnings" : <N>
```

| #   | Category           | Short description                 | Affects tasks | Input type     |
| --- | ------------------ | --------------------------------- | ------------- | -------------- |
| 1   | 🔴 Blocking        | Missing API version specification | 3, 5, 7       | Single select  |
| 2   | 🟡 Cross-cutting   | Authentication strategy           | 2, 4, 6       | Single select  |
| 3   | 🟡 Cross-cutting   | Error response format             | All           | Single select  |
| 4   | 🔵 Assumption      | Database migration strategy       | 1             | Confirm/revise |
| 5   | 🔵 Assumption      | Test coverage target              | All           | Single select  |
| 6   | ⚪ Task 3 question | Caching layer needed?             | 3             | Yes/No         |
| 7   | ⚪ Task 5 question | Retry policy for external API     | 5             | Single select  |
| 8   | ⚪ Validation warn | Task 6 DoD is vague               | 6             | Free text      |

**Estimated time:** ~<N> minutes (most questions have pre-defined options).

This is the complete list. I won't add surprise questions mid-conversation.
If your answers reveal something new, I'll show you the updated manifest
before asking any new questions.
````

Then ask the user to confirm they're ready to proceed, or if they want to
reorder, skip, or add anything before starting.

Use an interactive prompt:

```
- "Let's start from the top"
- "I want to skip some — let me review"
- "I have questions about the manifest first"
```

### Phase 2 — Walk through questions one at a time

For each question in the manifest, follow this exact sequence:

#### 2a. Show progress

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Question <current>/<total> — [<category emoji> <category>]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 2b. Provide visual context (MANDATORY — Rule 2)

Before asking the question, show at least one visual element that illustrates
the context. Choose the most appropriate visual type based on what the question
is about.

Include:

- **What this relates to:** 1–2 sentences on WHERE in the plan this came from.
- **Visual:** Diagram, table, code snippet, or impact map.
- **Why this matters:** 1–2 sentences on what changes downstream.

#### 2c. Ask using interactive tools (MANDATORY — Rule 1)

Present the options using the appropriate interactive tool. NEVER fall back to
"type A, B, or C" when a selection widget is available.

For questions with discrete options:

- Use single-select or multi-select interactive prompts.
- Always include a brief label for each option (no long descriptions in the
  selection widget — those go in the visual context above).
- If "Other / custom answer" is a valid choice, include it as the last option
  in the interactive prompt. If selected, follow up with a free-text prompt.

For confirmation questions (assumptions):

- Use a single-select with: "✅ Confirm as-is", "❌ Revise", "⏭️ Skip"

For free-text questions:

- Ask in plain text, but still provide the visual context first.

#### 2d. Record the answer

After the user responds:

1. **Acknowledge** their answer in one sentence.
2. **State downstream implications** if the answer changes anything — e.g.,
   "This means Task 3's implementation notes will shift from REST to GraphQL."
3. **Move to the next question.** Do NOT elaborate or re-ask.

**On "skip":**

- Record as unresolved with the fallback assumption.
- Move on without pressure.

**On "revise" (for assumptions):**

- Follow up with a plain text prompt: "What should the revised assumption be?"
- Record the new assumption.

**On an answer that reveals a NEW question:**

- Do NOT ask it now.
- Say: "Your answer raised a new consideration. I'm adding it as Question
  <N+1> to the manifest. You'll see it after we finish the current list."
- When the original manifest is exhausted, present the updated manifest section
  showing only the new questions, and get confirmation before proceeding.

### Phase 3 — Update the plan file and summarize

#### 3a. Update `docs/<TICKET_KEY>-tasks.md`

**Append a Decisions Log:**

```markdown
## Decisions Log

> Recorded on: <YYYY-MM-DD HH:MM UTC>

| #   | Category        | Question (short)         | Decision / Answer       | Impact on plan     |
| --- | --------------- | ------------------------ | ----------------------- | ------------------ |
| 1   | Cross-cutting   | Which API version?       | Use v3 REST API         | Tasks 3, 5 updated |
| 2   | Assumption      | Auth method?             | Confirmed: OAuth2       | No change          |
| 3   | Task 4 question | Error handling strategy? | Return 422 with details | Task 4 updated     |
```

**Inline updates:**

- In `Assumptions and Constraints`, mark each as
  `✅ Confirmed` or `❌ Revised: <new assumption>`.
- In each task's `Questions to answer before starting`, replace the question
  with the answer: `~~<question>~~ → <answer>`.
- Update `Implementation notes` if the answer changes the approach.

#### 3b. Validate updates

After modifying the plan file, re-read it and verify:

- [ ] Every question from the manifest has a corresponding entry in the
      Decisions Log (either resolved, confirmed, revised, or skipped).
- [ ] Every assumption in `Assumptions and Constraints` is annotated
      (confirmed, revised, or left untouched if not in scope).
- [ ] Every per-task `Questions to answer before starting` section reflects
      the answers given (strikethrough + answer, or marked as skipped).
- [ ] `Implementation notes` sections are updated where answers changed the
      approach.
- [ ] The `## Decisions Log` section exists and is well-formed (downstream
      skills check for its presence as a phase-completion signal).

If any updates are missing, apply them before presenting the summary.

#### 3c. Final summary

Present a visual summary:

````markdown
## Clarification Complete — <TICKET_KEY>

```mermaid
pie title Resolution Status
    "Resolved" : <N>
    "Confirmed" : <N>
    "Revised" : <N>
    "Skipped (using fallback)" : <N>
```

| Metric                | Count |
| --------------------- | ----- |
| Questions resolved    | <N>   |
| Assumptions confirmed | <N>   |
| Assumptions revised   | <N>   |
| Items skipped         | <N>   |
| New questions added   | <N>   |

**Key changes to the plan:**

- <bullet list of material changes, if any>

The task plan at `docs/<TICKET_KEY>-tasks.md` has been updated with all
decisions.
````

Then use an interactive prompt:

```
- "Create subtasks in Jira"
- "Review the updated plan first"
- "I have more questions"
```

---

## Behavioral Rules

- **ONE question at a time.** Never ask two questions in a single message.
- **NEVER generate questions ad hoc.** Every question comes from the manifest.
  If new questions surface, update the manifest first.
- **ALWAYS use interactive tools** for discrete choices. Plain text is only for
  free-form answers where options can't be predefined.
- **ALWAYS include a visual** (diagram, table, code snippet, or impact map) with
  every question. No exceptions.
- **Be a teacher, not an interrogator.** Visuals and context should help the user
  understand the problem space, not just answer your question.
- **Respect "skip".** Don't pressure. Note the fallback and move on.
- **Stay neutral.** Present options fairly. If you have a recommendation, state
  it as "I'd lean toward X because..." not "You should do X."
- **Keep it concise.** Each question block should be readable in under 30
  seconds. The visuals do the heavy lifting — don't duplicate them in prose.
- **Track progress.** Always show `Question <current>/<total>` so the user knows
  how far along they are.
- **No surprises.** The manifest is the contract. Follow it.
