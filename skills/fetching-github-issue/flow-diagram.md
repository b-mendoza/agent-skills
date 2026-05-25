# Fetching GitHub Issue

The coordinator retrieves exactly one GitHub issue into a validated local
Markdown snapshot. It may derive identifiers, dispatch the delegated
`issue-retriever`, interpret only the retriever's structured summary, and report
handoff state. Raw GitHub data stays out of coordinator context. The delegated
retriever performs read-only GitHub queries, may write at most one unstaged file
at `docs/<ISSUE_SLUG>.md`, and must not modify GitHub.

```mermaid
flowchart TD
  START([Start: fetch one GitHub issue]) --> INPUT{ISSUE_URL supplied?}
  INPUT -->|yes| DERIVE[Derive OWNER, REPO, ISSUE_NUMBER from URL]
  INPUT -->|no| COORDS{OWNER, REPO, ISSUE_NUMBER supplied?}
  COORDS -->|yes| NORMALIZE[Normalize owner and repo lowercase]
  COORDS -->|no| BAD_INPUT([FETCH: FAIL - BAD_INPUT])

  DERIVE --> NORMALIZE
  NORMALIZE --> SLUG[Set ISSUE_SLUG = owner-repo-number]
  SLUG --> DISPATCH[Coordinator dispatches issue-retriever with reference paths and identifiers]

  subgraph RETRIEVER["Delegated issue-retriever boundary"]
    DISPATCH --> PRECHECK{GitHub tools and auth available?}
    PRECHECK -->|no tools| TOOLS_FAIL([FETCH: FAIL - TOOLS_MISSING])
    PRECHECK -->|auth missing| AUTH_FAIL([FETCH: FAIL - AUTH])
    PRECHECK -->|yes| QUERY[Read-only GitHub queries for issue, comments, linked data, labels, assignees, milestone, projects, and attachment-like links]
    QUERY --> FOUND{Issue found and readable?}
    FOUND -->|not found| NOT_FOUND([FETCH: FAIL - NOT_FOUND])
    FOUND -->|rate limited| RATE_LIMIT([FETCH: FAIL - RATE_LIMIT])
    FOUND -->|unexpected error| UNEXPECTED([FETCH: ERROR - UNEXPECTED])
    FOUND -->|yes| ASSEMBLE[Assemble docs/ISSUE_SLUG.md from snapshot template]
    ASSEMBLE --> VALIDATE{Artifact validation passes?}
    VALIDATE -->|no| VALIDATION_FAIL([Validation: FAIL])
    VALIDATE -->|yes| FETCH_STATUS{Fetch complete?}
    FETCH_STATUS -->|complete| PASS([FETCH: PASS with Validation: PASS])
    FETCH_STATUS -->|partial but valid| PARTIAL([FETCH: PARTIAL with Validation: PASS])
  end

  PASS --> SUMMARY[Retriever returns locked structured summary only]
  PARTIAL --> SUMMARY
  BAD_INPUT --> REPORT_FAIL[Coordinator reports failure category and recovery action]
  TOOLS_FAIL --> REPORT_FAIL
  AUTH_FAIL --> REPORT_FAIL
  NOT_FOUND --> REPORT_FAIL
  RATE_LIMIT --> REPORT_FAIL
  UNEXPECTED --> REPORT_FAIL
  VALIDATION_FAIL --> REPORT_FAIL

  SUMMARY --> HANDOFF{Downstream phases tolerate partial context?}
  HANDOFF -->|PASS or tolerated PARTIAL| REPORT_OK[Coordinator reports path, issue identity, counts, warnings, and GitHub-not-modified confirmation]
  HANDOFF -->|PARTIAL not tolerated| REPORT_PARTIAL[Coordinator reports partial handoff state and stop reason]

  REPORT_OK --> DONE([Ready for downstream workflow])
  REPORT_PARTIAL --> DEFERRED([Deferred: partial context not acceptable])
  REPORT_FAIL --> STOP([Stopped for actionable recovery])

  class INPUT,COORDS,PRECHECK,FOUND,VALIDATE,FETCH_STATUS,HANDOFF decision;
  class DERIVE,NORMALIZE,SLUG,DISPATCH,QUERY,ASSEMBLE check;
  class SUMMARY,REPORT_OK,REPORT_PARTIAL output;
  class PASS,DONE success;
  class PARTIAL,DEFERRED refine;
  class BAD_INPUT,TOOLS_FAIL,AUTH_FAIL,NOT_FOUND,RATE_LIMIT,UNEXPECTED,VALIDATION_FAIL,REPORT_FAIL,STOP stop;
```

Completion rule: retrieval is complete only when the coordinator receives a
structured summary proving `FETCH: PASS` or tolerated `FETCH: PARTIAL` with
`Validation: PASS`, reports the unstaged snapshot path, and confirms GitHub was
not modified.

Sensitive-action rule: editing, closing, commenting on, assigning, labeling,
staging, or committing is outside this workflow and must route to a separate
approved workflow.
