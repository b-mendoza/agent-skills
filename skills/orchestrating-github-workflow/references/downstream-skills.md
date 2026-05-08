# Downstream Skill Dependencies

> Read this file only when entering a phase, validating runtime
> dependencies, or explaining how to install a missing workflow skill.
> The dependencies below are invoked by skill name through the host
> runtime and may be installed outside this package.

This orchestrator is standalone, but the end-to-end GitHub workflow still
depends on separate phase skills. A downloaded copy of this package should
work whenever those named skills are installed and invokable by the host
runtime. If they are unavailable, stop at preflight and ask the user to
install or enable the missing skill dependency.

For current runtime installation or skill-discovery instructions, load
`./external-sources.md` and fetch one URL from the runtime skill docs
section.

## Phase Skill Map

| Phase | Runtime skill | Required inputs | Retain from output |
| ----- | ------------- | --------------- | ------------------ |
| 1 | `fetching-github-issue` | `ISSUE_URL`, or `OWNER` + `REPO` + `ISSUE_NUMBER` | 12-line fetch summary, `ISSUE_SLUG`, written file path |
| 2 | `planning-github-issue-tasks` | `ISSUE_SLUG`; add `RE_PLAN=true` and accepted `DECISIONS` when re-planning | planning summary, final tasks file path, warnings |
| 3 | `clarifying-assumptions` | `TICKET_KEY=<ISSUE_SLUG>`, `MODE=upfront`, `ITERATION=<N>` | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT`, accepted decisions summary |
| 4 | `creating-github-child-issues` | `ISSUE_URL`, or owner/repo/issue context | write model, capability, created/linked task issue rows, warnings |
| 5 | `planning-github-task` | `ISSUE_SLUG`, `TASK_NUMBER=<N>` | four planning artifact paths, approach summary, test coverage shape |
| 6 | `clarifying-assumptions` | `TICKET_KEY=<ISSUE_SLUG>`, `MODE=critique`, `TASK_NUMBER=<N>`, `ITERATION=<N>` | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT`, decisions file path |
| 7 | `executing-github-task` | `ISSUE_SLUG`, `TASK_NUMBER=<N>`, owner/repo context as accepted by the skill | completion/blocker verdict, quality-gate summary, implementation artifact summary |

## Preflight Contract

`preflight-checker` validates only direct dependencies for the remaining
phase range:

| Dependency | Required for phases | How to verify |
| ---------- | ------------------- | ------------- |
| GitHub CLI (`gh`) | 1, 4, 7 | `gh --version`; for GitHub reads/writes, also `gh auth status` |
| `fetching-github-issue` | 1 | Runtime skill discovery or invocation registry reports the skill is available |
| `planning-github-issue-tasks` | 2 | Runtime skill discovery or invocation registry reports the skill is available |
| `clarifying-assumptions` | 3, 6 | Runtime skill discovery or invocation registry reports the skill is available |
| `creating-github-child-issues` | 4 | Runtime skill discovery or invocation registry reports the skill is available |
| `planning-github-task` | 5 | Runtime skill discovery or invocation registry reports the skill is available |
| `executing-github-task` | 7 | Runtime skill discovery or invocation registry reports the skill is available |

If the runtime exposes no reliable skill-discovery mechanism for a required
skill, return `PREFLIGHT: FAIL`, list the dependency under `Unknown`, and ask
the user to install, enable, or confirm the named skill before invoking it.

## Dispatch Example

<example>
Phase 3 dispatch maps the GitHub workflow key into the generic
clarification skill contract:

```text
Skill: clarifying-assumptions
Inputs:
  TICKET_KEY: acme-app-42
  MODE: upfront
  ITERATION: 1
Retain: RE_PLAN_NEEDED, BLOCKERS_PRESENT, accepted decisions summary
```
</example>
