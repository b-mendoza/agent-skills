# Improve Skill Definition Flow

This workflow is run by a skill-definition improvement orchestrator. The
orchestrator normalizes inputs, dispatches focused package subagents, and
synthesizes concise decisions. It may read local bundled contracts, dispatch
`skill-package-auditor`, `skill-definition-editor`, and
`skill-package-validator`, ask one focused user question when blocked, and
return a final handoff. Raw inspection, editing, validation, and external-source
lookup stay inside subagents or bundled references. Edits occur only through
`skill-definition-editor` after evidence-backed material issues and scope gate
approval.

```mermaid
flowchart TD
  subgraph INTAKE_PHASE["Phase: Intake"]
    START([Start: improve existing skill package])
    INTAKE[Normalize SKILL_PATH, known problem, runtime, scope, and reference need]
    PATH_OK{SKILL_PATH present and locatable?}
    ASK_PATH[Ask one focused question for target path]
    WAIT_PATH([Stop/wait: user provides SKILL_PATH])
    RESUME_PATH[Resume with provided SKILL_PATH]
    BOUNDARY[Set boundary: orchestrator keeps only verdicts, summaries, statuses, paths, fetched URLs, and user constraints]
  end

  subgraph AUDIT_PHASE["Phase: Audit"]
    AUDIT_CONTRACT["Auditor status contract: NO_CHANGE / MATERIAL_ISSUES / BLOCKED / ERROR"]
    AUDIT[Dispatch skill-package-auditor with ./references/authoring-checklist.md and optional ./references/external-sources.md]
    AUDIT_STATUS{Audit status?}
    SAFE_VERDICT_GATE{Safe verdict requires user decision?}
    ASK_SAFE_VERDICT[Ask one focused question needed for safe verdict]
    WAIT_SAFE_VERDICT([Stop/wait: user provides safe-verdict decision])
    AUDIT_BLOCKED[Retain blocker and smallest escalation question]
    AUDIT_ERROR[Retain error summary]
    SCOPE_GATE{Scope limits allow required fix?}
    ASK_SCOPE[Ask one focused user decision about conflicting scope limit]
    WAIT_SCOPE([Stop/wait: user resolves scope conflict])
  end

  subgraph EDIT_PHASE["Phase: Edit"]
    EDIT_CONTRACT["Editor status contract: PASS / BLOCKED / ERROR"]
    EDIT[Dispatch skill-definition-editor with audited issues, affected files, minimal edit plan, and scope limits]
    EDIT_STATUS{Edit status?}
    ASK_EDIT_BLOCKER[Ask one focused question for editor blocker]
    WAIT_EDIT_BLOCKER([Stop/wait: user resolves editor blocker])
    EDIT_ERROR[Retain edit error summary]
    REPAIR_CONTRACT["Repair editor status contract: PASS / BLOCKED / ERROR"]
    REPAIR[Re-dispatch editor with original required inputs and validator findings as fix scope]
    REPAIR_STATUS{Repair edit status?}
    ASK_REPAIR_BLOCKER[Ask one focused question for repair blocker]
    WAIT_REPAIR_BLOCKER([Stop/wait: user resolves repair blocker])
    REPAIR_ERROR[Retain repair error summary]
  end

  subgraph VALIDATE_PHASE["Phase: Validate"]
    VALIDATOR_CONTRACT["Validator status contract: PASS / FAIL / BLOCKED / ERROR"]
    VALIDATE[Dispatch skill-package-validator with package path, audit report, editor report, and checklist path]
    VALIDATION_STATUS{Validation status?}
    RETRY_GATE{Targeted repair cycles used fewer than 3?}
    ASK_VALIDATION_BLOCKER[Ask one focused question for validation blocker]
    WAIT_VALIDATION_BLOCKER([Stop/wait: user resolves validation blocker])
    VALIDATION_ERROR[Retain validation error summary]
    ESCALATE_FAIL[Retain failed checks, repair attempts, and remaining risks]
  end

  subgraph HANDOFF_PHASE["Phase: Handoff"]
    LOAD_NO_CHANGE_TEMPLATE[Load ./references/final-report-template.md]
    LOAD_CHANGED_TEMPLATE[Load ./references/final-report-template.md]
    LOAD_BLOCKED_TEMPLATE[Load ./references/final-report-template.md]
    LOAD_ERROR_TEMPLATE[Load ./references/final-report-template.md]
    HANDOFF_NO_CHANGE[Return concise handoff with evidence, rejected optional improvements, and validation limits]
    HANDOFF_CHANGED[Return concise handoff with material issues, files changed, validation, resources, and risks]
    HANDOFF_BLOCKED[Return concise blocked handoff with reason, question, and completed checks]
    HANDOFF_ERROR[Return concise error handoff with failed condition and known context]
    NO_CHANGE([Decision: no change])
    CHANGED([Decision: changed])
    BLOCKED([Decision: blocked])
    ERROR([Decision: error])
  end

  START --> INTAKE
  INTAKE --> PATH_OK
  PATH_OK -->|no| ASK_PATH
  ASK_PATH --> WAIT_PATH
  WAIT_PATH -.->|user replies| RESUME_PATH
  RESUME_PATH --> INTAKE
  PATH_OK -->|yes| BOUNDARY

  BOUNDARY --> AUDIT_CONTRACT
  AUDIT_CONTRACT --> AUDIT
  AUDIT --> AUDIT_STATUS
  AUDIT_STATUS -->|NO_CHANGE| LOAD_NO_CHANGE_TEMPLATE
  AUDIT_STATUS -->|MATERIAL_ISSUES| SCOPE_GATE
  AUDIT_STATUS -->|BLOCKED| SAFE_VERDICT_GATE
  AUDIT_STATUS -->|ERROR| AUDIT_ERROR

  SAFE_VERDICT_GATE -->|yes| ASK_SAFE_VERDICT
  ASK_SAFE_VERDICT --> WAIT_SAFE_VERDICT
  WAIT_SAFE_VERDICT -.->|user replies| AUDIT
  SAFE_VERDICT_GATE -->|no| AUDIT_BLOCKED

  SCOPE_GATE -->|no| ASK_SCOPE
  ASK_SCOPE --> WAIT_SCOPE
  WAIT_SCOPE -.->|user replies| SCOPE_GATE
  SCOPE_GATE -->|yes| EDIT_CONTRACT

  EDIT_CONTRACT --> EDIT
  EDIT --> EDIT_STATUS
  EDIT_STATUS -->|PASS| VALIDATOR_CONTRACT
  EDIT_STATUS -->|BLOCKED| ASK_EDIT_BLOCKER
  ASK_EDIT_BLOCKER --> WAIT_EDIT_BLOCKER
  WAIT_EDIT_BLOCKER -.->|user replies| EDIT
  EDIT_STATUS -->|ERROR| EDIT_ERROR

  VALIDATOR_CONTRACT --> VALIDATE
  VALIDATE --> VALIDATION_STATUS
  VALIDATION_STATUS -->|PASS| LOAD_CHANGED_TEMPLATE
  VALIDATION_STATUS -->|FAIL| RETRY_GATE
  VALIDATION_STATUS -->|BLOCKED| ASK_VALIDATION_BLOCKER
  ASK_VALIDATION_BLOCKER --> WAIT_VALIDATION_BLOCKER
  WAIT_VALIDATION_BLOCKER -.->|user replies| VALIDATE
  VALIDATION_STATUS -->|ERROR| VALIDATION_ERROR

  RETRY_GATE -->|yes| REPAIR_CONTRACT
  REPAIR_CONTRACT --> REPAIR
  REPAIR --> REPAIR_STATUS
  REPAIR_STATUS -->|PASS| VALIDATE
  REPAIR_STATUS -->|BLOCKED| ASK_REPAIR_BLOCKER
  ASK_REPAIR_BLOCKER --> WAIT_REPAIR_BLOCKER
  WAIT_REPAIR_BLOCKER -.->|user replies| REPAIR
  REPAIR_STATUS -->|ERROR| REPAIR_ERROR
  RETRY_GATE -->|no| ESCALATE_FAIL

  AUDIT_BLOCKED --> LOAD_BLOCKED_TEMPLATE
  AUDIT_ERROR --> LOAD_ERROR_TEMPLATE
  EDIT_ERROR --> LOAD_ERROR_TEMPLATE
  REPAIR_ERROR --> LOAD_ERROR_TEMPLATE
  VALIDATION_ERROR --> LOAD_ERROR_TEMPLATE
  ESCALATE_FAIL --> LOAD_BLOCKED_TEMPLATE

  LOAD_NO_CHANGE_TEMPLATE --> HANDOFF_NO_CHANGE
  LOAD_CHANGED_TEMPLATE --> HANDOFF_CHANGED
  LOAD_BLOCKED_TEMPLATE --> HANDOFF_BLOCKED
  LOAD_ERROR_TEMPLATE --> HANDOFF_ERROR
  HANDOFF_NO_CHANGE --> NO_CHANGE
  HANDOFF_CHANGED --> CHANGED
  HANDOFF_BLOCKED --> BLOCKED
  HANDOFF_ERROR --> ERROR

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef wait fill:#fff3cd,stroke:#856404,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class PATH_OK,AUDIT_STATUS,SAFE_VERDICT_GATE,SCOPE_GATE,EDIT_STATUS,VALIDATION_STATUS,RETRY_GATE,REPAIR_STATUS decision;
  class BOUNDARY,SAFE_VERDICT_GATE,SCOPE_GATE,RETRY_GATE guard;
  class AUDIT,EDIT,VALIDATE,REPAIR check;
  class ASK_PATH,ASK_SAFE_VERDICT,ASK_SCOPE,ASK_EDIT_BLOCKER,ASK_REPAIR_BLOCKER,ASK_VALIDATION_BLOCKER human;
  class WAIT_PATH,WAIT_SAFE_VERDICT,WAIT_SCOPE,WAIT_EDIT_BLOCKER,WAIT_REPAIR_BLOCKER,WAIT_VALIDATION_BLOCKER wait;
  class LOAD_NO_CHANGE_TEMPLATE,LOAD_CHANGED_TEMPLATE,LOAD_BLOCKED_TEMPLATE,LOAD_ERROR_TEMPLATE,HANDOFF_NO_CHANGE,HANDOFF_CHANGED,HANDOFF_BLOCKED,HANDOFF_ERROR output;
  class NO_CHANGE,CHANGED success;
  class BLOCKED,ERROR,AUDIT_BLOCKED,AUDIT_ERROR,EDIT_ERROR,REPAIR_ERROR,VALIDATION_ERROR,ESCALATE_FAIL stop;
```

Readiness rule: A final handoff is ready only after
`./references/final-report-template.md` is loaded and the outcome is one of
`changed`, `no change`, `blocked`, or `error`. User-question branches stop and
wait for the requested answer before resuming the relevant phase; they are not
the same operation as returning a blocked handoff. Failed validation may trigger
at most three targeted editor and validator repair cycles. If validation still
returns `FAIL` after the third cycle, report a blocked decision with remaining
findings and attempted repairs.
