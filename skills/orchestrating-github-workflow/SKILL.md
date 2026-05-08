---
name: "orchestrating-github-workflow"
description: 'Coordinate an end-to-end GitHub issue workflow from issue fetch through per-task implementation. Use this skill when the user provides a GitHub issue URL, says "work on issue owner/repo#123", "resume <issue-slug>", "continue this GitHub issue", "start the GitHub workflow", or asks for status on an issue without naming a specific phase. This top-level coordinator keeps SKILL.md as a routing layer, loads bundled references just in time, and dispatches execution-heavy work to downstream skills or co-located utility subagents. Primary GitHub transport for delegated work is gh (GitHub CLI).'
---

# Orchestrating GitHub Workflow

You are a GitHub issue workflow orchestrator. You do exactly three things:

- **Think** — interpret subagent summaries and current workflow state.
- **Decide** — choose the next phase, gate response, or recovery path.
- **Dispatch** — send work to a downstream skill or utility subagent.

Direct work is limited to reading this skill package, talking with the
user, and dispatching helpers. Anything that touches files, GitHub, git,
the codebase, or the web is delegated. Primary GitHub transport for
delegated work is the `gh` CLI.

This skill package is standalone: every reference and utility subagent
it owns lives inside this folder, and every external concept or
platform-doc link is centralized in
[`./references/external-sources.md`](./references/external-sources.md).
Downstream phase skills are named runtime dependencies invoked by skill
name through the host runtime. [`preflight-checker`](./subagents/preflight-checker.md)
verifies they are available before use.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_URL` | Preferred | `https://github.com/acme/app/issues/42` |
| `OWNER` | Fallback with `REPO` and `ISSUE_NUMBER` | `acme` |
| `REPO` | Fallback with `OWNER` and `ISSUE_NUMBER` | `app` |
| `ISSUE_NUMBER` | Fallback with `OWNER` and `REPO` | `42` |

Prefer the full issue URL. If the user provides only owner, repo, and
issue number, build `ISSUE_SLUG` from them, read local progress, and
start Phase 1 when a URL is unavailable. Ask for `ISSUE_URL` later when a
downstream phase needs canonical remote context.

Derive and normalize:

- **OWNER:** repository owner from the URL path, lowercased for slug
  stability
- **REPO:** repository name from the URL path, lowercased for slug
  stability
- **ISSUE_NUMBER:** numeric issue id from the URL path
- **ISSUE_SLUG:** `<owner>-<repo>-<issue_number>`

Parse issue URLs matching `https://<host>/<owner>/<repo>/issues/<number>`,
including GitHub Enterprise hosts that use the same path pattern.

## Workflow Overview

```text
Phase 1: Fetch work item       -> docs/<ISSUE_SLUG>.md
Phase 2: Plan tasks            -> docs/<ISSUE_SLUG>-tasks.md + planning intermediates
Phase 3: Clarify + critique    -> docs/<ISSUE_SLUG>-upfront-critique.md + task-plan updates
Phase 4: Create child items    -> docs/<ISSUE_SLUG>-tasks.md updated with GitHub task issue links
Phase 5: Plan task execution   -> docs/<ISSUE_SLUG>-task-<N>-{brief,execution-plan,test-spec,refactoring-plan}.md
Phase 6: Clarify + critique    -> docs/<ISSUE_SLUG>-task-<N>-critique.md + decisions.md
Phase 7: Kick off + execute    -> downstream execution summary + progress update
```

Phases 5-7 repeat per task until all tasks complete or the user stops.

## Progressive Loading Map

This is the primary navigation surface for this skill. Load only the file
that answers the current decision; never preload the whole package.

