# Handoff Data Contracts

> Read this file when deriving sibling artifact paths or checking what each
> stage must write.
>
> **Reminder:** Keep only verdicts, file paths, counts, and actionable warnings
> in orchestrator context. The structured payload lives on disk.

## Artifact Naming

Given:

```text
TARGET_FILE=docs/auth-review-handoff.md
```

Derive these sibling artifacts:

```text
CONTEXT_FILE=docs/auth-review-handoff.context.json
INSIGHTS_FILE=docs/auth-review-handoff.insights.json
CLAIMS_FILE=docs/auth-review-handoff.claims.json
```

Rules:

- Keep all sibling artifacts in the same directory as `TARGET_FILE`.
- Reuse the full filename stem before `.md`.
- Overwrite sibling artifacts on reruns; they are working state, not append-only
  logs.

## Context Artifact Schema

`context-extractor` writes:

```json
{
  "original_instructions": "string",
  "qa_log": [
    {
      "number": 1,
      "asker": "user",
      "answerer": "assistant",
      "question": "string",
      "answer": "string",
      "context": "string"
    }
  ],
  "amendments": [
    {
      "description": "string",
      "after_qa_number": 2
    }
  ]
}
```

## Insights Artifact Schema

`insight-documenter` writes:

```json
{
  "insights": [
    {
      "title": "string",
      "claim": "string",
      "rationale": "string",
      "evidence": ["string"],
      "verification_status": "verified|partial|unverified",
      "verification_notes": "string",
      "category": "string",
      "priority": "critical|important|informational"
    }
  ]
}
```

## Claims Artifact Schema

`claim-validator` writes:

```json
{
  "directive": "string",
  "claims": [
    {
      "claim": "string",
      "source": "string",
      "status": "verified|refuted|partial|unverified",
      "evidence": "string",
      "discrepancy": "string"
    }
  ],
  "summary": {
    "verified": 0,
    "refuted": 0,
    "partial": 0,
    "unverified": 0
  }
}
```

## Final Document Requirements

`document-assembler` writes `TARGET_FILE` with exactly these major sections:

1. `## 1. Original Instructions & Scope`
2. `## 2. Q&A Log`
3. `## 3. Observations & Insights`
4. `## 4. Unverified Claims & Validation Checklist`
5. `## 5. Open Questions & Recommended Next Steps`

Additional rules:

- Every section includes a `**Fulfills:**` line.
- `Open Questions` is never omitted; if none remain, say so explicitly.
- `Recommended Next Steps` contains concrete actions, not generic advice.
- If no claims artifact exists, Section 4 explicitly states that no tracking
  files were provided and that the next agent should verify factual claims
  independently.
