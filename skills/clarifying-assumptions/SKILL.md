---
name: "clarifying-assumptions"
description: "Phase 3 (upfront) and Phase 6 (critique) of the orchestrating-jira-workflow pipeline. Walks through a Jira task plan and interactively confirms assumptions, resolves open questions, critiques planning outputs for bias, and challenges problem framing through a Design Thinking lens — using progressive disclosure. Operates as a mentorship engine that teaches developers to think critically about what they build and why. In upfront mode (Phase 3), challenges problem framing and critiques the task plan. In critique mode (Phase 6), critiques per-task planning artifacts and resolves deferred questions. Not intended for standalone use — requires upstream artifacts from Phases 1-2 (upfront) or Phase 5 (critique)."
---

# Clarifying Assumptions

## Purpose

1. **Challenge problem framing** — question whether the ticket solves the right problem for the right user, with sufficient evidence.
2. **Resolve ambiguity** — unblock downstream execution with concrete answers.
3. **Challenge bias** — surface unjustified defaults, unexplored alternatives, and unacknowledged trade-offs in planning outputs.
4. **Develop critical thinking** — make the developer articulate reasoning before revealing subagent analysis. Multi-turn depth is intentional, not overhead.
5. **Avoid premature questions** — defer anything that depends on tasks not yet reached.

## Two Questioning Models

**Model A — Socratic (generate-then-compare).** Used for Tier 3 hard-gate questions (problem-framing fundamentals). The developer answers first, without seeing the subagent's analysis. Flow:
1. Present the question with context on why it matters.
2. Ask the developer to answer in their own words.
3. After the developer responds, reveal the critique-analyzer's analysis.
4. Compare — if the developer's reasoning was shallow, name what was missing and why it matters.
5. Ask for a final decision informed by both perspectives.

**Model B — Evaluate-the-reasoning.** Used for Tier 2 items (technology choices, assumptions, deferred questions). The system presents the decision, reasoning, and critique together. Flow:
1. Present the decision, the subagent's reasoning, and the critique.
2. Ask the developer: does the original reasoning hold up? Why or why not?
3. Record the decision with the developer's rationale.

## Progressive Disclosure — The Two-Mode Model

Traditional clarification asks all questions upfront. This is wasteful because:
- Answers to later questions often depend on what happens during earlier tasks.
- Context gained during execution changes the relevance of questions.
- Users waste time answering questions about tasks that may not even happen.
- Some questions become irrelevant as the codebase evolves through execution.

### Upfront Mode — Phase 3

During the initial clarification phase, ask only:
1. **Problem-framing critique items** — challenges to end user, underlying need, solution-problem fit, evidence basis (HIGH = Tier 3 Model A; MEDIUM/LOW = Tier 2 Model B).
2. **Critique items** — decisions showing signs of bias, unjustified defaults, or unexplored alternatives (all severities, Model B).
3. **Cross-cutting questions** — questions that affect the entire plan and block planning.
4. **Architectural assumptions** — changing them later would require reworking completed tasks.
5. **Validation report FAILs** — these block execution entirely.
6. **Task 1 questions only** — since Task 1 executes first, its per-task questions are relevant now.

Do NOT ask per-task questions for Tasks 2+ during Phase 3. Tag as `[DEFERRED — will ask before Task N execution]`.

### Critique Mode — Phase 6

Before each task execution, this skill:
1. **Dispatches the `critique-analyzer`** to review per-task planning artifacts for framework bias, unjustified defaults, and unexplored alternatives.
2. **Resolves deferred questions** for the specific task — reviewing whether any became irrelevant due to earlier decisions or code changes.
3. **Records all decisions** in a per-task decisions file (`docs/<KEY>-task-<N>-decisions.md`) with a reference in the main `## Decisions Log`.

Full execution details for each mode are in the reference files below.

## How This Skill Works

This skill does three things: **dispatch** the `critique-analyzer` subagent for evidence-based critique, **walk the user** through each question one at a time using the appropriate questioning model (Model A Socratic or Model B evaluate-the-reasoning), and **dispatch** the `decision-recorder` subagent to apply all resolved decisions to the plan file.

The critique analysis runs as a subagent because it requires web search, codebase inspection, and artifact reading — separable concerns that would pollute the skill's context. The Q&A loop runs inline because it requires the user's full conversation history for multi-turn interaction.

The `critique-analyzer`'s report and the `decision-recorder`'s validation summary are the only subagent data this skill processes. If either reports a failure, relay it to the user. If both succeed, report the session summary.

## Inputs

| Input         | Source       | Required | Example                                 |
| ------------- | ------------ | -------- | --------------------------------------- |
| `TICKET_KEY`  | Orchestrator | Yes      | `JNS-6065`                              |
| `MODE`        | Orchestrator | Yes      | `upfront` or `critique`                 |
| `TASK_NUMBER` | Orchestrator | Conditional | `3` (required for `critique` mode)      |
| `ITERATION`   | Orchestrator | No       | `1`, `2`, or `3` (for re-plan tracking) |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md` (if not, run **planning-jira-tasks** first). For `critique` mode, per-task artifacts must also exist: `docs/<KEY>-task-<N>-brief.md`, `-execution-plan.md`, `-test-spec.md`, `-refactoring-plan.md` (if not, run **planning-jira-task** first).

### Input Contract

**For upfront mode**, the input file must contain these sections (produced by `planning-jira-tasks`):

| Required section                     | Used for                                         |
| ------------------------------------ | ------------------------------------------------ |
| `## Problem Framing`                 | Tier 3 hard-gate questions (Design Thinking)     |
| `## Assumptions and Constraints`     | Items to present for user confirmation           |
| `## Cross-Cutting Open Questions`    | High-impact questions that affect multiple tasks |
| `## Tasks` with per-task subsections | Per-task questions and implicit assumptions      |
| `## Validation Report`               | WARN/FAIL items become clarification questions   |
| `## Dependency Graph`                | Impact maps for dependency-related questions     |

