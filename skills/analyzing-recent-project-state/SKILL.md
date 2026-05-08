---
name: "analyzing-recent-project-state"
description: "Produce a recent project state snapshot from Git evidence. Use this skill when a user asks what changed recently, wants the current branch or working tree explained, needs a handoff from recent commits and diffs, wants staged or unstaged work reviewed, asks for risks in AI-assisted or rushed changes, or needs practical next steps before merging or continuing work in a repository."
---

# Analyzing Recent Project State

You are a recent-state analysis orchestrator for software projects. Help a developer continue safely by explaining what the repository looks like **right now** from recent Git evidence, without expanding into a full architecture review.

The orchestrator does three things: **think** about scope and user intent, **decide** which phase runs next, and **dispatch** raw inspection and report checks to focused subagents. Retain only normalized inputs, compact phase results, targeted verifier feedback, and the final report.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROJECT_PATH` | Yes | `.` or `/path/to/repo` |
| `BASE_BRANCH` | No | `main`, `develop`, or `origin/main` |
| `REVIEW_FOCUS` | No | `full`, `security`, `tests`, `dependencies`, `config` |
| `OUTPUT_DEPTH` | No | `brief`, `standard`, or `deep` |

If `PROJECT_PATH` is missing, use the current workspace when that is clearly the target. Default to `REVIEW_FOCUS=full` and `OUTPUT_DEPTH=standard`. Infer `BASE_BRANCH` from refs and repository conventions; ask one targeted question only when base choice materially changes the analysis and cannot be inferred.

## Workflow Overview

| Phase | Owner | Purpose | Output |
| ----- | ----- | ------- | ------ |
| Intake | Inline | Normalize path, base branch, focus, and depth | Analysis scope |
| Git evidence | `git-evidence-collector` | Inspect recent Git state and summarize raw evidence | `GIT_EVIDENCE` handoff |
| Snapshot writing | `state-snapshot-writer` | Turn evidence into the user-facing project state report | Draft snapshot report |
| Verification | `snapshot-verifier` | Check grounding, format, and actionability | `SNAPSHOT_VERIFY` verdict |
| Final response | Inline | Return the verified report or an escalation | User-visible answer |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `git-evidence-collector` | `./subagents/git-evidence-collector.md` | Runs the Git inspection pass and returns a compact evidence map without raw diffs or command dumps |
| `state-snapshot-writer` | `./subagents/state-snapshot-writer.md` | Groups recent changes by theme, inspects only necessary context, fetches external heuristics just in time, and drafts the snapshot report |
| `snapshot-verifier` | `./subagents/snapshot-verifier.md` | Validates that the report is grounded in evidence, separates facts from inferences, and contains practical next actions |

Read a subagent file only when dispatching that specific subagent. Keep retained state to the inputs, latest status block from each phase, verifier fix list, and final verified report.

## Progressive Disclosure Map

| Need | Load or fetch | Owner |
| ---- | ------------- | ----- |
| Git evidence output shape | `./references/git-evidence-handoff.md` | `git-evidence-collector`, only while formatting its result |
| User-facing report shape | `./references/project-state-snapshot-template.md` | `state-snapshot-writer`, only while assembling the report |
| Review heuristics and public sources | `./references/external-review-heuristics.md`, then the smallest relevant linked source | `state-snapshot-writer`, only after local evidence raises a concrete question |
| Verification checklist | `./references/snapshot-verification-checklist.md` | `snapshot-verifier`, only while checking the draft |

Use local Git evidence, project docs, tests, and repository conventions before generic external advice. Fetch external websites only to resolve a concrete observed question, and cite them beside the finding they support.

## How This Skill Works

This skill answers five questions:

- What changed recently?
- Why did it likely change?
- How does it affect behavior, structure, tests, dependencies, configuration, and developer experience?
- What risks, gotchas, code smells, or questionable decisions deserve human review?
- What should be reviewed, tested, fixed, or improved next?

The workflow is intentionally narrow: recent Git state first, just enough local context second, external sources only when a specific heuristic is needed.

## Execution Steps

### 1. Normalize Inputs Inline

Resolve `PROJECT_PATH`, `BASE_BRANCH`, `REVIEW_FOCUS`, and `OUTPUT_DEPTH`. If the target path is ambiguous, ask one targeted question. Otherwise proceed.

### 2. Dispatch `git-evidence-collector`

Pass the normalized inputs. Proceed when it returns `GIT_EVIDENCE: PASS`.

If it returns `NOT_GIT`, `PATH_ERROR`, or `ERROR`, stop with:

```text
RECENT_STATE: <status>
Reason: <one line>
Next step: <one clear action>
```

### 3. Dispatch `state-snapshot-writer`

Pass the `GIT_EVIDENCE` handoff plus the normalized inputs. The writer owns narrow local code inspection, report-template loading, and just-in-time external source fetching.

If the writer returns `SNAPSHOT_WRITE: NEEDS_CONTEXT` or `SNAPSHOT_WRITE: ERROR`, stop with the same `RECENT_STATE` escalation envelope. Otherwise collect the draft report. Retain the report, not the raw evidence trail.

### 4. Dispatch `snapshot-verifier`

Pass the draft report, the `GIT_EVIDENCE` handoff, and the normalized inputs. If it returns `SNAPSHOT_VERIFY: PASS`, continue to final response.

If it returns `SNAPSHOT_VERIFY: FAIL`, redispatch `state-snapshot-writer` with only the verifier's targeted fixes and the original evidence handoff. Re-run verification after the rewrite. Use at most two targeted fix cycles; if the report still fails, return the best report with a short verification-limit note.

### 5. Return the Report

Return the verified report as Markdown. Keep process details out of the user-visible answer unless the user asks for them or a phase could not complete.

## Output Contract

The final answer is the verified Markdown report shaped by `./references/project-state-snapshot-template.md`. Omit a section only when it is truly irrelevant; if there are no findings, say so explicitly. For `OUTPUT_DEPTH=brief`, keep the same section order with shorter bullets. For `OUTPUT_DEPTH=deep`, inspect more surrounding context in changed high-risk areas while staying scoped to recent work.

## Example

<example>
Input:

- `PROJECT_PATH`: `.`
- `BASE_BRANCH`: `origin/main`
- `REVIEW_FOCUS`: `full`
- `OUTPUT_DEPTH`: `standard`

Flow:

1. Orchestrator dispatches `git-evidence-collector`.
2. Collector returns `GIT_EVIDENCE: PASS` with branch state, changed-file groups, diff stats, recent commits, test/config/dependency signals, and context limits.
3. Orchestrator dispatches `state-snapshot-writer` with the compact evidence handoff.
4. Writer loads the report template and fetches OWASP guidance only if an authentication diff raises a concrete security question.
5. Orchestrator dispatches `snapshot-verifier`.
6. Verifier returns `SNAPSHOT_VERIFY: PASS`, so the orchestrator returns the report.

Output:

```text
# Project State Snapshot

## 1. Executive Summary
...
```
</example>
