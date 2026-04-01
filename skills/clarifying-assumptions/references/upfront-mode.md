# Upfront Mode — Phase 3 Execution Playbook

Loaded just-in-time when the skill is dispatched with `MODE=upfront`.

---

## 1. Design Thinking Mindset

Before touching a single question, internalize these principles. They govern every interaction in this mode.

**Empathy first.** Every feature exists to serve a human. If we cannot name that human and articulate their need, we are not ready to build. A ticket that says "add endpoint X" is a solution — the question this skill forces is: who suffers without it, and how do we know? If the answer is "I assume someone needs it," that assumption becomes the first thing we challenge.

**Problem before solution.** Jira tickets describe solutions. The developer's job — with this skill's guidance — is to validate that the solution addresses a real, evidenced need before investing implementation effort. This is not bureaucratic friction; it is the difference between building something that ships and something that matters. The critique-analyzer will flag gaps in problem framing. The developer must engage with those gaps, not dismiss them as process overhead.

**No silent acceptance.** Every subagent decision passes through the developer's judgment. The system presents what was decided and why, and the developer must engage — either by generating their own reasoning first (Model A) or by evaluating the subagent's reasoning (Model B). Pass-through is not an option. A developer who clicks "confirm" on every item without thinking has not clarified anything — they have rubber-stamped a plan they do not own. This skill exists to prevent that.

**Teaching over interrogation.** The tone is that of a senior mentor who genuinely wants the developer to grow, not an auditor looking for failures. Be direct about gaps in thinking, but frame challenges as opportunities to sharpen reasoning, not as gotchas. When a Tier 3 answer is shallow, name exactly what is missing and why it matters — but do it the way a trusted colleague would: with candor, not condescension. The goal is that the developer leaves the session having thought more deeply, not having been made to feel small.

These four principles are not aspirational. They are operational constraints. Every prompt, every follow-up, every response evaluation must reflect them. If a question does not serve empathy, problem framing, developer judgment, or growth — it does not belong in this session.

---

## 2. Progressive Disclosure — Full Detail

### Why Progressive Disclosure Matters

Traditional clarification asks all questions upfront. This is wasteful because:

- **Answers depend on earlier tasks.** A question about Task 5's caching strategy is meaningless if Task 2's data model decision changes the entire storage layer. Asking it now produces an answer grounded in assumptions that may not survive execution.
- **Context changes during execution.** The developer learns things while building. Code reveals constraints that no amount of upfront analysis can surface. Questions asked before that learning are answered with less information than questions asked after it.
- **Users waste time on irrelevant questions.** If Task 4 gets descoped or reordered, every question the user answered about Task 4 was wasted effort. Multiply this across a 10-task plan and the cognitive tax is significant.
- **Questions become irrelevant as the codebase evolves.** A question about "should we use pattern X or Y?" may resolve itself when the developer discovers during Task 2 that the codebase already uses pattern X extensively. Deferral lets reality answer questions that speculation cannot.

### What Upfront Mode Asks

Upfront mode asks only the items that must be resolved before any execution can begin. Everything else is deferred to critique mode (Phase 6), where it will be asked with the benefit of execution context.

1. **Problem-framing critique items.** The critique-analyzer evaluates four dimensions of problem framing: end user, underlying need, solution-problem fit, and evidence basis. HIGH-severity items are Tier 3 hard gates — the developer must articulate their own answer before seeing the critique-analyzer's analysis (Model A Socratic). This is non-negotiable: if the developer cannot name who benefits and why, they are not ready to build. MEDIUM and LOW items use Model B (evaluate-the-reasoning) — the analysis is presented, and the developer evaluates whether it holds.

2. **Critique items.** Technology choices, architectural defaults, and implementation approaches that show signs of bias, unjustified defaults, or unexplored alternatives. All severities use Model B — the critique-analyzer presents its counter-analysis, trade-off comparison, and any web search findings. The developer evaluates whether the original reasoning holds or an alternative is stronger. These cover framework selection, library choices, API design patterns, and any decision where the planner may have defaulted to familiarity over fitness.

3. **Cross-cutting questions.** Questions that affect the entire plan and block planning execution. These are questions where the answer changes how multiple tasks are approached — authentication strategy, error handling philosophy, API versioning approach. They cannot be deferred because every task downstream depends on the answer. Must resolve before any task begins.

4. **Assumptions that affect architecture.** Assumptions baked into the plan that, if wrong, would require reworking completed tasks. These are confirmed or revised now because changing them later means throwing away work. Examples: "the database supports transactions," "the API is RESTful," "authentication is handled by an upstream service." If any of these are wrong, every task built on them is built on sand.

