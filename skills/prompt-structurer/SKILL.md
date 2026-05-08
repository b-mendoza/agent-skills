---
name: "prompt-structurer"
description: "Convert prose prompts into structured XML prompts through a staged, subagent-driven methodology. Use this skill when a user asks to structure, harden, formalize, convert, tighten, or debug a prompt; mentions XML tags, prompt templates, agent drift, ambiguity, implicit assumptions, success criteria, anti-patterns, autonomous prompts, or prompt suites; or provides natural-language instructions that need to become a reliable agent contract."
---

# Prompt Structurer

You are the orchestration layer for turning prose prompts into structured XML
prompts. You preserve the user's intent, choose the right amount of structure,
dispatch specialized passes, and return a final prompt plus concise assembly
notes.

This skill is self-contained. The local files under `subagents/` and
`references/` are sufficient to run every flow without web access. External
URLs in `references/web-resource-index.md` are progressive enrichment: fetch
one only when a decision still needs deeper rationale or current platform
guidance after the local files have been consulted.

## How This Skill Works

The orchestrator does three things:

- **Coordinate.** Capture inputs, classify the flow, and select passes.
- **Dispatch.** Send each pass to its dedicated subagent with the smallest
  required context, and collect concise findings only.
- **Synthesize.** Hand the prior outputs to the assembler and return the
  final XML prompt plus assembly notes.

Analysis, classification, taxonomy work, and final XML composition belong to
subagents, not the orchestrator. The orchestrator never reads the full
analysis transcripts; it keeps only the structured handoff each subagent
returns.

## Inputs

| Input | Required | Example |
| --- | --- | --- |
| `PROMPT_TEXT` | Yes | The prose prompt, instruction block, or prompt-suite entry to structure |
| `RUN_STYLE` | No | `interactive`, `autonomous`, or unknown |
| `SUITE_CONTEXT` | No | Prior structured prompts or shared conventions that should stay consistent |
| `TERMINOLOGY` | No | Terms to preserve exactly, such as `issue key`, `subagent`, or `ledger` |
| `CHANGE_REQUEST` | No | For revising an existing structured prompt, the specific change requested |

Ask one targeted clarifying question only when a missing input would
materially change the final prompt.

## Subagent Pipeline

Each pass is a dispatched subagent. The orchestrator passes the original
prompt and the relevant prior outputs, and stores only the structured
findings each subagent returns.

| Pass | Subagent | Path | Produces |
| --- | --- | --- | --- |
| 1 | `semantic-decomposer` | `./subagents/semantic-decomposer.md` | Sentence-to-category map, double-duty content, orphan content |
| 2 | `philosophy-constraints-classifier` | `./subagents/philosophy-constraints-classifier.md` | Philosophy, constraints, hard rules, ambiguous classifications |
| 3 | `implicit-behavior-surfacer` | `./subagents/implicit-behavior-surfacer.md` | Ambiguity handling, new-finding behavior, gates, autonomy, traceability |
| 4 | `anti-pattern-synthesizer` | `./subagents/anti-pattern-synthesizer.md` | Plausible-but-wrong completions and matching negative criteria |
| 5 | `success-criteria-builder` | `./subagents/success-criteria-builder.md` | Observable post-run audit checklist |
| 6 | `xml-prompt-assembler` | `./subagents/xml-prompt-assembler.md` | Final XML prompt and assembly notes |

Read a subagent file only when dispatching that subagent. Never preload the
full pipeline.

## Flow Selection

| Flow | Use When | Dispatches |
| --- | --- | --- |
| `light` | Under roughly 10 lines, no multi-phase workflow, low autonomy risk | `semantic-decomposer`, `xml-prompt-assembler` |
| `full` | Multi-phase, autonomous, safety-sensitive, or repeatedly failing prompt | All six subagents in pipeline order |
| `suite` | Prompt must align with existing suite conventions | `full` plus shared suite blocks passed into every pass |
| `revision` | Existing structured prompt needs a targeted change | Only the affected analysis pass(es), then assembler |

## Progressive Loading Map

Local files live one hop from `SKILL.md`. Load each only when the orchestrator
or a subagent needs it for the current decision.

| Need | Load |
| --- | --- |
| Local catalog of XML tags and tag-selection tests | `./references/tag-taxonomy.md` |
| Map of common agent failure modes to preventive prompt structures | `./references/failure-modes.md` |
| XML section order, skeleton, assembly rules, and common deviations | `./references/template-skeleton.md` |
| External background, source-backed rationale, or current platform guidance | `./references/web-resource-index.md`, then fetch one targeted URL |

The local references contain the minimum complete process. The web-resource
index is the only place the skill names external URLs, so updates to those
sources are localized to one file.

## Progressive Disclosure Policy

> Reminder: never preload references or subagents. Each layer earns its load
> at the moment it is needed.

Load information in this order:

1. Use this `SKILL.md` for routing, contracts, and pipeline decisions.
2. Read only the subagent file that is about to be dispatched.
3. Let that subagent load only the local reference file named in its
   instructions.
4. Fetch a single web resource only when the local file is insufficient, the
   user asks for source-backed rationale, or the subagent needs current
   prompt-engineering guidance.
5. Keep handoffs compact: each subagent returns structured findings, not a
   full re-analysis transcript.

This mirrors the principle of progressive disclosure in interface design:
primary content stays prominent, secondary material is available on demand,
and advanced background stays out of context until it changes a decision.

## Execution

1. Capture the original prompt and any explicit user constraints.
2. Choose `light`, `full`, `suite`, or `revision` based on risk and
   complexity.
3. Dispatch passes in pipeline order, supplying only the original prompt and
   relevant prior findings.
4. If a subagent returns `BLOCKED`, ask the smallest useful clarifying
   question, or skip only the blocked enhancement when the final prompt can
   still be valid.
5. Dispatch `xml-prompt-assembler` with the completed outputs.
6. Return the final XML prompt first, then assembly notes and any
   assumptions.

## Example

Input: `Structure this prompt so an agent audits Jira tickets, records findings, and does not change code.`

Dispatch summary:

1. `semantic-decomposer` returns task, scope, output, and double-duty
   sentences.
2. `philosophy-constraints-classifier` identifies report-only audit as a hard
   rule.
3. `implicit-behavior-surfacer` adds empty-output handling and a new-finding
   rule.
4. `anti-pattern-synthesizer` blocks code edits and unsupported ticket
   assumptions.
5. `success-criteria-builder` creates audit criteria for findings and zero
   findings.
6. `xml-prompt-assembler` returns the final XML prompt and notes that no web
   resources were needed.

## Boundaries

The orchestrator coordinates, decides, dispatches, and synthesizes. Analysis
work belongs to subagents. Preserve user terminology exactly unless the user
asks for renaming. Add structure in proportion to risk: every tag in the
final prompt should change agent behavior if removed.

## Run-Level Success Criteria

- Every meaningful sentence from the original prompt is represented,
  intentionally split, or explicitly omitted with justification.
- The final XML uses specific tags that encode behavior, not decorative
  organization.
- Constraints, anti-patterns, and success criteria correspond to each other.
- Assembly notes identify assumptions, omitted sections, fetched resources,
  and follow-up options.
- The context footprint stays progressive: no subagent or reference is loaded
  before it is needed, and at most one external URL is fetched per pass.
