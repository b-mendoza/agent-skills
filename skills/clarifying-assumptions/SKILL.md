---
name: "clarifying-assumptions"
description: 'Walk through a Jira task plan and interactively confirm assumptions, resolve open questions, and validate decisions — one question at a time. Use when the user says "review the plan", "ask me questions", "clarify assumptions", "let''s go through the questions", "grill me on the plan", "validate plan for PROJECT-1234", or anything about reviewing, questioning, or validating a task plan. Also triggered by the orchestrating-jira-workflow skill as Phase 3 of the pipeline. Requires a task plan at docs/<TICKET_KEY>-tasks.md.'
---

# Clarifying Assumptions

## Purpose

Act as a structured interviewer that walks the user through every open question,
assumption, and decision in the task plan — one at a time. Three goals:

1. **Resolve ambiguity** so downstream execution is unblocked.
2. **Educate** the user on the agent's reasoning so they can steer confidently.
3. **Build a shared mental model** between agent and user through visual context
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

- A `## Decisions Log` table appended
- Assumptions annotated (`✅ Confirmed` / `❌ Revised: <new text>`)
- Per-task questions resolved (`~~<question>~~ → <answer>`)
- Updated `Implementation notes` where answers changed the approach

### Output contract (consumed by downstream skills)

| Addition                                                | Required by            | Why                                               |
| ------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `## Decisions Log` table                                | creating-jira-subtasks | Subtask descriptions reflect resolved decisions   |
| Annotated assumptions                                   | executing-subtask      | Executor needs confirmed assumptions, not open Qs |
| Resolved per-task questions                             | executing-subtask      | Pre-flight check verifies no unresolved questions |
| Updated `Implementation notes` (where approach changed) | executing-subtask      | Executor follows the updated approach             |

## Subagent Registry

No subagents. This skill runs inline because it is conversational — it needs the
user's full conversation history for multi-turn Q&A. Delegating to a subagent
would lose that context.

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

### Phase 1 — Build and present the question manifest

#### 1a. Read and categorize all items

Read `docs/<TICKET_KEY>-tasks.md` and build the complete list of items needing
user input:

| Category                    | Where to find them                                   |
| --------------------------- | ---------------------------------------------------- |
| **Cross-cutting questions** | `## Cross-Cutting Open Questions` section            |
| **Assumptions**             | `## Assumptions and Constraints` section             |
| **Per-task questions**      | `Questions to answer before starting` in each task   |
| **Per-task assumptions**    | Implicit assumptions in `Implementation notes`       |
| **Dependency risks**        | `Dependencies / prerequisites` that seem uncertain   |
| **Validation warnings**     | `## Validation Report` — any WARN or unresolved FAIL |

#### 1b. Prioritize

Order items so blocking issues surface first:

1. Unresolved FAILs from the validation report (they block execution)
2. Cross-cutting questions (they unblock the most tasks)
3. Assumptions affecting architectural decisions
4. Per-task questions, ordered by task number
5. Validation warnings and low-impact confirmations

#### 1c. Present the manifest

Show the complete, numbered list to the user:

```markdown
## Question Manifest for <TICKET_KEY>

I've analyzed the task plan and found **<N> items** that need your input.
Here's the full list, organized by impact:

| #   | Category           | Short description                 | Affects tasks | Input type     |
| --- | ------------------ | --------------------------------- | ------------- | -------------- |
| 1   | 🔴 Blocking        | Missing API version specification | 3, 5, 7       | Single select  |
| 2   | 🟡 Cross-cutting   | Authentication strategy           | 2, 4, 6       | Single select  |
| 3   | 🔵 Assumption      | Database migration strategy       | 1             | Confirm/revise |
| 4   | ⚪ Task 3 question | Caching layer needed?             | 3             | Yes/No         |

| ...

**Estimated time:** ~<N> minutes (most questions have pre-defined options).

This is the complete list. No surprise questions mid-conversation.
If your answers reveal something new, I'll show you the updated manifest first.
```

Then ask whether the user is ready to start, or wants to reorder, skip, or
add anything. Use interactive selection if available:

```
1. Let's start from the top
2. I want to skip some — let me review
3. I have questions about the manifest first
```

### Phase 2 — Walk through questions one at a time

For each question in the manifest:

#### 2a. Show progress

```
Question <current>/<total> — [<category emoji> <category>]
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

**On an answer that reveals a new question:** Don't ask it now. Say: _"Your
answer raised a new consideration. I'm adding it as Question <N+1>."_ When the
original manifest is done, present the new questions for confirmation first.

### Phase 3 — Update the plan file and summarize

#### 3a. Update `docs/<TICKET_KEY>-tasks.md`

Append a Decisions Log:

```markdown
## Decisions Log

> Recorded on: <YYYY-MM-DD HH:MM UTC>

| #   | Category        | Question (short)         | Decision / Answer       | Impact on plan     |
| --- | --------------- | ------------------------ | ----------------------- | ------------------ |
| 1   | Cross-cutting   | Which API version?       | Use v3 REST API         | Tasks 3, 5 updated |
| 2   | Assumption      | Auth method?             | Confirmed: OAuth2       | No change          |
| 3   | Task 4 question | Error handling strategy? | Return 422 with details | Task 4 updated     |
```

Apply inline updates:

- In `Assumptions and Constraints`: mark each `✅ Confirmed` or `❌ Revised: <new text>`
- In per-task `Questions to answer before starting`: `~~<question>~~ → <answer>`
- Update `Implementation notes` where answers changed the approach

#### 3b. Validate updates

Re-read the file and verify:

- Every manifest question has a Decisions Log entry (resolved, confirmed, revised, or skipped)
- Every assumption in `Assumptions and Constraints` is annotated
- Every per-task question reflects the answer given
- `Implementation notes` are updated where answers changed the approach
- The `## Decisions Log` section exists and is well-formed (downstream skills check for it)

Fix any gaps before presenting the summary.

#### 3c. Final summary

```markdown
## Clarification Complete — <TICKET_KEY>

| Metric                | Count |
| --------------------- | ----- |
| Questions resolved    | <N>   |
| Assumptions confirmed | <N>   |
| Assumptions revised   | <N>   |
| Items skipped         | <N>   |
| New questions added   | <N>   |

**Key changes to the plan:**

- <list material changes, if any>

The task plan at `docs/<TICKET_KEY>-tasks.md` has been updated with all decisions.
```

Then ask what's next:

```
1. Create subtasks in Jira
2. Review the updated plan first
3. I have more questions
```

---

## Behavioral Guardrails

- **One question per message.** Never batch multiple questions in a single turn.
- **The manifest is the source of truth.** Every question comes from it. New
  questions get added to it before being asked.
- **Be a teacher, not an interrogator.** Context should help the user understand
  the problem space, not just answer your question.
- **Respect "skip."** Note the fallback, move on, no pressure.
- **Stay neutral on options.** If you have a recommendation, frame it as "I'd
  lean toward X because..." not "You should do X."
- **Keep each question block scannable** — readable in under 30 seconds. Let the
  visuals carry the weight; don't duplicate them in prose.
