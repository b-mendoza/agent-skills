# Execution Contracts (Orchestrator)

> Load this file when handling a subagent failure, showing the preview, applying
> the PR body template, or printing the final success block.
>
> Per-subagent return formats are not in this file. Each subagent loads its own
> output contract from `./contracts/<subagent-name>.md` at return time.

## Orchestrator Failure Envelope

Use this envelope when the workflow cannot safely continue:

```text
PR_CREATE: AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | EMPTY_DIFF | BLOCKED | CANCELLED | CREATE_ERROR
Reason: <one line>
Next step: <one clear action>
```

### Failure mapping

| Code | Use When |
| ---- | -------- |
| `AUTH` | Platform CLI, token, or permission is missing or invalid |
| `BASE_BRANCH_MISSING` | The target branch cannot be found on the remote |
| `HEAD_BRANCH_UNPUSHED` | The source branch is absent or stale remotely and cannot be pushed, or the user declined to push |
| `EMPTY_DIFF` | The trusted compare range has nothing meaningful to submit |
| `BLOCKED` | Repository state, unsupported platform, or a missing required value prevents safe progress |
| `CANCELLED` | The user declines a non-push confirmation gate |
| `CREATE_ERROR` | PR/MR creation or verification fails after approval |

### Mapping subagent codes to the envelope

| Subagent code | Envelope code |
| ------------- | ------------- |
| `PREFLIGHT: AUTH`, `PR_SUBMIT: AUTH`, `REVIEW_METADATA: AUTH` | `AUTH` |
| `PREFLIGHT: BASE_BRANCH_MISSING` | `BASE_BRANCH_MISSING` |
| `PREFLIGHT: HEAD_BRANCH_UNPUSHED` | `HEAD_BRANCH_UNPUSHED` |
| `DIFF_ANALYSIS: EMPTY_DIFF` | `EMPTY_DIFF` |
| `REPO_STATE: BLOCKED`, `PREFLIGHT: BLOCKED`, `PR_SUBMIT: BLOCKED` | `BLOCKED` |
| User declines a confirmation gate | `CANCELLED` |
| `PR_SUBMIT: CREATE_ERROR` | `CREATE_ERROR` |
| Any subagent `ERROR` | `BLOCKED` (with the subagent reason and the next safe action) |

## Preview Template

Show this before creating anything. Any edit to title, body, reviewer, label,
branch, or state invalidates approval. Show a fresh preview after the affected
phase re-runs. After three non-converging preview cycles, ask the user for
explicit final values.

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

Use this body when the user did not provide `BODY_OVERRIDE`. Mention tests only
when the diff analysis reports test changes or test-relevant risk. For deeper
guidance on writing good descriptions, fetch the entries grouped under "PR
Writing and Review Quality" in `./external-resources.md`.

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