5. **Validation report FAILs.** Items from the planning-jira-tasks validation report that received a FAIL status. These block execution entirely — they represent structural problems in the plan (missing required sections, circular dependencies, unresolvable conflicts). They must be addressed before any task can start.

6. **Questions for Task 1 only.** Since Task 1 executes first, its per-task questions are relevant now. The developer will have the answers fresh in mind when execution begins immediately after clarification. These include Task 1's assumptions, open questions, and any critique items specific to Task 1's approach.

### Deferral Rule

Do NOT ask per-task questions for Tasks 2+. Tag them as `[DEFERRED — will ask before Task N execution]`. They will be reviewed during critique mode (Phase 6) when their task comes up, and any that became irrelevant due to earlier decisions or code changes will be discarded at that point.

---

## 3. Phase 1 — Dispatch critique-analyzer and Build Manifest

### 1a. Dispatch critique-analyzer

Read `./subagents/critique-analyzer.md` to understand its input/output contract.

Dispatch the critique-analyzer with:
- `MODE=upfront`
- `TICKET_KEY=<TICKET_KEY>`
- `ARTIFACTS` list:
  - `docs/<TICKET_KEY>-tasks.md` (the task plan)
  - `docs/<TICKET_KEY>-stage-1-detailed.md` (detailed planning intermediate)
  - `docs/<TICKET_KEY>-stage-2-prioritized.md` (prioritized planning intermediate)

Collect the output as `CRITIQUE_REPORT`. This report contains categorized critique items, each with a severity (HIGH/MEDIUM/LOW), a category, affected tasks, and the critique-analyzer's analysis including counter-arguments, trade-off tables, and web search findings where applicable.

If the dispatch fails, report the failure to the user and stop. Do not proceed without the critique report — the manifest depends on it.

### 1b. Read and Categorize All Items

Combine items from the `CRITIQUE_REPORT` with items extracted from the task plan file (`docs/<TICKET_KEY>-tasks.md`). Categorize every item into exactly one row of this table:

| Category                           | Where to find them                               | Tier | Model |
| ---------------------------------- | ------------------------------------------------ | ---- | ----- |
| Problem-framing critique (HIGH)    | CRITIQUE_REPORT → problem_framing, severity=HIGH | 3    | A     |
| Problem-framing critique (MEDIUM)  | CRITIQUE_REPORT → problem_framing, severity=MED  | 2    | B     |
| Problem-framing critique (LOW)     | CRITIQUE_REPORT → problem_framing, severity=LOW  | 2    | B     |
| Technology critique (HIGH)         | CRITIQUE_REPORT → technology, severity=HIGH       | 2    | B     |
| Technology critique (MEDIUM)       | CRITIQUE_REPORT → technology, severity=MED        | 2    | B     |
| Technology critique (LOW)          | CRITIQUE_REPORT → technology, severity=LOW        | 2    | B     |
| Validation FAILs                   | Task plan → `## Validation Report`, status=FAIL  | 2    | B     |
| Cross-cutting questions            | Task plan → `## Cross-Cutting Open Questions`    | 2    | B     |
| Architectural assumptions          | Task plan → `## Assumptions and Constraints`     | 2    | B     |
| Task 1 questions                   | Task plan → Task 1 subsection → open questions   | 2    | B     |
| Task 2+ questions (DEFERRED)       | Task plan → Task 2+ subsections → open questions | —    | —     |
| Task 2+ assumptions (DEFERRED)     | Task plan → Task 2+ subsections → assumptions    | —    | —     |
| Dependency risks                   | Task plan → `## Dependency Graph` + CRITIQUE     | 2    | B     |
| Validation warnings                | Task plan → `## Validation Report`, status=WARN  | 2    | B     |

Every item must land in exactly one row. If an item could fit multiple categories, use the highest-severity match. Deferred items are tracked but not asked during this session.

### 1c. Prioritize Items

Order the non-deferred items by this priority (highest first):

1. Problem-framing HIGH (Tier 3, Model A) — hard gate, must resolve first
2. Problem-framing MEDIUM (Tier 2, Model B)
3. Problem-framing LOW (Tier 2, Model B)
4. Validation FAILs (Tier 2, Model B) — block execution
5. Technology critique HIGH (Tier 2, Model B)
6. Technology critique MEDIUM (Tier 2, Model B)
7. Architectural assumptions (Tier 2, Model B)
8. Cross-cutting questions (Tier 2, Model B)
9. Task 1 questions (Tier 2, Model B)
10. Dependency risks (Tier 2, Model B)
11. Cross-cutting validation warnings (Tier 2, Model B)

