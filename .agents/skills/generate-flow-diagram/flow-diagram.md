# Generate Flow Diagram

The Generate Flow Diagram workflow is a read-only orchestration contract for a skill orchestrator that turns normalized process inputs into Markdown with one Mermaid flowchart. It may inspect supplied process specs, existing flows or diagrams, approved refinement gaps, and optional external rationale; dispatches only `refinement-analyst`, `diagram-builder`, and `diagram-quality-reviewer`; and stops before file mutation, unapproved scope expansion, or unreviewed candidate release.

```mermaid
flowchart TD
  START([Start: diagram request]) --> CAPTURE[Capture PROCESS_SPEC and/or baseline, refinement request, and approvals]
  CAPTURE --> NORMALIZE[Normalize PROCESS_INPUTS from spec or baseline]
  NORMALIZE --> MISSING{Missing value changes diagram contract?}
  MISSING -->|yes| NEEDS_INPUT([needs input])
  MISSING -->|no| ASSUME[Record safe assumptions explicitly]
  ASSUME --> EVIDENCE[Load only needed bundled references and supplied rationale]
  EVIDENCE --> CLASSIFY{RUN_MODE?}

  CLASSIFY -->|new| BUILD_NEW[Dispatch diagram-builder with RUN_MODE=new]
  CLASSIFY -->|refinement| PREFLIGHT[Dispatch refinement-analyst with baseline, request, PROCESS_INPUTS, and approvals]
  CLASSIFY -->|repair| REPAIR_INPUTS{Candidate and REVIEW_FEEDBACK provided?}

  PREFLIGHT --> PREFLIGHT_VERDICT{PREFLIGHT_VERDICT}
  PREFLIGHT_VERDICT -->|PREFLIGHT: PASS with approved IDs| BUILD_REFINED[Dispatch diagram-builder with RUN_MODE=refinement and approved gaps]
  PREFLIGHT_VERDICT -->|PREFLIGHT: PASS with no gaps or scope none| BUILD_BASELINE[Dispatch diagram-builder with RUN_MODE=refinement and no-op scope]
  PREFLIGHT_VERDICT -->|PREFLIGHT: NEEDS_CONFIRMATION missing approvals| NEEDS_CONFIRM([needs confirmation])
  PREFLIGHT_VERDICT -->|PREFLIGHT: NEEDS_CONFIRMATION unknown IDs| NEEDS_CONFIRM
  PREFLIGHT_VERDICT -->|PREFLIGHT: BLOCKED| BLOCKED([blocked])
  PREFLIGHT_VERDICT -->|PREFLIGHT: ERROR| ERROR([error])

  REPAIR_INPUTS -->|no| NEEDS_INPUT
  REPAIR_INPUTS -->|yes| BUILD_REPAIR_MODE[Dispatch diagram-builder with RUN_MODE=repair and supplied review feedback]

  BUILD_NEW --> BUILD_VERDICT{BUILD_VERDICT}
  BUILD_REFINED --> BUILD_VERDICT
  BUILD_BASELINE --> BUILD_VERDICT
  BUILD_REPAIR_MODE --> BUILD_VERDICT
  BUILD_REPAIR_LOOP --> BUILD_VERDICT

  BUILD_VERDICT -->|BUILD: PASS| REVIEW[Dispatch full diagram-quality-reviewer with candidate, PROCESS_INPUTS, baseline, and approval scope]
  BUILD_VERDICT -->|BUILD: NEEDS_INPUT| NEEDS_INPUT
  BUILD_VERDICT -->|BUILD: ERROR| ERROR

  REVIEW --> REVIEW_VERDICT{REVIEW_VERDICT}
  REVIEW_VERDICT -->|REVIEW: PASS| FINAL_DOC[Return reviewed Markdown candidate only]
  REVIEW_VERDICT -->|REVIEW: FAIL| REPAIR_CAP{Repair cycles less than 3?}
  REVIEW_VERDICT -->|REVIEW: BLOCKED| BLOCKED
  REVIEW_VERDICT -->|REVIEW: ERROR| ERROR

  REPAIR_CAP -->|no| REPAIR_LIMIT([repair limit reached])
  REPAIR_CAP -->|yes| REPAIR_SCOPE{Repair exceeds approved refinement scope?}
  REPAIR_SCOPE -->|yes or scope none| NEEDS_CONFIRM
  REPAIR_SCOPE -->|no| REPAIR_FEEDBACK[Package targeted REVIEW_FEEDBACK and original baseline/scope]
  REPAIR_FEEDBACK --> BUILD_REPAIR_LOOP[Dispatch diagram-builder with RUN_MODE=repair]

  FINAL_DOC --> FINAL_PASSED([final passed])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class MISSING,CLASSIFY,REPAIR_INPUTS,PREFLIGHT_VERDICT,BUILD_VERDICT,REVIEW_VERDICT,REPAIR_CAP,REPAIR_SCOPE decision;
  class NORMALIZE,EVIDENCE,PREFLIGHT,REVIEW check;
  class BUILD_NEW,BUILD_REFINED,BUILD_BASELINE,BUILD_REPAIR_MODE,REPAIR_FEEDBACK,BUILD_REPAIR_LOOP refine;
  class NEEDS_CONFIRM human;
  class FINAL_DOC output;
  class FINAL_PASSED success;
  class NEEDS_INPUT,BLOCKED,ERROR,REPAIR_LIMIT stop;
```

Readiness rule: return a candidate only after `PREFLIGHT: PASS` when refinement applies, `BUILD: PASS`, and `REVIEW: PASS`; otherwise return the exact terminal state and its recovery details.

Completion states: final passed, needs confirmation, blocked, error, needs input, or repair limit reached.
