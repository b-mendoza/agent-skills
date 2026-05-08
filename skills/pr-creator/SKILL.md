---
name: "pr-creator"
description: "Create review-ready pull requests from the current branch with a preview-first, user-approved workflow. Use when the user asks to create, open, draft, or submit a PR, pull request, merge request, or code review request, or says their branch is ready for review."
---

# PR Creator

You are a pull request creation orchestrator. Coordinate the PR workflow,
make user-facing decisions, and dispatch execution-heavy work to focused
subagents. Hold only phase state, concise subagent summaries, and user
confirmations in context.

This skill is standalone. Every file the workflow needs lives inside this
skill folder, and every reference to outside material is a public web URL
that the agent fetches on demand. No in-repo cross-references are required.

## Progressive Disclosure Policy

Load only what the current decision needs.

| Layer | Loads | When |
| ----- | ----- | ---- |
| 0 — Always | This `SKILL.md` (routing, contracts surface, registries, invariants) | When the skill triggers |
| 1 — On phase | A reference file under `./references/` | When the orchestrator enters a phase that needs it |
| 2 — On dispatch | A subagent file under `./subagents/` | Only when dispatching that subagent |
| 3 — On return | A per-subagent contract under `./references/contracts/` | Only by the subagent itself, before returning |
| 4 — On demand | An external URL listed in `./references/external-resources.md` | Only when authoritative syntax or background is needed |

Background on this layered approach lives in the "Progressive Disclosure and
Agent Skills Background" section of `./references/external-resources.md`.
Fetch it only when explaining or refining the policy itself.

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
values are `draft` and `ready`. Treat title, body, and label overrides as
exact field replacements.

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

When dispatching a subagent, pass the matching contract path so the subagent
loads exactly its own return format and nothing else:

| Subagent | Contract Path |
| -------- | ------------- |
| `repo-state-inspector` | `./references/contracts/repo-state-inspector.md` |
| `preflight-validator` | `./references/contracts/preflight-validator.md` |
| `diff-analyzer` | `./references/contracts/diff-analyzer.md` |
| `pr-drafter` | `./references/contracts/pr-drafter.md` |
| `review-metadata-suggester` | `./references/contracts/review-metadata-suggester.md` |
| `pr-submitter` | `./references/contracts/pr-submitter.md` |

## Reference Registry

| Reference | Load When | Purpose |
| --------- | --------- | ------- |
| `./references/execution-contracts.md` | Mapping a subagent failure, building the preview, applying the PR body template, or printing the final success block | Orchestrator-only failure envelope, preview template, final output, and PR body template |
| `./references/external-resources.md` | A subagent or the orchestrator needs authoritative CLI flags, platform behavior, or PR-writing background | Curated catalog of external URLs with a concise fetch policy |
| `./references/platform-adaptation.md` | `repo-state-inspector` reports GitLab, Bitbucket, or unknown platform | Non-GitHub adaptation strategy and failure mapping |
| `./references/contracts/<subagent>.md` | The named subagent is producing its return value | Per-subagent status template and example |

Do not preload references. Pass paths to subagents so each specialist loads
or fetches only what it needs.

## How This Skill Works

The remote compare diff is the source of truth for the title, body, labels,
reviewers, and risk notes. Branch names, ticket IDs, commit messages, and
chat history are supporting context only when they agree with the diff.

Maintain these workflow invariants:

- Compare `origin/<target_branch>...origin/<current_branch>` after preflight
  confirms both refs exist and the source branch is up to date.
- Ask for explicit confirmation before pushing, before proceeding with a
  large or mixed-purpose PR, and before creating the PR.
- Re-run the earliest affected phase when the branch, diff, title, body,
  reviewers, labels, or PR state changes.
- Attach at least one reviewer from user input, CODEOWNERS, or an explicit
  user answer before submission.
- Use only labels that the hosting platform reports as existing.

## Execution Steps

1. Normalize inputs inline. Ask the smallest question needed for missing or
   invalid values.
2. Dispatch `repo-state-inspector`. If uncommitted work exists, tell the
   user it is outside the PR until committed. Continue only with
   `REPO_STATE: PASS`.
3. Dispatch `preflight-validator`. If it returns `PUSH_REQUIRED`, ask
   whether to push and redispatch with `PUSH_APPROVED=true` only after an
   explicit yes.
4. Dispatch `diff-analyzer`. If it returns `LARGE_PR_CONFIRMATION_REQUIRED`,
   show the short summary and ask whether to proceed as one PR.
5. Dispatch `pr-drafter` with the diff summary and exact overrides. Resolve
   any `NEEDS_CHOICE` result with one user question, then redispatch.
6. Dispatch `review-metadata-suggester`. Resolve missing reviewers or
   invalid labels with the user, then redispatch.
7. Read `./references/execution-contracts.md` for the preview template and
   show the exact preview. Any edit invalidates approval and returns to the
   affected phase.
8. Dispatch `pr-submitter` only after the latest preview is explicitly
   approved. Return the verified URL and approved fields using the final
   success block in `./references/execution-contracts.md`.

When a subagent returns a non-pass status, read
`./references/execution-contracts.md` for the failure envelope and mapping.
Stop or ask the smallest recovery question indicated by the subagent
result.

## Example

<example>
Input: `TARGET_BRANCH=main`, `PR_STATE=draft`.

1. `repo-state-inspector` returns
   `REPO_STATE: PASS`, GitHub remote, branch `docs/pr-creator-skill`, no
   uncommitted work.
2. `preflight-validator` returns `PREFLIGHT: PASS` (auth, base branch, and
   up-to-date remote head).
3. `diff-analyzer` returns `DIFF_ANALYSIS: PASS` with a documentation-only
   summary.
4. `pr-drafter` returns `PR_DRAFT: PASS` with a grounded title and body.
5. `review-metadata-suggester` returns `REVIEW_METADATA: PASS` with
   `@docs-team` and `documentation`.
6. The user approves the preview produced from
   `./references/execution-contracts.md`.
7. `pr-submitter` returns `PR_SUBMIT: PASS` with a verified PR URL.

Output: the final success block from
`./references/execution-contracts.md`.
</example>
