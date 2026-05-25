# Fetching Jira Ticket

The coordinator retrieves exactly one Jira ticket into a validated local
Markdown snapshot. It may normalize ticket coordinates, dispatch the delegated
`ticket-retriever`, interpret only the retriever's structured summary, and
report handoff state. Raw Jira payloads stay out of coordinator context. The
delegated retriever performs read-only Jira queries, may write at most one
unstaged file at `docs/<TICKET_KEY>.md`, and must not modify Jira.

```mermaid
flowchart TD
  START([Start: Jira ticket reference provided]) --> INPUT_CHECK{Valid ticket reference?}
  INPUT_CHECK -->|JIRA_URL| DERIVE["Derive workspace, TICKET_KEY, and project prefix from URL"]
  INPUT_CHECK -->|missing or malformed| BAD_INPUT([FETCH: FAIL - BAD_INPUT - Validation: NOT_RUN])

  DERIVE --> NORMALIZE["Normalize ticket identity"]
  NORMALIZE --> ARTIFACT_ID["Set TICKET_KEY and target docs/<TICKET_KEY>.md"]
  ARTIFACT_ID --> DISPATCH["Dispatch ticket-retriever with full JIRA_URL and reference paths"]

  subgraph RETRIEVER [Delegated ticket-retriever boundary]
    RETRIEVER_ENTRY["ticket-retriever starts"] --> PRECHECK{Jira read path available?}
    PRECHECK -->|auth missing| AUTH_STOP([FETCH: FAIL - AUTH - Validation: NOT_RUN])
    PRECHECK -->|tools missing| TOOLS_STOP([FETCH: FAIL - TOOLS_MISSING - Validation: NOT_RUN])
    PRECHECK -->|rate limited| RATE_STOP([FETCH: FAIL - RATE_LIMIT - Validation: NOT_RUN])
    PRECHECK -->|unexpected error| ERROR_STOP([FETCH: ERROR - UNEXPECTED - Validation: NOT_RUN])
    PRECHECK -->|yes| READ["Run read-only Jira queries"]

    READ --> FOUND{Ticket found and readable?}
    FOUND -->|not found| NOT_FOUND([FETCH: FAIL - NOT_FOUND - Validation: NOT_RUN])
    FOUND -->|rate limited| RATE_STOP
    FOUND -->|unexpected error| ERROR_STOP
    FOUND -->|yes| COLLECT["Collect Jira ticket data required by the retrieval playbook and snapshot template"]

    COLLECT --> ASSEMBLE["Assemble docs/<TICKET_KEY>.md from snapshot template"]
    ASSEMBLE --> WRITE["Write one unstaged local snapshot"]
    WRITE --> VALIDATE["Validate snapshot against fetch contract, playbook, and template"]
    VALIDATE --> VALIDATION{Validation pass?}
    VALIDATION -->|no after repair loop| VALIDATION_FAIL([FETCH: ERROR - UNEXPECTED - Validation: FAIL])
    VALIDATION -->|yes| DISCOVERY{Required discovery complete?}
    DISCOVERY -->|yes| PASS([FETCH: PASS - Validation: PASS])
    DISCOVERY -->|partial but valid| PARTIAL([FETCH: PARTIAL - Validation: PASS])
  end

  DISPATCH --> RETRIEVER_ENTRY

  BAD_INPUT --> SUMMARY["Locked summary/report carries FETCH, Validation, Failure category, File written, counts, warnings, and reason"]
  AUTH_STOP --> SUMMARY
  TOOLS_STOP --> SUMMARY
  RATE_STOP --> SUMMARY
  ERROR_STOP --> SUMMARY
  NOT_FOUND --> SUMMARY
  VALIDATION_FAIL --> SUMMARY
  PASS --> SUMMARY
  PARTIAL --> SUMMARY

  SUMMARY --> COORDINATOR["Coordinator interprets structured summary without raw Jira payloads"]
  COORDINATOR --> RESULT_STATUS{Result status?}
  RESULT_STATUS -->|FETCH: PASS with Validation: PASS| REPORT["Report path, ticket identity, counts, warnings, and Jira-not-modified confirmation"]
  RESULT_STATUS -->|FETCH: PARTIAL with Validation: PASS| DOWNSTREAM{Downstream phase tolerates partial context?}
  RESULT_STATUS -->|FETCH: FAIL with Validation: NOT_RUN| FAILURE_REPORT["Report failure category, reason, recovery action, and Jira not modified"]
  RESULT_STATUS -->|FETCH: ERROR or Validation: FAIL| FAILURE_REPORT
  RESULT_STATUS -->|inconsistent status pairing| CONTRACT_CHECK["Consult fetch-contract.md before reporting error"]
  CONTRACT_CHECK --> FAILURE_REPORT
  DOWNSTREAM -->|yes| REPORT
  DOWNSTREAM -->|no| PARTIAL_REPORT["Report partial context warning and stop reason"]
  FAILURE_REPORT --> STOP([Stopped for user recovery])
  PARTIAL_REPORT --> STOP
  REPORT --> DONE([Ready for downstream workflow])

  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class INPUT_CHECK,PRECHECK,FOUND,VALIDATION,DISCOVERY,RESULT_STATUS,DOWNSTREAM decision;
  class DERIVE,NORMALIZE,ARTIFACT_ID,DISPATCH,RETRIEVER_ENTRY,READ,COLLECT,ASSEMBLE,WRITE,VALIDATE,COORDINATOR,CONTRACT_CHECK check;
  class SUMMARY,FAILURE_REPORT,REPORT,PARTIAL_REPORT output;
  class PASS,PARTIAL,DONE success;
  class BAD_INPUT,AUTH_STOP,TOOLS_STOP,RATE_STOP,ERROR_STOP,NOT_FOUND,VALIDATION_FAIL,STOP stop;
```

Readiness rule: continue only after `FETCH: PASS` with `Validation: PASS`, or
after `FETCH: PARTIAL` with `Validation: PASS` when the next workflow phase
explicitly tolerates partial context.

Boundary rule: Jira mutations, local staging, and commits are out of scope;
route them to a separate approved workflow.
