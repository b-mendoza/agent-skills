# Workflow Skill Architect Flow

Workflow Skill Architect is an orchestration workflow for turning repeatable
workflows into portable agent-skill packages. The orchestrator may clarify
inputs, inspect a supplied skill directory, choose artifact boundaries, load its
own bundled references just in time, dispatch `step-architect` and
`definition-reviewer`, and synthesize final files. Generated artifacts stay
standalone and portable; package mutation is limited to the requested skill
scope and validation repairs.

```mermaid
flowchart TD
  START([Start: workflow skill architecture request]) --> INTAKE["Capture WORKFLOW_OR_STEP, TARGET_RUNTIME, EXISTING_PROMPT, OUTPUT_SCOPE, and CONSTRAINTS"]
  INTAKE --> REQUIRED{"WORKFLOW_OR_STEP or existing skill directory supplied?"}
  REQUIRED -->|no| NEEDS_WORKFLOW([needs input: ask one workflow question])
  REQUIRED -->|yes| DEFAULTS["Default TARGET_RUNTIME to portable Agent Skills when absent"]
  DEFAULTS --> EXISTING{"Existing skill directory supplied?"}
  EXISTING -->|yes| INSPECT["Inspect local package files before editing or replacement generation"]
  EXISTING -->|no| CLASSIFY
  INSPECT --> CLASSIFY{"Request type?"}

  CLASSIFY -->|create| SCOPE["Identify OUTPUT_SCOPE and artifact boundaries"]
  CLASSIFY -->|extend| SCOPE
  CLASSIFY -->|review| REVIEW_ONLY["Prepare existing-package review scope and quality checklist"]
  CLASSIFY -->|refactor| SCOPE

  SCOPE --> REF_NEED{"Which local reference is needed now?"}
  REF_NEED -->|structure or contracts| LOAD_STRUCTURE["Load ./references/skill-structure.md"]
  REF_NEED -->|templates| LOAD_TEMPLATES["Load ./references/output-templates.md"]
  REF_NEED -->|current runtime facts| EXTERNAL_GATE{"Exact external syntax or platform behavior needed?"}
  REF_NEED -->|validation| LOAD_QUALITY["Load ./references/quality-checklist.md"]

  EXTERNAL_GATE -->|yes| LOAD_EXTERNAL["Load ./references/external-sources.md and fetch the smallest relevant official source"]
  EXTERNAL_GATE -->|no| LOAD_STRUCTURE
  LOAD_STRUCTURE --> PLAN["Plan smallest correct package: SKILL.md, subagents, references, scripts, or assets"]
  LOAD_TEMPLATES --> PLAN
  LOAD_EXTERNAL --> PLAN
  LOAD_QUALITY --> PLAN

  PLAN --> MORE_STEPS{"More workflow steps or artifacts to design?"}
  MORE_STEPS -->|yes| ARCHITECT["Dispatch step-architect with explicit step, runtime, context, prompt, and constraints"]
  ARCHITECT --> ARCHITECT_STATUS{"ARCHITECTURE status?"}
  ARCHITECT_STATUS -->|PASS| COLLECT["Collect complete files, registry rows, contracts, and handoff summary"]
  COLLECT --> MORE_STEPS
  ARCHITECT_STATUS -->|NEEDS_INPUT| STEP_INPUT([needs input: ask one precise step question])
  ARCHITECT_STATUS -->|BLOCKED| STEP_BLOCKED([blocked: runtime detail or artifact boundary unverifiable])

  MORE_STEPS -->|no| SYNTHESIZE["Synthesize coherent package and integration notes"]
  REVIEW_ONLY --> REVIEW
  SYNTHESIZE --> REVIEW["Dispatch definition-reviewer with changed paths, target runtime, constraints, and final scope"]
  REVIEW --> REVIEW_STATUS{"REVIEW status?"}

  REVIEW_STATUS -->|PASS| FINAL["Return final files, integration notes, fetched sources, validation summary, and remaining risks"]
  REVIEW_STATUS -->|FAIL| REPAIR_CAP{"Targeted repair cycles used fewer than 3?"}
  REVIEW_STATUS -->|BLOCKED| REVIEW_BLOCKED([blocked: reviewer needs missing file or runtime fact])
  REVIEW_STATUS -->|ERROR| REVIEW_ERROR([error: unexpected review failure])

  REPAIR_CAP -->|yes| REPAIR["Apply only reviewer-required targeted fixes"]
  REPAIR --> REVIEW
  REPAIR_CAP -->|no| REPAIR_LIMIT([blocked: repair limit reached])
  FINAL --> READY([ready])

  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class DEFAULTS,SCOPE,REF_NEED,EXTERNAL_GATE guard;
  class INTAKE,INSPECT,LOAD_STRUCTURE,LOAD_TEMPLATES,LOAD_EXTERNAL,LOAD_QUALITY,PLAN,ARCHITECT,COLLECT,SYNTHESIZE,REVIEW_ONLY,REVIEW check;
  class REQUIRED,EXISTING,CLASSIFY,MORE_STEPS,ARCHITECT_STATUS,REVIEW_STATUS,REPAIR_CAP decision;
  class NEEDS_WORKFLOW,STEP_INPUT human;
  class REPAIR refine;
  class FINAL output;
  class READY success;
  class STEP_BLOCKED,REVIEW_BLOCKED,REVIEW_ERROR,REPAIR_LIMIT stop;
```

Readiness rule: return final skill files only after all needed
`step-architect` work returns `ARCHITECTURE: PASS`, synthesis is complete, and
`definition-reviewer` returns `REVIEW: PASS`. A `REVIEW: FAIL` may trigger at
most three targeted repair cycles before the workflow returns blocked with the
remaining findings.

Completion states: ready, needs input, blocked, or error.
