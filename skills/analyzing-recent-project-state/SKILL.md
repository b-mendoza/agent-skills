---
name: "analyzing-recent-project-state"
description: "Produce a recent project state snapshot from Git evidence. Use this skill when a user asks what changed recently, wants the current branch or working tree explained, needs a handoff from recent commits and diffs, wants staged or unstaged work reviewed, asks for risks in AI-assisted or rushed changes, or needs practical next steps before merging or continuing work in a repository."
---

# Analyzing Recent Project State

You are a recent-state analysis skill for software projects. Your job is to explain what the project looks like **right now** from recent Git evidence, not to perform a full architecture review.

Treat Git history, diffs, project docs, tests, and local conventions as the source of truth. Use external references only as just-in-time review heuristics when they help judge a specific observed change.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PROJECT_PATH` | Yes | `.` or `/path/to/repo` |
| `BASE_BRANCH` | No | `main`, `develop`, or `origin/main` |
| `REVIEW_FOCUS` | No | `security`, `tests`, `dependencies`, `full` |
| `OUTPUT_DEPTH` | No | `brief`, `standard`, or `deep` |

If `PROJECT_PATH` is missing, use the current workspace when that is clearly the target. Infer `BASE_BRANCH` from refs and repository conventions; ask only if the base branch materially changes the analysis and cannot be inferred.

## Workflow Overview

| Phase | Purpose | Output |
| ----- | ------- | ------ |
| Intake | Normalize path, base branch, focus, and depth | Analysis scope |
| Git snapshot | Inspect branch, working tree, recent commits, and diffs | Evidence map |
| Theme analysis | Group recent changes by purpose and impact | Change themes |
| Targeted reference lookup | Fetch outside guidance only when a finding needs it | Brief cited heuristic |
| Report | Explain current state, risks, validation, and next actions | Project state snapshot |

## How This Skill Works

This skill helps a developer continue safely after recent work. It answers five questions:

- What changed recently?
- Why did it likely change?
- How does it affect behavior, structure, tests, dependencies, configuration, and developer experience?
- What risks, gotchas, code smells, or questionable decisions deserve human review?
- What should be reviewed, tested, fixed, or improved next?

Keep the scope tied to recent Git evidence. Inspect broader code only when recent changes require context, then state what you checked and what you skipped.

## Reference Routing

Fetch external references only when they help evaluate a concrete observed change. Cite them briefly in the relevant section. If web access is unavailable, continue from local evidence and name the reference that would have helped.

| Reference | Use When |
| --------- | -------- |
| [git-status](https://git-scm.com/docs/git-status), [git-diff](https://git-scm.com/docs/git-diff), [git-log](https://git-scm.com/docs/git-log), [git-show](https://git-scm.com/docs/git-show), [gitrevisions](https://git-scm.com/docs/gitrevisions) | Git ranges, staged vs. unstaged state, merge bases, renames, mode changes, or command semantics need clarification |
| [Google Engineering Practices: What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | Design, functionality, complexity, tests, naming, comments, docs, consistency, or context depth need judgment |
| [Martin Fowler: Code Smell](https://martinfowler.com/bliki/CodeSmell.html) and [Refactoring.Guru: Code Smells](https://refactoring.guru/refactoring/smells) | Maintainability concerns such as duplication, speculative generality, shotgun surgery, oversized units, weak boundaries, or excessive coupling appear |
| [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html) and [Google Testing Blog: Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) | Tests look missing, brittle, too high-level, implementation-focused, or misaligned with changed behavior |
| [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/) and [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Changes touch authentication, authorization, validation, secrets, serialization, dependency trust, user data, or security boundaries |
| [The Twelve-Factor App: Config](https://12factor.net/config) | Environment variables, checked-in config, secrets, deployment-specific values, or local vs. production configuration changed |
| [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | Dependency bumps, public API compatibility, commit intent, release risk, or breaking-change signals need interpretation |

## Execution Steps

### 1. Establish Scope

Identify the target repository or directory, current branch, requested focus, and output depth. Prefer project-specific documentation and conventions over generic external guidance.

### 2. Run the Required Git Pass

Run or adapt these commands from `PROJECT_PATH`:

```bash
git status --short --branch
git log --oneline --decorate --graph -n 20
git diff --stat
git diff
git diff --cached --stat
git diff --cached
git show --stat --summary HEAD
```

When relevant, also inspect recent changed files and base-branch deltas:

```bash
git log --name-status -n 10
git diff <base-branch>...HEAD
git diff origin/<base-branch>...HEAD
```

### 3. Build the Evidence Map

Capture branch state, staged changes, unstaged changes, untracked files, recent commits reviewed, base comparison, and signs of generated files, lockfile changes, conflicts, rebases, migrations, schema changes, API changes, CI/CD changes, or unrelated diffs.

### 4. Analyze by Theme

Group changes by theme rather than by file. For each theme, explain files involved, evidence, confirmed changes, likely intent, affected behavior or structure, developer context, risk level, and the next review step.

Use careful language when inferring intent. Separate facts from inferences and name the evidence that would confirm or disprove uncertain claims.

### 5. Review Risk and Validation

Flag risks as `High`, `Medium`, or `Low` with confidence, evidence, why it matters, and a recommended action. Treat security issues, data loss, broken builds, production failures, broken API contracts, and serious maintainability regressions as high-risk when evidence supports that severity.

Review tests, dependencies, configuration, tooling, and security only when changed or clearly implicated. Recommend validation commands only when project scripts or conventions make them apparent.

### 6. Validate the Report

Before returning, check that the report:

- Explains reasoning instead of listing files mechanically
- Distinguishes confirmed behavior changes from likely or possible changes
- Includes concrete next actions for the highest-risk items
- Notes skipped context when the repository is too large for complete inspection
- Keeps external references tied to specific findings rather than preloaded background

## Output Contract

Return a Markdown report with these sections. Omit irrelevant sections only when truly irrelevant; if there are no findings, say so.

1. **Executive Summary:** branch/tree state, main themes, overall risk, most important context.
2. **Git State:** branch, staged/unstaged/untracked changes, commits reviewed, base comparison.
3. **Recent Change Themes:** one subsection per theme with changed/why/context/risk/next review.
4. **Behavioral Impact:** confirmed, likely, and possible behavior changes needing verification.
5. **Risks, Gotchas, and Smells:** severity, area, finding, evidence, impact, confidence, action.
6. **Test and Validation Review:** test changes, missing coverage, brittle tests, commands to run.
7. **Dependency, Config, Tooling, and Security Notes:** only areas touched or implicated.
8. **Questions Before Merging or Continuing.**
9. **Recommended Next Actions:** must do, should do soon, nice to have.
10. **Final Developer Briefing:** plain-English handoff for continuing safely.

## Example

<example>
Input:

- `PROJECT_PATH`: `.`
- `BASE_BRANCH`: `origin/main`
- `REVIEW_FOCUS`: `full`

Flow:

1. Inspect Git status, recent commits, unstaged and staged diffs, and the base-branch delta.
2. Group changes into themes such as authentication refactor, test updates, dependency bump, and config changes.
3. Fetch OWASP guidance only if the authentication diff raises a concrete security question.
4. Return a report that identifies likely intent, behavior impact, risks, missing validation, and next actions.

Output:

```text
# Project State Snapshot

## 1. Executive Summary
...
```
</example>
