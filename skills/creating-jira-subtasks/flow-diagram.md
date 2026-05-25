# Creating Jira Subtasks

This workflow shares the same Phase 4 shape as the GitHub child-issue flow: the
orchestrator derives routing identifiers, confirms approval for platform writes
and local plan updates, dispatches a worker, routes the returned verdict, and
relays a compact summary. The Jira-specific implementation details are the
`JIRA_URL` input, `TICKET_KEY` plan path, `subtask-creator` worker, Jira parent
ticket verification, subtask refs, and the project subtask issue-type check.

```mermaid
flowchart TD
  START([Start: JIRA_URL received]) --> INPUT{Required URL present?}
  INPUT -->|no| ORCH_BLOCK_INPUT([SUBTASKS: BLOCKED<br/>Validation: NOT_RUN<br/>Missing JIRA_URL])
  INPUT -->|yes| DERIVE[Orchestrator derives workspace, project prefix, TICKET_KEY, and plan path]
  DERIVE --> APPROVAL{Prior approval for Jira writes and plan updates?}
  APPROVAL -->|no| ORCH_BLOCK_APPROVAL([SUBTASKS: BLOCKED<br/>Validation: NOT_RUN<br/>Approval required])
  APPROVAL -->|yes| DISPATCH[Dispatch subtask-creator with JIRA_URL and approved mutation scope]

  DISPATCH --> W_START[Worker receives approved scope]
  W_START --> PLAN{Plan exists with Tasks and Task headings?}
  PLAN -->|no| W_BLOCK_PLAN[Return SUBTASKS: BLOCKED<br/>Validation: NOT_RUN]
  PLAN -->|yes| PARENT{Parent work item verified?}
  PARENT -->|no| W_FAIL_PARENT[Return SUBTASKS: FAIL<br/>Validation: NOT_RUN]
  PARENT -->|yes| PLATFORM{Platform write or reuse path available?}
  PLATFORM -->|no| W_FAIL_PLATFORM[Return SUBTASKS: FAIL<br/>Validation: NOT_RUN]
  PLATFORM -->|yes| PARSE[Parse tasks, Decisions Log, existing Jira Subtask refs, dependencies, and priorities]
  PARSE --> REFS{Existing refs unsafe or conflicting?}
  REFS -->|yes| W_BLOCK_REFS[Return SUBTASKS: BLOCKED<br/>Validation: NOT_RUN]
  REFS -->|no, safe refs or none| MISSING{Any task missing verified traceability?}
  MISSING -->|no| VALIDATE[Validate existing plan against Phase 4 contract]
  MISSING -->|yes| CREATE[Create or reuse missing subtasks sequentially; retry rate limits once]
  CREATE --> PARTIAL{Any write failed after retry?}
  PARTIAL -->|yes| WARN_RECORD[Record warning or failure and continue when remaining traceability is safe]
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
  W_FAIL_PLATFORM --> RECEIVE
  W_BLOCK_REFS --> RECEIVE
  W_FAIL_BOUNDARY --> RECEIVE
  W_SUMMARY_PASS --> RECEIVE
  W_SUMMARY_WARN --> RECEIVE
  W_FAIL_VALIDATE --> RECEIVE
  W_ERROR --> RECEIVE

  RECEIVE --> ROUTE{Route on task verdict and Validation}
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

  class INPUT,APPROVAL,PLAN,PARENT,PLATFORM,REFS,MISSING,PARTIAL,BOUNDARY,VALID,REVALIDATE,ROUTE decision;
  class DERIVE,PARSE,VALIDATE,REPAIR check;
  class DISPATCH,CREATE,WARN_RECORD,UPDATE guard;
  class APPROVAL human;
  class RECEIVE,W_SUMMARY_PASS,W_SUMMARY_WARN output;
  class PASS success;
  class WARN output;
  class ORCH_BLOCK_INPUT,ORCH_BLOCK_APPROVAL,W_BLOCK_PLAN,W_FAIL_PARENT,W_FAIL_PLATFORM,W_BLOCK_REFS,W_FAIL_BOUNDARY,W_FAIL_VALIDATE,W_ERROR,BLOCKED,FAIL,ERROR stop;
```

Readiness rule: report `SUBTASKS: PASS` only when parent lookup, subtask
configuration, existing-ref safety checks, approved subtask creation or reuse,
scoped plan updates, and validation all pass. Existing keys for another parent
block the workflow; missing Decisions Log or partial creates may produce
`SUBTASKS: WARN`. Jira summaries do not include GitHub-style write model or
capability lines.
