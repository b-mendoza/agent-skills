# Improve Skill Definition Flow

This workflow is run by a skill-definition improvement orchestrator. The
orchestrator may normalize routing inputs, default `TARGET_RUNTIME`, choose the
required subagent dispatches, load its own bundled references only when needed,
route on enumerated statuses, and synthesize the final handoff. Raw package
inspection, editing, validation, and target-package source lookup stay inside
focused subagents, which return compact statuses, findings, paths, URLs, and
summaries.

```mermaid
flowchart TD
  START([Start: improve existing skill package]) --> INTAKE["Normalize routing inputs<br/>SKILL_PATH, KNOWN_PROBLEM, SCOPE_LIMITS, REFERENCE_NEED<br/>Default TARGET_RUNTIME to portable Agent Skills when absent"]
  INTAKE --> PATH_OK{"SKILL_PATH present and locatable?"}

  PATH_OK -->|no| PATH_BLOCK["Blocked handoff: missing path<br/>Include one SKILL_PATH question, completed intake checks,<br/>and stop until the user supplies the path"]
  PATH_OK -->|yes| BOUNDARY["Set orchestrator boundary<br/>Allowed: normalize inputs, route statuses, select subagents,<br/>load own refs just in time, synthesize handoff<br/>Forbidden: inspect raw package, edit, validate,<br/>or fetch target-package sources directly"]

  BOUNDARY --> REFS["Reference policy<br/>Keep bundled paths available:<br/>./references/authoring-checklist.md<br/>./references/external-sources.md<br/>./references/final-report-template.md<br/>Load only when the current route needs them"]
  REFS --> STATUS_CONTRACT["Status routing contract<br/>AUDIT: MATERIAL_ISSUES, NO_CHANGE, BLOCKED, ERROR<br/>EDIT: PASS, BLOCKED, ERROR<br/>VALIDATION: PASS, FAIL, BLOCKED, ERROR"]

  STATUS_CONTRACT --> AUDIT["Dispatch skill-package-auditor<br/>Payload: SKILL_PATH, TARGET_RUNTIME, SCOPE_LIMITS,<br/>KNOWN_PROBLEM, REFERENCE_NEED, authoring-checklist path,<br/>external-sources path when needed, mutation limits<br/>Return: AUDIT status, findings, affected paths, URLs, summary"]
  AUDIT --> AUDIT_STATUS{"AUDIT status?"}

  AUDIT_STATUS -->|NO_CHANGE| FINAL_NO_CHANGE["Load final-report-template.md<br/>Return no-change handoff with evidence,<br/>rejected optional improvements, and validation limits"]
  FINAL_NO_CHANGE --> NO_CHANGE([Decision: no change])

  AUDIT_STATUS -->|MATERIAL_ISSUES| SCOPE_GATE{"Required fix inside SCOPE_LIMITS?"}
  SCOPE_GATE -->|no| SCOPE_BLOCK["Blocked handoff: scope decision needed<br/>Include conflict, completed audit checks,<br/>one scope question, and stop until the user decides"]
  SCOPE_GATE -->|yes| EDIT["Dispatch skill-definition-editor<br/>Payload: SKILL_PATH, TARGET_RUNTIME, SCOPE_LIMITS,<br/>AUDIT_REPORT, affected paths, minimal edit plan,<br/>authoring-checklist path, mutation limits<br/>Return: EDIT status, editor report, changed paths, blockers"]

  AUDIT_STATUS -->|BLOCKED| SAFE_GATE{"Audit blocker requires user safe-verdict decision?"}
  SAFE_GATE -->|yes| SAFE_BLOCK["Blocked handoff: safe-verdict decision needed<br/>Include blocker, completed audit checks,<br/>one safe-verdict question, and stop until the user decides"]
  SAFE_GATE -->|no| AUDIT_BLOCK["Blocked handoff: audit blocker<br/>Include blocker, completed checks, recovery action,<br/>and stop until resolved"]
  AUDIT_STATUS -->|ERROR| AUDIT_ERROR["Retain audit error summary"]

  EDIT --> EDIT_STATUS{"EDIT status?"}
  EDIT_STATUS -->|PASS| VALIDATE["Dispatch skill-package-validator<br/>Payload: SKILL_PATH, TARGET_RUNTIME, SCOPE_LIMITS,<br/>AUDIT_REPORT, EDITOR_REPORT, changed paths,<br/>authoring-checklist path<br/>Return: VALIDATION status, checks, findings, risks"]
  EDIT_STATUS -->|BLOCKED| EDIT_BLOCK["Blocked handoff: edit blocker<br/>Include blocker, completed checks,<br/>smallest user decision if any, and stop until resolved"]
  EDIT_STATUS -->|ERROR| EDIT_ERROR["Retain edit error summary"]

  VALIDATE --> VALIDATION_STATUS{"VALIDATION status?"}
  VALIDATION_STATUS -->|PASS| FINAL_CHANGED["Load final-report-template.md<br/>Return changed handoff with material issues,<br/>files changed, validation, resources, and risks"]
  FINAL_CHANGED --> CHANGED([Decision: changed])

  VALIDATION_STATUS -->|FAIL| RETRY_GATE{"Targeted repair cycles used fewer than 3?"}
  RETRY_GATE -->|yes| REPAIR["Re-dispatch skill-definition-editor<br/>Payload: original editor payload plus VALIDATOR_FINDINGS,<br/>repair cycle count, focused fix scope<br/>Return: EDIT status, editor report, changed paths, blockers"]
  RETRY_GATE -->|no| FAIL_BLOCK["Blocked handoff: validation still failing<br/>Include failed checks, attempted repairs,<br/>remaining risks, completed checks, and stop for user decision"]

  REPAIR --> REPAIR_STATUS{"Repair EDIT status?"}
  REPAIR_STATUS -->|PASS| VALIDATE
  REPAIR_STATUS -->|BLOCKED| REPAIR_BLOCK["Blocked handoff: repair blocker<br/>Include blocker, completed checks,<br/>smallest user decision if any, and stop until resolved"]
  REPAIR_STATUS -->|ERROR| REPAIR_ERROR["Retain repair error summary"]

  VALIDATION_STATUS -->|BLOCKED| VALIDATION_BLOCK["Blocked handoff: validation blocker<br/>Include blocker, completed checks, recovery action,<br/>and stop until resolved"]
  VALIDATION_STATUS -->|ERROR| VALIDATION_ERROR["Retain validation error summary"]

  PATH_BLOCK --> FINAL_BLOCKED
  SCOPE_BLOCK --> FINAL_BLOCKED
  SAFE_BLOCK --> FINAL_BLOCKED
  AUDIT_BLOCK --> FINAL_BLOCKED
  EDIT_BLOCK --> FINAL_BLOCKED
  FAIL_BLOCK --> FINAL_BLOCKED
  REPAIR_BLOCK --> FINAL_BLOCKED
  VALIDATION_BLOCK --> FINAL_BLOCKED
  FINAL_BLOCKED["Load final-report-template.md<br/>Return blocked handoff with reason, question,<br/>completed checks, and resume condition"] --> BLOCKED([Decision: blocked])

  AUDIT_ERROR --> FINAL_ERROR
  EDIT_ERROR --> FINAL_ERROR
  REPAIR_ERROR --> FINAL_ERROR
  VALIDATION_ERROR --> FINAL_ERROR
  FINAL_ERROR["Load final-report-template.md<br/>Return error handoff with failed condition<br/>and known context"] --> ERROR([Decision: error])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class BOUNDARY,REFS,STATUS_CONTRACT guard;
  class AUDIT,EDIT,VALIDATE,REPAIR check;
  class PATH_OK,AUDIT_STATUS,SCOPE_GATE,SAFE_GATE,EDIT_STATUS,VALIDATION_STATUS,RETRY_GATE,REPAIR_STATUS decision;
  class PATH_BLOCK,SCOPE_BLOCK,SAFE_BLOCK,AUDIT_BLOCK,EDIT_BLOCK,FAIL_BLOCK,REPAIR_BLOCK,VALIDATION_BLOCK human;
  class FINAL_NO_CHANGE,FINAL_CHANGED,FINAL_BLOCKED,FINAL_ERROR output;
  class NO_CHANGE,CHANGED success;
  class BLOCKED,ERROR,AUDIT_ERROR,EDIT_ERROR,REPAIR_ERROR,VALIDATION_ERROR stop;
```

Readiness rule: A final handoff is ready only after
`./references/final-report-template.md` is loaded and the outcome is one of
`changed`, `no change`, `blocked`, or `error`. A `VALIDATION: FAIL` may trigger
at most three targeted editor/validator repair cycles; after the third failed
validation, return `blocked` with remaining findings and attempted repairs.

Rationale sources: [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents),
[Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices),
and [OpenCode agents](https://opencode.ai/docs/agents/).
