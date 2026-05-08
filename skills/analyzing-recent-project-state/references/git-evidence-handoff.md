# Git Evidence Handoff Template

> Load this file only when `git-evidence-collector` formats its final result.
> Return summaries and command names, not raw diffs or full command output.

## Template

```text
GIT_EVIDENCE: PASS | NOT_GIT | PATH_ERROR | ERROR
Project path: <path>
Branch: <branch and upstream/ahead/behind if known>
Working tree: <clean or staged/unstaged/untracked summary>
Base branch: <resolved base, not found, or not needed>
Base comparison: <summary or not run with reason>
Recent commits reviewed:
- <sha/title and relevance>
Changed-file groups:
- <area>: <paths or counts>
Diff stats:
- Working tree: <summary>
- Staged: <summary>
- Base delta: <summary>
Preliminary themes:
- <theme and supporting paths>
Risk signals:
- <signal, evidence, why it may matter>
Test signals:
- <tests added/changed/removed/missing signals>
Dependency/config/tooling signals:
- <package, lockfile, env, CI, Docker, tooling, or none>
Context limitations:
- <limitation or none>
Commands run:
- <command names only>
Reason: none | <why status is not PASS>
Decision needed: none | <smallest orchestrator action>
```

## Status Rules

| Status | Use when |
| ------ | -------- |
| `PASS` | Enough Git evidence exists for snapshot writing. |
| `NOT_GIT` | The target is outside a Git worktree. |
| `PATH_ERROR` | `PROJECT_PATH` is missing or inaccessible. |
| `ERROR` | An unexpected command or filesystem failure occurred. |

## Example

```text
GIT_EVIDENCE: PASS
Project path: /repo/app
Branch: feature/auth-refresh, ahead 3 of origin/main
Working tree: 2 unstaged files, 1 untracked test file
Base branch: origin/main
Base comparison: 8 files changed, mostly auth middleware and tests
Recent commits reviewed:
- a1b2c3d Add token refresh middleware
Changed-file groups:
- Source: 2 auth files
- Tests: 1 auth test
Risk signals:
- Security boundary touched: refresh-token behavior changed.
Context limitations:
- Full auth package not inspected.
Commands run:
- git status, git log, git diff, git show
Reason: none
Decision needed: none
```
