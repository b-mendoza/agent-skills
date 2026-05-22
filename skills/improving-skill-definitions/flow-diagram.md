# Improving Skill Definitions Flow

This workflow is run by a skill-definition improvement orchestrator. The
orchestrator normalizes inputs, dispatches focused subagents, and keeps only
statuses, findings, file paths, fetched URLs, and concise summaries. Raw package
inspection, editing, validation, and external-source lookup happen inside
subagents or bundled references. Edits occur only after an evidence-backed
material issue, and the package must remain standalone with relative bundled
paths.

```mermaid
flowchart TD
  START([Start: improve existing skill package]) --> INTAKE[Normalize SKILL_PATH, known problem, runtime, scope, and reference need]
  INTAKE --> PATH_OK{SKILL_PATH present and locatable?}

  PATH_OK -->|no| ASK_PATH[Ask one focused question for target path]
  ASK_PATH --> LOAD_BLOCKED_TEMPLATE

  PATH_OK -->|yes| BOUNDARY[Set boundary: orchestrator does not inspect raw target files, edit, validate, or fetch sources directly]
  BOUNDARY --> AUDIT[Dispatch skill-package-auditor with checklist path and optional external sources path]

  AUDIT --> AUDIT_STATUS{Audit status?}
  AUDIT_STATUS -->|NO_CHANGE| LOAD_NO_CHANGE_TEMPLATE[Load final-report-template]
  LOAD_NO_CHANGE_TEMPLATE --> NO_CHANGE([Decision: no change])

  AUDIT_STATUS -->|MATERIAL_ISSUES| SCOPE_GATE{Scope limits allow required fix?}
  AUDIT_STATUS -->|BLOCKED| SAFE_VERDICT_GATE{Safe verdict requires user decision?}
  AUDIT_STATUS -->|ERROR| AUDIT_ERROR[Retain error summary]

  SAFE_VERDICT_GATE -->|yes| ASK_SAFE_VERDICT[Ask one focused question needed for safe verdict]
  SAFE_VERDICT_GATE -->|no| AUDIT_BLOCKED[Retain blocker and smallest escalation question]
  ASK_SAFE_VERDICT --> LOAD_BLOCKED_TEMPLATE

  AUDIT_BLOCKED --> LOAD_BLOCKED_TEMPLATE[Load final-report-template]
  LOAD_BLOCKED_TEMPLATE --> BLOCKED([Decision: blocked])

  AUDIT_ERROR --> LOAD_ERROR_TEMPLATE[Load final-report-template]
  LOAD_ERROR_TEMPLATE --> ERROR([Decision: error])

  SCOPE_GATE -->|no| ASK_SCOPE[Ask one focused user decision about the conflicting scope limit]
  ASK_SCOPE --> LOAD_BLOCKED_TEMPLATE

  SCOPE_GATE -->|yes| EDIT[Dispatch skill-definition-editor with audited issues, affected files, minimal edit plan, and scope limits]
  EDIT --> EDIT_STATUS{Edit status?}

  EDIT_STATUS -->|PASS| VALIDATE[Dispatch skill-package-validator with package path, audit report, editor report, and checklist path]
  EDIT_STATUS -->|BLOCKED| EDIT_BLOCKED[Retain edit blocker and smallest escalation question]
  EDIT_STATUS -->|ERROR| EDIT_ERROR[Retain edit error summary]

  EDIT_BLOCKED --> LOAD_BLOCKED_TEMPLATE
  EDIT_ERROR --> LOAD_ERROR_TEMPLATE

  VALIDATE --> VALIDATION_STATUS{Validation status?}
  VALIDATION_STATUS -->|PASS| LOAD_CHANGED_TEMPLATE[Load final-report-template]
  LOAD_CHANGED_TEMPLATE --> CHANGED([Decision: changed])

  VALIDATION_STATUS -->|FAIL| RETRY_GATE{Targeted repair cycles used fewer than 3?}
  RETRY_GATE -->|yes| REPAIR[Re-dispatch editor with only validator findings]
  REPAIR --> REPAIR_STATUS{Repair edit status?}
  REPAIR_STATUS -->|PASS| VALIDATE
  REPAIR_STATUS -->|BLOCKED| REPAIR_BLOCKED[Retain repair blocker and smallest escalation question]
  REPAIR_STATUS -->|ERROR| REPAIR_ERROR[Retain repair error summary]
  REPAIR_BLOCKED --> LOAD_BLOCKED_TEMPLATE
  REPAIR_ERROR --> LOAD_ERROR_TEMPLATE

  RETRY_GATE -->|no| ESCALATE_FAIL[Retain failed checks, repair attempts, and remaining risks]
  ESCALATE_FAIL --> LOAD_BLOCKED_TEMPLATE

  VALIDATION_STATUS -->|BLOCKED| VALIDATION_BLOCKED[Retain validation blocker and smallest escalation question]
  VALIDATION_STATUS -->|ERROR| VALIDATION_ERROR[Retain validation error summary]

  VALIDATION_BLOCKED --> LOAD_BLOCKED_TEMPLATE
  VALIDATION_ERROR --> LOAD_ERROR_TEMPLATE

  NO_CHANGE --> HANDOFF[Return concise handoff with evidence, rejected optional improvements, and validation limits]
  CHANGED --> HANDOFF_CHANGED[Return concise handoff with material issues, files changed, validation, resources, and risks]
  BLOCKED --> HANDOFF_BLOCKED[Return concise blocked handoff with reason, question, and completed checks]
  ERROR --> HANDOFF_ERROR[Return concise error handoff with failed condition and known context]
```
