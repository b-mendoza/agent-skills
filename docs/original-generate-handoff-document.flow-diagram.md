# Generate Handoff Document

The `generate-handoff-document` skill is a handoff-document orchestrator. Its authority is limited to path checks, routing decisions, status handling, optional external-source decisions, dispatching co-located subagents, bounded repair loops, and final reporting. It may write the requested handoff and sibling resumability artifacts after safety checks pass; it does not mutate product code. Detailed extraction, insight capture, claim validation, assembly, and review are owned by subagents.

```mermaid
flowchart TD
  START([Start: user requests a handoff package]) --> INTAKE[Collect TARGET_FILE plus optional SUBJECT, TRACKING_FILES, and CONTEXT_SOURCE]
  INTAKE --> TARGET_CLEAR{TARGET_FILE clear?}
  TARGET_CLEAR -->|no| ASK_TARGET[Ask one short target-path question]
  ASK_TARGET --> BLOCKED_TARGET([Blocked: unclear target path])
  TARGET_CLEAR -->|yes| PATH_CHECK[Validate readable inputs, writable target, and sibling artifact locations]

  PATH_CHECK --> WRITE_SAFE{Path and write checks safe?}
  WRITE_SAFE -->|no| BLOCKED_WRITE([Blocked: unsafe writes or missing readable/writable path])
  WRITE_SAFE -->|yes| LOAD_CONTRACTS[Read data-contracts.md and derive sibling artifact paths]

  LOAD_CONTRACTS --> LOCAL_OK{Bundled contracts sufficient?}
  LOCAL_OK -->|yes| EXT_SKIPPED[Record EXTERNAL: SKIPPED]
  LOCAL_OK -->|no| EXT_REQUIRED{External source required for current contract question?}
  EXT_REQUIRED -->|no| EXT_OPTIONAL[Record EXTERNAL: UNAVAILABLE or USED and continue local-only]
  EXT_REQUIRED -->|yes| EXT_AVAILABLE{One minimal relevant source available?}
  EXT_AVAILABLE -->|yes| EXT_USED[Fetch one source and record EXTERNAL: USED]
  EXT_AVAILABLE -->|no| BLOCKED_EXT([Blocked: required external dependency unavailable])

  EXT_SKIPPED --> CONTEXT_DISPATCH[Dispatch context-extractor]
  EXT_OPTIONAL --> CONTEXT_DISPATCH
  EXT_USED --> CONTEXT_DISPATCH

  CONTEXT_DISPATCH --> CONTEXT_STATUS{CONTEXT status?}
  CONTEXT_STATUS -->|PASS or WARN| INSIGHTS_DISPATCH[Dispatch insight-documenter]
  CONTEXT_STATUS -->|ERROR, FAIL, or SKIPPED| BLOCKED_STAGE([Blocked: subagent error, failure, or unexpected skip])

  INSIGHTS_DISPATCH --> INSIGHTS_STATUS{INSIGHTS status?}
  INSIGHTS_STATUS -->|PASS or WARN| TRACKING{TRACKING_FILES provided?}
  INSIGHTS_STATUS -->|ERROR, FAIL, or SKIPPED| BLOCKED_STAGE

  TRACKING -->|yes| CLAIMS_DISPATCH[Dispatch claim-validator]
  TRACKING -->|no| CLAIMS_SKIPPED[Record CLAIMS: SKIPPED and require independent factual verification note]

  CLAIMS_DISPATCH --> CLAIMS_STATUS{CLAIMS status?}
  CLAIMS_STATUS -->|PASS or WARN| ASSEMBLE[Dispatch document-assembler]
  CLAIMS_STATUS -->|SKIPPED| CLAIMS_SKIPPED
  CLAIMS_STATUS -->|ERROR or FAIL| BLOCKED_STAGE
  CLAIMS_SKIPPED --> ASSEMBLE

  ASSEMBLE --> HANDOFF_STATUS{HANDOFF status?}
  HANDOFF_STATUS -->|PASS or WARN| REVIEW[Dispatch handoff-reviewer]
  HANDOFF_STATUS -->|ERROR, FAIL, or SKIPPED| BLOCKED_STAGE

  REVIEW --> REVIEW_STATUS{REVIEW status?}
  REVIEW_STATUS -->|PASS or WARN| FINAL[Return paths, external status, verdicts, counts, warnings, open-question count, and Completed: review pass]
  REVIEW_STATUS -->|ERROR or SKIPPED| BLOCKED_STAGE
  REVIEW_STATUS -->|FAIL| REPAIR_LIMIT{Fewer than 3 repair cycles?}

  REPAIR_LIMIT -->|no| BLOCKED_REPAIR([Blocked: repair limit exhausted])
  REPAIR_LIMIT -->|yes| RERUN_TARGETS[Parse rerun targets and normalize to canonical stage order]
  RERUN_TARGETS --> EARLIEST{Earliest rerun stage?}
  EARLIEST -->|context-extractor| CONTEXT_DISPATCH
  EARLIEST -->|insight-documenter| INSIGHTS_DISPATCH
  EARLIEST -->|claim-validator| TRACKING
  EARLIEST -->|document-assembler| ASSEMBLE
  EARLIEST -->|handoff-reviewer| REVIEW

  FINAL --> DONE([Completed: review pass])

  class TARGET_CLEAR,WRITE_SAFE,LOCAL_OK,EXT_REQUIRED,EXT_AVAILABLE,CONTEXT_STATUS,INSIGHTS_STATUS,TRACKING,CLAIMS_STATUS,HANDOFF_STATUS,REVIEW_STATUS,REPAIR_LIMIT,EARLIEST decision;
  class PATH_CHECK,LOAD_CONTRACTS,CONTEXT_DISPATCH,INSIGHTS_DISPATCH,CLAIMS_DISPATCH,ASSEMBLE,REVIEW,RERUN_TARGETS check;
  class ASK_TARGET human;
  class EXT_SKIPPED,EXT_OPTIONAL,EXT_USED,CLAIMS_SKIPPED,FINAL output;
  class DONE success;
  class BLOCKED_TARGET,BLOCKED_WRITE,BLOCKED_EXT,BLOCKED_STAGE,BLOCKED_REPAIR stop;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

Readiness rule: the workflow reaches success only after `handoff-reviewer` returns `REVIEW: PASS` or `REVIEW: WARN` and the orchestrator reports `Completed: review pass`. It stops instead at one of the named blockers when the target path is unclear, path/write checks are unsafe, a required external dependency is unavailable, a stage errors or returns an unexpected status, or three repair cycles fail to produce a passing review.

Source basis: `SKILL.md` defines the orchestrator role, inputs, status routing, subagent registry, execution steps, output contract, dispatch contract, and repair limit. `references/data-contracts.md` defines artifact naming, status vocabulary, final document sections, and final summary fields. The five files under `subagents/` define the dispatched stage contracts. The bundled `flow-diagram.md` provides an existing whole-workflow diagram consistent with these contracts.
