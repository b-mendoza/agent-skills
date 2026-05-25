# Fetching Jira Ticket

A Jira retrieval coordinator accepts one `JIRA_URL`, derives workspace, project,
and ticket identity, then delegates read-only Jira access and local snapshot
assembly to `ticket-retriever`. The coordinator keeps raw Jira payloads out of
context, branches only on the retriever's structured summary, and never mutates
Jira, stages, or commits the snapshot.

```mermaid
flowchart TD
  START([Start: JIRA_URL provided]) --> URL_CHECK{JIRA_URL valid?}
  URL_CHECK -->|no| BAD_INPUT([BAD_INPUT])
  BAD_INPUT --> INPUT_REPORT[Coordinator reports malformed URL and asks for a corrected JIRA_URL]
  URL_CHECK -->|yes| DERIVE[Derive workspace, TICKET_KEY, and project prefix]

  DERIVE --> DISPATCH[Dispatch ticket-retriever with identifiers and reference paths]
  DISPATCH --> RETRIEVE[Subagent: run read-only Jira queries]
  RETRIEVE --> AUTH_CHECK{Jira readable?}
  AUTH_CHECK -->|auth missing| AUTH_STOP([AUTH])
  AUTH_CHECK -->|not found| NOT_FOUND([NOT_FOUND])
  AUTH_CHECK -->|tools missing| TOOLS_STOP([TOOLS_MISSING])
  AUTH_CHECK -->|rate limited| RATE_STOP([RATE_LIMIT])
  AUTH_CHECK -->|unexpected error| ERROR_STOP([FETCH: ERROR, failure category UNEXPECTED])
  AUTH_CHECK -->|yes| ASSEMBLE[Subagent: assemble docs/<TICKET_KEY>.md from fields, comments, subtasks, links, attachments, and custom fields]

  ASSEMBLE --> WRITE_LIMIT{Within mutation limit?}
  WRITE_LIMIT -->|no| VALIDATION_FAIL([Validation: FAIL])
  WRITE_LIMIT -->|yes| WRITE[Write one unstaged local snapshot: docs/<TICKET_KEY>.md]
  WRITE --> VALIDATE[Subagent: validate snapshot against fetch contract, playbook, and template]
  VALIDATE --> VALIDATION{Validation pass?}
  VALIDATION -->|no| VALIDATION_FAIL
  VALIDATION -->|yes| FETCH_STATE{Fetch complete?}

  FETCH_STATE -->|complete| PASS([FETCH: PASS with Validation: PASS])
  FETCH_STATE -->|partial but usable| PARTIAL([FETCH: PARTIAL with Validation: PASS])
  FETCH_STATE -->|failed| FETCH_FAIL([FETCH: FAIL])

  PASS --> SUMMARY[Subagent returns locked structured summary only]
  PARTIAL --> SUMMARY
  FETCH_FAIL --> SUMMARY
  VALIDATION_FAIL --> SUMMARY
  AUTH_STOP --> SUMMARY
  NOT_FOUND --> SUMMARY
  TOOLS_STOP --> SUMMARY
  RATE_STOP --> SUMMARY
  ERROR_STOP --> SUMMARY

  SUMMARY --> COORDINATOR[Coordinator interprets summary without raw Jira payloads]
  COORDINATOR --> RESULT_STATUS{Result status or failure category?}
  RESULT_STATUS -->|FETCH: PASS or FETCH: PARTIAL with Validation: PASS| DOWNSTREAM{Downstream phase tolerates partial context?}
  RESULT_STATUS -->|AUTH| FAILURE_REPORT[Report failure category, reason, recovery action, and Jira not modified]
  RESULT_STATUS -->|NOT_FOUND| FAILURE_REPORT
  RESULT_STATUS -->|TOOLS_MISSING| FAILURE_REPORT
  RESULT_STATUS -->|RATE_LIMIT| FAILURE_REPORT
  RESULT_STATUS -->|FETCH: FAIL| FAILURE_REPORT
  RESULT_STATUS -->|FETCH: ERROR| FAILURE_REPORT
  RESULT_STATUS -->|Validation: FAIL| FAILURE_REPORT
  DOWNSTREAM -->|yes for PASS or tolerated PARTIAL| REPORT[Report path, ticket identity, counts, warnings, and Jira-not-modified confirmation]
  DOWNSTREAM -->|no for PARTIAL| PARTIAL_REPORT[Report partial context warning and stop reason]
  INPUT_REPORT --> STOP([Stopped for user recovery])
  FAILURE_REPORT --> STOP
  PARTIAL_REPORT --> STOP
  REPORT --> DONE([Ready for downstream workflow])

  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class URL_CHECK,AUTH_CHECK,WRITE_LIMIT,VALIDATION,FETCH_STATE,RESULT_STATUS,DOWNSTREAM decision;
  class DERIVE,DISPATCH,RETRIEVE,ASSEMBLE,WRITE,VALIDATE,COORDINATOR check;
  class SUMMARY,INPUT_REPORT,FAILURE_REPORT,REPORT,PARTIAL_REPORT output;
  class PASS,PARTIAL,DONE success;
  class BAD_INPUT,AUTH_STOP,NOT_FOUND,TOOLS_STOP,RATE_STOP,ERROR_STOP,VALIDATION_FAIL,FETCH_FAIL,STOP stop;
```

Readiness rule: continue only after `FETCH: PASS` with `Validation: PASS`, or
after `FETCH: PARTIAL` with `Validation: PASS` when the next workflow phase
explicitly tolerates partial context.

Boundary rule: Jira mutations, local staging, and commits are out of scope;
route them to a separate approved workflow.
