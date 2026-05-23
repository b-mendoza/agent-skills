# PR Creator Skill Flow

The `skills/pr-creator` orchestrator creates a review-ready PR or MR from the
current branch by delegating repository inspection, platform adaptation,
preflight validation, diff analysis, drafting, review metadata, and submission to
focused subagents. The orchestrator may normalize inputs, ask focused questions,
recover only failing gates, and load local contracts. It must not push without
`GATE_PUSH_APPROVAL` and must not create a PR or MR without
`GATE_PREVIEW_APPROVAL`.

## Contract References

- `skills/pr-creator/SKILL.md`
- `skills/pr-creator/subagents/repo-state-inspector.md`
- `skills/pr-creator/subagents/preflight-validator.md`
- `skills/pr-creator/subagents/diff-analyzer.md`
- `skills/pr-creator/subagents/pr-drafter.md`
- `skills/pr-creator/subagents/review-metadata-suggester.md`
- `skills/pr-creator/subagents/pr-submitter.md`
- `skills/pr-creator/references/execution-contracts.md`
- `skills/pr-creator/references/platform-adaptation.md`
- `skills/pr-creator/references/contracts/repo-state-inspector.md`
- `skills/pr-creator/references/contracts/preflight-validator.md`
- `skills/pr-creator/references/contracts/diff-analyzer.md`
- `skills/pr-creator/references/contracts/pr-drafter.md`
- `skills/pr-creator/references/contracts/review-metadata-suggester.md`
- `skills/pr-creator/references/contracts/pr-submitter.md`

```mermaid
flowchart TD
  START([Start]) --> INTAKE[Normalize inputs]
  INTAKE --> REPO[Dispatch repo-state-inspector]
  REPO --> REPO_STATUS{REPO_STATE}

  REPO_STATUS -->|PASS| WORKTREE{Uncommitted work present}
  REPO_STATUS -->|BLOCKED| BLOCKED_FAIL["PR_CREATE: BLOCKED"]
  REPO_STATUS -->|ERROR| BLOCKED_FAIL

  WORKTREE -->|yes| NOTE_LOCAL[Record uncommitted-work boundary]
  WORKTREE -->|no| PLATFORM[Apply platform adaptation]
  NOTE_LOCAL --> PLATFORM

  PLATFORM --> PREFLIGHT[Dispatch preflight-validator]
  PREFLIGHT --> PREFLIGHT_STATUS{PREFLIGHT}

  PREFLIGHT_STATUS -->|PASS| DIFF[Dispatch diff-analyzer]
  PREFLIGHT_STATUS -->|PUSH_REQUIRED| GATE_PUSH_APPROVAL{GATE_PUSH_APPROVAL}
  PREFLIGHT_STATUS -->|AUTH| AUTH_FAIL["PR_CREATE: AUTH"]
  PREFLIGHT_STATUS -->|BASE_BRANCH_MISSING| BASE_FAIL["PR_CREATE: BASE_BRANCH_MISSING"]
  PREFLIGHT_STATUS -->|HEAD_BRANCH_UNPUSHED| HEAD_FAIL["PR_CREATE: HEAD_BRANCH_UNPUSHED"]
  PREFLIGHT_STATUS -->|BLOCKED| BLOCKED_FAIL
  PREFLIGHT_STATUS -->|ERROR| BLOCKED_FAIL

  GATE_PUSH_APPROVAL -->|approved| PUSH_BRANCH[Push approved current branch]
  GATE_PUSH_APPROVAL -->|declined| HEAD_FAIL
  GATE_PUSH_APPROVAL -->|limit reached| BLOCKED_FAIL
  PUSH_BRANCH --> PREFLIGHT

  DIFF --> DIFF_STATUS{DIFF_ANALYSIS}
  DIFF_STATUS -->|PASS| DRAFT[Dispatch pr-drafter]
  DIFF_STATUS -->|LARGE_PR_CONFIRMATION_REQUIRED| GATE_SCOPE_APPROVAL{GATE_SCOPE_APPROVAL}
  DIFF_STATUS -->|EMPTY_DIFF| EMPTY_FAIL["PR_CREATE: EMPTY_DIFF"]
  DIFF_STATUS -->|ERROR| BLOCKED_FAIL

  GATE_SCOPE_APPROVAL -->|approved| DRAFT
  GATE_SCOPE_APPROVAL -->|declined| CANCEL_FAIL["PR_CREATE: CANCELLED"]
  GATE_SCOPE_APPROVAL -->|limit reached| CANCEL_FAIL

  DRAFT --> DRAFT_STATUS{PR_DRAFT}
  DRAFT_STATUS -->|PASS| META[Dispatch review-metadata-suggester]
  DRAFT_STATUS -->|NEEDS_CHOICE| GATE_DRAFT_CHOICE{GATE_DRAFT_CHOICE}
  DRAFT_STATUS -->|ERROR| BLOCKED_FAIL

  GATE_DRAFT_CHOICE -->|choice provided| DRAFT
  GATE_DRAFT_CHOICE -->|cancelled| CANCEL_FAIL
  GATE_DRAFT_CHOICE -->|limit reached| BLOCKED_FAIL

  META --> META_STATUS{REVIEW_METADATA}
  META_STATUS -->|PASS| PREVIEW[Load preview output contract]
  META_STATUS -->|NEEDS_REVIEWER| GATE_REVIEWER{GATE_REVIEWER}
  META_STATUS -->|INVALID_LABELS| GATE_LABELS{GATE_LABELS}
  META_STATUS -->|AUTH| AUTH_FAIL
  META_STATUS -->|ERROR| BLOCKED_FAIL

  GATE_REVIEWER -->|reviewer provided| META
  GATE_REVIEWER -->|cancelled| CANCEL_FAIL
  GATE_REVIEWER -->|limit reached| BLOCKED_FAIL

  GATE_LABELS -->|labels corrected| META
  GATE_LABELS -->|labels removed| META
  GATE_LABELS -->|cancelled| CANCEL_FAIL
  GATE_LABELS -->|limit reached| BLOCKED_FAIL

  PREVIEW --> GATE_PREVIEW_APPROVAL{GATE_PREVIEW_APPROVAL}
  GATE_PREVIEW_APPROVAL -->|approved| FREEZE[Freeze approved preview fields]
  GATE_PREVIEW_APPROVAL -->|revise title or body| DRAFT
  GATE_PREVIEW_APPROVAL -->|revise reviewers or labels| META
  GATE_PREVIEW_APPROVAL -->|revise branch or preflight| PREFLIGHT
  GATE_PREVIEW_APPROVAL -->|declined| CANCEL_FAIL

  FREEZE --> SUBMIT[Dispatch pr-submitter]
  SUBMIT --> SUBMIT_STATUS{PR_SUBMIT}
  SUBMIT_STATUS -->|PASS| SUCCESS([Success: verified PR or MR URL])
  SUBMIT_STATUS -->|BLOCKED| BLOCKED_FAIL
  SUBMIT_STATUS -->|CREATE_ERROR| CREATE_FAIL["PR_CREATE: CREATE_ERROR"]
  SUBMIT_STATUS -->|AUTH| AUTH_FAIL
  SUBMIT_STATUS -->|ERROR| CREATE_FAIL

  classDef subagent fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef gate fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef guard fill:#fff3cd,stroke:#856404,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;

  class REPO,PREFLIGHT,DIFF,DRAFT,META,SUBMIT subagent;
  class GATE_PUSH_APPROVAL,GATE_SCOPE_APPROVAL,GATE_DRAFT_CHOICE,GATE_REVIEWER,GATE_LABELS,GATE_PREVIEW_APPROVAL gate;
  class INTAKE,WORKTREE,NOTE_LOCAL,PLATFORM,PREVIEW,FREEZE,PUSH_BRANCH guard;
  class AUTH_FAIL,BASE_FAIL,HEAD_FAIL,EMPTY_FAIL,BLOCKED_FAIL,CANCEL_FAIL,CREATE_FAIL stop;
  class SUCCESS success;
```

