---
name: "prompt-structurer"
description: "Convert prose prompts into structured XML prompts using a five-pass methodology. Use this skill whenever a user wants to turn a text-based prompt, instruction block, or natural-language request into a more structured, tagged, agent-friendly format — including phrases like 'structure this prompt', 'make this prompt more reliable', 'convert this to XML', 'formalize this prompt', 'this prompt keeps failing, can you tighten it up', or 'turn this into a proper prompt template'. Also use when a user provides a prompt that has ambiguity, implicit assumptions, or agent-drift problems and wants it reshaped. Works for single prompts and prompt suites (multiple related prompts that should stay internally consistent)."
---

# Structuring Prompts

Convert prose prompts into structured XML prompts using a deterministic five-pass methodology. Each pass runs as an isolated subagent, and a final assembler composes the results into a production-ready prompt.

## Why this skill exists

Prose prompts are contracts written in plain English: readable, but full of ambiguity, implicit assumptions, and buried rules. Structured prompts are contracts written in a semi-formal tagged language: every clause has a named slot, every rule has a known weight, every edge case has an explicit home.

The conversion is not "make it look organized." It's surfacing every implicit rule, decision point, and constraint as an explicit, labeled element the agent cannot miss or misinterpret.

Three principles drive every decision in this skill:

1. **Nothing important should be implicit.** If a rule matters, it gets its own tag.
2. **Proximity ≠ priority.** Structure lets you declare priority explicitly through tag names, positioning, and nesting.
3. **Structure encodes mental models, not just information.** A well-tagged prompt teaches the agent the conceptual shape of the task, not just the content.

## Subagent registry

This skill dispatches to six subagents, each handling one pass of the methodology. The orchestrator never executes the passes inline — its job is to coordinate, collect outputs, and synthesize the final result.

| Subagent                             | Path                                               | Purpose                                                                                                        |
| ------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `semantic-decomposer`                | `./subagents/semantic-decomposer.md`               | Bins every sentence of the prose prompt into candidate semantic categories; flags double-duty and orphan sentences |
| `philosophy-constraints-classifier`  | `./subagents/philosophy-constraints-classifier.md` | Separates framing (philosophy) from rules (constraints) from non-negotiables (hard rules); names and numbers each |
| `implicit-behavior-surfacer`         | `./subagents/implicit-behavior-surfacer.md`        | Identifies unstated assumptions about ambiguity handling, new findings, empty outputs, gates, traceability     |
| `anti-pattern-synthesizer`           | `./subagents/anti-pattern-synthesizer.md`          | Enumerates plausible-but-wrong ways to fulfill the task; produces anti-patterns block and negative success criteria |
| `success-criteria-builder`           | `./subagents/success-criteria-builder.md`          | Assembles the self-audit checklist covering every phase, constraint, and anti-pattern                          |
| `xml-prompt-assembler`                | `./subagents/xml-prompt-assembler.md`              | Composes all prior outputs into the final tagged XML prompt, applies polish, runs the removal test            |

Read a subagent's file only when dispatching to that specific subagent. Do not preload them.

## Reference material

The subagents load these references as needed. The orchestrator does not need to read them directly.

| File                                 | Purpose                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `./references/tag-taxonomy.md`       | Complete catalog of XML tags with purposes, distinctions, and selection heuristics   |
| `./references/failure-modes.md`      | Agent failure modes mapped to the structural techniques that prevent each one        |
| `./references/template-skeleton.md`  | Canonical XML skeleton with section order rationale and assembly rules               |

## How the orchestrator runs

### Step 1 — Gather input

Accept the prose prompt from the user. Before dispatching, determine:

- **Is this a single prompt or part of a suite?** If a suite, note any prior prompts in the suite that the user has already structured; their philosophy, constraints, and anti-patterns should stay consistent.
- **Is this prompt intended for interactive use or autonomous use?** This affects which behavioral tags are added (gates vs autonomy guardrails, ambiguity handling vs defer-and-record).
- **Are there terminology commitments?** Specific technical terms the user uses that must be preserved exactly.

