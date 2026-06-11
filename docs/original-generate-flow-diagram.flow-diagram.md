# Generate Flow Diagram Skill Workflow

The `generate-flow-diagram` skill is an orchestration workflow for turning normalized process inputs into a reviewed Markdown document with one Mermaid flowchart, or for decomposing a skill package into a slim root diagram plus localized subagent diagrams. The orchestrator may normalize inputs, ask for missing contract details, dispatch only the bundled subagents, route on their status lines, and write files only in `RUN_MODE=decompose` after planner, path-boundary, mutation-limit, builder, and reviewer gates pass.

```mermaid
flowchart TD
  START([Start: diagram request]) --> CAPTURE[Capture spec, baseline, refinement approvals, scope, and package inputs]
  CAPTURE --> DEFAULT[Default DIAGRAM_SCOPE to whole when absent]
  DEFAULT --> MUTATE{RUN_MODE might be decompose?}
  MUTATE -->|yes| LIMITS[Derive MUTATION_LIMITS from package path, diagram targets, load wiring, and scope limits]
  MUTATE -->|no| READONLY[Mark run read-only and content-emitting only]
  LIMITS --> NORMALIZE
  READONLY --> NORMALIZE[Produce PROCESS_INPUTS before routing]
  NORMALIZE --> MISSING{Missing value changes diagram contract?}
  MISSING -->|yes| NEEDS_INPUT([needs input])
  MISSING -->|no| ASSUME[Record safe assumptions explicitly]
  ASSUME --> CLASSIFY{RUN_MODE}

  CLASSIFY -->|new| BUILD_NEW[Dispatch diagram-builder with PROCESS_INPUTS and RUN_MODE=new]
  CLASSIFY -->|repair| REPAIR_READY{Candidate and REVIEW_FEEDBACK supplied?}
  CLASSIFY -->|refinement| PREFLIGHT[Dispatch refinement-analyst with baseline, request, PROCESS_INPUTS, and approved gaps]
  CLASSIFY -->|decompose| DECOMP_READY{PACKAGE_PATH and SUBAGENT_REGISTRY supplied?}

  REPAIR_READY -->|no| NEEDS_INPUT
  REPAIR_READY -->|yes| BUILD_REPAIR[Dispatch diagram-builder with RUN_MODE=repair and targeted feedback]

  PREFLIGHT --> PREFLIGHT_STATUS{PREFLIGHT_VERDICT}
  PREFLIGHT_STATUS -->|PASS with approved IDs| BUILD_REFINED[Dispatch diagram-builder with approved gaps]
  PREFLIGHT_STATUS -->|PASS with none| BUILD_NOOP[Dispatch diagram-builder with no-op refinement scope]
  PREFLIGHT_STATUS -->|NEEDS_CONFIRMATION| CONFIRM([needs confirmation])
  PREFLIGHT_STATUS -->|BLOCKED| BLOCKED([blocked])
  PREFLIGHT_STATUS -->|ERROR| ERROR([error])

  BUILD_NEW --> BUILD_STATUS{BUILD_VERDICT}
  BUILD_REPAIR --> BUILD_STATUS
  BUILD_REFINED --> BUILD_STATUS
  BUILD_NOOP --> BUILD_STATUS
  BUILD_LOOP --> BUILD_STATUS

  BUILD_STATUS -->|PASS| REVIEW[Dispatch diagram-quality-reviewer with candidate, inputs, baseline, approvals, and scoped payload]
  BUILD_STATUS -->|NEEDS_INPUT| NEEDS_INPUT
  BUILD_STATUS -->|ERROR| ERROR

  REVIEW --> REVIEW_STATUS{REVIEW_VERDICT}
  REVIEW_STATUS -->|PASS| RETURN_DOC[Return reviewed Markdown candidate only]
  REVIEW_STATUS -->|BLOCKED| BLOCKED
  REVIEW_STATUS -->|ERROR| ERROR
  REVIEW_STATUS -->|FAIL| REPAIR_BUDGET{Repair cycles less than 3?}
  REPAIR_BUDGET -->|no| REPAIR_LIMIT([repair limit reached])
  REPAIR_BUDGET -->|yes| REPAIR_SCOPE{Repair exceeds approved refinement scope?}
  REPAIR_SCOPE -->|yes or scope none| CONFIRM
  REPAIR_SCOPE -->|no| FEEDBACK[Package only failed checks as REVIEW_FEEDBACK and preserve original scope payload]
  FEEDBACK --> BUILD_LOOP[Dispatch diagram-builder with RUN_MODE=repair]
  RETURN_DOC --> FINAL([final passed])

  DECOMP_READY -->|no| NEEDS_INPUT
  DECOMP_READY -->|yes| PLAN[Dispatch decomposition-planner with package path, registry, root path, and mutation limits]
  PLAN --> PLAN_STATUS{PLAN_VERDICT}
  PLAN_STATUS -->|NEEDS_INPUT| NEEDS_INPUT
  PLAN_STATUS -->|BLOCKED| BLOCKED
  PLAN_STATUS -->|ERROR| ERROR
  PLAN_STATUS -->|PASS| PLAN_OUT[Keep bloat map, earned decisions, coverage audit, ownership map, and root before-size]
  PLAN_OUT --> LOCAL_LOOP[For EARNED create or re-scope actions, build localized subagent diagrams with scoped context and root cross-link]
  LOCAL_LOOP --> LOCAL_REVIEW[Review each localized candidate with mutation limits and planned-ownership digest]
  LOCAL_REVIEW --> LOCAL_PASS{All localized candidates pass within repair budget?}
  LOCAL_PASS -->|no| REPAIR_LIMIT
  LOCAL_PASS -->|yes| ROOT_BUILD[Build slim orchestrator root with dispatch nodes and localized cross-links]
  ROOT_BUILD --> ROOT_REVIEW[Review root with localized diagram digest]
  ROOT_REVIEW --> ROOT_PASS{Root passes within repair budget?}
  ROOT_PASS -->|no| REPAIR_LIMIT
  ROOT_PASS -->|yes| WRITE[Enforce package boundary and write only passing diagrams plus load-instruction lines]
  WRITE --> DECOMP_DONE([decomposition complete])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class MUTATE,MISSING,CLASSIFY,REPAIR_READY,PREFLIGHT_STATUS,BUILD_STATUS,REVIEW_STATUS,REPAIR_BUDGET,REPAIR_SCOPE,DECOMP_READY,PLAN_STATUS,LOCAL_PASS,ROOT_PASS decision;
  class NORMALIZE,PREFLIGHT,REVIEW,PLAN,LOCAL_REVIEW,ROOT_REVIEW check;
  class BUILD_NEW,BUILD_REPAIR,BUILD_REFINED,BUILD_NOOP,BUILD_LOOP,FEEDBACK,LOCAL_LOOP,ROOT_BUILD refine;
  class CONFIRM human;
  class RETURN_DOC,WRITE output;
  class FINAL,DECOMP_DONE success;
  class NEEDS_INPUT,BLOCKED,ERROR,REPAIR_LIMIT stop;
```

Readiness rule: return a non-decompose candidate only after `BUILD: PASS` and `REVIEW: PASS`, plus `PREFLIGHT: PASS` when refinement applies. In decompose mode, write only after `PLAN: PASS`, package-boundary checks, `MUTATION_LIMITS` enforcement, and `REVIEW: PASS` for every generated localized diagram and the slim root.

Completion states: final passed, decomposition complete, needs confirmation, blocked, error, needs input, or repair limit reached.

Source grounding: this diagram is based on `skills/generate-flow-diagram/SKILL.md`, the existing package `flow-diagram.md`, `references/input-contract.md`, `references/flow-design-playbook.md`, `references/output-templates.md`, `references/quality-gate-checklist.md`, and the four subagent definitions under `skills/generate-flow-diagram/subagents/`.
