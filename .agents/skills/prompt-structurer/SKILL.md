---
name: "prompt-structurer"
description: "Convert prose prompts into compact, structured XML prompts through staged subagent passes. Use when a user asks to structure, harden, formalize, debug, or convert a prompt; mentions XML tags, agent drift, ambiguity, hidden assumptions, success criteria, anti-patterns, autonomous prompts, or prompt suites; or provides natural-language instructions that need to become a reliable agent contract."
---

# Prompt Structurer

Prompt Structurer is a portable orchestration skill for turning prose prompts
into executable XML prompt contracts. The orchestrator preserves intent, selects
the smallest useful analysis flow, dispatches specialized passes, and returns a
final prompt with concise assembly notes.

The package is self-contained: bundled subagents and references are enough to
run without network access. External URLs are optional just-in-time background
sources that replace long static explanations in the skill files.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROMPT_TEXT` | Yes | Prose prompt, instruction block, or prompt-suite entry to structure |
| `RUN_STYLE` | No | `interactive`, `autonomous`, or unknown |
| `SUITE_CONTEXT` | No | Existing structured prompts or shared suite conventions |
| `TERMINOLOGY` | No | Terms to preserve exactly, such as `issue key`, `subagent`, or `ledger` |
| `CHANGE_REQUEST` | No | Specific revision requested for an existing structured prompt |

Ask one targeted clarifying question only when the missing answer would change
the final prompt contract.

## Output Contract

Return the final XML prompt first, then assembly notes with assumptions,
sections omitted, resources fetched, and suggested follow-ups. Preserve user
terminology unless the user requested renaming.

## Subagent Registry

| Pass | Subagent | Path | Produces |
| ---- | -------- | ---- | -------- |
| 1 | `semantic-decomposer` | `./subagents/semantic-decomposer.md` | Sentence-to-category map and source-preservation notes |
| 2 | `philosophy-constraints-classifier` | `./subagents/philosophy-constraints-classifier.md` | Philosophy, constraints, hard rules, and ambiguities |
| 3 | `implicit-behavior-surfacer` | `./subagents/implicit-behavior-surfacer.md` | Ambiguity, autonomy, gate, empty-output, and traceability gaps |
| 4 | `anti-pattern-synthesizer` | `./subagents/anti-pattern-synthesizer.md` | Plausible wrong paths and matching negative criteria |
| 5 | `success-criteria-builder` | `./subagents/success-criteria-builder.md` | Observable post-run checklist and coverage gaps |
| 6 | `xml-prompt-assembler` | `./subagents/xml-prompt-assembler.md` | Final XML prompt and assembly notes |

Read a subagent file only when dispatching that pass.

## Flow Selection

| Flow | Use When | Dispatches |
| ---- | -------- | ---------- |
| `light` | Short one-shot prompt with low autonomy risk | Passes 1 and 6 |
| `full` | Multi-phase, autonomous, safety-sensitive, or repeatedly failing prompt | All passes in order |
| `suite` | Prompt must align with existing suite conventions | `full`, with shared suite blocks passed into every pass |
| `revision` | Existing structured prompt needs a targeted change | Affected analysis pass(es), then pass 6 |

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Tag selection or tag naming | `./references/tag-taxonomy.md` |
| Edge cases, agent drift, autonomy, gates, or wrong-path risks | `./references/failure-modes.md` |
| Final XML section order and removal test | `./references/template-skeleton.md` |
| Source-backed rationale, current vendor guidance, or progressive-disclosure background | `./references/web-resource-index.md`, then fetch one targeted URL |

Use local references first. Fetch a web resource only when the local package is
insufficient for the current decision, the user asks for source-backed
rationale, or model/platform guidance may have changed.

## How This Skill Works

The orchestrator does exactly three things:

- Coordinate: capture inputs, choose a flow, and route passes.
- Dispatch: send each pass the original prompt plus only relevant prior outputs.
- Synthesize: hand compact findings to the assembler and return the final prompt.

Subagents perform analysis and return structured findings. The orchestrator
keeps summaries, statuses, fetched URLs, and user-facing decisions, not raw
analysis transcripts.

## Execution

1. Capture `PROMPT_TEXT`, explicit constraints, run style, suite context, and change request.
2. Choose `light`, `full`, `suite`, or `revision`.
3. Dispatch passes in pipeline order, loading only the current subagent file.
4. If a subagent returns `BLOCKED` or `FAIL`, ask the smallest useful question or continue only when the skipped enhancement is nonessential.
5. Dispatch `xml-prompt-assembler` with the completed pass outputs.
6. Check the result against the run-level success criteria below.
7. Fix only failed checks and re-run the relevant pass; stop after three fix cycles.

## Run-Level Success Criteria

- Meaningful source content is represented, intentionally split, or explicitly omitted with justification.
- Each emitted XML tag changes agent behavior if removed.
- Constraints, anti-patterns, and success criteria audit the same behaviors.
- Assembly notes list assumptions, omitted sections, fetched resources, and follow-up options.
- Progressive disclosure was preserved: no subagent, reference, or URL was loaded before it was needed.

## Example

Input: `Structure this prompt so an agent audits Jira tickets, records findings, and does not change code.`

Round trip:

1. The orchestrator selects `full` because report-only auditing has scope and empty-output risks.
2. `semantic-decomposer` maps task, output, hard rule, and edge-case signals.
3. `philosophy-constraints-classifier` classifies report-only behavior as a hard rule.
4. `implicit-behavior-surfacer` adds explicit empty-output and new-finding handling.
5. `anti-pattern-synthesizer` blocks code edits and unsupported ticket assumptions.
6. `success-criteria-builder` creates audit checks for findings, no-findings cases, and unchanged files.
7. `xml-prompt-assembler` returns the final XML prompt and notes whether any web resource was fetched.

## Boundaries

Add structure in proportion to risk. A simple prompt should stay simple. A
production autonomous workflow usually earns philosophy, constraints, gates or
guardrails, anti-patterns, traceability, and success criteria.
