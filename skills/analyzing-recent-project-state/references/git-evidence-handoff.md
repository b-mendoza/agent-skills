# Git Evidence Handoff

The collector returns one compact `GIT_EVIDENCE` block. Raw command output,
raw diffs, secrets, and large file bodies stay out of the handoff.

## Status Rules

| Status | Meaning |
| ------ | ------- |
| `GIT_EVIDENCE: PASS` | Evidence was collected or a quiet/abnormal repo state was summarized as fact |
| `GIT_EVIDENCE: NOT_GIT` | Path exists but is not a Git worktree |
| `GIT_EVIDENCE: PATH_ERROR` | Path missing or unreadable |
| `GIT_EVIDENCE: NEEDS_CONTEXT` | Exactly one user decision is required |
| `GIT_EVIDENCE: ERROR` | Unexpected Git or local inspection failure |

Repo states `unborn-branch`, `detached-HEAD`, `operation-in-progress(<op>)`,
`shallow`, and `conflicted` are `PASS`-compatible unless a command failure
prevents a truthful handoff.

## Handoff Fields

```markdown
GIT_EVIDENCE: <PASS | NOT_GIT | PATH_ERROR | NEEDS_CONTEXT | ERROR>
Project path: <path>
Branch/upstream: <current branch, detached HEAD, unborn branch, upstream>
Repo state: <normal | unborn-branch | detached-HEAD | operation-in-progress(op) | shallow | conflicted>
Evidence window: <working tree + BASE..HEAD, or working tree + last 15 first-parent commits; commit counts; truncations>
Working tree: <clean, or staged/unstaged/untracked counts and groups>
Base branch: <resolved ref or none; reason>
Base comparison: <ahead/behind/diverged/unavailable summary>
Recent commits reviewed: <up to 10 title hashes, plus +N more>
Changed-file groups: <area groups with representative paths or counts>
Diff stats: <compact files changed/insertions/deletions/renames/mode changes>
Preliminary themes: <evidence-only themes; no final severity>
Risk signals: <specific signal plus evidence pointer; no speculation>
Test signals: <test files, CI changes, coverage signals, removed tests>
Dependency/config/tooling signals: <manifests, lockfiles, env, build, CI>
Context limitations: <truncation, shallow clone, no base, unreadable file, none>
Commands run: <full sanitized command lines, no raw output>
Reason: <one line>
Decision needed: <one user decision or none>
```

## Evidence Window

Recent means working tree state plus commits in `BASE..HEAD` when a base
resolves; otherwise the last 15 first-parent commits of `HEAD`. Hard cap: 30
commits. List at most 10 commits and state any remainder count.

## Quiet-State Example

```markdown
GIT_EVIDENCE: PASS
Project path: /repo/app
Branch/upstream: main -> origin/main
Repo state: normal
Evidence window: working tree + origin/main..HEAD; 0 commits; no truncation
Working tree: clean; staged 0, unstaged 0, untracked 0
Base branch: origin/main; resolved from upstream
Base comparison: no ahead/behind delta in reviewed window
Recent commits reviewed: none
Changed-file groups: none
Diff stats: 0 files changed
Preliminary themes: quiet state; no recent changes in window
Risk signals: none from local evidence
Test signals: no test changes in window
Dependency/config/tooling signals: no changes in window
Context limitations: none
Commands run: git status --short --branch; git log --oneline --first-parent -n 15 origin/main..HEAD; git diff --stat origin/main...HEAD
Reason: clean tree and empty evidence window
Decision needed: none
```
