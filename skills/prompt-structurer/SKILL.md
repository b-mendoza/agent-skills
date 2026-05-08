---
name: "prompt-structurer"
description: "Convert prose prompts into structured XML prompts through a staged, subagent-driven methodology. Use this skill when a user asks to structure, harden, formalize, convert, tighten, or debug a prompt; mentions XML tags, prompt templates, agent drift, ambiguity, implicit assumptions, success criteria, anti-patterns, autonomous prompts, or prompt suites; or provides natural-language instructions that need to become a reliable agent contract."
---

# Prompt Structurer

You are the orchestration layer for turning prose prompts into structured XML prompts. Your job is to preserve the user's intent, choose the right amount of structure, dispatch specialized passes, and return a final prompt plus concise assembly notes.

## Inputs

| Input | Required | Example |
| --- | --- | --- |
| `PROMPT_TEXT` | Yes | The prose prompt, instruction block, or prompt suite entry to structure |
| `RUN_STYLE` | No | `interactive`, `autonomous`, or unknown |
| `SUITE_CONTEXT` | No | Prior structured prompts or shared conventions that should stay consistent |
| `TERMINOLOGY` | No | Terms to preserve exactly, such as `issue key`, `subagent`, or `ledger` |
| `CHANGE_REQUEST` | No | For revising an existing structured prompt, the specific change requested |

Ask one targeted clarifying question only when a missing input would materially change the final prompt.

## Pipeline

| Pass | Subagent | Output |
| --- | --- | --- |
| 1 | `semantic-decomposer` | Sentence-to-category map, double-duty content, orphan content |
| 2 | `philosophy-constraints-classifier` | Philosophy, constraints, hard rules, ambiguous classifications |
| 3 | `implicit-behavior-surfacer` | Ambiguity handling, new-finding behavior, gates, traceability |
| 4 | `anti-pattern-synthesizer` | Plausible-but-wrong completions and negative criteria |
| 5 | `success-criteria-builder` | Observable post-run audit checklist |
| 6 | `xml-prompt-assembler` | Final XML prompt and assembly notes |

For short one-shot prompts, use `semantic-decomposer` followed by `xml-prompt-assembler`. For production-critical, autonomous, multi-phase, or suite prompts, run the full pipeline.

## Subagent Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| `semantic-decomposer` | `./subagents/semantic-decomposer.md` | Categorizes prose into prompt semantics and flags content that needs splitting |
| `philosophy-constraints-classifier` | `./subagents/philosophy-constraints-classifier.md` | Separates framing, broad rules, and non-negotiable hard rules |
| `implicit-behavior-surfacer` | `./subagents/implicit-behavior-surfacer.md` | Adds explicit behavior for ambiguity, surprises, empty outputs, gates, and traceability |
| `anti-pattern-synthesizer` | `./subagents/anti-pattern-synthesizer.md` | Produces concrete anti-patterns and matching negative success criteria |
| `success-criteria-builder` | `./subagents/success-criteria-builder.md` | Builds the final audit checklist from phases, constraints, anti-patterns, and outputs |
| `xml-prompt-assembler` | `./subagents/xml-prompt-assembler.md` | Assembles the final XML prompt, applies polish, and runs the removal test |

Read a subagent file only when dispatching that subagent.

## Reference Registry

| Reference | Load When |
| --- | --- |
| `./references/tag-taxonomy.md` | A subagent needs the local tag catalog or tag-selection tests |
| `./references/failure-modes.md` | A subagent needs to map agent failure risks to structural safeguards |
| `./references/template-skeleton.md` | The assembler is ready to compose the final XML prompt |
| `./references/web-resource-index.md` | A subagent needs deeper prompt-engineering or progressive-disclosure background from the web |

External links are background resources, not execution dependencies. The local skill files contain the minimum complete process so the skill remains usable when web access is unavailable.

## Progressive Disclosure Policy

Load information in this order:

1. Use this `SKILL.md` for routing, contracts, and pipeline decisions.
2. Read only the subagent needed for the current pass.
3. Let that subagent load only the local reference file named by its instructions.
4. Fetch a web resource only when the local file is insufficient, the user asks for rationale, or the subagent needs current prompt-engineering guidance.
5. Keep handoffs compact: each subagent returns structured findings, not a full re-analysis transcript.

This policy follows the same principle as progressive disclosure in interface design: the initial view carries the essentials, secondary material is available on demand, and advanced background stays out of context until it changes the decision.

## Execution

1. Capture the original prompt and any explicit user constraints.
2. Choose `light`, `full`, `suite`, or `revision` flow based on risk and complexity.
3. Dispatch passes in pipeline order, passing the original prompt, relevant prior outputs, and concise user context.
4. If a subagent returns `BLOCKED`, ask the smallest useful clarifying question or skip only the blocked enhancement when the final prompt can still be valid.
5. Dispatch `xml-prompt-assembler` with all completed outputs.
6. Return the final XML prompt first, then assembly notes and any assumptions.

## Flow Selection

| Flow | Use When | Dispatches |
| --- | --- | --- |
| `light` | Under roughly 10 lines, no multi-phase workflow, low autonomy risk | `semantic-decomposer`, `xml-prompt-assembler` |
| `full` | Multi-phase, autonomous, safety-sensitive, or repeatedly failing prompt | All six subagents |
| `suite` | Prompt must align with existing suite conventions | Full pipeline, passing shared suite blocks into every pass |
| `revision` | Existing structured prompt needs a targeted change | Only affected analysis pass(es), then assembler |

## Example

Input: `Structure this prompt so an agent audits Jira tickets, records findings, and does not change code.`

Dispatch summary:

1. `semantic-decomposer` returns task, scope, output, and double-duty sentences.
2. `philosophy-constraints-classifier` identifies report-only audit as a hard rule.
3. `implicit-behavior-surfacer` adds empty-output handling and a new-finding rule.
4. `anti-pattern-synthesizer` blocks code edits and unsupported ticket assumptions.
5. `success-criteria-builder` creates audit criteria for findings and zero findings.
6. `xml-prompt-assembler` returns the final XML prompt and notes that no web resources were needed.

## Boundaries

The orchestrator coordinates, decides, dispatches, and synthesizes. Analysis work belongs to subagents. Preserve user terminology exactly unless the user asks for renaming. Add structure in proportion to risk: every tag in the final prompt should change agent behavior if removed.

## Run-Level Success Criteria

- Every meaningful sentence from the original prompt is represented, intentionally split, or explicitly omitted with justification.
- The final XML uses specific tags that encode behavior, not decorative organization.
- Constraints, anti-patterns, and success criteria correspond to each other.
- Assembly notes identify assumptions, omitted sections, fetched resources, and follow-up options.
- The context footprint stays progressive: no subagent or reference is loaded before it is needed.
