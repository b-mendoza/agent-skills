# PR Creator Workflow

The `pr-creator` skill is a pull request creation orchestrator. It may inspect repository state, validate remote comparability, analyze a trusted remote diff, draft a title and body, resolve reviewers and labels, show an exact preview, and create a PR or MR only after explicit approval. Its trust model is compact subagent status blocks, recorded remote facts, comparable remote refs, exact changed-file paths, platform-valid metadata, and frozen preview fields.

```mermaid
flowchart TD
  START([Start: user asks to create a PR or MR]) --> INPUTS["Normalize inputs: TARGET_BRANCH, PR_STATE, REMOTE_NAME, REVIEWERS, TITLE_OVERRIDE, BODY_OVERRIDE, LABELS_OVERRIDE"]
  INPUTS --> TARGET_OK{"TARGET_BRANCH known and PR_STATE valid?"}
  TARGET_OK -->|no| ASK_TARGET["Human gate: ask for missing TARGET_BRANCH or valid PR_STATE"]
  ASK_TARGET -->|answered| REPO["Dispatch repo-state-inspector"]
  ASK_TARGET -->|waiting| FAIL_BLOCKED([PR_CREATE: BLOCKED])
  TARGET_OK -->|yes| REPO

  REPO --> REPO_STATUS{"REPO_STATE status"}
  REPO_STATUS -->|PASS| LOCAL_WORK{"Uncommitted local changes?"}
  REPO_STATUS -->|BLOCKED or ERROR| FAIL_BLOCKED
  LOCAL_WORK -->|yes| LOCAL_BOUNDARY["State boundary: local changes stay outside PR until committed"]
  LOCAL_WORK -->|no| PLATFORM_CHECK{"Adapter needed or platform unknown?"}
  LOCAL_BOUNDARY --> PLATFORM_CHECK

  PLATFORM_CHECK -->|yes| ADAPTER["Load platform-adaptation.md"]
  PLATFORM_CHECK -->|no| PREFLIGHT["Dispatch preflight-validator"]
  ADAPTER --> PLATFORM_SAFE{"Safe platform create path known?"}
  PLATFORM_SAFE -->|yes| PREFLIGHT
  PLATFORM_SAFE -->|no| ASK_PLATFORM["Human gate: ask hosting platform or approved tooling"]
  ASK_PLATFORM -->|answered| ADAPTER
  ASK_PLATFORM -->|waiting| FAIL_BLOCKED

  PREFLIGHT --> PREF_STATUS{"PREFLIGHT status"}
  PREF_STATUS -->|PASS| TRUSTED_DIFF["Trusted compare range: remote/target...remote/current"]
  PREF_STATUS -->|PUSH_REQUIRED| PUSH_CYCLE{"Preflight cycles under 3?"}
  PREF_STATUS -->|AUTH| FAIL_AUTH([PR_CREATE: AUTH])
  PREF_STATUS -->|BASE_BRANCH_MISSING| FAIL_BASE([PR_CREATE: BASE_BRANCH_MISSING])
  PREF_STATUS -->|HEAD_BRANCH_UNPUSHED| FAIL_HEAD([PR_CREATE: HEAD_BRANCH_UNPUSHED])
  PREF_STATUS -->|BLOCKED or ERROR| FAIL_BLOCKED
  PUSH_CYCLE -->|yes| PUSH_GATE["Human gate: approve pushing current branch"]
  PUSH_CYCLE -->|no| RECOVERY["Human gate: ask exact recovery values or permission to stop"]
  PUSH_GATE -->|approved| PREFLIGHT_PUSH["Redispatch preflight-validator only with PUSH_APPROVED=true"]
  PUSH_GATE -->|declined| FAIL_HEAD
  PREFLIGHT_PUSH --> PREF_STATUS

  TRUSTED_DIFF --> DIFF["Dispatch diff-analyzer"]
  DIFF --> DIFF_STATUS{"DIFF_ANALYSIS status"}
  DIFF_STATUS -->|PASS| DRAFT["Dispatch pr-drafter"]
  DIFF_STATUS -->|LARGE_PR_CONFIRMATION_REQUIRED| SCOPE_CYCLE{"Scope cycles under 3?"}
  DIFF_STATUS -->|EMPTY_DIFF| FAIL_EMPTY([PR_CREATE: EMPTY_DIFF])
  DIFF_STATUS -->|ERROR| FAIL_BLOCKED
  SCOPE_CYCLE -->|yes| SCOPE_GATE["Human gate: proceed as one large or mixed-purpose PR?"]
  SCOPE_CYCLE -->|no| RECOVERY
  SCOPE_GATE -->|approved| DIFF_RETRY["Redispatch diff-analyzer only with LARGE_PR_APPROVED=true"]
  SCOPE_GATE -->|declined| FAIL_CANCELLED([PR_CREATE: CANCELLED])
  DIFF_RETRY --> DIFF_STATUS

  DRAFT --> DRAFT_STATUS{"PR_DRAFT status"}
  DRAFT_STATUS -->|PASS| META["Dispatch review-metadata-suggester with exact changed paths"]
  DRAFT_STATUS -->|NEEDS_CHOICE| DRAFT_CYCLE{"Draft cycles under 3?"}
  DRAFT_STATUS -->|ERROR| FAIL_BLOCKED
  DRAFT_CYCLE -->|yes| TYPE_SCOPE["Human gate: ask one type or scope choice"]
  DRAFT_CYCLE -->|no| RECOVERY
  TYPE_SCOPE -->|answered| DRAFT_RETRY["Redispatch pr-drafter only"]
  TYPE_SCOPE -->|waiting| FAIL_BLOCKED
  DRAFT_RETRY --> DRAFT_STATUS

  META --> META_STATUS{"REVIEW_METADATA status"}
  META_STATUS -->|PASS| PREVIEW["Load execution-contracts.md and show exact PR Preview"]
  META_STATUS -->|NEEDS_REVIEWER| REVIEWER_CYCLE{"Reviewer cycles under 3?"}
  META_STATUS -->|INVALID_LABELS| LABEL_CYCLE{"Label cycles under 3?"}
  META_STATUS -->|AUTH| FAIL_AUTH
  META_STATUS -->|ERROR| FAIL_BLOCKED
  REVIEWER_CYCLE -->|yes| REVIEWER_GATE["Human gate: ask for required reviewer"]
  REVIEWER_CYCLE -->|no| RECOVERY
  REVIEWER_GATE -->|answered| META_RETRY["Redispatch review-metadata-suggester only"]
  REVIEWER_GATE -->|waiting| FAIL_BLOCKED
  META_RETRY --> META_STATUS
  LABEL_CYCLE -->|yes| LABEL_GATE["Human gate: choose valid labels or remove labels"]
  LABEL_CYCLE -->|no| RECOVERY
  LABEL_GATE -->|answered| LABEL_RETRY["Redispatch review-metadata-suggester only"]
  LABEL_GATE -->|waiting| FAIL_BLOCKED
  LABEL_RETRY --> META_STATUS

  PREVIEW --> APPROVAL["Human gate: approve exact preview before create"]
  APPROVAL -->|approved| FREEZE["Freeze branch, state, title, body, reviewers, and labels"]
  APPROVAL -->|declined without changes| FAIL_CANCELLED
  APPROVAL -->|declined with changes| AFFECTED{"Earliest affected phase"}
  AFFECTED -->|branch or platform| REPO
  AFFECTED -->|preflight or push| PREFLIGHT
  AFFECTED -->|diff or scope| DIFF
  AFFECTED -->|title, body, type, or scope| DRAFT
  AFFECTED -->|reviewers or labels| META

  RECOVERY -->|exact values| RECOVERY_ROUTE{"Recovery target"}
  RECOVERY -->|stop or no values| FAIL_ESCALATED([PR_CREATE: ESCALATED])
  RECOVERY_ROUTE -->|repo, branch, platform| REPO
  RECOVERY_ROUTE -->|preflight or push| PREFLIGHT
  RECOVERY_ROUTE -->|diff or scope| DIFF
  RECOVERY_ROUTE -->|draft| DRAFT
  RECOVERY_ROUTE -->|metadata| META

  FREEZE --> SUBMIT["Dispatch pr-submitter with frozen approved values"]
  SUBMIT --> SUBMIT_STATUS{"PR_SUBMIT status"}
  SUBMIT_STATUS -->|PASS| VERIFY["Verify URL, base, head, title, body, state, reviewers, labels"]
  SUBMIT_STATUS -->|AUTH| FAIL_AUTH
  SUBMIT_STATUS -->|CREATE_ERROR| FAIL_CREATE([PR_CREATE: CREATE_ERROR])
  SUBMIT_STATUS -->|BLOCKED or ERROR| FAIL_BLOCKED
  VERIFY --> VERIFIED{"All frozen preview fields verified?"}
  VERIFIED -->|yes| SUCCESS["Return final success block with verified PR/MR URL"]
  VERIFIED -->|no| FAIL_CREATE
  SUCCESS --> DONE([Success])

  classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
  classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
  classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
  classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
  classDef stop fill:#fdecea,stroke:#b02a37,color:#000;

  class TARGET_OK,REPO_STATUS,LOCAL_WORK,PLATFORM_CHECK,PLATFORM_SAFE,PREF_STATUS,PUSH_CYCLE,DIFF_STATUS,SCOPE_CYCLE,DRAFT_STATUS,DRAFT_CYCLE,META_STATUS,REVIEWER_CYCLE,LABEL_CYCLE,AFFECTED,RECOVERY_ROUTE,SUBMIT_STATUS,VERIFIED decision;
  class REPO,PREFLIGHT,PREFLIGHT_PUSH,TRUSTED_DIFF,DIFF,DIFF_RETRY,DRAFT,DRAFT_RETRY,META,META_RETRY,LABEL_RETRY,SUBMIT,VERIFY check;
  class ASK_TARGET,ASK_PLATFORM,PUSH_GATE,SCOPE_GATE,TYPE_SCOPE,REVIEWER_GATE,LABEL_GATE,APPROVAL,RECOVERY human;
  class INPUTS,LOCAL_BOUNDARY,ADAPTER,PREVIEW,FREEZE,SUCCESS output;
  class DONE success;
  class FAIL_BLOCKED,FAIL_AUTH,FAIL_BASE,FAIL_HEAD,FAIL_EMPTY,FAIL_CANCELLED,FAIL_ESCALATED,FAIL_CREATE stop;
```

