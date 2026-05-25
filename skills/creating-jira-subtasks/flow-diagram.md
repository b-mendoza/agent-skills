# Creating Jira Subtasks

This workflow separates orchestration from Jira mutation. The orchestrator
derives `TICKET_KEY` from `JIRA_URL`, confirms prior approval for Jira writes
and `docs/<TICKET_KEY>-tasks.md` updates, dispatches `subtask-creator`, and
routes the returned verdict. The worker trusts the clarified Phase 4 plan for
task intent, but verifies the parent ticket, subtask configuration, existing
Jira keys, mutation boundary, and final plan structure before reporting
success.

```mermaid
flowchart TD
  START([Start: JIRA_URL received]) --> INPUT{JIRA_URL present?}
  INPUT -->|no| ORCH_BLOCK_INPUT([SUBTASKS: BLOCKED<br/>Validation: NOT_RUN<br/>Missing JIRA_URL])
  INPUT -->|yes| DERIVE[Orchestrator derives workspace, project prefix, TICKET_KEY]
  DERIVE --> APPROVAL{Prior approval for Jira writes and plan updates?}
  APPROVAL -->|no| ORCH_BLOCK_APPROVAL([SUBTASKS: BLOCKED<br/>Validation: NOT_RUN<br/>Approval required])
  APPROVAL -->|yes| DISPATCH[Dispatch subtask-creator with JIRA_URL and approved mutation scope]

  DISPATCH --> W_START[Worker receives JIRA_URL]
  W_START --> PLAN{docs/TICKET_KEY-tasks.md has Tasks and Task headings?}
  PLAN -->|no| W_BLOCK_PLAN[Return SUBTASKS: BLOCKED<br/>Validation: NOT_RUN]
  PLAN -->|yes| PARENT{Parent ticket verified and project key confirmed?}
  PARENT -->|no| W_FAIL_PARENT[Return SUBTASKS: FAIL<br/>Validation: NOT_RUN]
  PARENT -->|yes| CONFIG{Subtask issue type configured?}
  CONFIG -->|no| W_FAIL_CONFIG[Return SUBTASKS: FAIL<br/>Validation: NOT_RUN]
  CONFIG -->|yes| PARSE[Parse tasks, Decisions Log, existing Jira Subtask refs, dependencies, and priorities]
  PARSE --> REFS{Existing concrete Jira keys valid for this parent?}
  REFS -->|no| W_BLOCK_REFS[Return SUBTASKS: BLOCKED<br/>Validation: NOT_RUN]
  REFS -->|yes or none| MISSING{Any task missing a verified subtask?}
  MISSING -->|no| VALIDATE[Validate existing plan against Phase 4 contract]
  MISSING -->|yes| CREATE[Create missing subtasks sequentially; retry rate limits once]
  CREATE --> PARTIAL{Any create failed after retry?}
  PARTIAL -->|yes| WARN_RECORD[Record failure as warning when remaining traceability can validate]
  PARTIAL -->|no| UPDATE[Update only docs/TICKET_KEY-tasks.md idempotently]
  WARN_RECORD --> UPDATE
  UPDATE --> BOUNDARY{Only approved plan file changed?}
  BOUNDARY -->|no| W_FAIL_BOUNDARY[Return SUBTASKS: FAIL<br/>Validation: FAIL]
  BOUNDARY -->|yes| VALIDATE
  VALIDATE --> VALID{Validation passes?}
  VALID -->|yes, no warnings| W_SUMMARY_PASS[Return SUBTASKS: PASS<br/>Validation: PASS]
  VALID -->|yes, warnings| W_SUMMARY_WARN[Return SUBTASKS: WARN<br/>Validation: PASS]
  VALID -->|no| REPAIR[Repair local markdown once without more Jira writes]
  REPAIR --> REVALIDATE{Validation passes after repair?}
  REVALIDATE -->|yes| W_SUMMARY_WARN
  REVALIDATE -->|no| W_FAIL_VALIDATE[Return SUBTASKS: FAIL<br/>Validation: FAIL]
  W_START -->|unexpected tool, filesystem, or environment failure| W_ERROR[Return SUBTASKS: ERROR<br/>Validation: NOT_RUN]

  W_BLOCK_PLAN --> RECEIVE[Orchestrator receives structured worker summary]
  W_FAIL_PARENT --> RECEIVE
  W_FAIL_CONFIG --> RECEIVE
  W_BLOCK_REFS --> RECEIVE
  W_FAIL_BOUNDARY --> RECEIVE
  W_SUMMARY_PASS --> RECEIVE
  W_SUMMARY_WARN --> RECEIVE
  W_FAIL_VALIDATE --> RECEIVE
  W_ERROR --> RECEIVE

  RECEIVE --> ROUTE{Route on SUBTASKS and Validation}
  ROUTE -->|PASS + PASS| PASS([SUBTASKS: PASS<br/>Validation: PASS<br/>Subtasks ready])
  ROUTE -->|WARN + PASS| WARN([SUBTASKS: WARN<br/>Validation: PASS<br/>Subtasks ready with caveats])
  ROUTE -->|BLOCKED + NOT_RUN| BLOCKED([SUBTASKS: BLOCKED<br/>Validation: NOT_RUN<br/>Unsafe to continue])
  ROUTE -->|FAIL + FAIL or NOT_RUN| FAIL([SUBTASKS: FAIL<br/>Validation: FAIL or NOT_RUN<br/>Operation failed])
  ROUTE -->|ERROR + NOT_RUN| ERROR([SUBTASKS: ERROR<br/>Validation: NOT_RUN<br/>Unexpected failure])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class INPUT,APPROVAL,PLAN,PARENT,CONFIG,REFS,MISSING,PARTIAL,BOUNDARY,VALID,REVALIDATE,ROUTE decision;
  class DERIVE,PARSE,VALIDATE,REPAIR check;
  class DISPATCH,CREATE,WARN_RECORD,UPDATE guard;
  class APPROVAL human;
  class RECEIVE,W_SUMMARY_PASS,W_SUMMARY_WARN output;
  class PASS success;
  class WARN output;
  class ORCH_BLOCK_INPUT,ORCH_BLOCK_APPROVAL,W_BLOCK_PLAN,W_FAIL_PARENT,W_FAIL_CONFIG,W_BLOCK_REFS,W_FAIL_BOUNDARY,W_FAIL_VALIDATE,W_ERROR,BLOCKED,FAIL,ERROR stop;
```

Readiness rule: report `SUBTASKS: PASS` only when parent lookup, subtask
configuration, existing-key safety checks, approved subtask creation or reuse,
scoped plan updates, and validation all pass. Existing keys for another parent
block the workflow; missing Decisions Log or partial creates may produce
`SUBTASKS: WARN`.
