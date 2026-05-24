# Rewriting Code Strictly Workflow

This workflow is run by a strict-rewrite orchestrator for behavior-preserving rewrites of Python, TypeScript/JavaScript, or Go code. The orchestrator normalizes target, language, scope, goal, validation command, and reference need; dispatches one bundled subagent at a time; keeps compact evidence and decisions; and stops before dependency, public API, behavior, or scope changes unless explicitly allowed. Baseline and strategy phases are read-only, implementation edits only files justified by the approved strategy or direct compilation consequences, and review is read-only.

```mermaid
flowchart TD
  START([Start: strict code rewrite]) --> INTAKE["Normalize inputs<br/>TARGET_CODE, LANGUAGE, USER_GOAL, VALIDATION_COMMAND, SCOPE_LIMITS, REFERENCE_NEED"]
  INTAKE --> TARGET_OK{TARGET_CODE present?}
  TARGET_OK -->|no| ASK_TARGET["Ask one focused question for target code or path"]
  ASK_TARGET --> NEEDS_CLARIFICATION(["NEEDS_CLARIFICATION"])

  TARGET_OK -->|yes| LANGUAGE_OK{Language clear or inferable from extension?}
  LANGUAGE_OK -->|no| ASK_LANGUAGE["Ask one focused language question"]
  ASK_LANGUAGE --> NEEDS_CLARIFICATION

  LANGUAGE_OK -->|yes| SCOPE_OK{Scope safe enough to dispatch?}
  SCOPE_OK -->|no| ASK_SCOPE["Ask one focused scope question"]
  ASK_SCOPE --> NEEDS_CLARIFICATION

  SCOPE_OK -->|yes| BOUNDARY["Set authority and mutation boundary<br/>preserve observable behavior; project settings are authority"]
  BOUNDARY --> BASELINE["Dispatch strict-baseline-mapper<br/>map behavior, callers, tests, configs, dependencies, and current weaknesses"]
  BASELINE --> BASELINE_STATUS{Baseline status?}

  BASELINE_STATUS -->|BLOCKED| BASELINE_BLOCKED["Retain missing evidence and smallest recovery"]
  BASELINE_STATUS -->|ERROR| BASELINE_ERROR["Retain failed condition and context"]
  BASELINE_STATUS -->|PASS| STRATEGY["Dispatch strict-rewrite-strategist<br/>choose static typing vs runtime validation and approved rewrite plan"]

  STRATEGY --> EXT_NEEDED{Decision-changing external source needed?}
  EXT_NEEDED -->|yes| EXT_AUTH{External fetch already approved by REFERENCE_NEED or project authority?}
  EXT_AUTH -->|yes| STRATEGIST_FETCH["Strategist fetches exactly needed URL or source map<br/>record approval basis, claim, source, and reason"]
  EXT_AUTH -->|no| EXT_APPROVAL["Request approval for external fetch<br/>target URL/source, reason, risk, reversibility, safer alternative"]
  EXT_APPROVAL -->|approved| STRATEGIST_FETCH
  EXT_APPROVAL -->|declined| EXT_DECLINED["Record declined fetch and missing evidence<br/>handoff blocker or ask for local source"]
  EXT_DECLINED --> NEEDS_CLARIFICATION
  EXT_NEEDED -->|no| STRATEGY_STATUS
  STRATEGIST_FETCH --> STRATEGY_STATUS{Strategy status?}

  STRATEGY_STATUS -->|NO_CHANGE| NO_CHANGE(["NO_CHANGE"])
  STRATEGY_STATUS -->|NEEDS_CLARIFICATION| STRATEGY_ASK["Ask one missing decision required for safe strategy"]
  STRATEGY_ASK --> NEEDS_CLARIFICATION
  STRATEGY_STATUS -->|BLOCKED| STRATEGY_BLOCKED["Retain blocker, assumptions, and recovery"]
  STRATEGY_STATUS -->|ERROR| STRATEGY_ERROR["Retain failed condition and context"]
  STRATEGY_STATUS -->|PASS| CHANGE_GATE{Plan requires dependency, public API, behavior, or scope expansion not allowed?}

  CHANGE_GATE -->|yes| ASK_CHANGE["Ask or stop for explicit allowance<br/>target, reason, risk, reversibility, safer alternative"]
  ASK_CHANGE --> NEEDS_CLARIFICATION
  CHANGE_GATE -->|no| IMPLEMENT["Dispatch strict-rewrite-implementer<br/>edit only approved files or direct compilation consequences"]
  IMPLEMENT --> IMPLEMENT_STATUS{Implementation status?}

  IMPLEMENT_STATUS -->|BLOCKED| IMPLEMENT_BLOCKED["Retain edit blocker and smallest recovery"]
  IMPLEMENT_STATUS -->|ERROR| IMPLEMENT_ERROR["Retain failed condition and changed paths"]
  IMPLEMENT_STATUS -->|PASS| VALIDATE_GATE{Validation command or project checker available?}

  VALIDATE_GATE -->|yes| VALIDATE_AUTH{Validation execution already approved by VALIDATION_COMMAND or project authority?}
  VALIDATE_AUTH -->|yes| VALIDATE["Run approved/project validation<br/>record approval basis, command, output, and result"]
  VALIDATE_AUTH -->|no| VALIDATE_APPROVAL["Request approval for validation execution<br/>command target, reason, risk, reversibility, safer alternative"]
  VALIDATE_APPROVAL -->|approved| VALIDATE
  VALIDATE_APPROVAL -->|declined| VALIDATE_DECLINED["Record declined validation and missing evidence<br/>handoff safest next action"]
  VALIDATE_DECLINED --> BLOCKED
  VALIDATE_GATE -->|no| REVIEW
  VALIDATE --> REVIEW["Dispatch strict-rewrite-reviewer<br/>verify behavior preservation, strictness, scope, and validation evidence"]
  REVIEW --> REVIEW_STATUS{Reviewer verdict?}

  REVIEW_STATUS -->|PASS| HANDOFF["Return final handoff<br/>original behavior, weaknesses, typing vs validation decisions, changed files or code, validation, references, risks"]
  HANDOFF --> PASS(["PASS"])

  REVIEW_STATUS -->|FAIL with targeted fixes| FIX_CYCLES{Fewer than two reviewer fix cycles used?}
  FIX_CYCLES -->|yes| REPAIR["Re-dispatch implementer with only reviewer-named fix scope"]
  REPAIR --> IMPLEMENT_STATUS
  FIX_CYCLES -->|no| REVIEW_BLOCKED["Retain unresolved findings, attempted repairs, and safest next action"]

  REVIEW_STATUS -->|BLOCKED| REVIEW_BLOCKED
  REVIEW_STATUS -->|ERROR| REVIEW_ERROR["Retain failed review condition and evidence"]

  BASELINE_BLOCKED --> BLOCKED(["BLOCKED"])
  STRATEGY_BLOCKED --> BLOCKED
  IMPLEMENT_BLOCKED --> BLOCKED
  REVIEW_BLOCKED --> BLOCKED

  BASELINE_ERROR --> ERROR(["ERROR"])
  STRATEGY_ERROR --> ERROR
  IMPLEMENT_ERROR --> ERROR
  REVIEW_ERROR --> ERROR
```