This order ensures that fundamental problem-framing questions are resolved before any technology or implementation questions, since the answers to "who is this for?" and "what problem does it solve?" may change whether the technology questions are even relevant.

### 1d. Present the Manifest

Present the manifest to the user in this format:

```
## Question Manifest — <TICKET_KEY>

**<N> questions for now** · <M> deferred to task execution

### Questions for now

| #  | Category                  | Short description              | Affects tasks | Model | Skippable |
| -- | ------------------------- | ------------------------------ | ------------- | ----- | --------- |
| 1  | 🔴 Problem framing (HIGH) | End user not identified        | All           | A     | No        |
| 2  | 🔴 Problem framing (HIGH) | No evidence basis stated       | All           | A     | No        |
| 3  | 🟡 Technology (MEDIUM)    | ORM choice vs query builder    | 2, 4, 6       | B     | Yes       |
| …  | …                         | …                              | …             | …     | …         |

### Deferred questions

| #  | Category         | Short description              | Deferred to   |
| -- | ---------------- | ------------------------------ | ------------- |
| 1  | Task 3 question  | Cache invalidation strategy    | Before Task 3 |
| 2  | Task 5 assumption| External API rate limit known  | Before Task 5 |
| …  | …                | …                              | …             |

⏱️ Estimated time: ~<X> minutes (<Y> questions × ~<Z> min each)

No surprise questions — this is everything. Questions deferred to task execution
will be asked before each task starts, and any that became irrelevant will be
discarded at that point.
```

After presenting the manifest, ask: **"Ready to start? I'll walk through these one at a time."**

Wait for the user's confirmation before proceeding to Phase 2.

---

## 4. Phase 2 — Walk Through Questions One at a Time

### 2a. Show Progress

At the top of each question, show a progress indicator:

```
Question <current>/<total> — [<category emoji> <category>]
```

Examples:
- `Question 1/8 — [🔴 Problem framing (HIGH)]`
- `Question 4/8 — [🟡 Technology critique (MEDIUM)]`
- `Question 7/8 — [🔵 Task 1 question]`

### 2b. Provide Context and Ask (Using the Correct Model)

**For Tier 3 hard-gate items (Model A — Socratic):**

Follow this 5-step protocol exactly:

1. **Frame the challenge.** Explain which problem-framing dimension this question addresses (end user, underlying need, solution-problem fit, or evidence basis). Explain WHY it matters in concrete terms for THIS ticket — not abstract principles, but what goes wrong if this is unresolved for this specific feature. Ground the framing in the ticket's domain.

2. **Ask the developer to answer in their own words.** Do NOT show the critique-analyzer's analysis yet. The prompt must be open-ended — do not offer options, do not hint at the "right" answer. The developer must generate reasoning, not select from a menu.

3. **Evaluate the developer's response.** If the response is shallow, vague, or restates the ticket's solution as the problem, push back directly. Name specifically what is missing: "You described what the code will do, not who benefits from it." "You named a user role, but not what they are trying to accomplish." Be direct but constructive — the goal is sharper thinking, not embarrassment. If the response is substantive, acknowledge what is strong about it before proceeding.

4. **Reveal the critique-analyzer's analysis.** Show what the critique-analyzer found, including the gap it identified, the concrete risk it named, and any evidence it gathered. Frame the reveal as additional input, not as the "correct answer" — the developer's reasoning and the subagent's analysis are both inputs to the final decision.

5. **Ask for the final decision.** With both perspectives on the table, ask the developer to make a final call. Record the decision and the reasoning behind it.

**Tier 3 items cannot be skipped.** If the developer attempts to skip a Tier 3 item, respond:

> "This is a Tier 3 hard-gate question — it addresses a fundamental gap in problem framing that affects every downstream task. Skipping it means building on an unvalidated foundation. Let's work through it."

**For Tier 2 items (Model B — evaluate-the-reasoning):**

Follow this 4-step protocol:

1. **Present the decision and reasoning.** Show what the planner decided and why — the original reasoning from the task plan or planning artifacts.

2. **Present the critique.** Show the critique-analyzer's counter-analysis: what alternatives exist, what trade-offs the planner may not have considered, and any web search findings or codebase evidence that supports or undermines the original decision. Use trade-off tables where appropriate.

3. **Ask the developer to evaluate.** Not a yes/no question — the developer must articulate their evaluation. "Does the original reasoning hold up? Why or why not?" If the developer's response is a bare "yes" or "looks fine," push for substance: "What about the critique-analyzer's point on [X]? Does that change your assessment?"

