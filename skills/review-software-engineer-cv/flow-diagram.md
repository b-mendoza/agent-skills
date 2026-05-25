# Review Software Engineer CV

This workflow coordinates a read-only CV review for software engineer applications. The agent may normalize inputs, route work to intake, role-fit, tailoring, and review subagents, and produce evidence-labeled recommendations. Candidate facts may come only from the `CV` and `APPLICANT_CONTEXT`; job requirements come from `JOB_POSTING`; public resume or ATS guidance is background only and never candidate evidence.

```mermaid
flowchart TD
  START(["Start: review software engineer CV"]) --> MODE_INPUT{"OUTPUT_MODE provided and supported?"}
  MODE_INPUT -->|supported| MODE_KEEP["Use requested OUTPUT_MODE"]
  MODE_INPUT -->|missing or invalid| MODE_DEFAULT["Set OUTPUT_MODE to review"]
  MODE_KEEP --> CHECK_REQUIRED{"Readable CV and JOB_POSTING provided?"}
  MODE_DEFAULT --> CHECK_REQUIRED

  CHECK_REQUIRED -->|no| ASK_REQUIRED["Request missing or unreadable required source"]
  ASK_REQUIRED --> BLOCKED_MISSING(["Blocked: missing required source"])
  CHECK_REQUIRED -->|yes| INTAKE["Dispatch source-intake-analyst"]

  INTAKE --> INTAKE_STATUS{"SOURCE_INTAKE status"}
  INTAKE_STATUS -->|PASS| EVIDENCE_FULL["Open evidence ledger with usable primary sources"]
  INTAKE_STATUS -->|PARTIAL| EVIDENCE_PARTIAL["Open evidence ledger with source limitations"]
  INTAKE_STATUS -->|BLOCKED| BLOCKED_EVIDENCE(["Blocked: insufficient primary evidence"])
  INTAKE_STATUS -->|ERROR| PHASE_ERROR(["Error: phase failed"])

  EVIDENCE_FULL --> ROLE_FIT["Dispatch role-fit-mapper with evidence ledger"]
  EVIDENCE_PARTIAL --> ROLE_FIT
  ROLE_FIT --> ROLE_STATUS{"ROLE_FIT status"}
  ROLE_STATUS -->|PASS| ROLE_OK["Record role requirements and fit map"]
  ROLE_STATUS -->|PARTIAL| ROLE_PARTIAL["Record partial fit map and limitations"]
  ROLE_STATUS -->|ERROR| PHASE_ERROR

  ROLE_OK --> TAILOR["Dispatch cv-tailoring-editor"]
  ROLE_PARTIAL --> TAILOR
  TAILOR --> TAILOR_STATUS{"TAILORING_DRAFT status"}
  TAILOR_STATUS -->|PASS| DRAFT_OK["Record draft recommendations with evidence labels"]
  TAILOR_STATUS -->|PARTIAL| DRAFT_PARTIAL["Record partial draft and limitations"]
  TAILOR_STATUS -->|ERROR| PHASE_ERROR

  DRAFT_OK --> CLAIM_GATE{"Unsupported sensitive candidate claims remain?"}
  DRAFT_PARTIAL --> CLAIM_GATE
  CLAIM_GATE -->|no| REVIEW["Dispatch cv-reviewer with summaries, ledger, and TAILORING_DRAFT"]
  CLAIM_GATE -->|yes| RESOLVE["Resolve by support, safe weakening, exclusion, or verification questions"]
  RESOLVE --> SAFE_DELIVERABLE{"Safe selected-mode deliverable remains?"}
  SAFE_DELIVERABLE -->|yes| REVIEW
  SAFE_DELIVERABLE -->|no| BLOCKED_RISK(["Blocked: unresolved integrity risk"])

  REVIEW --> REVIEW_STATUS{"CV_REVIEW status"}
  REVIEW_STATUS -->|PASS| ASSEMBLE["Assemble selected output with evidence labels"]
  REVIEW_STATUS -->|ERROR| PHASE_ERROR
  REVIEW_STATUS -->|FAIL| FIX_LIMIT{"Targeted fix cycles under 3?"}
  FIX_LIMIT -->|no| BLOCKED_RISK
  FIX_LIMIT -->|yes| EDIT_FIX["Redispatch cv-tailoring-editor with TAILORING_DRAFT and REVIEW_FIXES"]
  EDIT_FIX --> FIX_STATUS{"TAILORING_DRAFT status"}
  FIX_STATUS -->|PASS| DRAFT_OK
  FIX_STATUS -->|PARTIAL| DRAFT_PARTIAL
  FIX_STATUS -->|ERROR| PHASE_ERROR

  ASSEMBLE --> LIMITATIONS{"Limitations ledger non-empty?"}
  LIMITATIONS -->|yes| PARTIAL_OUTPUT["Return selected-mode output with labeled limitations"]
  LIMITATIONS -->|no| MODE{"OUTPUT_MODE"}

  MODE -->|review| REPORT_REVIEW["Return reviewed report"]
  MODE -->|rewrite| REPORT_REWRITE["Return supported rewrites with evidence labels"]
  MODE -->|checklist| REPORT_CHECKLIST["Return prioritized checklist"]
  MODE -->|questions-only| REPORT_QUESTIONS["Return verification questions only"]

  REPORT_REVIEW --> FINAL(["Complete: full reviewed output"])
  REPORT_REWRITE --> FINAL
  REPORT_CHECKLIST --> FINAL
  REPORT_QUESTIONS --> FINAL
  PARTIAL_OUTPUT --> PARTIAL_FINAL(["Complete: partial output with limitations"])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class MODE_INPUT,CHECK_REQUIRED,INTAKE_STATUS,ROLE_STATUS,TAILOR_STATUS,CLAIM_GATE,SAFE_DELIVERABLE,REVIEW_STATUS,FIX_LIMIT,FIX_STATUS,LIMITATIONS,MODE decision;
  class MODE_KEEP,MODE_DEFAULT,INTAKE,EVIDENCE_FULL,EVIDENCE_PARTIAL,ROLE_FIT,ROLE_OK,ROLE_PARTIAL,TAILOR,DRAFT_OK,DRAFT_PARTIAL,RESOLVE,REVIEW,EDIT_FIX,ASSEMBLE check;
  class ASK_REQUIRED guard;
  class REPORT_REVIEW,REPORT_REWRITE,REPORT_CHECKLIST,REPORT_QUESTIONS,PARTIAL_OUTPUT output;
  class FINAL,PARTIAL_FINAL success;
  class BLOCKED_MISSING,BLOCKED_EVIDENCE,BLOCKED_RISK,PHASE_ERROR stop;
```

Completion rule: finish with a full selected-mode output, a partial selected-mode output with propagated limitations, a blocked missing-source status, a blocked insufficient-evidence status, a blocked unresolved-integrity status after three targeted fix cycles or unsafe claim resolution, or a phase error.

Sensitive-action rule: publishable candidate claims, metrics, seniority signals, domain depth claims, and technology/tool claims must be directly supported by `CV` or `APPLICANT_CONTEXT`, safely weakened, excluded, or carried as verification questions. They must not be asserted from background guidance.
