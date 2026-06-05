# Generate Flow Diagram

The Generate Flow Diagram workflow is an orchestration contract for a skill orchestrator that turns normalized process inputs into Markdown with one Mermaid flowchart, optionally scoped to the orchestrator or a single subagent. It may inspect supplied process specs, existing flows or diagrams, approved refinement gaps, and optional external rationale; dispatches only `refinement-analyst`, `decomposition-planner`, `diagram-builder`, and `diagram-quality-reviewer`; and stops before unapproved scope expansion or unreviewed candidate release. Every mode except `RUN_MODE=decompose` is read-only and stops before file mutation; `RUN_MODE=decompose` writes localized diagrams and load wiring into the target package only after each candidate passes review.

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
  CLASSIFY -->|decompose| DECOMPOSE_INPUTS{PACKAGE_PATH and SUBAGENT_REGISTRY provided?}

  DECOMPOSE_INPUTS -->|no| NEEDS_INPUT
  DECOMPOSE_INPUTS -->|yes| PLAN[Dispatch decomposition-planner for bloat map, earned decision, and coverage audit]
  PLAN --> PLAN_VERDICT{PLAN_VERDICT}
  PLAN_VERDICT -->|PLAN: PASS| SCOPED_GEN[Generate EARNED localized diagrams and slim root via scoped diagram-builder and reviewer with bounded repair]
  PLAN_VERDICT -->|PLAN: NEEDS_INPUT| NEEDS_INPUT
  PLAN_VERDICT -->|PLAN: BLOCKED| BLOCKED
  PLAN_VERDICT -->|PLAN: ERROR| ERROR
  SCOPED_GEN --> SCOPE_GATE{All scoped diagrams pass review within repair budget?}
  SCOPE_GATE -->|no| REPAIR_LIMIT
  SCOPE_GATE -->|yes| WRITE[Write localized diagrams and slim root; wire each owner to load only its own diagram]
  WRITE --> DECOMPOSE_DONE([decomposition complete])

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

  class MISSING,CLASSIFY,REPAIR_INPUTS,PREFLIGHT_VERDICT,BUILD_VERDICT,REVIEW_VERDICT,REPAIR_CAP,REPAIR_SCOPE,DECOMPOSE_INPUTS,PLAN_VERDICT,SCOPE_GATE decision;
  class NORMALIZE,EVIDENCE,PREFLIGHT,REVIEW,PLAN check;
  class BUILD_NEW,BUILD_REFINED,BUILD_BASELINE,BUILD_REPAIR_MODE,REPAIR_FEEDBACK,BUILD_REPAIR_LOOP,SCOPED_GEN refine;
  class NEEDS_CONFIRM human;
  class FINAL_DOC,WRITE output;
  class FINAL_PASSED,DECOMPOSE_DONE success;
  class NEEDS_INPUT,BLOCKED,ERROR,REPAIR_LIMIT stop;
```

Readiness rule: return a candidate only after `PREFLIGHT: PASS` when refinement applies, `BUILD: PASS`, and `REVIEW: PASS`; otherwise return the exact terminal state and its recovery details. For `RUN_MODE=decompose`, write into the package only after `PLAN: PASS` and a `REVIEW: PASS` for every generated diagram.

Completion states: final passed, decomposition complete, needs confirmation, blocked, error, needs input, or repair limit reached.
