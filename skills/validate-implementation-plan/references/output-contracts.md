# Output Contracts

> Load this file when formatting a subagent handoff or the final audit report.
> Return compact structured data; keep raw plan text out of the orchestrator.

## Contents

- Snapshotter
- Requirements Extractor
- Technical Researcher
- Requirements Auditor
- YAGNI Auditor
- Assumptions Auditor
- Plan Annotator

## Snapshotter

Success:

```text
SNAPSHOT: PASS
Source: <PLAN_PATH>
Snapshot: <SNAPSHOT_PATH or "not written">
Sections: <N>
Redactions: none | present
Sensitive categories: <comma-separated categories or "none">
Technical claims: <N>
Reason: <one line>
```

Escalation:

```text
SNAPSHOT: BLOCKED | FAIL | ERROR
Source: <PLAN_PATH>
Snapshot: <SNAPSHOT_PATH or "not written">
Reason: <what prevented completion>
```

Snapshot artifact structure:

```markdown
## Source Metadata
- Source path: <PLAN_PATH>
- Redactions applied: yes | no
- Sensitive categories: <list or "none">

## Section Inventory
1. <section heading>

## Sanitized Section Summaries
### <section heading>
- <2-5 bullets summarizing the section>
- Optional excerpt: "<sanitized excerpt, max 180 characters>"

## Technical Claims
- <specific library/version/API/behavior claim>

## Sensitive Content Handling
- <redaction summary or "No sensitive literals detected">
```

## Requirements Extractor

```markdown
## Source Requirements

1. [EXPLICIT] <requirement from the user's request>
2. [CONSTRAINT] <technology, scope, or delivery constraint>
3. [IMPLICIT] <carefully inferred requirement with a short why-clause>

## Baseline Notes

- <missing context, contradiction, or uncertainty>
```

Escalation:

```text
REQUIREMENTS: BLOCKED | FAIL | ERROR
Reason: <what prevented completion>
```

## Technical Researcher

Return a JSON array:

```json
[
  {
    "claim": "Library X supports feature Y",
    "plan_section": "Implementation Approach",
    "status": "supported | unsupported | unclear | not-reviewed",
    "evidence_path": "docs/rfc.md",
    "note": "One-sentence summary of the relevant local evidence"
  }
]
```

Escalation:

```text
EVIDENCE: BLOCKED | FAIL | ERROR
Reason: <what prevented completion>
```

## Requirements Auditor

Return a JSON object:

```json
{
  "req_annotations": [
    {
      "plan_section": "Implementation Approach",
      "expert": "Requirements Auditor",
      "severity": "critical | warning | info",
      "text": "Maps to [1] and [3], but introduces cross-region replication with no requirement basis."
    }
  ],
  "requirement_gaps": [
    {
      "requirement_number": 4,
      "requirement_text": "Preserve the existing CLI flags",
      "severity": "critical | warning | info",
      "note": "No plan section addresses backward compatibility for CLI flags."
    }
  ]
}
```

Escalation:

```text
TRACEABILITY: BLOCKED | FAIL | ERROR
Reason: <what prevented completion>
```

## YAGNI Auditor

Return a JSON array:

```json
[
  {
    "plan_section": "Architecture",
    "expert": "YAGNI Auditor",
    "severity": "critical | warning | info",
    "text": "Plugin architecture is premature; requirement [1] only needs one notifier. A direct implementation would satisfy the current scope."
  }
]
```

Escalation:

```text
YAGNI: BLOCKED | FAIL | ERROR
Reason: <what prevented completion>
```

## Assumptions Auditor

Discovery pass:

```json
{
  "assumption_annotations": [
    {
      "plan_section": "Dependencies",
      "expert": "Assumptions Auditor",
      "severity": "info | warning",
      "text": "Assumes Redis already exists. Requirement [2] states Redis must be reused, so this assumption is supported."
    }
  ],
  "unresolved_assumptions": [
    {
      "id": "unresolved-1",
      "plan_section": "Observability",
      "assumption": "OpenTelemetry is already deployed for this service.",
      "verification_attempted": "Checked requirements, baseline notes, and approved evidence; none mention tracing.",
      "question": "Is OpenTelemetry already available for this service, or would the plan introduce tracing for the first time?",
      "if_confirmed_risky": "The plan adds unapproved infrastructure and dependency risk."
    }
  ]
}
```

Resolution pass:

```json
{
  "resolved_annotations": [
    {
      "id": "unresolved-1",
      "plan_section": "Observability",
      "expert": "Assumptions Auditor",
      "severity": "critical | warning | info",
      "text": "User confirmed tracing is not available today, so the plan introduces a new dependency outside the baseline.",
      "user_answer_summary": "Tracing is not currently deployed for this service."
    }
  ],
  "open_questions": [
    {
      "id": "unresolved-3",
      "plan_section": "Rollout",
      "assumption": "A canary path already exists.",
      "reason": "User chose not to answer"
    }
  ]
}
```

Escalation:

```text
ASSUMPTIONS: BLOCKED | FAIL | ERROR
Reason: <what prevented completion>
```

## Plan Annotator

Report sections, in order:

- `## Audit Scope`
- `## Source Requirements`
- `## Findings By Plan Section`
- `## Requirement Gaps`
- `## Audit Summary`
- `## Resolved Assumptions`
- `## Open Questions`
- `## Sensitive Content Handling`

Completion handoff:

```text
AUDIT: PASS
Output: <OUTPUT_PATH or "not written">
Sections covered: <N>
Findings: critical=<N>, warning=<N>, info=<N>
Open questions: <N>
Reason: <one line>
```

Escalation:

```text
AUDIT: BLOCKED | FAIL | ERROR
Output: <OUTPUT_PATH or "not written">
Reason: <what prevented completion>
```
