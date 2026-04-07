---
name: "generate-handoff-document"
description: 'Generate a resumable handoff document from an in-progress conversation, review, debugging session, or investigation. Dispatches co-located subagents to extract original instructions and Q&A context, capture evidence-backed insights, optionally validate claims from tracking files, and assemble a cold-start-ready handoff file plus structured working artifacts. Use when the user says "create a handoff doc", "save this for later", "document what we found", "update the resumption file", or wants a fresh agent to resume later without relying on chat history.'
---

# Generating Handoff Documents

Create a resumable handoff package for an in-progress analytical session. This
orchestrator does three things: **think** (identify missing inputs and failed
gates), **decide** (choose the next specialist or targeted rerun), and
**dispatch** (send extraction, validation, and assembly work to co-located
subagents). The working data lives on disk as structured artifacts; the
orchestrator keeps only verdicts, paths, counts, and unresolved questions in
context.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_FILE` | Yes | `docs/auth-review-handoff.md` |
| `SUBJECT` | No | `Authentication review` |
| `TRACKING_FILES` | No | `docs/auth-review-notes.md,docs/plan.md` |
| `CONTEXT_SOURCE` | No | `current conversation` or `docs/transcript.md` |

If the user omits optional values, infer them from the session when that is
safe. Read `./references/data-contracts.md` when deriving sibling artifact
paths or checking the structured artifact schemas.

## Workflow Overview

1. `context-extractor` writes the instruction/Q&A artifact.
2. `insight-documenter` writes the insights artifact.
3. `claim-validator` optionally writes the claims artifact when tracking files
   exist.
4. `document-assembler` reads those artifacts and writes the final handoff
   document.
5. The orchestrator validates the final document and reruns only the failing
   stage(s).

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `context-extractor` | `./subagents/context-extractor.md` | Capture the original mandate, instruction amendments, and chronological Q&A history |
| `insight-documenter` | `./subagents/insight-documenter.md` | Extract evidence-backed findings, risks, and recommendations from the session |
| `claim-validator` | `./subagents/claim-validator.md` | Verify factual claims from external tracking files against primary sources when available |
| `document-assembler` | `./subagents/document-assembler.md` | Assemble the final handoff document from the structured artifacts |

## How This Skill Works

- Read `./references/data-contracts.md` when you need the sibling artifact
  naming rules, JSON schemas, or final-section requirements.
- Pass only explicit handoffs between stages: source path, target artifact
  path, subject, and optional tracking files.
- Keep only verdicts, file paths, counts, and actionable warnings from each
  subagent. The detailed payload stays in the artifact files.
- Treat claims from tracking files as provisional even after validation. The
  final handoff must preserve that caution for the next agent.
- Use targeted fix cycles. If source extraction is incomplete, rerun the
  relevant upstream subagent and the downstream stages that consume it. If the
  problem is only document coherence or formatting, rerun `document-assembler`
  only.
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

## Phase Guide

| Situation | Reference file | Purpose |
| --------- | -------------- | ------- |
| Contract or artifact-path questions | `./references/data-contracts.md` | Derive sibling artifact names and confirm the schemas/required sections |

## Execution Steps

1. Confirm `TARGET_FILE` and derive the sibling artifact paths described in
   `./references/data-contracts.md`.
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

## Example

<example>
Input:
- `TARGET_FILE=docs/auth-review-handoff.md`
- `SUBJECT=Authentication review`
- `TRACKING_FILES=docs/auth-review-notes.md`

Derived working artifacts:
- `docs/auth-review-handoff.context.json`
- `docs/auth-review-handoff.insights.json`
- `docs/auth-review-handoff.claims.json`

1. Dispatch `context-extractor`
2. Subagent returns:
   `CONTEXT: PASS`
   `File: docs/auth-review-handoff.context.json`
   `Q&A exchanges: 4`
3. Dispatch `insight-documenter`
4. Subagent returns:
   `INSIGHTS: PASS`
   `File: docs/auth-review-handoff.insights.json`
   `Insights: 6`
5. Dispatch `claim-validator`
6. Subagent returns:
   `CLAIMS: WARN`
   `File: docs/auth-review-handoff.claims.json`
   `Claims checked: 9`
   `Unverified: 2`
7. Dispatch `document-assembler`
8. Subagent returns:
   `HANDOFF: PASS`
   `File: docs/auth-review-handoff.md`
   `Open questions: 2`
9. Report:
   "Handoff document written to `docs/auth-review-handoff.md`. The session is
   resumable from disk; two open questions remain."

The orchestrator keeps only those summaries and file paths.
</example>
