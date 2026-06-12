# Recency Guard Workflow

Recency Guard is a read-only response-validation workflow for answers that depend on current external facts. The orchestrator may inspect or draft an answer, route focused verification to `recency-checker` and `claim-verifier`, apply only flagged edits within repair limits, and return a user-visible final answer rather than a default audit report.

```mermaid
flowchart TD
  START(["Start: USER_REQUEST"]) --> INPUTS["Collect USER_REQUEST, optional DRAFT_RESPONSE, optional TODAYS_DATE, optional RECENCY_RISK_HINT"]
  INPUTS --> DATE{"TODAYS_DATE supplied?"}
  DATE -->|yes| DRAFT_CHECK{"DRAFT_RESPONSE supplied?"}
  DATE -->|no| SET_DATE["Use runtime current date"]
  SET_DATE --> DRAFT_CHECK

  DRAFT_CHECK -->|yes| INSPECT["Inspect supplied draft"]
  DRAFT_CHECK -->|no| DRAFT["Draft concise answer"]
  INSPECT --> BOUNDARY["State read-only role, authority, trust model, and freshness scope"]
  DRAFT --> BOUNDARY

  BOUNDARY --> MUTATION{"External mutation or high-impact action requested?"}
  MUTATION -->|yes| OUT_OF_SCOPE(["Out-of-scope route"])
  MUTATION -->|no| MARK["Mark current and decision-shaping claims"]

  MARK --> RECENCY["Dispatch recency-checker"]
  RECENCY --> REC_STATUS{"RECENCY_CHECK status?"}
  REC_STATUS -->|PASS| CLAIM["Dispatch claim-verifier"]
  REC_STATUS -->|FAIL| REC_FIX["Apply only flagged recency edits"]
  REC_STATUS -->|TOOLS_MISSING| REC_LIMIT["Keep supportable claims and qualify freshness or tool limits"]
  REC_STATUS -->|ERROR| REC_ERROR{"ERROR retry already used?"}
  REC_FIX --> REC_RERUN{"Fewer than 2 targeted FAIL reruns used?"}
  REC_RERUN -->|yes| RECENCY
  REC_RERUN -->|no| MATERIAL
  REC_ERROR -->|no| REC_RETRY["Retry recency-checker once with same focused request"]
  REC_ERROR -->|yes| MATERIAL
  REC_RETRY --> RECENCY
  REC_LIMIT --> CLAIM

  CLAIM --> CLAIM_STATUS{"CLAIM_REVIEW status?"}
  CLAIM_STATUS -->|PASS| INTEGRATE["Integrate evidence and confidence wording"]
  CLAIM_STATUS -->|FAIL| CLAIM_FIX["Apply only flagged claim edits"]
  CLAIM_STATUS -->|TOOLS_MISSING| CLAIM_LIMIT["Qualify claims by evidence limits and freshness scope"]
  CLAIM_STATUS -->|ERROR| CLAIM_ERROR{"ERROR retry already used?"}
  CLAIM_FIX --> CLAIM_RERUN{"Fewer than 2 targeted FAIL reruns used?"}
  CLAIM_RERUN -->|yes| CLAIM
  CLAIM_RERUN -->|no| MATERIAL
  CLAIM_ERROR -->|no| CLAIM_RETRY["Retry claim-verifier once with same revised draft"]
  CLAIM_ERROR -->|yes| MATERIAL
  CLAIM_RETRY --> CLAIM
  CLAIM_LIMIT --> INTEGRATE

  INTEGRATE --> STRICTER["Apply stricter result for overlapping recency and claim reviews"]
  STRICTER --> CONFLICTS["Resolve source conflicts and convert High, Med, Low confidence into wording"]
  CONFLICTS --> UNCERTAIN{"Material uncertainty remains?"}
  UNCERTAIN -->|yes| MATERIAL
  UNCERTAIN -->|no| COMPLETE{"All request deliverables and qualifiers covered?"}
  COMPLETE -->|no| COMPLETE_FIX["Add missing date, scope, evidence, tool-limit, or uncertainty wording"]
  COMPLETE -->|yes| NEW_RISK{"Final wording adds new risky claim?"}
  COMPLETE_FIX --> NEW_RISK

  NEW_RISK -->|yes| REROUTE{"Relevant rerun capacity remains?"}
  NEW_RISK -->|no| LIMITS{"Any material evidence, tool, or freshness limit remains?"}
  REROUTE -->|recency or both| RECENCY
  REROUTE -->|claim only| CLAIM
  REROUTE -->|no| MATERIAL

  LIMITS -->|yes| LIMITED(["Limited final answer"])
  LIMITS -->|no| READY(["Ready final answer"])
  MATERIAL(["Material uncertainty final"])

  class DATE,DRAFT_CHECK,MUTATION,REC_STATUS,REC_RERUN,REC_ERROR,CLAIM_STATUS,CLAIM_RERUN,CLAIM_ERROR,UNCERTAIN,COMPLETE,NEW_RISK,REROUTE,LIMITS decision;
  class RECENCY,CLAIM,INTEGRATE,STRICTER,CONFLICTS check;
  class BOUNDARY,REC_FIX,REC_LIMIT,CLAIM_FIX,CLAIM_LIMIT,COMPLETE_FIX guard;
  class SET_DATE,INSPECT,DRAFT,MARK,REC_RETRY,CLAIM_RETRY output;
  class READY success;
  class LIMITED refine;
  class MATERIAL,OUT_OF_SCOPE stop;

  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef refine fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

Readiness rule: Return the user-visible final answer, not a verification report, unless the user asks for verification details. The final answer must carry date, scope, evidence, tool-limit, or uncertainty wording whenever those limits materially affect action.

Repair rule: Each subagent gets one initial review plus at most two targeted FAIL reruns. Each subagent also gets one separate ERROR retry. Exhausted repair capacity or a repeated ERROR yields a material uncertainty final.

## Run Report

- Run mode and scope: new, whole workflow.
- Assumptions: `TODAYS_DATE` defaults to the runtime current date when omitted; helper-skill pass dispatch was executed inline because no user-requested subagent delegation was authorized in this session.
- Repair cycles used: 0.
- Mermaid validation method: inspected-only (parser unavailable in this environment).
- Dispatch method: inline.
- External sources fetched: none for diagram construction; local target and helper-skill files were sufficient.
- Source grounding: `skills/recency-guard/SKILL.md`, `skills/recency-guard/flow-diagram.md`, both target subagents, and all target references.