```text
PR Preview
----------
Title:      <title>
Target:     <target_branch>
Source:     <current_branch>
Reviewers:  <reviewer list>
Labels:     <label list or "none">
Status:     <draft or ready>

Description:
<description>
```

Readiness rule: dispatch `pr-submitter` only after `REPO_STATE: PASS`, a safe platform path, `PREFLIGHT: PASS`, `DIFF_ANALYSIS: PASS`, `PR_DRAFT: PASS`, `REVIEW_METADATA: PASS`, exact preview approval, and frozen approved preview fields. Return success only after verifying URL, base, head, title, body, state, reviewers, and labels against the frozen preview.

## Run Report

- Run mode and scope: new, whole skill workflow.
- Assumptions: `DOCS_DIR` defaulted to `docs/`; target slug resolved to `pr-creator`.
- Repair cycles used: 0.
- Mermaid validation method: inspected-only. `generate-flow-diagram/scripts/check-mermaid.sh` was run, but no `mmdc` or `npx` parser was available in this environment.
- Dispatch method: inline, because delegated agent work was not explicitly requested by the user.
- External sources fetched: none for diagram construction; local `pr-creator` files were sufficient.

## Source Grounding

- `skills/pr-creator/SKILL.md`: inputs, progressive loading map, subagent registry, workflow, status routing, core rules, and output contract.
- `skills/pr-creator/flow-diagram.md`: existing whole-workflow node coverage, human gates, failure envelope rule, and readiness rule.
- `skills/pr-creator/references/execution-contracts.md`: preview template, failure envelope, final success output, cycle recovery rule, and body template.
- `skills/pr-creator/references/platform-adaptation.md`: GitLab, Bitbucket, GitHub Enterprise, unknown platform handling, field mapping, and failure mapping.
- `skills/pr-creator/subagents/*.md` and `skills/pr-creator/references/contracts/*.md`: routeable subagent statuses, required inputs, outputs, and escalation behavior.
