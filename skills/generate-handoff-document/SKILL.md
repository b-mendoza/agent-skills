---
name: "generate-handoff-document"
description: 'Generate a resumable handoff package from an in-progress conversation, review, debugging session, or investigation. Dispatches co-located subagents to extract scope and Q&A context, capture evidence-backed insights, optionally validate tracking-file claims, and assemble a cold-start handoff document. Use when the user says "create a handoff doc", "save this for later", "document what we found", "update the resumption file", or wants a fresh agent to resume without chat history.'
---

# Generating Handoff Documents

Create a resumable handoff package for an in-progress analytical session. The
orchestrator does three things: **think** about missing inputs and failed gates,
**decide** which specialist or targeted rerun is needed, and **dispatch** the
actual extraction, validation, and assembly work to co-located subagents.

Working data lives on disk as structured artifacts. Keep only verdicts, file
paths, counts, warnings, and unresolved questions in orchestrator context.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_FILE` | Yes | `docs/auth-review-handoff.md` |
| `SUBJECT` | No | `Authentication review` |
| `TRACKING_FILES` | No | `docs/auth-review-notes.md,docs/plan.md` |
| `CONTEXT_SOURCE` | No | `current conversation` or `docs/transcript.md` |

If the user omits optional values, infer them from the session when that is
safe. Ask one short question when `TARGET_FILE` is unclear.

## Workflow Overview

1. `context-extractor` writes the instruction/Q&A artifact.
2. `insight-documenter` writes the insights artifact.
3. `claim-validator` optionally writes the claims artifact when tracking files
   exist.
4. `document-assembler` reads those artifacts and writes the final handoff
   document.
5. The orchestrator validates the final document and reruns only the failing
   stage(s).

## Progressive Disclosure Map

Read the smallest file that answers the current question.

| Need | Load | Purpose |
| ---- | ---- | ------- |
| Artifact names, JSON schemas, or required final sections | `./references/data-contracts.md` | Canonical local contract for every stage |
| A dispatch round-trip example | `./references/dispatch-example.md` | Example of inputs, subagent summaries, and final report |
| Conceptual background or current external guidance | `./references/external-resources.md` | Optional links to fetch only when background is needed |
| Final handoff template | `./subagents/document-assembler-template.md` | Loaded by `document-assembler` only at assembly time |

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `context-extractor` | `./subagents/context-extractor.md` | Capture the original mandate, instruction amendments, and chronological Q&A history |
| `insight-documenter` | `./subagents/insight-documenter.md` | Extract evidence-backed findings, risks, and recommendations from the session |
| `claim-validator` | `./subagents/claim-validator.md` | Verify factual claims from external tracking files against primary sources when available |
| `document-assembler` | `./subagents/document-assembler.md` | Assemble the final handoff document from the structured artifacts |

## How This Skill Works

The orchestrator is a router and quality gate, not the extractor. It passes
explicit handoffs between stages: source path, target artifact path, subject,
and optional tracking files.

- Keep detailed payloads in artifact files; retain only summaries in context.
- Treat tracking-file claims as provisional even after validation. The final
  handoff keeps that caution visible for the next agent.
- Use external URLs only for optional background. Local files define the
  required contracts, output sections, and workflow behavior.
- Use targeted fix cycles. If source extraction is incomplete, rerun the
  upstream subagent and downstream consumers. If only coherence or formatting
  fails, rerun `document-assembler`.
- Stop and surface the blocker if dispatch is unavailable or if three fix
  cycles fail to produce a coherent handoff.

## Output Contract

All files written by this skill are resumability artifacts. They preserve
workflow state for later continuation; they are not product-code changes.

| Artifact | Produced by | Purpose |
| -------- | ----------- | ------- |
| `TARGET_FILE` | `document-assembler` | Final cold-start handoff document |
| `<stem>.context.json` | `context-extractor` | Original instructions, amendments, and Q&A log |
| `<stem>.insights.json` | `insight-documenter` | Findings with evidence, category, priority, and verification state |
| `<stem>.claims.json` | `claim-validator` | Optional claim-validation checklist and summary |

On success, `TARGET_FILE` contains five sections:

1. `Original Instructions & Scope`
2. `Q&A Log`
3. `Observations & Insights`
4. `Unverified Claims & Validation Checklist`
5. `Open Questions & Recommended Next Steps`

If no tracking files were provided, Section 4 must explicitly say so and tell
the next agent to verify any factual claims independently.

## Execution Steps

1. Confirm `TARGET_FILE`; then read `./references/data-contracts.md` and derive
   sibling artifact paths.
2. Dispatch `context-extractor` with `CONTEXT_SOURCE` and `CONTEXT_FILE`.
3. Dispatch `insight-documenter` with `CONTEXT_SOURCE` and `INSIGHTS_FILE`.
4. If `TRACKING_FILES` exist, dispatch `claim-validator` with
   `TRACKING_FILES`, `INSIGHTS_FILE`, and `CLAIMS_FILE`. Otherwise record the
   claims step as skipped.
5. Dispatch `document-assembler` with `TARGET_FILE`, `SUBJECT`,
   `CONTEXT_FILE`, `INSIGHTS_FILE`, and optional `CLAIMS_FILE`.
6. Validate the written handoff against this checklist:
   - every required section exists
   - each insight has rationale plus evidence
   - the claims section includes either the validation directive or the explicit
     "no tracking files" note
   - open questions are listed or explicitly marked resolved
   - a fresh agent could continue without consulting prior chat history
7. If a check fails, rerun only the failing stage(s); cap the fix loop at three
   passes.
8. Return the final handoff path plus a concise summary of counts, warnings, and
   open questions.

Read `./references/dispatch-example.md` if you need an example of the complete
dispatch round trip.
