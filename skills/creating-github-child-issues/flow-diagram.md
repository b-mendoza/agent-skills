# Creating GitHub Child Issues

This workflow separates orchestration from mutation. The orchestrator derives
routing identifiers from `ISSUE_URL`, confirms prior approval for GitHub writes
and `docs/<ISSUE_SLUG>-tasks.md` updates, dispatches `task-issue-creator`, and
routes the returned verdict. The worker trusts the clarified Phase 4 plan for
task intent, but verifies the parent issue, existing refs, write capability,
mutation boundary, and final plan structure before reporting success.

```mermaid
flowchart TD
  START([Start: ISSUE_URL received]) --> INPUT{ISSUE_URL present?}
  INPUT -->|no| ORCH_BLOCK_INPUT([TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN<br/>Missing ISSUE_URL])
  INPUT -->|yes| DERIVE[Orchestrator derives OWNER, REPO, PARENT_NUMBER, ISSUE_SLUG]
  DERIVE --> APPROVAL{Prior approval for GitHub writes and plan updates?}
  APPROVAL -->|no| ORCH_BLOCK_APPROVAL([TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN<br/>Approval required])
  APPROVAL -->|yes| DISPATCH[Dispatch task-issue-creator with ISSUE_URL and approved mutation scope]

  DISPATCH --> W_START[Worker receives ISSUE_URL]
  W_START --> PLAN{docs/ISSUE_SLUG-tasks.md has Tasks and Task headings?}
  PLAN -->|no| W_BLOCK_PLAN[Return TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN]
  PLAN -->|yes| PARENT{Parent issue verified with gh?}
  PARENT -->|no| W_FAIL_PARENT[Return TASK_ISSUES: FAIL<br/>Validation: NOT_RUN]
  PARENT -->|yes| PARSE[Parse tasks, Decisions Log, existing GitHub Task Issue refs, and prior handoff table]
  PARSE --> REFS{Existing concrete refs unsafe or conflicting?}
  REFS -->|yes| W_BLOCK_REFS[Return TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN]
  REFS -->|no, safe refs or none| CAPABILITY[Select best confirmed path: native sub-issue, linked issue, or task-list fallback]
  CAPABILITY --> MISSING{Any task missing safe traceability?}
  MISSING -->|no| VALIDATE[Validate existing plan against Phase 4 contract]
  MISSING -->|yes| CREATE[Create/link missing task issues or record approved task-list fallback]
  CREATE --> RATE{Rate limited?}
  RATE -->|yes| RETRY[Retry the same request once]
  RATE -->|no| UPDATE[Update only docs/ISSUE_SLUG-tasks.md idempotently]
  RETRY --> RETRY_OK{Retry succeeded?}
  RETRY_OK -->|yes| UPDATE
  RETRY_OK -->|no| W_FAIL_RETRY[Return TASK_ISSUES: FAIL<br/>Validation: NOT_RUN]
  UPDATE --> BOUNDARY{Only approved plan file changed?}
  BOUNDARY -->|no| W_FAIL_BOUNDARY[Return TASK_ISSUES: FAIL<br/>Validation: FAIL]
  BOUNDARY -->|yes| VALIDATE
  VALIDATE --> VALID{Validation passes?}
  VALID -->|yes| W_SUMMARY_OK[Return TASK_ISSUES: PASS or WARN<br/>Validation: PASS]
  VALID -->|no| REPAIR[Repair local markdown once without more GitHub writes]
  REPAIR --> REVALIDATE{Validation passes after repair?}
  REVALIDATE -->|yes| W_SUMMARY_WARN[Return TASK_ISSUES: WARN<br/>Validation: PASS]
  REVALIDATE -->|no| W_FAIL_VALIDATE[Return TASK_ISSUES: FAIL<br/>Validation: FAIL]
  W_START -->|unexpected tool or filesystem failure| W_ERROR[Return TASK_ISSUES: ERROR<br/>Validation: NOT_RUN]

  W_BLOCK_PLAN --> RECEIVE[Orchestrator receives structured worker summary]
  W_FAIL_PARENT --> RECEIVE
  W_BLOCK_REFS --> RECEIVE
  W_FAIL_RETRY --> RECEIVE
  W_FAIL_BOUNDARY --> RECEIVE
  W_SUMMARY_OK --> RECEIVE
  W_SUMMARY_WARN --> RECEIVE
  W_FAIL_VALIDATE --> RECEIVE
  W_ERROR --> RECEIVE

  RECEIVE --> ROUTE{Route on TASK_ISSUES and Validation}
  ROUTE -->|PASS + PASS| PASS([TASK_ISSUES: PASS<br/>Validation: PASS<br/>Ready])
  ROUTE -->|WARN + PASS| WARN([TASK_ISSUES: WARN<br/>Validation: PASS<br/>Ready with caveats])
  ROUTE -->|BLOCKED + NOT_RUN| BLOCKED([TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN<br/>Unsafe to continue])
  ROUTE -->|FAIL + FAIL or NOT_RUN| FAIL([TASK_ISSUES: FAIL<br/>Validation: FAIL or NOT_RUN<br/>Operation failed])
  ROUTE -->|ERROR + NOT_RUN| ERROR([TASK_ISSUES: ERROR<br/>Validation: NOT_RUN<br/>Unexpected failure])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class INPUT,APPROVAL,PLAN,PARENT,REFS,MISSING,RATE,RETRY_OK,BOUNDARY,VALID,REVALIDATE,ROUTE decision;
  class DERIVE,PARSE,CAPABILITY,VALIDATE,REPAIR check;
  class DISPATCH,CREATE,RETRY,UPDATE guard;
  class APPROVAL human;
  class RECEIVE,W_SUMMARY_OK,W_SUMMARY_WARN output;
  class PASS success;
  class WARN output;
  class ORCH_BLOCK_INPUT,ORCH_BLOCK_APPROVAL,W_BLOCK_PLAN,W_FAIL_PARENT,W_BLOCK_REFS,W_FAIL_RETRY,W_FAIL_BOUNDARY,W_FAIL_VALIDATE,W_ERROR,BLOCKED,FAIL,ERROR stop;
```

Readiness rule: report `TASK_ISSUES: PASS` only when parent lookup,
existing-ref safety checks, approved writes or fallback traceability, scoped
plan updates, and validation all pass. The caller-facing rollup must include
write model and capability, but not raw `gh` JSON, REST responses, or full plan
contents.