4. **Record the decision with rationale.** Capture what was decided and the developer's reasoning.

Skip handling for Tier 2: if the developer chooses to skip, record the skip with the planner's original default as the fallback and add this warning:

> ⚠️ Skipped — using planner's default. This decision was not evaluated by the developer. If issues arise during execution, revisit this item.

**For non-critique items** (cross-cutting questions, architectural assumptions, validation items, Task 1 questions): use the Model B flow. Present the item with context, ask the developer to evaluate or confirm, and record the decision.

### 2c. Ask Using Best Available Input Method

Match the input method to the question type:

- **Tier 3 (Model A):** Use open-ended text input for the initial question — not selection widgets. The developer must generate reasoning from scratch. Selection widgets are only appropriate for the final decision step after both perspectives are on the table.

- **Tier 2 critique items:** Present the 4 standard options:
  1. `✅ Keep current approach` — agrees with the planner's decision
  2. `🔄 Switch to <alternative>` — one option per alternative the critic named
  3. `🔍 I need more information` — wants to investigate further before deciding
  4. `⏭️ Acknowledge but proceed` — sees the concern, consciously proceeds (logged as override)

- **Non-critique Tier 2 items:** Use standard options appropriate to the item type:
  - For assumptions: `✅ Confirm` / `✏️ Revise` / `⏭️ Skip`
  - For questions: free-text answer / `⏭️ Skip`
  - For validation items: `✅ Resolved` / `🔄 Action needed`

Detect whether an interactive selection tool is available (`AskUserQuestion`, `ask_user_input`, or equivalent). If one exists, use it for every discrete choice. If none is available, present numbered options and ask the user to reply with a number.

### 2d. Record the Answer

After each answer, record the decision. Handle each response type as follows:

**On "keep current approach":**
Record the planner's original decision as confirmed. Log: `Decision: Keep — <short description>. Rationale: <developer's reasoning>`. No downstream changes needed.

**On "switch to alternative":**
Record the switch. Log: `Decision: Switch to <alternative> — <short description>. Rationale: <developer's reasoning>`. Set `RE_PLAN_NEEDED=true`. The orchestrator will trigger a re-plan cycle after this session to update affected tasks.

**On "acknowledge but proceed":**
Record as an override. Log: `Decision: Override — <short description>. Developer acknowledged <critique summary> but chose to proceed. Rationale: <developer's reasoning>`. Do NOT set `RE_PLAN_NEEDED` — the developer consciously accepted the risk.

**On "I need more information":**
Pause the question. Ask the developer what additional information they need. If the information can be gathered (web search, codebase inspection), attempt to gather it. If it requires external input (asking a stakeholder, checking a third-party API), tag the question as `[BLOCKED — waiting for <information>]` and move to the next question. Return to it at the end if the information becomes available.

**On "skip" (Tier 2 only):**
Record the skip with the planner's default as the fallback. Log: `Decision: Skipped — using planner's default (<default>). Not evaluated by developer.` Add the ⚠️ warning to the manifest entry.

**On attempted skip of Tier 3:**
Refuse. Respond with:

> "This is a Tier 3 hard-gate question — it addresses a fundamental gap in problem framing that affects every downstream task. Skipping it means building on an unvalidated foundation. Let's work through it."

Do not record a skip. Re-present the question.

**On new question for CURRENT task (or cross-cutting):**
Add the question to the manifest immediately, at the end of the current priority group. It will be asked in sequence after the remaining questions in its group. Log: `Added to manifest: <short description> (from discussion on Q<N>)`.

**On new question for FUTURE task:**
Defer the question. Tag it as `[DEFERRED — will ask before Task <N> execution]`. Add it to the deferred section of the manifest. Log: `Deferred: <short description> → Task <N>`.

---

## 5. Phase 3 — Delegate File Updates and Summarize

### 3a. Dispatch decision-recorder

Read `./subagents/decision-recorder.md` to understand its input/output contract.

Dispatch the decision-recorder with:
- `TICKET_KEY=<TICKET_KEY>`
- `MODE=upfront`
- `DECISIONS` — the list of all resolved decisions from Phase 2
- `DEFERRED_QUESTIONS` — the list of all deferred questions with their target tasks
- `IMPLEMENTATION_UPDATES` — any changes to implementation notes triggered by "switch" decisions

The decision-recorder handles:
- Appending the `## Decisions Log` table to `docs/<TICKET_KEY>-tasks.md`
- Annotating assumptions with `✅ Confirmed` or `❌ Revised` status
- Striking through resolved per-task questions and appending the answer
- Updating `Implementation notes` sections where the approach changed
- Tagging deferred questions with `[DEFERRED — will ask before Task N execution]`
- Recording override decisions with their rationale and the ⚠️ warning
- Validating that all non-skipped, non-deferred items have a recorded decision

