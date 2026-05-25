# Analyzing Recent Project State

This read-only orchestration workflow helps a developer continue safely by normalizing the requested scope, collecting compact local Git evidence, drafting a grounded project-state snapshot, and verifying the report before return. The orchestrator controls phase transitions and routes only on explicit `GIT_EVIDENCE`, `SNAPSHOT_WRITE`, and `SNAPSHOT_VERIFY` statuses, while `git-evidence-collector`, `state-snapshot-writer`, and `snapshot-verifier` handle focused evidence collection, drafting, and validation. Local Git state, repository docs, tests, scripts, CI files, and project conventions are primary evidence; external sources are optional, narrow, and only used for concrete local questions. The flow does not merge, deploy, mutate repository contents, bypass CI, or return raw diffs or full command dumps.

```mermaid
flowchart TD
  START([Start: analyze recent project state]) --> INTAKE[Normalize PROJECT_PATH, BASE_BRANCH, REVIEW_FOCUS, OUTPUT_DEPTH]
  INTAKE --> PATH_READY{PROJECT_PATH available?}
  PATH_READY -->|provided| BASE_CHECK{Would BASE_BRANCH ambiguity materially change the answer?}
  PATH_READY -->|missing, active workspace clearly target| USE_WORKSPACE[Use active workspace and label assumption]
  PATH_READY -->|missing or unclear target| NEEDS_CONTEXT([Escalate: NEEDS_CONTEXT])
  USE_WORKSPACE --> BASE_CHECK

  BASE_CHECK -->|yes| ASK_BASE[Ask one targeted base-branch question]
  ASK_BASE --> WAIT_CONTEXT([Escalate: NEEDS_CONTEXT])
  BASE_CHECK -->|no| DEFAULTS[Apply defaults: REVIEW_FOCUS full; OUTPUT_DEPTH standard]

  DEFAULTS --> SENSITIVE_CHECK{Request includes mutation, merge, deploy, CI bypass, or unsupported intent claim?}
  SENSITIVE_CHECK -->|yes| OUT_OF_SCOPE[Keep analysis read-only; convert to risk, blocker, or recommendation]
  SENSITIVE_CHECK -->|no| COLLECTOR
  OUT_OF_SCOPE --> COLLECTOR[Dispatch git-evidence-collector]

  COLLECTOR --> COLLECT[Collect compact Git evidence and narrow repository context]
  COLLECT --> COLLECT_STATUS{Collector status}
  COLLECT_STATUS -->|GIT_EVIDENCE: PASS| EVIDENCE[Retain compact evidence: status, branch, commits, changed paths, stats, base delta, tests, docs, conventions]
  COLLECT_STATUS -->|GIT_EVIDENCE: NOT_GIT| NOT_GIT([Escalate: NOT_GIT])
  COLLECT_STATUS -->|GIT_EVIDENCE: PATH_ERROR| PATH_ERROR([Escalate: PATH_ERROR])
  COLLECT_STATUS -->|GIT_EVIDENCE: NEEDS_CONTEXT| COLLECT_NEEDS([Escalate: NEEDS_CONTEXT])
  COLLECT_STATUS -->|GIT_EVIDENCE: ERROR| COLLECT_ERROR([Escalate: ERROR])

  EVIDENCE --> WRITER[Dispatch state-snapshot-writer]
  WRITER --> DRAFT[Draft developer-facing snapshot from compact evidence and narrow context]
  DRAFT --> WRITER_STATUS{Writer status}
  WRITER_STATUS -->|SNAPSHOT_WRITE: PASS| SNAPSHOT[Retain candidate report body]
  WRITER_STATUS -->|SNAPSHOT_WRITE: NEEDS_CONTEXT| WRITE_NEEDS([Escalate: NEEDS_CONTEXT])
  WRITER_STATUS -->|SNAPSHOT_WRITE: ERROR| WRITE_ERROR([Escalate: ERROR])

  SNAPSHOT --> VERIFIER[Dispatch snapshot-verifier]
  VERIFIER --> VERIFY[Check grounding, report shape, actionability, assumptions, and validation gaps]
  VERIFY --> VERIFY_STATUS{Verifier decision}
  VERIFY_STATUS -->|SNAPSHOT_VERIFY: PASS| FINAL[Return verified Markdown report body]
  VERIFY_STATUS -->|SNAPSHOT_VERIFY: FAIL and cycles under 2| FEEDBACK[Retain targeted verifier feedback]
  VERIFY_STATUS -->|repair cycles exhausted| REPAIR_EXHAUSTED([Escalate: ERROR])
  VERIFY_STATUS -->|SNAPSHOT_VERIFY: NEEDS_CONTEXT| VERIFY_NEEDS([Escalate: NEEDS_CONTEXT])
  VERIFY_STATUS -->|SNAPSHOT_VERIFY: ERROR| VERIFY_ERROR([Escalate: ERROR])

  FEEDBACK --> REPAIR_WRITER[Dispatch state-snapshot-writer for targeted repair only]
  REPAIR_WRITER --> DRAFT

  FINAL --> DONE([Complete: verified report returned])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class PATH_READY,BASE_CHECK,SENSITIVE_CHECK,COLLECT_STATUS,WRITER_STATUS,VERIFY_STATUS decision;
  class COLLECT,EVIDENCE,DRAFT,VERIFY check;
  class ASK_BASE,OUT_OF_SCOPE guard;
  class SNAPSHOT,FINAL output;
  class FEEDBACK,REPAIR_WRITER refine;
  class DONE success;
  class NEEDS_CONTEXT,WAIT_CONTEXT,NOT_GIT,PATH_ERROR,COLLECT_NEEDS,COLLECT_ERROR,WRITE_NEEDS,WRITE_ERROR,REPAIR_EXHAUSTED,VERIFY_NEEDS,VERIFY_ERROR stop;
```

Completion rule: return only a verified Markdown report body or a labeled `RECENT_STATE` escalation state: `NOT_GIT`, `PATH_ERROR`, `NEEDS_CONTEXT`, or `ERROR`.

Readiness rule: claims in the final report must be tied to compact Git evidence, narrow repository context, or clearly labeled inference; validation gaps and next actions must stay separate from facts.