## Status Contracts

- `REPO_STATE: PASS | BLOCKED | ERROR`
- `PREFLIGHT: PASS | PUSH_REQUIRED | AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | BLOCKED | ERROR`
- `DIFF_ANALYSIS: PASS | LARGE_PR_CONFIRMATION_REQUIRED | EMPTY_DIFF | ERROR`
- `PR_DRAFT: PASS | NEEDS_CHOICE | ERROR`
- `REVIEW_METADATA: PASS | NEEDS_REVIEWER | INVALID_LABELS | AUTH | ERROR`
- `PR_SUBMIT: PASS | BLOCKED | CREATE_ERROR | AUTH | ERROR`

## Terminal Rules

- `PR_CREATE: AUTH` returns the gate that failed, evidence used, and one next
  step to authenticate or refresh access.
- `PR_CREATE: BASE_BRANCH_MISSING` returns the missing target branch evidence and
  one next step to choose an existing target branch.
- `PR_CREATE: HEAD_BRANCH_UNPUSHED` returns the source branch evidence and one
  next step to push manually or approve the orchestrator to push.
- `PR_CREATE: EMPTY_DIFF` returns the compare range evidence and one next step to
  add commits or choose a different branch pair.
- `PR_CREATE: BLOCKED` returns the blocked subagent status, evidence used, and
  one next step to resolve the blocker.
- `PR_CREATE: CANCELLED` returns the declined gate and one next step to rerun
  after approval is available.
- `PR_CREATE: CREATE_ERROR` returns the create or verification failure and one
  next step to correct and retry.
- Success returns the verified PR or MR URL plus frozen submitted metadata from
  `PR_SUBMIT: PASS`.
