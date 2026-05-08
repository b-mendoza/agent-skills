---
name: "generate-handoff-document"
description: 'Generate a resumable cold-start handoff package from an in-progress conversation, review, debugging session, or investigation. Dispatches co-located subagents to extract scope and Q&A, capture evidence-backed insights, optionally validate tracking-file claims, and assemble a final handoff document. Use when the user says "create a handoff doc", "save this for later", "document what we found", "update the resumption file", or wants a fresh agent to resume without chat history.'
---

# Generating Handoff Documents

You are a handoff-document orchestrator. You do exactly three things:
**think** (interpret summaries and detect missing inputs), **decide** (pick the
next subagent or rerun a failed stage), and **dispatch** (send work to a
co-located subagent). The orchestrator does not extract, validate, or write
the final document directly.

This skill package is standalone: every reference and subagent it depends on
lives inside this folder. External URLs are optional supporting material; the
skill works without network access.

> **Reminder:** Working data lives on disk as structured artifacts. Keep only
> verdicts, file paths, counts, and unresolved questions in orchestrator
> context.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_FILE` | Yes | `docs/auth-review-handoff.md` |
| `SUBJECT` | No | `Authentication review` |
| `TRACKING_FILES` | No | `docs/auth-review-notes.md,docs/plan.md` |
| `CONTEXT_SOURCE` | No | `current conversation` or `docs/transcript.md` |

If the user omits optional values, infer them from the session when that is
safe. Ask one short question only when `TARGET_FILE` is unclear.

Sibling artifact paths are derived from `TARGET_FILE`. See
`./references/data-contracts.md` for the derivation rule and schemas.

## Workflow Overview

```text
1. context-extractor   -> <stem>.context.json
2. insight-documenter  -> <stem>.insights.json
3. claim-validator     -> <stem>.claims.json   (only if TRACKING_FILES given)
4. document-assembler  -> TARGET_FILE
5. orchestrator        -> validates the handoff, reruns failing stages
```

Stages run in order. Stage 3 is skipped when no tracking files are provided;
in that case the final document explicitly tells the next agent to verify
factual claims independently.

## Subagent Registry

Use this registry as a lookup table. Read one subagent definition only when
you are about to dispatch that subagent.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `context-extractor` | `./subagents/context-extractor.md` | Capture original mandate, instruction amendments, and chronological Q&A |
| `insight-documenter` | `./subagents/insight-documenter.md` | Extract evidence-backed findings, risks, and recommendations |
| `claim-validator` | `./subagents/claim-validator.md` | Verify factual claims from tracking files against primary sources |
| `document-assembler` | `./subagents/document-assembler.md` | Assemble the final handoff document from the structured artifacts |

## Progressive Loading Map

Load the smallest file that answers the current question. Do not preload
references, subagent definitions, or external URLs.

| Need | Load |
| ---- | ---- |
| Artifact naming, JSON schemas, final document section requirements | `./references/data-contracts.md` |
| A complete dispatch round-trip example with summaries | `./references/dispatch-example.md` |
| Background on progressive disclosure, context engineering, JSON Schema, or session-handoff practice | `./references/external-sources.md`, then fetch only the relevant URL |
| The final handoff template | `./subagents/document-assembler-template.md` (loaded by `document-assembler` only) |

External sources are optional supporting material. Bundled contracts in this
skill package win over web content when they conflict.

## Output Contract

This skill writes resumability artifacts that preserve workflow state for
later continuation; it does not produce product-code changes.

| Artifact | Produced by | Purpose |
| -------- | ----------- | ------- |
| `TARGET_FILE` | `document-assembler` | Final cold-start handoff document |
| `<stem>.context.json` | `context-extractor` | Original instructions, amendments, Q&A log |
| `<stem>.insights.json` | `insight-documenter` | Findings with evidence, category, priority, verification state |
| `<stem>.claims.json` | `claim-validator` | Optional claim-validation checklist and summary |

On success, `TARGET_FILE` contains exactly five major sections:

1. `Original Instructions & Scope`
2. `Q&A Log`
3. `Observations & Insights`
4. `Unverified Claims & Validation Checklist`
5. `Open Questions & Recommended Next Steps`

If no tracking files were provided, Section 4 must explicitly say so and
direct the next agent to verify factual claims independently.

## Execution Steps

1. Confirm `TARGET_FILE`. Read `./references/data-contracts.md` and derive
   sibling artifact paths.
2. Dispatch `context-extractor` with `CONTEXT_SOURCE` and `CONTEXT_FILE`.
3. Dispatch `insight-documenter` with `CONTEXT_SOURCE` and `INSIGHTS_FILE`.
4. If `TRACKING_FILES` exist, dispatch `claim-validator` with
   `TRACKING_FILES`, `INSIGHTS_FILE`, and `CLAIMS_FILE`. Otherwise record the
   claims stage as skipped.
5. Dispatch `document-assembler` with `TARGET_FILE`, `SUBJECT`,
   `CONTEXT_FILE`, `INSIGHTS_FILE`, and optional `CLAIMS_FILE`.
6. Validate the written handoff against the checklist below.
7. If a check fails, rerun only the failing stage(s) and any downstream
   consumers. Cap the fix loop at three passes.
8. Return the final handoff path plus a concise summary of counts, warnings,
   and open questions.

### Validation Checklist

A valid handoff satisfies every gate:

- Every required section exists.
- Each insight has both rationale and concrete evidence.
- The claims section either includes the validation directive or the
  explicit "no tracking files" note.
- Open questions are listed or explicitly marked resolved.
- A fresh agent could continue from `TARGET_FILE` without consulting prior
  chat history.

If three fix cycles fail to produce a coherent handoff, stop and surface the
blocker to the user with the latest stage summaries.

## Dispatch Contract

For any subagent dispatch:

1. Read the subagent definition from the registry.
2. Pass only the explicit inputs that subagent needs.
3. Collect its structured summary.
4. Retain only the verdict, file path, and next-step-relevant counts.

Treat tracking-file claims as provisional even after validation; the final
handoff keeps that caution visible for the next agent.

## Example

A complete dispatch round trip with sample subagent summaries lives in
`./references/dispatch-example.md`. Read it only when an example would clarify
dispatch order, expected summaries, or the final response shape.
