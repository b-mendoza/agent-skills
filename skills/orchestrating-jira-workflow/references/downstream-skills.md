# Downstream Skill Dependencies

> Read this file only when entering a phase, validating runtime
> dependencies, or explaining how to install a missing workflow skill.
> The dependencies below are invoked by skill name through the host
> runtime and may be installed outside this package.

This orchestrator is standalone, but the end-to-end Jira workflow still
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
| 1 | `fetching-jira-ticket` | `JIRA_URL` | 12-line fetch summary, `TICKET_KEY`, written file path |
| 2 | `planning-jira-tasks` | `TICKET_KEY`; add `RE_PLAN=true` and accepted `DECISIONS` when re-planning | planning summary, final tasks file path, warnings |
| 3 | `clarifying-assumptions` | `TICKET_KEY=<TICKET_KEY>`, `MODE=upfront`, `ITERATION=<N>` | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT`, accepted decisions summary |
| 4 | `creating-jira-subtasks` | `JIRA_URL` | created/linked subtask rows, warnings, failed-create notes |
| 5 | `planning-jira-task` | `TICKET_KEY`, `TASK_NUMBER=<N>` | four planning artifact paths, approach summary, test coverage shape, refactoring verdict |
| 6 | `clarifying-assumptions` | `TICKET_KEY=<TICKET_KEY>`, `MODE=critique`, `TASK_NUMBER=<N>`, `ITERATION=<N>` | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT`, decisions file path |
| 7 | `executing-jira-task` | `TICKET_KEY`, `TASK_NUMBER=<N>` | `FINAL_TASK_REPORT` status, completion/blocker verdict, quality-gate summary, implementation artifact summary, retry counts, next required action |

## Preflight Contract

`preflight-checker` validates only direct dependencies for the remaining
phase range:

| Dependency | Required for phases | How to verify |
| ---------- | ------------------- | ------------- |
| Jira MCP | 1, 4 | Jira-related MCP tools are available and responsive |
| `fetching-jira-ticket` | 1 | Runtime skill discovery or invocation registry reports the skill is available |
| `planning-jira-tasks` | 2 | Runtime skill discovery or invocation registry reports the skill is available |
| `clarifying-assumptions` | 3, 6 | Runtime skill discovery or invocation registry reports the skill is available |
| `creating-jira-subtasks` | 4 | Runtime skill discovery or invocation registry reports the skill is available |
| `planning-jira-task` | 5 | Runtime skill discovery or invocation registry reports the skill is available |
| `executing-jira-task` | 7 | Runtime skill discovery or invocation registry reports the skill is available |

If the runtime exposes no reliable skill-discovery mechanism for a required
skill, return `PREFLIGHT: FAIL`, list the dependency under `Unknown`, and ask
the user to install, enable, or confirm the named skill before invoking it.

## Dispatch Example

<example>
Phase 6 dispatch maps the task workflow state into the generic
clarification skill contract:

```text
Skill: clarifying-assumptions
Inputs:
  TICKET_KEY: JNS-6065
  MODE: critique
  TASK_NUMBER: 2
  ITERATION: 1
Retain: RE_PLAN_NEEDED, BLOCKERS_PRESENT, decisions file path
```
</example>
