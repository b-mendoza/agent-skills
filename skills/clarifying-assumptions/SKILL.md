---
name: "clarifying-assumptions"
description: "Run the conversational clarification phases of the Jira workflow. Use in Phase 3 (`MODE=upfront`) to challenge problem framing, resolve cross-cutting ambiguity, and defer future-task questions. Use in Phase 6 (`MODE=critique`) to review one task's planning artifacts, revisit deferred questions just before execution, and record developer decisions. Keeps the mentoring dialogue inline while delegating artifact reading, critique generation, manifest assembly, and file updates to subagents."
---

# Clarifying Assumptions

This skill is the conversation layer for the Jira-ticket workflow. The
orchestrator does exactly three things: think about the current question and the
developer's reasoning, decide what to ask or defer next, and dispatch
subagents for artifact reading, critique generation, manifest assembly, and
file updates. `critique-analyzer` writes its full report to a workflow artifact
before manifest assembly so the orchestrator carries only summaries, manifest
rows, and artifact paths instead of raw planning content.

## Inputs

| Input | Required | Example |
| --- | --- | --- |
| `TICKET_KEY` | Yes | `JNS-6065` |
| `MODE` | Yes | `upfront` or `critique` |
| `TASK_NUMBER` | Required for `MODE=critique` | `3` |
| `ITERATION` | No | `1`, `2`, or `3` |

`<KEY>` in path examples below is the same value as `TICKET_KEY`.

The main task plan must already exist at `docs/<TICKET_KEY>-tasks.md`. The
required plan sections and artifact contracts are part of this skill's
preconditions and are defined in `## Input And Output Contracts`.

When `MODE=critique`, these per-task artifacts must also exist:

- `docs/<KEY>-task-<N>-brief.md`
- `docs/<KEY>-task-<N>-execution-plan.md`
- `docs/<KEY>-task-<N>-test-spec.md`
- `docs/<KEY>-task-<N>-refactoring-plan.md`

## Workflow Overview

| Mode | Goal | Delegated work | Inline work |
| --- | --- | --- | --- |
| `upfront` | Challenge the whole plan before execution starts | critique generation, manifest assembly, file updates | Socratic questioning and decision capture |
| `critique` | Challenge one task just before execution | critique generation, deferred-question filtering, file updates | Evaluate reasoning and make final task-level decisions |

## Subagent Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| `critique-analyzer` | `./subagents/critique-analyzer.md` | Reads planning artifacts, verifies the real codebase, searches the web, and returns structured critique |
| `question-manifest-builder` | `./subagents/question-manifest-builder.md` | Reads the task plan plus the critique report and returns an ordered manifest of what to ask now, what to defer, and what is no longer relevant |
| `decision-recorder` | `./subagents/decision-recorder.md` | Writes clarification artifacts, updates the main task plan, creates per-task decisions files when needed, and validates the result |

## How This Skill Works

Keep only these items inline while the skill is running:

- The current manifest item
- The developer's response
- The accumulated decision list
- The `RE_PLAN_NEEDED` flag
- The `BLOCKERS_PRESENT` flag
- The active critique artifact path

Everything else comes from delegated subagents through concise verdicts,
manifest rows, and artifact paths. The manifest is the source of truth for what
gets asked once execution starts.

Run the workflow in this order:

1. Load the design-thinking reference and the current mode's playbook.
2. Dispatch `critique-analyzer` to read artifacts, inspect the codebase, search
   the web, and write the critique artifact.
3. Dispatch `question-manifest-builder` with the critique artifact path and the
   plan path to build the ordered manifest.
4. Walk the manifest one question at a time inline, deciding what to confirm,
   revise, defer, or block.
5. Dispatch `decision-recorder` with the resolved decisions and let it update
   the workflow artifacts plus validate the result.

The inline questioning loop uses two reasoning patterns:

- **Model A — Socratic.** Used only for Tier 3 problem-framing hard gates. The
  developer answers first, then sees the critique.
- **Model B — evaluate the reasoning.** Used for all other items. Present the
  original decision, the critique, and ask the developer whether the reasoning
  holds up.

## Input And Output Contracts

### Required input structure

The main plan file at `docs/<TICKET_KEY>-tasks.md` must contain:

