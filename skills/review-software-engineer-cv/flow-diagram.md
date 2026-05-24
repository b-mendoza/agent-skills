# Review Software Engineer CV

This workflow reviews a software engineer CV against a job posting. The agent may coordinate intake, role-fit mapping, truthful tailoring, validation, and a user-facing report, but it must not invent candidate facts, inflate seniority, fabricate metrics, or treat external resume guidance as candidate evidence. Primary evidence is the provided `CV`, `APPLICANT_CONTEXT`, and `JOB_POSTING`; optional fetched sources are background only.

```mermaid
flowchart TD
  START([Start: review software engineer CV]) --> NORMALIZE[Normalize OUTPUT_MODE or default to review]
  NORMALIZE --> CHECK_REQUIRED{Readable CV and JOB_POSTING provided?}

  CHECK_REQUIRED -->|no| ASK_REQUIRED[Ask user for missing or unreadable required source]
  ASK_REQUIRED --> BLOCKED_MISSING([Blocked: pending required source])

  CHECK_REQUIRED -->|yes| INTAKE[Dispatch source-intake-analyst]
  INTAKE -->|phase error| PHASE_ERROR([Error: phase failed])
  INTAKE --> SOURCE_OK{Enough primary evidence remains?}
  SOURCE_OK -->|no| BLOCKED_EVIDENCE([Blocked: insufficient evidence])
  SOURCE_OK -->|yes| LIMITS[Record limitations for partial, inaccessible, or ambiguous sources]

  LIMITS --> MAP[Dispatch role-fit-mapper]
  MAP -->|phase error| PHASE_ERROR
  MAP --> TAILOR[Dispatch cv-tailoring-editor]
  TAILOR -->|phase error| PHASE_ERROR
  TAILOR --> LABEL[Label rewrites and recommendations by evidence support]
  LABEL --> UNSUPPORTED{Unsupported claims, metrics, seniority, or domain depth?}

  UNSUPPORTED -->|yes| QUESTIONS[Ask user verification questions for unsupported claims]
  QUESTIONS --> USER_VERIFY{User verifies candidate claim?}
  USER_VERIFY -->|confirmed| INCLUDE_CONFIRMED[Include confirmed claim with evidence label]
  USER_VERIFY -->|declined or unverified| EXCLUDE_UNVERIFIED[Exclude claim or keep it as a question]
  USER_VERIFY -->|unresolved or handoff needed| BLOCKED_VERIFY([Blocked: unresolved verification handoff])
  INCLUDE_CONFIRMED --> REVIEW
  EXCLUDE_UNVERIFIED --> REVIEW

  UNSUPPORTED -->|no| REVIEW[Dispatch cv-reviewer with compact summaries and verdicts]
  REVIEW -->|phase error| PHASE_ERROR
  REVIEW --> PASSES{Quality checklist passes?}
  PASSES -->|yes| LIMITATION_STATE{Limitations require partial report?}
  PASSES -->|validation error| PHASE_ERROR
  PASSES -->|no| FIX_CYCLES{Targeted fix cycles under 3?}

  FIX_CYCLES -->|yes| RERUN[Run targeted editor or reviewer fix]
  RERUN --> LABEL
  FIX_CYCLES -->|no| BLOCKED_RISK([Blocked: unresolved integrity risk])

  LIMITATION_STATE -->|yes| PARTIAL_REPORT[Return partial reviewed report with labeled limitations]
  LIMITATION_STATE -->|no| MODE{OUTPUT_MODE}

  MODE -->|review| REPORT_REVIEW[Return reviewed report]
  MODE -->|rewrite| REPORT_REWRITE[Return supported rewrites with evidence labels]
  MODE -->|checklist| REPORT_CHECKLIST[Return checklist and prioritized edits]
  MODE -->|questions-only| REPORT_QUESTIONS[Return verification questions only]

  REPORT_REVIEW --> FINAL([Complete: final reviewed report])
  REPORT_REWRITE --> FINAL
  REPORT_CHECKLIST --> FINAL
  REPORT_QUESTIONS --> FINAL
  PARTIAL_REPORT --> PARTIAL_FINAL([Complete: partial reviewed report with limitations])
```
