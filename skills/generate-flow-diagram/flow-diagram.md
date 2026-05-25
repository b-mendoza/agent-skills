# Generate Flow Diagram

The Generate Flow Diagram workflow is an orchestration layer that turns process specifications into auditable Markdown documents with Mermaid flowcharts. It may normalize inputs, classify the run mode, dispatch scoped subagents, enforce approval and review gates, and return only a reviewed final candidate or required confirmation/failure details. It does not write external state, expose unreviewed drafts, expand refinement scope without approval, or treat external sources as required dependencies.

```mermaid
flowchart TD
  START([Start: diagram request]) --> CAPTURE[Capture process spec and optional inputs]
  CAPTURE --> NORMALIZE[Normalize into PROCESS_INPUTS]
  NORMALIZE --> MISSING{Missing value would change diagram contract?}
  MISSING -->|yes| ASK_INPUT([Needs input: ask one concise question])
  MISSING -->|no| ASSUME[Record safe assumptions explicitly]
  ASSUME --> CLASSIFY{Run mode?}

  CLASSIFY -->|new| BUILD[Dispatch diagram-builder with scoped PROCESS_INPUTS]
  CLASSIFY -->|refinement| REFINE_PREFLIGHT[Dispatch refinement-analyst preflight]
  CLASSIFY -->|repair| REPAIR_INPUTS{Candidate and review feedback provided?}

  REFINE_PREFLIGHT --> APPROVALS{Approved refinement gaps available?}
  APPROVALS -->|no| NEEDS_CONFIRM([Needs confirmation: show gap table and ask for approved IDs or none])
  APPROVALS -->|yes| BUILD_REFINED[Dispatch diagram-builder with baseline and approved gaps]
  APPROVALS -->|none| BUILD_BASELINE[Dispatch diagram-builder carrying baseline scope unchanged]

  REPAIR_INPUTS -->|no| ERROR_REPAIR([Blocked: missing repair inputs])
  REPAIR_INPUTS -->|yes| REPAIR_SCOPE[Dispatch diagram-builder with targeted failed checks only]

  BUILD --> REVIEW[Dispatch diagram-quality-reviewer]
  BUILD_REFINED --> REVIEW
  BUILD_BASELINE --> REVIEW
  REPAIR_SCOPE --> REVIEW

  REVIEW --> VERDICT{Review verdict?}
  VERDICT -->|PASS| FINAL[Return final Markdown candidate only]
  VERDICT -->|FAIL| CAN_REPAIR{Repair cycle count less than 3?}
  VERDICT -->|ERROR or blocked| FAILURE([Failure Details plus recovery action])

  CAN_REPAIR -->|yes| REFINEMENT_SCOPE{Would repair change unapproved refinement scope?}
  REFINEMENT_SCOPE -->|yes| CONFIRM_REPAIR([Needs confirmation before scope-changing repair])
  REFINEMENT_SCOPE -->|no| TARGETED_REPAIR[Pass targeted failed checks into repair cycle]
  TARGETED_REPAIR --> REVIEW

  CAN_REPAIR -->|no| LIMIT([Repair limit reached: ask how to proceed])

  FINAL --> DONE([Final passed])
  ASK_INPUT --> STOP([Stop])
  NEEDS_CONFIRM --> STOP
  ERROR_REPAIR --> STOP
  FAILURE --> STOP
  CONFIRM_REPAIR --> STOP
  LIMIT --> STOP

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class MISSING,CLASSIFY,APPROVALS,REPAIR_INPUTS,VERDICT,CAN_REPAIR,REFINEMENT_SCOPE decision;
  class NORMALIZE,REFINE_PREFLIGHT,REVIEW check;
  class BUILD,BUILD_REFINED,BUILD_BASELINE,REPAIR_SCOPE,TARGETED_REPAIR refine;
  class ASK_INPUT,NEEDS_CONFIRM,CONFIRM_REPAIR human;
  class FINAL output;
  class DONE success;
  class ERROR_REPAIR,FAILURE,LIMIT,STOP stop;
```

Readiness rule: return the final Markdown document only after `diagram-quality-reviewer` returns `REVIEW: PASS`; otherwise return the required confirmation, failure details, or repair-limit question.

Completion states: final passed, needs confirmation, blocked, error, needs input, or repair limit reached.