If any of these is unclear and materially affects the output, ask one targeted clarifying question before dispatching. Do not ask speculative questions.

### Step 2 — Dispatch passes 1–5 in order

The passes are sequential; later passes consume earlier outputs. Dispatch each subagent with:

- The original prose prompt
- All relevant prior subagent outputs
- Any user context gathered in Step 1

Order:

1. Dispatch `semantic-decomposer` first.
2. Dispatch `philosophy-constraints-classifier` with the decomposer's output.
3. Dispatch `implicit-behavior-surfacer` with decomposer + classifier outputs.
4. Dispatch `anti-pattern-synthesizer` with outputs from passes 1–3.
5. Dispatch `success-criteria-builder` with outputs from passes 1–4.

Collect each subagent's output as a compact result — do not expand or restate. The orchestrator's context should hold structured intermediate results, not raw re-analyses.

### Step 3 — Dispatch the assembler

Dispatch `xml-prompt-assembler` with all five prior outputs plus the original prompt. The assembler produces the final XML and assembly notes.

### Step 4 — Present to the user

Return the final structured prompt first, assembly notes second. If the assembler flagged assumptions or open questions, highlight them — the user may want to iterate.

## When to deviate from the full pipeline

**Short or simple prompts.** A one-shot conversational prompt doesn't need the full pipeline. If the input is under ~10 lines and has no multi-phase structure, consider dispatching only `semantic-decomposer` → `xml-prompt-assembler`. The middle passes add little value when the prompt has few rules to classify.

**Prompts in an established suite.** If prior prompts in the suite already have a stable philosophy block and constraint set, the classifier's job is mostly to *verify* consistency rather than re-derive. Pass the prior suite's shared blocks as context so the subagent knows what to reuse vs. what to adapt.

**Iteration on an existing structured prompt.** If the user wants to modify a prompt that's already structured, skip passes 1–2 (the structure is already determined) and dispatch only the passes relevant to the change. For example, adding an autonomy mode → dispatch `implicit-behavior-surfacer` + `xml-prompt-assembler`.

## Handling multi-version outputs

Some user requests produce parallel versions (interactive + autonomous, report-only + full-flow). The orchestrator should:

1. Run passes 1–4 once (they produce shared outputs).
2. Run pass 5 (`success-criteria-builder`) separately per version, since criteria differ.
3. Run the assembler separately per version, producing two complete prompts.

Share the philosophy block and constraints verbatim across versions. Diverge only where the versions legitimately differ (gates vs. autonomy guardrails, ambiguity handling, etc.).

## Principles the orchestrator holds

- **Fidelity to the user's intent.** Every term, every carve-out, every stated rule should survive the conversion. Never paraphrase technical terminology. Never add scope the user didn't request.
- **Protect the context window.** Dispatch heavy work to subagents; hold only compact intermediate outputs. The orchestrator synthesizes; it does not re-analyze.
- **Apply structure in proportion to risk.** A simple prompt gets a light conversion. A production-critical autonomous prompt gets the full pipeline. Over-structuring a simple prompt adds noise without preventing anything.
- **The removal test is the final quality gate.** Every tag in the final prompt should be defensible: "Would removing this change the agent's behavior?" If no, remove it.

## Anti-patterns for this skill

Do NOT:
- Execute any of the five passes inline instead of dispatching to the corresponding subagent.
- Add content, rules, or scope the user did not request.
- Paraphrase or normalize the user's technical terminology.
- Skip the assembler's removal test to save time.
- Produce a structured prompt that is longer than the original prose without the length being justified by specific, load-bearing tags.

## Success criteria for a run

- Every sentence of the original prose appears somewhere in the final prompt (in the right tag) or is explicitly flagged as omitted with justification.
- The final prompt uses specific tag names that aid scanning rather than generic ones.
- The final prompt's philosophy (if present) explicitly blocks the most dangerous misinterpretations.
- Every constraint has a corresponding success criterion.
- Every anti-pattern has a corresponding negative success criterion.
- Assembly notes are returned alongside the final prompt, flagging judgment calls and open questions.
- The orchestrator dispatched each pass as a subagent and did not execute passes inline.