| Section | Used for |
| --- | --- |
| `## Problem Framing` | Tier 3 hard-gate questions and user-impact context |
| `## Assumptions and Constraints` | Assumptions to confirm, revise, or defer |
| `## Cross-Cutting Open Questions` | Plan-wide blocking questions |
| `## Tasks` | Task-specific questions and assumptions |
| `## Validation Report` | Validation `FAIL` and `WARN` items |
| `## Dependency Graph` | Impact mapping and downstream task references |

Additional upstream artifacts:

- `MODE=upfront`: `docs/<KEY>-stage-1-detailed.md`,
  `docs/<KEY>-stage-2-prioritized.md`
- `MODE=critique`: task brief, execution plan, test spec, and refactoring plan

### Output contract

This skill updates orchestration artifacts only. It does not produce
implementation code.

| Artifact | Why it exists |
| --- | --- |
| `docs/<KEY>-upfront-critique.md` or `docs/<KEY>-task-<N>-critique.md` | Keeps structured critique available for manifest building and later review without retaining the full report inline |
| `docs/<KEY>-tasks.md` updates | Makes downstream execution consume resolved decisions instead of open ambiguity |
| `## Decisions Log` rows | Gives later phases a durable audit trail |
| Deferred question tags | Tell Phase 6 what still needs to be asked later |
| `docs/<KEY>-task-<N>-decisions.md` | Captures per-task critique decisions for re-planning and execution |
| `RE_PLAN_NEEDED` in the final summary | Signals whether the orchestrator should re-run planning before execution |
| `BLOCKERS_PRESENT` in the final summary | Signals that clarification stopped with unresolved items and execution must not proceed |

These are orchestration artifacts. Keep them out of version control.

## Phase Guide

Read `./references/design-thinking-mindset.md` first for both modes.

Then load the mode-specific playbook:

| Mode | Reference file | When to load |
| --- | --- | --- |
| `upfront` | `./references/upfront-mode.md` | Before Phase 3 clarification starts |
| `critique` | `./references/critique-mode.md` | Before Phase 6 task-level clarification starts |

## Escalation

| Source | Verdict | Orchestrator action |
| --- | --- | --- |
| `critique-analyzer` | `FAIL` | Stop and surface the reason to the user |
| `critique-analyzer` | `WARN` | Continue only if the missing context does not invalidate the critique |
| `question-manifest-builder` | `BLOCKED` or `FAIL` | Stop and surface the manifest issue |
| `question-manifest-builder` | `WARN` | Continue, but mention what was omitted or guessed |
| `decision-recorder` | `BLOCKED` or `ERROR` | Stop and ask the user how to proceed |
| `decision-recorder` | `WARN` | Present the warnings in the final summary and continue |

## Behavioral Guardrails

1. Ask one question per message.
2. Ask only from the manifest; if a new item emerges, add it before asking it.
3. Defer future-task questions instead of speculating about them now.
4. Be direct about shallow thinking on Tier 3 items, but keep the tone mentor-like.
5. Present every critique item; do not silently accept a subagent recommendation.
6. Respect skip only for Tier 2 items. Tier 3 hard gates cannot be skipped.
7. Use selection widgets for discrete choices when available; otherwise use numbered options.
8. Keep question blocks scannable. Use tables or diagrams only when they clarify a real trade-off.

## Example

```text
<example>
Input: TICKET_KEY=JNS-6065, MODE=upfront, ITERATION=1

1. Read `./references/design-thinking-mindset.md`
2. Read `./references/upfront-mode.md`
3. Dispatch `critique-analyzer` with the plan file, stage artifacts, and
   `docs/JNS-6065-upfront-critique.md`
4. Receive:
   CRITIQUE: PASS
   Ticket: JNS-6065 | Mode: upfront | Task: -
   Artifact: docs/JNS-6065-upfront-critique.md
5. Dispatch `question-manifest-builder` with
   `docs/JNS-6065-upfront-critique.md` and `docs/JNS-6065-tasks.md`
6. Receive:
   MANIFEST: PASS
   Questions now: 8 | Deferred: 4
7. Walk the 8 questions one at a time
8. Dispatch `decision-recorder` with resolved decisions and deferred items
9. Receive:
   RECORDING: PASS
   Files updated:
   - docs/JNS-6065-tasks.md
10. Present final summary with `RE_PLAN_NEEDED=true`
</example>
```
