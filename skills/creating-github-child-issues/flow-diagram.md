# Creating GitHub Child Issues

This workflow shares the same Phase 4 shape as the Jira subtask flow: the
orchestrator derives routing identifiers, confirms approval for platform writes
and local plan updates, dispatches a worker, routes the returned verdict, and
relays a compact summary. The GitHub-specific implementation details are the
`ISSUE_URL` input, `ISSUE_SLUG` plan path, `task-issue-creator` worker, GitHub
parent issue verification, task issue refs, and write-path selection across
native sub-issues, linked issues, or task-list fallback.

```mermaid
flowchart TD
  START([Start: ISSUE_URL received]) --> INPUT{Required URL present?}
  INPUT -->|no| ORCH_BLOCK_INPUT([TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN<br/>Missing ISSUE_URL])
  INPUT -->|yes| DERIVE[Orchestrator derives OWNER, REPO, PARENT_NUMBER, ISSUE_SLUG, and plan path]
  DERIVE --> APPROVAL{Prior approval for GitHub writes and plan updates?}
  APPROVAL -->|no| ORCH_BLOCK_APPROVAL([TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN<br/>Approval required])
  APPROVAL -->|yes| DISPATCH[Dispatch task-issue-creator with ISSUE_URL and approved mutation scope]

  DISPATCH --> W_START[Worker receives approved scope]
  W_START --> PLAN{Plan exists with Tasks and Task headings?}
  PLAN -->|no| W_BLOCK_PLAN[Return TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN]
  PLAN -->|yes| PARENT{Parent work item verified?}
  PARENT -->|no| W_FAIL_PARENT[Return TASK_ISSUES: FAIL<br/>Validation: NOT_RUN]
  PARENT -->|yes| PLATFORM{Platform write or reuse path available?}
  PLATFORM -->|no| W_FAIL_PLATFORM[Return TASK_ISSUES: FAIL<br/>Validation: NOT_RUN]
  PLATFORM -->|yes| PARSE[Parse tasks, Decisions Log, existing GitHub Task Issue refs, dependencies, and priorities]
  PARSE --> REFS{Existing refs unsafe or conflicting?}
  REFS -->|yes| W_BLOCK_REFS[Return TASK_ISSUES: BLOCKED<br/>Validation: NOT_RUN]
  REFS -->|no, safe refs or none| MISSING{Any task missing verified traceability?}
  MISSING -->|no| VALIDATE[Validate existing plan against Phase 4 contract]
  MISSING -->|yes| CREATE[Create, link, reuse, or record task-list fallback for missing task issues; retry rate limits once]
  CREATE --> PARTIAL{Any write failed after retry?}
  PARTIAL -->|yes| WARN_RECORD[Record warning or failure and continue when remaining traceability is safe]
  PARTIAL -->|no| UPDATE[Update only docs/ISSUE_SLUG-tasks.md idempotently]
  WARN_RECORD --> UPDATE
  UPDATE --> BOUNDARY{Only approved plan file changed?}
  BOUNDARY -->|no| W_FAIL_BOUNDARY[Return TASK_ISSUES: FAIL<br/>Validation: FAIL]
  BOUNDARY -->|yes| VALIDATE
  VALIDATE --> VALID{Validation passes?}
  VALID -->|yes, no warnings| W_SUMMARY_PASS[Return TASK_ISSUES: PASS<br/>Validation: PASS]
  VALID -->|yes, warnings| W_SUMMARY_WARN[Return TASK_ISSUES: WARN<br/>Validation: PASS]
  VALID -->|no| REPAIR[Repair local markdown once without more GitHub writes]
  REPAIR --> REVALIDATE{Validation passes after repair?}
  REVALIDATE -->|yes| W_SUMMARY_WARN
  REVALIDATE -->|no| W_FAIL_VALIDATE[Return TASK_ISSUES: FAIL<br/>Validation: FAIL]
  W_START -->|unexpected tool, filesystem, or environment failure| W_ERROR[Return TASK_ISSUES: ERROR<br/>Validation: NOT_RUN]

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
  ROUTE -->|PASS + PASS| PASS([TASK_ISSUES: PASS<br/>Validation: PASS<br/>Child issues ready])
  ROUTE -->|WARN + PASS| WARN([TASK_ISSUES: WARN<br/>Validation: PASS<br/>Child issues ready with caveats])
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

  class INPUT,APPROVAL,PLAN,PARENT,PLATFORM,REFS,MISSING,PARTIAL,BOUNDARY,VALID,REVALIDATE,ROUTE decision;
  class DERIVE,PARSE,VALIDATE,REPAIR check;
  class DISPATCH,CREATE,WARN_RECORD,UPDATE guard;
  class APPROVAL human;
  class RECEIVE,W_SUMMARY_PASS,W_SUMMARY_WARN output;
  class PASS success;
  class WARN output;
  class ORCH_BLOCK_INPUT,ORCH_BLOCK_APPROVAL,W_BLOCK_PLAN,W_FAIL_PARENT,W_FAIL_PLATFORM,W_BLOCK_REFS,W_FAIL_BOUNDARY,W_FAIL_VALIDATE,W_ERROR,BLOCKED,FAIL,ERROR stop;
```

Readiness rule: report `TASK_ISSUES: PASS` only when parent lookup,
write-path detection, existing-ref safety checks, approved issue creation or
reuse, scoped plan updates, and validation all pass. The caller-facing rollup
must include write model and capability, but not raw `gh` JSON, REST responses,
or full plan contents.
