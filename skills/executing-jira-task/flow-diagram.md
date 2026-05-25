# executing-jira-task

Per-task execution orchestrator for exactly one planned Jira workflow task
identified by `TICKET_KEY` and `TASK_NUMBER`. It may read Phase 1-6 handoff
artifacts, dispatch one specialist at a time, mutate Category B source, tests,
and config through approved execution paths, update Category A workflow tracking
only outside git, and assemble a final task report. It must stop before Jira
kickoff or execution unless critique approval and readiness are confirmed, and
it never continues to another task.

```mermaid
flowchart TD
  START([Start executing-jira-task]) --> INPUTS["Read TICKET_KEY and TASK_NUMBER"]
  INPUTS --> CONTRACTS["Read ./references/contracts.md for Phase 1-6 artifacts, readiness, kickoff, and handoff shapes"]
  CONTRACTS --> REQUIRED{"Required Phase 1-6 artifacts exist and align?"}
  REQUIRED -->|no| REPORT_BLOCKED["Assemble FINAL_TASK_REPORT: status BLOCKED"]
  REQUIRED -->|yes| READY{"Critique approved, selected task ready, and branch usable?"}
  READY -->|no| REPORT_BLOCKED
  READY -->|yes| SCOPE["Set mutation boundary: Category A out of git; Category B source/tests/config may change"]
  SCOPE --> KICKOFF["Dispatch execution-starter for Jira kickoff"]

  KICKOFF --> KICKOFF_STATUS{"KICKOFF_REPORT status"}
  KICKOFF_STATUS -->|READY| EXECUTE["Dispatch task-executor"]
  KICKOFF_STATUS -->|BLOCKED or ERROR| RECOVERY["Read ./references/retry-and-escalation.md; preserve completed phase results"]

  EXECUTE --> EXEC_STATUS{"EXECUTION_REPORT status"}
  EXEC_STATUS -->|COMPLETE| DOCUMENT["Dispatch documentation-writer (UPDATE_TRACKING): docs + Category A tracking"]
  EXEC_STATUS -->|NEEDS_CONTEXT, BLOCKED, or ERROR| RECOVERY

  DOCUMENT --> DOC_STATUS{"DOCUMENTATION_REPORT status"}
  DOC_STATUS -->|COMPLETE| VERIFY["Dispatch requirements-verifier"]
  DOC_STATUS -->|BLOCKED or ERROR| RECOVERY

  VERIFY --> VERIFY_STATUS{"VERIFICATION_RESULT"}
  VERIFY_STATUS -->|PASS| CLEAN["Dispatch clean-code-reviewer"]
  VERIFY_STATUS -->|FAIL: in-scope gaps| REQ_ATTEMPTS{"Requirements fix attempts < 3?"}
  VERIFY_STATUS -->|BLOCKED or ERROR| RECOVERY

  REQ_ATTEMPTS -->|yes| REQ_FIX["Build requirements fix brief from verifier findings; increment attempt count"]
  REQ_ATTEMPTS -->|no| REPORT_ESCALATED["Assemble FINAL_TASK_REPORT: status ESCALATED"]
  REQ_FIX --> REQ_EXEC["Re-dispatch task-executor with requirements fix brief"]
  REQ_EXEC --> REQ_DOC["Re-dispatch documentation-writer (UPDATE_TRACKING)"]
  REQ_DOC --> VERIFY

  CLEAN --> CLEAN_STATUS{"Clean-code verdict"}
  CLEAN_STATUS -->|PASS or PASS WITH SUGGESTIONS| ARCH["Dispatch architecture-reviewer"]
  CLEAN_STATUS -->|NEEDS FIXES| CLEAN_ATTEMPTS{"Clean-code fix attempts < 3?"}
  CLEAN_STATUS -->|BLOCKED or ERROR| RECOVERY
  CLEAN_ATTEMPTS -->|yes| CLEAN_FIX["Build clean-code fix brief from reviewer findings; increment attempt count"]
  CLEAN_ATTEMPTS -->|no| REPORT_ESCALATED
  CLEAN_FIX --> CLEAN_EXEC["Re-dispatch task-executor with clean-code fix brief"]
  CLEAN_EXEC --> CLEAN_DOC["Re-dispatch documentation-writer (UPDATE_TRACKING)"]
  CLEAN_DOC --> RERUN_CLEAN["Re-run clean-code-reviewer only"]
  RERUN_CLEAN --> CLEAN_STATUS

  ARCH --> ARCH_STATUS{"Architecture verdict"}
  ARCH_STATUS -->|PASS or PASS WITH SUGGESTIONS| SECURITY["Dispatch security-auditor"]
  ARCH_STATUS -->|NEEDS FIXES| ARCH_ATTEMPTS{"Architecture fix attempts < 3?"}
  ARCH_STATUS -->|BLOCKED or ERROR| RECOVERY
  ARCH_ATTEMPTS -->|yes| ARCH_FIX["Build architecture fix brief from reviewer findings; increment attempt count"]
  ARCH_ATTEMPTS -->|no| REPORT_ESCALATED
  ARCH_FIX --> ARCH_EXEC["Re-dispatch task-executor with architecture fix brief"]
  ARCH_EXEC --> ARCH_DOC["Re-dispatch documentation-writer (UPDATE_TRACKING)"]
  ARCH_DOC --> RERUN_ARCH["Re-run architecture-reviewer only"]
  RERUN_ARCH --> ARCH_STATUS

  SECURITY --> SECURITY_STATUS{"Security verdict"}
  SECURITY_STATUS -->|PASS or PASS WITH ADVISORIES| FINALIZE["Dispatch documentation-writer (FINALIZE_TRACKER)"]
  SECURITY_STATUS -->|NEEDS FIXES| SECURITY_ATTEMPTS{"Security fix attempts < 3?"}
  SECURITY_STATUS -->|BLOCKED or ERROR| RECOVERY
  FINALIZE --> FINALIZE_STATUS{"FINAL_TRACKING_REPORT status"}
  FINALIZE_STATUS -->|COMPLETE| REPORT_COMPLETE["Read ./references/template-final-report.md and assemble FINAL_TASK_REPORT: status COMPLETE"]
  FINALIZE_STATUS -->|BLOCKED or ERROR| RECOVERY
  SECURITY_ATTEMPTS -->|yes| SECURITY_FIX["Build security fix brief from auditor findings; increment attempt count"]
  SECURITY_ATTEMPTS -->|no| REPORT_ESCALATED
  SECURITY_FIX --> SECURITY_EXEC["Re-dispatch task-executor with security fix brief"]
  SECURITY_EXEC --> SECURITY_DOC["Re-dispatch documentation-writer (UPDATE_TRACKING)"]
  SECURITY_DOC --> RERUN_SECURITY["Re-run security-auditor only"]
  RERUN_SECURITY --> SECURITY_STATUS

  RECOVERY --> RECOVERY_CONTEXT{"New context, fix brief, explicit user decision, or restored Jira capability available?"}
  RECOVERY_CONTEXT -->|no| REPORT_USER
  RECOVERY_CONTEXT -->|yes| RECOVERY_SAFE{"Affected retry path still safe and within budget?"}
  RECOVERY_SAFE -->|no| REPORT_ESCALATED
  RECOVERY_SAFE -->|yes| TARGETED_RETRY["Retry affected step only with updated context; do not restart passed phases"]
  TARGETED_RETRY --> AFFECTED{"Affected phase"}
  AFFECTED -->|kickoff| KICKOFF
  AFFECTED -->|execution| EXECUTE
  AFFECTED -->|documentation| DOCUMENT
  AFFECTED -->|requirements| VERIFY
  AFFECTED -->|clean-code| CLEAN
  AFFECTED -->|architecture| ARCH
  AFFECTED -->|security| SECURITY
  AFFECTED -->|tracker-finalization| FINALIZE

  REPORT_COMPLETE --> STOP_SELECTED([Stop after TASK_NUMBER; no next task dispatch])
  REPORT_BLOCKED --> STOP_SELECTED
  REPORT_USER --> STOP_SELECTED
  REPORT_ESCALATED --> STOP_SELECTED

  class REQUIRED,READY,KICKOFF_STATUS,EXEC_STATUS,DOC_STATUS,VERIFY_STATUS,REQ_ATTEMPTS,CLEAN_STATUS,CLEAN_ATTEMPTS,ARCH_STATUS,ARCH_ATTEMPTS,SECURITY_STATUS,SECURITY_ATTEMPTS,FINALIZE_STATUS,RECOVERY_CONTEXT,RECOVERY_SAFE,AFFECTED decision;
  class INPUTS,CONTRACTS,SCOPE,KICKOFF,EXECUTE,DOCUMENT,VERIFY,CLEAN,ARCH,SECURITY,FINALIZE,REQ_EXEC,REQ_DOC,CLEAN_EXEC,CLEAN_DOC,RERUN_CLEAN,ARCH_EXEC,ARCH_DOC,RERUN_ARCH,SECURITY_EXEC,SECURITY_DOC,RERUN_SECURITY,RECOVERY,TARGETED_RETRY check;
  class REQ_FIX,CLEAN_FIX,ARCH_FIX,SECURITY_FIX refine;
  class REPORT_COMPLETE,REPORT_BLOCKED,REPORT_USER,REPORT_ESCALATED output;
  class STOP_SELECTED stop;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

Readiness rule: Jira kickoff and execution are forbidden until the selected
task has valid Phase 1-6 handoff artifacts, explicit critique approval, resolved
or consciously waived questions, a planner-generated branch, and no blocking
contradiction.

Retry rule: requirements verification and each quality gate get at most three
targeted fix attempts. A generic retry is valid only with new context, a fix
brief, an explicit user decision, or restored Jira capability, and it resumes
the affected step without repeating already passed phases.

Final status contract: return exactly one `FINAL_TASK_REPORT` status:
`COMPLETE`, `BLOCKED`, `STOPPED_FOR_USER_INPUT`, or `ESCALATED`. Every final
report includes evidence checked, retry counts, changed files, Category A
tracking paths, final tracker completion or skips, unresolved blockers, and the
next required action.
