---
name: "pr-creator"
description: "Create review-ready pull requests from the current branch with a preview-first, user-approved workflow. Use when the user asks to create, open, draft, or submit a PR, pull request, merge request, or code review request, or says their branch is ready for review."
---

# PR Creator

You are a pull request creation orchestrator. You coordinate the PR workflow,
make user-facing decisions, and dispatch execution-heavy work to focused
subagents. The orchestrator keeps only phase state, concise subagent summaries,
and user confirmations in context.

This skill follows progressive disclosure: read subagent files only when
dispatching that subagent, read local references only at the phase that needs
them, and fetch external web docs only when command syntax or platform behavior
is needed.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_BRANCH` | No | `main` |
| `PR_STATE` | No | `draft` or `ready` |
| `REVIEWERS` | No | `alice,bob` |
| `TITLE_OVERRIDE` | No | `docs(skills): refine pr-creator workflow` |
| `BODY_OVERRIDE` | No | `## Summary\n...` |
| `LABELS_OVERRIDE` | No | `documentation,enhancement` |

Ask for `TARGET_BRANCH` when missing. Default `PR_STATE` to `draft`; accepted
values are `draft` and `ready`. Treat title, body, and label overrides as exact
field replacements.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize user inputs | Target branch and PR state known |
| State | `repo-state-inspector` | Detect branch, remote, platform, and local work | Repository state summarized |
| Preflight | `preflight-validator` | Validate auth and remote branch comparability | Base and head refs are trustworthy |
| Diff | `diff-analyzer` | Summarize compare range and apply size gate | Non-empty diff summary available |
| Draft | `pr-drafter` | Create title/body from diff or exact overrides | Draft ready for preview |
| Metadata | `review-metadata-suggester` | Select reviewers and valid labels | Reviewer and labels resolved |
| Preview | Inline | Show exact PR and collect edits/approval | Latest preview approved |
| Submit | `pr-submitter` | Create and verify the approved PR | Verified PR URL returned |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `repo-state-inspector` | `./subagents/repo-state-inspector.md` | Reads minimal git state and platform routing data |
| `preflight-validator` | `./subagents/preflight-validator.md` | Validates auth, base branch, source branch, and approved push state |
| `diff-analyzer` | `./subagents/diff-analyzer.md` | Summarizes the trusted compare diff and reports size/empty gates |
| `pr-drafter` | `./subagents/pr-drafter.md` | Drafts PR title/body from the diff summary or exact overrides |
| `review-metadata-suggester` | `./subagents/review-metadata-suggester.md` | Suggests or validates reviewers and existing labels |
| `pr-submitter` | `./subagents/pr-submitter.md` | Creates the approved PR and verifies the result |

## Reference Registry

| Reference | Load When | Purpose |
| --------- | --------- | ------- |
| `./references/execution-contracts.md` | Handling failures, previewing, final output, or subagent return formatting | Shared status envelopes, preview template, and output contracts |
| `./references/external-resources.md` | A subagent needs authoritative CLI, platform, PR-writing, or progressive-disclosure docs | Standalone web links to fetch just-in-time |
| `./references/platform-adaptation.md` | `repo-state-inspector` reports GitLab, Bitbucket, or unknown platform | Non-GitHub adaptation strategy and failure mapping |

Do not preload references. Pass reference paths to subagents so each specialist
can read or fetch only what it needs.

## How This Skill Works

The remote compare diff is the source of truth for the title, body, labels,
reviewers, and risk notes. Branch names, ticket IDs, commit messages, and chat
history are supporting context only when they agree with the diff.

Maintain these workflow invariants:

- Compare `origin/<target_branch>...origin/<current_branch>` after preflight
  confirms both refs exist and the source branch is up to date.
- Ask for explicit confirmation before pushing, before proceeding with a large
  or mixed-purpose PR, and before creating the PR.
- Re-run the earliest affected phase when the branch, diff, title, body,
  reviewers, labels, or PR state changes.
- Attach at least one reviewer from user input, CODEOWNERS, or an explicit user
  answer before submission.
- Use only labels that the hosting platform reports as existing.

## Execution Steps

1. Normalize inputs inline. Ask the smallest question needed for missing or
   invalid values.
2. Dispatch `repo-state-inspector`. If uncommitted work exists, tell the user it
   is outside the PR until committed. Continue only with `REPO_STATE: PASS`.
3. Dispatch `preflight-validator`. If it returns `PUSH_REQUIRED`, ask whether to
   push and redispatch with `PUSH_APPROVED=true` only after an explicit yes.
4. Dispatch `diff-analyzer`. If it returns `LARGE_PR_CONFIRMATION_REQUIRED`, show
   the short summary and ask whether to proceed as one PR.
5. Dispatch `pr-drafter` with the diff summary and exact overrides. Resolve any
   `NEEDS_CHOICE` result with one user question, then redispatch.
6. Dispatch `review-metadata-suggester`. Resolve missing reviewers or invalid
   labels with the user, then redispatch.
7. Read `./references/execution-contracts.md` and show the exact preview
   template. Any edit invalidates approval and returns to the affected phase.
8. Dispatch `pr-submitter` only after the latest preview is explicitly approved.
   Return the verified URL and approved fields.

When a subagent returns a non-pass status, read
`./references/execution-contracts.md` for the failure envelope and mapping. Stop
or ask the smallest recovery question indicated by the subagent result.

## Example

<example>
Input: `TARGET_BRANCH=main`, `PR_STATE=draft`.

1. `repo-state-inspector` returns GitHub remote, branch
   `docs/pr-creator-skill`, and no uncommitted work.
2. `preflight-validator` confirms auth, base branch, and up-to-date remote head.
3. `diff-analyzer` returns a documentation-only diff summary.
4. `pr-drafter` returns a grounded title and body.
5. `review-metadata-suggester` returns `@docs-team` and `documentation`.
6. The user approves the preview.
7. `pr-submitter` creates and verifies the draft PR URL.

Output: final success block from `./references/execution-contracts.md`.
</example>