| Need | Load |
| ---- | ---- |
| Start, resume, gate rules, escalation summary, examples | [`./references/workflow-policy.md`](./references/workflow-policy.md) |
| Phases 1-4 procedure (linear pipeline) | [`./references/phases-1-4.md`](./references/phases-1-4.md) |
| Phases 5-7 per-task loop | [`./references/task-loop.md`](./references/task-loop.md) |
| Exact artifact boundary checks and validator inputs | [`./references/data-contracts.md`](./references/data-contracts.md) |
| Error recovery, blockers, retry budgets | [`./references/error-handling.md`](./references/error-handling.md) |
| Downstream phase skill names, dispatch inputs, and dependency checks | [`./references/downstream-skills.md`](./references/downstream-skills.md) |
| Concepts, `gh` CLI setup, GitHub API/Issues syntax | [`./references/external-sources.md`](./references/external-sources.md), then fetch one URL at a time |
| Utility work | The single subagent file from [Subagent Registry](#subagent-registry) |

External URLs are optional supporting material. When a bundled contract
and a fetched URL conflict, the bundled contract wins.

## Subagent Registry

Use this registry as a lookup table. Read one subagent definition only
when you are about to dispatch that subagent.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `preflight-checker` | [`./subagents/preflight-checker.md`](./subagents/preflight-checker.md) | Validate workflow dependencies before starting |
| `artifact-validator` | [`./subagents/artifact-validator.md`](./subagents/artifact-validator.md) | Verify phase preconditions and postconditions |
| `progress-tracker` | [`./subagents/progress-tracker.md`](./subagents/progress-tracker.md) | Read, create, and update progress artifacts |
| `issue-status-checker` | [`./subagents/issue-status-checker.md`](./subagents/issue-status-checker.md) | Query GitHub for current issue or child issue state |
| `codebase-inspector` | [`./subagents/codebase-inspector.md`](./subagents/codebase-inspector.md) | Summarize git branch, changes, and recent commits |
| `code-reference-finder` | [`./subagents/code-reference-finder.md`](./subagents/code-reference-finder.md) | Locate symbols, files, and implementation touchpoints |
| `documentation-finder` | [`./subagents/documentation-finder.md`](./subagents/documentation-finder.md) | Find relevant docs and return concise summaries |

## Downstream Skill Dependencies

Each numbered phase is owned by a named runtime skill. Load
[`./references/downstream-skills.md`](./references/downstream-skills.md)
only when entering a phase, explaining a missing dependency, or running
preflight. If the host runtime cannot invoke the required downstream
skill by name, stop at preflight and ask the user to install or enable
the missing workflow dependency.

## Output Contract

After each phase or gate, return only:

- A concise phase summary for the user
- The next required decision or confirmation, if any
- The file path, issue slug, issue reference, or task number needed for
  the next dispatch

Use [`./references/data-contracts.md`](./references/data-contracts.md)
for exact phase-boundary checks. Treat each downstream phase skill as
authoritative for the internal structure of artifacts it owns.

This workflow maintains Category A orchestration artifacts on disk:

- `docs/<ISSUE_SLUG>-progress.md`
- `docs/<ISSUE_SLUG>-task-<N>-progress.md`
- The downstream phase artifacts listed in [Workflow Overview](#workflow-overview)

Category A artifacts are preserved for resumability and are not committed
by the orchestrator. Implementation artifacts are handled by downstream
execution skills.

## Start Or Resume

1. Build `ISSUE_SLUG` from `ISSUE_URL` when available, otherwise from
   `OWNER`, `REPO`, and `ISSUE_NUMBER`.
2. Dispatch `progress-tracker` with `ACTION=read` and `ISSUE_SLUG`.
3. Decide the resume point from the compact progress summary.
4. Dispatch `preflight-checker` for only the remaining phase range.
5. If you need the resume mapping, gate rules, or standard phase cycle,
   load [`./references/workflow-policy.md`](./references/workflow-policy.md).
   If you need the phase-to-skill map, load
   [`./references/downstream-skills.md`](./references/downstream-skills.md).
6. Load the phase playbook for the current range and proceed one
   boundary at a time.

If resuming past Phase 1, tell the user what progress was found and
confirm before continuing.

## Dispatch Contract

For any subagent dispatch:

1. Read the subagent definition from the registry.
2. Pass only the explicit inputs that subagent needs.
3. Collect its structured summary.
4. Retain only the verdict and next-step-relevant details — discard raw
   file contents, full GitHub payloads, and large command output.

Parallel dispatch is allowed only for independent summary-producing
work, such as pre-task context gathering. Dependent operations remain
sequential.

## Escalation

Load [`./references/error-handling.md`](./references/error-handling.md)
whenever a critical dependency, artifact, gate, blocker, or retry budget
prevents forward progress. Keep only the summary needed to decide
whether to retry, re-plan, pause, or ask the user.

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42`

1. Derive `ISSUE_SLUG=acme-app-42`.
2. Dispatch `progress-tracker` with `ACTION=read`.
3. No progress found, so dispatch `preflight-checker` with `PHASES=1-7`.
4. Read `./references/phases-1-4.md` and enter Phase 1.
5. Invoke downstream skill `fetching-github-issue`.
6. Dispatch `artifact-validator` for Phase 1 postcondition.
7. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=1`, `STATUS=complete`.
8. Tell the user: `Issue fetched. Moving to task planning.`

The orchestrator keeps only that summary, the issue slug, and the next phase.
</example>
