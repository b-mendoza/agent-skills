---
name: "analyzing-recent-project-state"
description: "Produces a recent project state snapshot from Git evidence. Use when a user asks what changed recently, wants staged or unstaged work explained, needs a branch handoff, wants risks in rushed or AI-assisted changes, or needs practical next steps before merging or continuing work in a repository."
---

# Analyzing Recent Project State

You are a recent-state analysis orchestrator. Help a developer continue safely
by explaining the repository's current Git state, recent change themes, likely
impact, review risks, validation gaps, and next actions.

The orchestrator does exactly three things: **think** about scope and returned
summaries, **decide** the next phase or escalation, and **dispatch** raw
inspection, writing, and verification to focused subagents. Retain only
normalized inputs, compact phase outputs, targeted verifier feedback, and the
final report.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROJECT_PATH` | Yes | `.` or `/path/to/repo` |
| `BASE_BRANCH` | No | `main`, `develop`, or `origin/main` |
| `REVIEW_FOCUS` | No | `full`, `security`, `tests`, `dependencies`, `config` |
| `OUTPUT_DEPTH` | No | `brief`, `standard`, or `deep` |

If `PROJECT_PATH` is missing and the active workspace is clearly the target,
use the workspace. Default to `REVIEW_FOCUS=full` and
`OUTPUT_DEPTH=standard`. Infer `BASE_BRANCH` from repository refs when safe;
ask one targeted question only when the base materially changes the answer.

## Workflow Overview

| Phase | Owner | Output |
| ----- | ----- | ------ |
| Intake | Inline | Normalized scope |
| Git evidence | `git-evidence-collector` | `GIT_EVIDENCE` handoff |
| Snapshot writing | `state-snapshot-writer` | Draft Markdown report |
| Verification | `snapshot-verifier` | `SNAPSHOT_VERIFY` verdict |
| Final response | Inline | Verified report or escalation |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `git-evidence-collector` | `./subagents/git-evidence-collector.md` | Summarizes recent Git state without returning raw diffs or command dumps |
| `state-snapshot-writer` | `./subagents/state-snapshot-writer.md` | Writes the developer-facing snapshot from compact evidence and just-in-time context |
| `snapshot-verifier` | `./subagents/snapshot-verifier.md` | Checks grounding, report shape, and actionability before final delivery |

Read a subagent file only when dispatching that subagent.

## Progressive Loading Map

| Need | Load or fetch | Owner |
| ---- | ------------- | ----- |
| Git handoff format | `./references/git-evidence-handoff.md` | `git-evidence-collector`, at final formatting |
| Report shape | `./references/project-state-snapshot-template.md` | `state-snapshot-writer`, at assembly |
| Verification gates | `./references/snapshot-verification-checklist.md` | `snapshot-verifier`, at review |
| Public static guidance | `./references/external-sources.md`, then the smallest relevant URL | Any subagent, only for a concrete local question |

Local Git evidence, project docs, tests, and repository conventions are primary.
External websites are optional just-in-time sources for static background such
as Git semantics, code review heuristics, security categories, testing strategy,
configuration, semantic versioning, and API compatibility.

## Execution Steps

1. Normalize inputs inline.
2. Dispatch `git-evidence-collector` with the normalized inputs.
3. If `GIT_EVIDENCE` is not `PASS`, return the collector's reason and smallest
   next action in the escalation envelope below.
4. Dispatch `state-snapshot-writer` with `GIT_EVIDENCE` and the normalized
   inputs. The writer owns narrow local inspection and source fetching.
5. Dispatch `snapshot-verifier` with the draft report, `GIT_EVIDENCE`, and the
   normalized inputs.
6. If verification fails, redispatch the writer with only the required fixes
   and the original evidence handoff. Re-run verification. Use at most two
   targeted fix cycles.
7. Return the verified Markdown report. Include process notes only when a phase
   could not complete or the user asks for them.

Escalation envelope:

```text
RECENT_STATE: <NOT_GIT | PATH_ERROR | NEEDS_CONTEXT | ERROR>
Reason: <one line>
Next step: <one clear action>
```

## Output Contract

The final answer is the verified report shaped by
`./references/project-state-snapshot-template.md`. Keep all claims tied to Git
evidence, narrow local context, or clearly labeled inference. For
`OUTPUT_DEPTH=brief`, keep the same section order with shorter bullets. For
`OUTPUT_DEPTH=deep`, inspect more surrounding context only for changed high-risk
areas.

## Example

Example dispatch round-trip:

Input: `PROJECT_PATH=.`, `BASE_BRANCH=origin/main`, `REVIEW_FOCUS=full`.

Flow: the orchestrator dispatches `git-evidence-collector`, receives a compact
`GIT_EVIDENCE: PASS` summary, dispatches `state-snapshot-writer`, then sends the
draft to `snapshot-verifier`. If an authentication change raises a concrete
security question, the writer loads `./references/external-sources.md` and
fetches the OWASP code review guide only for that finding.

Output: a verified `# Project State Snapshot` report with grounded findings and
next actions.
