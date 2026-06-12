# Revised Generate Flow Diagram

This workflow turns normalized process inputs into a reviewed Markdown document
with one Mermaid flowchart, or decomposes a skill package into a slim root and
localized subagent diagrams. The orchestrator routes on documented status lines,
validates Mermaid empirically when possible, and mutates files only in decompose
mode after plan approval, all-pass staging, mutation-boundary enforcement, and a
write verdict.

```mermaid
flowchart TD
  START([Start: diagram request]) --> CAPTURE[Capture inputs and default DIAGRAM_SCOPE to whole]
  CAPTURE --> NORMALIZE[Produce PROCESS_INPUTS and record explicit assumptions]
  NORMALIZE --> MISSING{Missing value changes the diagram contract?}
  MISSING -->|yes| NEEDS_INPUT([needs input])
  MISSING -->|no| CLASSIFY{RUN_MODE by precedence table}

  CLASSIFY -->|1 decompose inputs or request| DECOMP_GATE{Decompose inputs complete?}
  CLASSIFY -->|2 user candidate plus feedback| BUILD_REPAIR[Dispatch diagram-builder with RUN_MODE repair]
  CLASSIFY -->|3 baseline present| PREFLIGHT[Dispatch refinement-analyst with baseline, request, inputs, approvals]
  CLASSIFY -->|4 spec only| BUILD_NEW[Dispatch diagram-builder with RUN_MODE new]
  CLASSIFY -->|5 no row matches| NEEDS_INPUT

  PREFLIGHT --> PRE_STATUS{PREFLIGHT_VERDICT}
  PRE_STATUS -->|PASS with validated scope| BUILD_REFINED[Dispatch diagram-builder with validated approved gaps]
  PRE_STATUS -->|NEEDS_CONFIRMATION| GAP_ASK[Present gap inventory and ask which IDs to approve]
  GAP_ASK --> CONFIRM([needs confirmation])
  PRE_STATUS -->|BLOCKED| BLOCKED([blocked])
  PRE_STATUS -->|ERROR| ERROR([error])

  RESUME([Resume: user replies with gap IDs]) --> VALIDATE_IDS{Every ID exists in retained inventory?}
  VALIDATE_IDS -->|no| REASK[Re-ask once listing valid IDs]
  REASK --> CONFIRM
  VALIDATE_IDS -->|yes| BUILD_REFINED

  BUILD_NEW --> BUILD_STATUS{BUILD_VERDICT}
  BUILD_REPAIR --> BUILD_STATUS
  BUILD_REFINED --> BUILD_STATUS
  LOOP_BUILD --> BUILD_STATUS

  BUILD_STATUS -->|PASS| REVIEW[Dispatch diagram-quality-reviewer with script-first Mermaid validation]
  BUILD_STATUS -->|NEEDS_INPUT| NEEDS_INPUT
  BUILD_STATUS -->|ERROR| ERROR

  REVIEW --> REVIEW_STATUS{REVIEW_VERDICT}
  REVIEW_STATUS -->|PASS| RETURN_DOC[Return artifact plus run report]
  REVIEW_STATUS -->|BLOCKED| BLOCKED
  REVIEW_STATUS -->|ERROR| ERROR
  REVIEW_STATUS -->|FAIL| BUDGET{Repair cycles below three for this candidate?}
  BUDGET -->|no| LIMIT([repair limit reached])
  BUDGET -->|yes| SCOPE_NONE{Approval scope is explicit none?}
  SCOPE_NONE -->|yes| REPAIR_CONFIRM(["needs confirmation (repair approval)"])
  SCOPE_NONE -->|no| FEEDBACK[Package failed checks and preserve baseline, approvals, scoped payload]
  FEEDBACK --> LOOP_BUILD[Dispatch diagram-builder with RUN_MODE repair]
  RETURN_DOC --> FINAL([final passed])

  DECOMP_GATE -->|missing package or registry| NEEDS_INPUT
  DECOMP_GATE -->|empty registry| EMPTY_REGISTRY[Ask whether package truly has no subagents]
  EMPTY_REGISTRY -->|confirmed| NOOP([no changes needed])
  EMPTY_REGISTRY -->|not confirmed| NEEDS_INPUT
  DECOMP_GATE -->|complete| LIMITS[Derive one MUTATION_LIMITS contract for the run]
  LIMITS --> PLAN[Dispatch decomposition-planner with package path, registry, root path, mutation limits]
  PLAN --> PLAN_STATUS{PLAN_VERDICT}
  PLAN_STATUS -->|NEEDS_INPUT| NEEDS_INPUT
  PLAN_STATUS -->|BLOCKED| BLOCKED
  PLAN_STATUS -->|ERROR| ERROR
  PLAN_STATUS -->|PASS| NOOP_CHECK{Zero extract nodes and every owner keep or n/a?}
  NOOP_CHECK -->|yes| NOOP
  NOOP_CHECK -->|no| PLAN_SUMMARY[Present decomposition plan summary with files to be written]
  PLAN_SUMMARY --> APPROVAL{Plan approved by user or explicit auto pre-approval?}
  APPROVAL -->|no| CONFIRM
  APPROVAL -->|yes| STAGE_LOOP[Build and review localized diagrams and slim root; stage passing candidates]
  STAGE_LOOP --> ALL_PASS{"Every staged candidate holds REVIEW: PASS?"}
  ALL_PASS -->|no| PARTIAL[Write nothing and report passing and failing candidates]
  PARTIAL --> LIMIT
  ALL_PASS -->|yes| WRITE_BATCH[Enforce mutation limits and write full batch plus load lines]
  WRITE_BATCH --> WRITE_STATUS{WRITE_VERDICT}
  WRITE_STATUS -->|ERROR| WRITE_ERR([write error])
  WRITE_STATUS -->|PASS| DISCLOSE[Report node counts, outcomes, and mirror and lockfile follow-up]
  DISCLOSE --> DECOMP_DONE([decomposition complete])

  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class MISSING,CLASSIFY,DECOMP_GATE,PRE_STATUS,VALIDATE_IDS,BUILD_STATUS,REVIEW_STATUS,BUDGET,SCOPE_NONE,PLAN_STATUS,NOOP_CHECK,APPROVAL,ALL_PASS,WRITE_STATUS decision;
  class NORMALIZE,PREFLIGHT,REVIEW,PLAN,LIMITS check;
  class GAP_ASK,REASK,PLAN_SUMMARY,EMPTY_REGISTRY human;
  class BUILD_NEW,BUILD_REPAIR,BUILD_REFINED,LOOP_BUILD,FEEDBACK,STAGE_LOOP refine;
  class RETURN_DOC,WRITE_BATCH,DISCLOSE,PARTIAL output;
  class FINAL,DECOMP_DONE,NOOP success;
  class NEEDS_INPUT,BLOCKED,ERROR,LIMIT,WRITE_ERR,CONFIRM,REPAIR_CONFIRM stop;
```

Readiness rule: return a non-decompose artifact only after `BUILD: PASS` and
`REVIEW: PASS`, plus `PREFLIGHT: PASS` with validated approvals when refinement
applies. Write decompose files only after `PLAN: PASS`, a negative no-op check,
plan approval, `REVIEW: PASS` for every staged candidate, mutation-limit and
path-boundary enforcement, and `WRITE: PASS`.

Completion states: `final passed`, `decomposition complete`,
`no changes needed`, `needs confirmation`,
`needs confirmation (repair approval)`, `needs input`, `blocked`, `error`,
`write error`, and `repair limit reached`.