### 3b. Handle the Result

If the decision-recorder returns `PASS`: all file updates applied successfully. Proceed to the summary.

If the decision-recorder returns `WARN`: note the warnings (e.g., a section was missing and was created, or a formatting issue was auto-corrected). Do not block — present the warnings in the summary but proceed.

If the decision-recorder returns `FAIL`: report the failure to the user. Show which file updates failed and why. Ask the user how to proceed (retry, manual fix, or skip the failed updates).

### 3c. Final Summary

Present the session summary to the user:

```
## Clarification Complete — <TICKET_KEY> (Upfront)

| Metric                    | Value                                  |
| ------------------------- | -------------------------------------- |
| Questions resolved        | <N>                                    |
| Questions skipped         | <N> (⚠️ using planner defaults)        |
| Questions blocked         | <N> (waiting for external input)       |
| Questions deferred        | <N> (to task execution)                |
| Decisions changing plan   | <N> (triggers re-plan)                 |
| Overrides (acknowledged)  | <N>                                    |

### Problem Framing Status

| Dimension          | Status             | Summary                              |
| ------------------ | ------------------ | ------------------------------------ |
| End user           | ✅ Identified       | Enterprise admins with SSO lockouts  |
| Underlying need    | ✅ Articulated      | Regain access without IT support     |
| Solution-problem fit| ✅ Validated        | Password reset addresses the need    |
| Evidence basis     | ⚠️ Partial          | No usage data; based on support tickets |

### Key Changes

- <bullet list of "switch" decisions and their impact>
- <bullet list of overrides with rationale>

### Deferred Questions

<N> questions deferred to task execution. They will be asked before each
task starts, and any that became irrelevant will be discarded.

See `docs/<TICKET_KEY>-tasks.md` → Decisions Log for the full record.
```

If `RE_PLAN_NEEDED` is true, add:

> **Re-plan triggered.** <N> decision(s) changed the implementation approach. The orchestrator will run a re-plan cycle (Phase 2) to update affected tasks before execution begins.

Then present the "What's next?" options:

1. **Create subtasks** — proceed to creating Jira subtasks from the updated plan
2. **Review the updated plan** — read through `docs/<TICKET_KEY>-tasks.md` to verify changes
3. **Ask more questions** — add questions that came to mind during the session

### Upfront Mode Output

The same task plan file at `docs/<TICKET_KEY>-tasks.md`, updated in-place, with:

- A **Decisions Log** table appended — each row records the question #, category, decision, rationale, and affected tasks
- **Assumptions annotated** — each assumption now shows `✅ Confirmed` or `❌ Revised` with a note explaining the revision
- **Per-task questions resolved** — answered questions are struck through with the answer appended; unanswered questions retain their original text
- **Updated Implementation notes** — where a "switch" decision changed the approach, the implementation notes reflect the new approach
- **Deferred questions tagged** — questions for Tasks 2+ are tagged with `[DEFERRED — will ask before Task N execution]` so the orchestrator knows to invoke critique mode before each task

---

## 6. Model A Socratic Exchange Example

```
<example>
Model A Socratic exchange — Problem Framing (End User):

Question 3/8 — [🔴 Problem framing (HIGH)]

"The task plan says this feature is for 'our customers,' but different customer
segments have different needs. If we build for the wrong segment, the feature
might solve a problem nobody has.

Who specifically will use this feature? Describe the user and what they are
trying to accomplish."

Developer: "It's for users who need to reset their password."

"Your answer describes what the code will do, not who the user is. A password
reset endpoint is a solution — the need is that users currently cannot regain
access without contacting support. Who are these users? Are they consumers,
enterprise admins, API integrators? Each has different needs."

Developer: "Enterprise admins who manage team accounts. They get locked out
when SSO tokens expire and need to regain access quickly without IT support."

"That's specific. The critique-analyzer found: the ticket mentions no user
segment, and the Problem Framing section says 'Not stated in ticket' for
end user. Your answer identifies enterprise admins with SSO-related lockouts.

Final decision: record 'Enterprise admins with SSO-related lockouts' as the
identified end user?"

Developer: "Yes."

Recorded. This informs all downstream tasks.
</example>
```
