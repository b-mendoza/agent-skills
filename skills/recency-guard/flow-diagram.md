# Recency Guard

Recency Guard is a read-only response-validation orchestrator for answers that depend on current external facts. It prepares or inspects a draft response, identifies high-risk and time-sensitive claims, dispatches `./subagents/recency-checker.md` and `./subagents/claim-verifier.md` one at a time, applies only flagged repairs within bounded caps, and produces the final user-visible answer. Current external facts require evidence from official, canonical, or otherwise authoritative sources, guided by `./references/evidence-policy.md`, `./references/claim-extraction-playbook.md`, `./references/repair-and-integration.md`, `./references/output-templates.md`, and `./references/external-sources.md`. External mutations, posting, purchasing, deploying, policy changes, and irreversible actions are outside this flow and must be routed to a separate approved workflow.

```mermaid
flowchart TD
  START([Start: USER_REQUEST received]) --> INPUTS["Collect inputs: USER_REQUEST, optional DRAFT_RESPONSE, optional TODAYS_DATE, optional RECENCY_RISK_HINT"]
  INPUTS --> DATE{TODAYS_DATE present?}
  DATE -->|yes| DRAFT_CHECK{DRAFT_RESPONSE present?}
  DATE -->|no| SET_DATE[Use runtime current date]
  SET_DATE --> DRAFT_CHECK

  DRAFT_CHECK -->|yes| BOUNDARY[State read-only boundary, evidence standard, and freshness scope]
  DRAFT_CHECK -->|no| DRAFT[Draft concise answer first]
  DRAFT --> BOUNDARY

  BOUNDARY --> MUTATION{External mutation or high-impact action requested?}
  MUTATION -->|yes| OUT_OF_SCOPE([OUT_OF_SCOPE: route to separate approved workflow])
  MUTATION -->|no| RISK[Identify high-risk and time-sensitive claims]

  RISK --> RECENCY_INIT[Dispatch ./subagents/recency-checker.md initial review]
  RECENCY_INIT --> RECENCY_STATUS{RECENCY_CHECK status?}

  RECENCY_STATUS -->|PASS| CLAIM_SELECT[Select decision-shaping claims for claim review]
  RECENCY_STATUS -->|FAIL| RECENCY_REPAIR{Recency FAIL reruns used < 2?}
  RECENCY_REPAIR -->|yes| RECENCY_FIX[Apply only recency-checker flagged edits]
  RECENCY_FIX --> RECENCY_RERUN[Targeted rerun of ./subagents/recency-checker.md]
  RECENCY_RERUN --> RECENCY_STATUS
  RECENCY_REPAIR -->|no| NEEDS_REPAIR([NEEDS_REPAIR: recency repair cap reached])

  RECENCY_STATUS -->|TOOLS_MISSING| RECENCY_LIMIT[Set tools-missing limitation flag and keep only supportable freshness claims]
  RECENCY_LIMIT --> CLAIM_SELECT
  RECENCY_STATUS -->|ERROR| RECENCY_ERROR{Recency ERROR retry used?}
  RECENCY_ERROR -->|no| RECENCY_RETRY[Retry ./subagents/recency-checker.md once]
  RECENCY_RETRY --> RECENCY_STATUS
  RECENCY_ERROR -->|yes| MATERIAL_UNCERTAINTY([MATERIAL_UNCERTAINTY: recency review unavailable])

  CLAIM_SELECT --> CLAIM_INIT[Dispatch ./subagents/claim-verifier.md initial review]
  CLAIM_INIT --> CLAIM_STATUS{CLAIM_REVIEW status?}

  CLAIM_STATUS -->|PASS| OVERLAP[Apply stricter result where recency and claim reviews overlap]
  CLAIM_STATUS -->|FAIL| CLAIM_REPAIR{Claim FAIL reruns used < 2?}
  CLAIM_REPAIR -->|yes| CLAIM_FIX[Apply only claim-verifier flagged edits]
  CLAIM_FIX --> CLAIM_RERUN[Targeted rerun of ./subagents/claim-verifier.md]
  CLAIM_RERUN --> CLAIM_STATUS
  CLAIM_REPAIR -->|no| NEEDS_REPAIR

  CLAIM_STATUS -->|TOOLS_MISSING| CLAIM_LIMIT[Set tools-missing limitation flag and qualify evidence strength]
  CLAIM_LIMIT --> OVERLAP
  CLAIM_STATUS -->|ERROR| CLAIM_ERROR{Claim ERROR retry used?}
  CLAIM_ERROR -->|no| CLAIM_RETRY[Retry ./subagents/claim-verifier.md once]
  CLAIM_RETRY --> CLAIM_STATUS
  CLAIM_ERROR -->|yes| MATERIAL_UNCERTAINTY

  OVERLAP --> COMPLETE{Inline completeness check passes?}
  COMPLETE -->|yes| FINAL_WORDING[Prepare final user-visible answer]
  COMPLETE -->|no| COMPLETE_FIX[Add missing qualifiers, scope, or unresolved uncertainty]
  COMPLETE_FIX --> FINAL_WORDING

  FINAL_WORDING --> NEW_CLAIM_CHECK{Final wording added new current-fact claim?}
  NEW_CLAIM_CHECK -->|time-sensitive| RECENCY_RERUN
  NEW_CLAIM_CHECK -->|decision-shaping| CLAIM_RERUN
  NEW_CLAIM_CHECK -->|both| RECENCY_RERUN
  NEW_CLAIM_CHECK -->|no| LIMIT_GATE{Limitation flag material?}

  LIMIT_GATE -->|tools missing and material| BLOCKED_TOOLS_MISSING([BLOCKED_TOOLS_MISSING: conservative answer with tool limits])
  LIMIT_GATE -->|uncertainty material| MATERIAL_UNCERTAINTY
  LIMIT_GATE -->|not material| READY([READY: final user-visible answer])

  class DATE,DRAFT_CHECK,MUTATION,RECENCY_STATUS,RECENCY_REPAIR,RECENCY_ERROR,CLAIM_STATUS,CLAIM_REPAIR,CLAIM_ERROR,COMPLETE,NEW_CLAIM_CHECK,LIMIT_GATE decision;
  class RECENCY_INIT,RECENCY_RERUN,RECENCY_RETRY,CLAIM_INIT,CLAIM_RERUN,CLAIM_RETRY check;
  class BOUNDARY,RISK,RECENCY_FIX,RECENCY_LIMIT,CLAIM_SELECT,CLAIM_FIX,CLAIM_LIMIT,OVERLAP,COMPLETE_FIX guard;
  class DRAFT,FINAL_WORDING output;
  class READY success;
  class NEEDS_REPAIR,BLOCKED_TOOLS_MISSING,MATERIAL_UNCERTAINTY,OUT_OF_SCOPE stop;
```

Readiness rule: Produce the final user-visible answer, not a verification report, unless the user asks for verification details. Include date, freshness scope, evidence limits, unresolved material uncertainty, and conservative wording when evidence or tools are limited.

Deterministic repair rule: Each subagent receives one initial review. A `FAIL` permits at most 2 targeted reruns for that subagent after flagged edits. An `ERROR` permits one retry. Cap exits must resolve to `NEEDS_REPAIR`, `MATERIAL_UNCERTAINTY`, or `BLOCKED_TOOLS_MISSING`, not silent readiness.

New-claim rule: If final wording or completeness repair adds a new time-sensitive claim, rerun `./subagents/recency-checker.md`; if it adds a new decision-shaping claim, rerun `./subagents/claim-verifier.md`; if both, rerun the relevant checks one at a time before finalizing.

Mutation boundary: Any external mutation or high-impact action stays outside Recency Guard and must be routed to a separate approved workflow.
