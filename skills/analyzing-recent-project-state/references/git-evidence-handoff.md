# Git Evidence Handoff Template

> Read this file only when `git-evidence-collector` is formatting its final result. Keep raw diffs and command output out of the returned handoff.

## Template

```text
GIT_EVIDENCE: PASS | NOT_GIT | PATH_ERROR | ERROR
Project path: <path>
Branch: <branch and upstream/ahead/behind if known>
Working tree: <clean or summary of staged/unstaged/untracked>
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
- <relevant package, lockfile, env, CI, Docker, tooling, or none>
Context limitations:
- <limitation or none>
Commands run:
- <command names only, not full output>
Reason: none | <why status is not PASS>
Decision needed: none | <smallest orchestrator action>
```

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
- Source: src/auth/middleware.ts, src/auth/session.ts
- Tests: tests/auth-refresh.test.ts
Diff stats:
- Working tree: 2 files changed, 48 insertions, 10 deletions
- Staged: none
- Base delta: 8 files changed, 210 insertions, 40 deletions
Preliminary themes:
- Auth token refresh flow changed across middleware and session handling.
Risk signals:
- Security boundary touched: token refresh behavior now accepts an additional cookie.
Test signals:
- New auth-refresh test exists; logout regression coverage unclear.
Dependency/config/tooling signals:
- none
Context limitations:
- Did not inspect full auth package beyond changed files.
Commands run:
- git status, git log, git diff, git show
Reason: none
Decision needed: none
```

## Status Rules

Use `PASS` when enough Git evidence exists for snapshot writing. Use `NOT_GIT` when the target is outside a Git worktree, `PATH_ERROR` when `PROJECT_PATH` is missing or inaccessible, and `ERROR` for unexpected command or filesystem failures.
