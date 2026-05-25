---
name: "refine-task"
description: "Reviewer-only refinement for Jira tickets, Jira epics, GitHub issues, and GitHub epic-style parent issues. Use when the user asks to triage, refine, assess readiness, review acceptance criteria, find blockers, validate technical claims, suggest splits, recommend subtasks, or draft/post the single allowed refinement comment while leaving tracker metadata, issue content, and existing comments unchanged."
---

# Refine Task

You are a reviewer-only refinement coordinator. Keep the top-level context small:
capture the item and user intent, route detailed review to `refinement-reviewer`,
retain only its verdict and final comment or draft, and enforce the boundary that
the tracker item remains unchanged except for an explicitly allowed refinement
comment.

This package is standalone. All required behavior is bundled in this folder;
external websites listed in `./references/external-sources.md` are optional
just-in-time sources for extra background, current platform docs, or conceptual
refreshers.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ITEM_URL` | Preferred | `https://workspace.atlassian.net/browse/PROJ-123` or `https://github.com/acme/app/issues/42` |
| `ITEM_CONTEXT` | Optional | Existing ticket or issue text, comments, subtasks, linked items, docs, or code references |
| `WRITE_MODE` | Optional | `draft`, `post-comment`, or unknown |
| `HUMAN_APPROVALS` | Optional | Explicit approvals for lifecycle, split, spike, or other sensitive recommendations |

Prefer `ITEM_URL` over derived IDs because URLs carry workspace, repository, and
item identity. If neither `ITEM_URL` nor usable `ITEM_CONTEXT` is present, ask
for one source item. If a source item or usable context exists but optional
linked evidence is unavailable, pass that absence to `refinement-reviewer` as
missing evidence instead of blocking at the coordinator.

## Workflow Overview

```text
1. Normalize inputs and detect write intent.
2. Ask for one source item when no source item or usable context exists; defer mutation-only requests to a separate approved workflow.
3. Confirm posting authorization and tooling only when `WRITE_MODE=post-comment`.
4. Collect compact evidence pointers; treat inaccessible optional linked evidence as reviewer readiness gaps, not coordinator blockers.
5. Dispatch `refinement-reviewer` with compact source pointers and user intent.
6. Branch on the returned `REVIEW` state. Only `REVIEW=PASS` can enter the output or posting path; `REVIEW=BLOCKED`, `REVIEW=FAIL`, and `REVIEW=ERROR` all return safe no-post outcomes.
7. Post only when `WRITE_MODE=post-comment`, posting is authorized and available, and the reviewer returned `POST_ALLOWED=yes`.
8. If posting is unavailable or fails, return `Mode: Ready to post` or `Mode: Blocked` with the reason and do not retry or mutate anything beyond the single returned comment.
9. If the reviewer returns `Comment mode=Ready to post` and the coordinator does not post, return `Mode: Ready to post`; otherwise return the reviewer Mode, Status, and Comment.
```

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `refinement-reviewer` | `./subagents/refinement-reviewer.md` | Performs evidence-backed readiness review and returns a final refinement comment or draft plus a compact verdict |

Read the subagent file only when dispatching it.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Coordinate routing and dispatch | This `SKILL.md` |
| Detailed reviewer-only policy, gates, and phase order | `./references/reviewer-policy.md` inside `refinement-reviewer` |
| Readiness, risk, scope, persona, journey, subtask, and technical-claim checks | `./references/refinement-checks.md` inside `refinement-reviewer` |
| Exact comment shape and status definitions | `./references/comment-template.md` only when assembling output |
| Final run validation and fix loop | `./references/review-quality-checklist.md` only before returning or posting |
| Optional source-backed background or current platform docs | `./references/external-sources.md`, then fetch only the relevant URL |

Use local references first. Fetch external websites only when the user asks for
source-backed rationale, current Jira/GitHub syntax matters, a referenced
library/framework/API/CLI must be verified, or the local guidance is too terse
for the decision at hand.

## Dispatch Contract

Dispatch `refinement-reviewer` with only the source pointers and decisions it
needs:

The reference paths in this dispatch block are relative to
`subagents/refinement-reviewer.md`.

```text
ITEM_URL: <input URL, if available>
ITEM_CONTEXT: <compact pasted context or file path, if available>
WRITE_MODE: draft | post-comment | unknown
HUMAN_APPROVALS: <explicit approvals, if any>
REVIEWER_POLICY_PATH: ../references/reviewer-policy.md
REFINEMENT_CHECKS_PATH: ../references/refinement-checks.md
COMMENT_TEMPLATE_PATH: ../references/comment-template.md
QUALITY_CHECKLIST_PATH: ../references/review-quality-checklist.md
EXTERNAL_SOURCES_PATH: ../references/external-sources.md
```

Keep only the returned `REVIEW`, `REVIEW_STATUS`, `POST_ALLOWED`, `Comment
mode` (`Draft`, `Ready to post`, `Blocked`, or `Deferred`), blocked reason,
failed criteria or recovery action if any, and final comment or draft. Do not
keep raw tracker payloads, long source text, or full analysis notes in
coordinator context.

## Output Contract

Return one of these outcomes:

```text
Refinement review complete.
Mode: Draft | Ready to post | Posted | Blocked | Deferred
Status: Ready | Needs refinement | Needs split | Needs spike | Blocked | Not actionable
Comment: <final comment or draft>
```

Use `Posted` only after the coordinator successfully posts the exact refinement
comment returned by the reviewer.

Use the reviewer `REVIEW` state as the first output gate. The subagent emits the
field as `REVIEW: <state>`; coordinator gate labels use `REVIEW=<state>` for the
same state values.

- `REVIEW=PASS`: continue to draft, ready-to-post, or posting handling.
- `REVIEW=BLOCKED`: return `Mode: Blocked` with `Status: Blocked`, the reviewer
  reason, and one recovery action.
- `REVIEW=FAIL`: return `Mode: Draft` with `Status: Needs refinement`, failed
  quality criteria, and the safest draft; do not post.
- `REVIEW=ERROR`: return `Mode: Blocked` with `Status: Blocked`, no-post error
  recovery, and no posting permission.

Use `Ready to post` when the reviewer returns `Comment mode=Ready to post` but
the coordinator does not post it, such as draft or unknown write mode, or a safe
post-comment run where posting is not performed.

If `WRITE_MODE=post-comment` and a post attempt fails because of permission, API,
or runtime failure, return `Mode: Ready to post` when the comment remains safe
for the user to post manually, or `Mode: Blocked` when the failure prevents safe
posting. Do not retry or perform any other tracker mutation.

If the reviewer reports a mutation-only request with no refinement review to
perform, return `Mode: Deferred` and explain that the mutation belongs in a
separate approved workflow.

## Escalation

Ask the user one concise question when no source item is available, when posting
was requested but authorization or tooling is unclear, or when a human-gated
recommendation would materially change the comment.

If a gate is unavailable during an autonomous run, keep the safe reviewer-only
path: return a draft, ask a neutral question in the comment, and defer sensitive
recommendations.

## Example

<example>
Input: `Review https://github.com/acme/app/issues/42 for readiness and draft a refinement comment.`

Flow: normalize `ITEM_URL`, dispatch `refinement-reviewer` with
`WRITE_MODE=draft`, receive `REVIEW_STATUS=Needs refinement` and
`Comment mode=Draft`, then return the draft comment.
</example>
