# Execution Contracts

> Load this file only when exact PR preview, final response, failure mapping, or
> subagent return formatting is needed. Keep raw command output inside subagents.

This reference is part of the skill package. It is standalone and does not rely
on repo-level authoring docs.

## Orchestrator Failure Envelope

Use this envelope when the workflow cannot safely continue:

```text
PR_CREATE: AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | EMPTY_DIFF | BLOCKED | CANCELLED | CREATE_ERROR
Reason: <one line>
Next step: <one clear action>
```

Failure mapping:

| Code | Use When |
| ---- | -------- |
| `AUTH` | Platform CLI, token, or permission is missing or invalid |
| `BASE_BRANCH_MISSING` | The target branch cannot be found on the remote |
| `HEAD_BRANCH_UNPUSHED` | The source branch is absent/stale remotely and cannot be pushed or user declined push |
| `EMPTY_DIFF` | The trusted compare range has nothing meaningful to submit |
| `BLOCKED` | Repository state, unsupported platform, or missing required value prevents safe progress |
| `CANCELLED` | The user declines a non-push confirmation gate |
| `CREATE_ERROR` | PR/MR creation or verification fails after approval |

## Preview Template

Show this before creating anything:

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

Any edit to title, body, reviewer, label, branch, or state invalidates approval.
Show a fresh preview after the affected phase re-runs. After three
non-converging preview cycles, ask the user for explicit final values.

## Final Success Output

```text
PR created: <url>

Base: <target_branch>
Head: <current_branch>
Title: <title>
State: <draft|ready>
Reviewers: <reviewer list or none>
Labels: <label list or none>

Description:
<description>
```

## PR Body Template

Use this body when the user did not provide `BODY_OVERRIDE`:

```markdown
## Summary

<2-3 sentence overview of what changed and why it matters>

## Key Changes

- <specific grounded change>
- <specific grounded change>

## Impact

- <who or what is affected>
- <testing, migration, rollout, or risk notes when present>
```

Mention tests only when the diff analysis says tests changed or test risk is
relevant.

## Subagent Output Contracts

### Repo State Inspector

```text
REPO_STATE: PASS | BLOCKED | ERROR
Remote: <remote url or none>
Platform: github | github-enterprise | gitlab | bitbucket | unknown
Current branch: <branch or none>
Target branch: <target branch or missing>
PR state: draft | ready | invalid
Uncommitted work: none | <count and concise categories>
Platform adapter needed: yes | no

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or orchestrator action>
```

<example>
REPO_STATE: PASS
Remote: git@github.com:acme/app.git
Platform: github
Current branch: docs/pr-creator-skill
Target branch: main
PR state: draft
Uncommitted work: none
Platform adapter needed: no

Reason: none
Decision needed: none
</example>

### Preflight Validator

```text
PREFLIGHT: PASS | PUSH_REQUIRED | AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | BLOCKED | ERROR
Platform: <platform>
Base branch: <target_branch>
Head branch: <current_branch>
Head remote state: up-to-date | missing | local-ahead | unknown
Push attempted: yes | no

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or recovery action>
```

<example>
PREFLIGHT: PUSH_REQUIRED
Platform: github
Base branch: main
Head branch: feat/checkout-redesign
Head remote state: local-ahead
Push attempted: no

Reason: Local branch has commits that are not on origin/feat/checkout-redesign.
Decision needed: Ask the user whether to push the current branch.
</example>

### Diff Analyzer

```text
DIFF_ANALYSIS: PASS | LARGE_PR_CONFIRMATION_REQUIRED | EMPTY_DIFF | ERROR
Range: origin/<target_branch>...origin/<current_branch>
Shortstat: <insertions/deletions summary or none>
Changed files:
- <path or grouped area>

Diff summary:
- <grounded behavior or structural change>

Conventional type candidates:
- <type>: <rationale>

Scope candidates:
- none | <scope>: <rationale>

Tests:
- none | <test files or test-relevant changes>

Risk notes:
- none | <risk or migration note>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest confirmation or recovery action>
```

<example>
DIFF_ANALYSIS: LARGE_PR_CONFIRMATION_REQUIRED
Range: origin/main...origin/feat/billing-export
Shortstat: 38 files changed, 1460 insertions(+), 210 deletions(-)
Changed files:
- api/billing export endpoints
- frontend billing settings
- docs export workflow

Diff summary:
- Export API, UI, and documentation changed in one branch.

Conventional type candidates:
- feat: adds a new export capability

Scope candidates:
- billing: most changed files are billing-related

Tests:
- billing export API tests changed

Risk notes:
- Large mixed surface may be hard to review as one PR.

Reason: Size gate exceeded and the branch spans API, UI, and docs.
Decision needed: Ask the user whether to proceed with one large PR or split it.
</example>

### PR Drafter

```text
PR_DRAFT: PASS | NEEDS_CHOICE | ERROR
Title: <title or none>
Type: <type or needs-choice>
Scope: none | <scope or needs-choice>

Body:
<body or none>

Sources used:
- diff analysis
- title override | body override | none

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user choice or recovery action>
```

<example>
PR_DRAFT: PASS
Title: docs(skills): strengthen pr creation workflow
Type: docs
Scope: skills

Body:
## Summary

This updates the PR creation skill so execution-heavy work is delegated to
focused subagents. The workflow keeps the user in control of push, preview, and
create gates while reducing raw git and diff output in the orchestrator.

## Key Changes

- Adds subagent routing for state inspection, preflight, diff analysis, drafting,
  metadata, and submission.
- Preserves explicit preview approval before creating the PR.

## Impact

- PR creation runs with clearer phase boundaries and less orchestrator context
  pollution.
- No runtime migration is required for existing skill consumers.

Sources used:
- diff analysis
- none

Reason: none
Decision needed: none
</example>

### Review Metadata Suggester

```text
REVIEW_METADATA: PASS | NEEDS_REVIEWER | INVALID_LABELS | AUTH | ERROR
Reviewers: <reviewer list or none>
Reviewer source: user | CODEOWNERS | none
Labels: <label list or none>
Label source: platform-list | user-override | skipped | none
CODEOWNERS source: .github/CODEOWNERS | CODEOWNERS | none

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or recovery action>
```

<example>
REVIEW_METADATA: INVALID_LABELS
Reviewers: alice
Reviewer source: user
Labels: none
Label source: user-override
CODEOWNERS source: none

Reason: Label `doc` does not exist on the repository.
Decision needed: Ask the user to choose `documentation` or remove labels.
</example>

### PR Submitter

```text
PR_SUBMIT: PASS | BLOCKED | CREATE_ERROR | AUTH | ERROR
URL: <created PR/MR URL or none>
Base: <target_branch>
Head: <current_branch>
Title: <title>
State: draft | ready
Reviewers: <reviewer list or none>
Labels: <label list or none>
Verification: pass | fail | not-run

Reason: none | <why status is not PASS>
Decision needed: none | <smallest recovery action>
```

<example>
PR_SUBMIT: PASS
URL: https://github.com/acme/app/pull/42
Base: main
Head: docs/pr-creator-skill
Title: docs(skills): strengthen pr creation workflow
State: draft
Reviewers: @docs-team
Labels: documentation
Verification: pass

Reason: none
Decision needed: none
</example>