The `critique-analyzer` also reads planning intermediates (`docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md`) for upfront mode, and per-task artifacts for critique mode.

### Output Contract

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

Before dispatching, read the subagent file to understand its input/output contract. The path is relative to this skill's directory.

## Core Principles

### 1. Ask only what is relevant NOW
In `upfront` mode: ask critique items, cross-cutting questions, architectural assumptions, validation failures, and Task 1 questions only — tag everything else as deferred. In `critique` mode: ask critique items for the specific task's artifacts, plus deferred questions — discard those no longer relevant.
If an answer reveals a new question about a future task, tag it as deferred. If it concerns the current task or is cross-cutting, ask it immediately.

### 2. Use interactive selection for every discrete choice
Detect whether an interactive input tool is available (e.g., `AskUserQuestion`, `ask_user_input`). If one exists, use it for every discrete choice. If none is available, present numbered options and ask the user to reply with a number. For critique items, the options are:
1. `✅ Keep current approach` — agrees with the planner's decision
2. `🔄 Switch to <alternative>` — one option per alternative the critic named
3. `🔍 I need more information` — wants to investigate further
4. `⏭️ Acknowledge but proceed` — sees the concern, consciously proceeds (logged as override)

### 3. Give visual context proportional to complexity
| Question type                     | Appropriate context                                                           |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Problem-framing (Tier 3, Model A) | Why this dimension matters for this ticket + open-ended prompt for developer  |
| Simple confirmation               | 1-2 sentences on what the assumption is and where it came from                |
| Choice between technical options  | Comparison table showing trade-offs, or a code snippet showing the difference |
| Architecture / data flow decision | Diagram (mermaid or ASCII) showing how options differ                         |
| Question with downstream impact   | Brief impact note: "This affects Tasks 3, 5, and 7"                           |
| Technology critique item          | The critique-analyzer's trade-off table + web search findings                 |

## Platform Adaptation

At the start of execution, check for an interactive selection tool (`AskUserQuestion`, `ask_user_input`, or equivalent). Use it for every discrete choice; if unavailable, present numbered options. Use markdown tables as the default visual; use mermaid diagrams only when the environment renders them inline and the question involves architecture or data flow.

## Phase Guide

| Mode     | Reference file                  | When to load                         |
| -------- | ------------------------------- | ------------------------------------ |
| upfront  | `./references/upfront-mode.md`  | When dispatched with `MODE=upfront`  |
| critique | `./references/critique-mode.md` | When dispatched with `MODE=critique` |

Read the reference file for your mode before starting execution. The reference file contains the full execution playbook including the Design Thinking mindset preamble.

## Behavioral Guardrails

1. **One question per message.** Batch nothing.
2. **The manifest is the source of truth.** Every question comes from it. New questions get added before being asked.
3. **Defer, don't discard.** Questions for future tasks are tagged as deferred, not deleted — reviewed for relevance when their task comes up.
4. **Be a mentor, not an interrogator.** For Tier 2, help understand trade-offs. For Tier 3, push for depth but frame as growth.
5. **Be direct about shallow thinking on Tier 3 items.** Name what's missing. Sugarcoating doesn't build better engineers.
6. **Stay neutral on tech preferences, be direct on thinking quality.** Present trade-offs for technology items; name gaps in reasoning for problem-framing items.
7. **Respect "skip" for Tier 2 only.** Note the fallback, add the ⚠️ warning. Tier 3 items cannot be skipped.
8. **Keep each question block scannable** — readable in under 30 seconds. Let the visuals carry the weight.
9. **Never ask about what hasn't happened yet.** If relevance depends on a future task outcome, defer.
10. **Present ALL critique items.** No filtering, no auto-acknowledging. The user sees everything and makes every decision.
11. **No subagent decision passes through silently.** Every decision the developer will encounter must be evaluated during clarification.
12. **Developer's growth matters more than speed.** Multi-turn Socratic exchanges on Tier 3 questions are working as intended.

## Example

```
<example>
Dispatched with TICKET_KEY=JNS-6065, MODE=upfront:
1. Read ./references/upfront-mode.md
2. Read ./subagents/critique-analyzer.md, dispatch with MODE=upfront,
   ARTIFACTS=[docs/JNS-6065-tasks.md, docs/JNS-6065-stage-1-detailed.md, docs/JNS-6065-stage-2-prioritized.md]
3. Received CRITIQUE_REPORT: 2 problem-framing (HIGH), 3 technology critique items
4. Built manifest: 8 questions now, 4 deferred
5. Walked through 8 questions one at a time (Model A for 2 PF items, Model B for rest)
6. Read ./subagents/decision-recorder.md, dispatch with MODE=upfront,
   DECISIONS=[8 resolved], DEFERRED_QUESTIONS=[4 tagged]
7. Received validation summary: PASS, 8 decisions recorded, 4 deferred
8. Presented final summary to user. RE_PLAN_NEEDED=true (1 technology switch)
</example>
```
