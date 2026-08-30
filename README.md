# agent-skills

`agent-skills` is a repository of reusable skills for coding agents. The repository itself is the main artifact: it contains the skills, their supporting subagents and references, and the docs used to keep the skill format portable across OpenCode and Claude Code.

## What is in this repository

- [`skills/`](skills/) contains 31 first-party skills. Each skill has its own `SKILL.md`, with `subagents/` and `references/` added where needed.
- [`prompts/`](prompts/) contains reusable prompt families. Each family is a kebab-case directory that keeps related executable prompts together with any contracts and supporting docs. See [`prompts/README.md`](prompts/README.md) for the catalog and addition rules.
- [`docs/`](docs/) contains workflow notes, design specs, and project-specific planning documents.
- [`docs/best-practices/`](docs/best-practices/) is the best starting point for skill-authoring guidance.
- [`.agents/skills/`](.agents/skills/) contains pinned skill packages for OpenCode discovery. Some come from this repository, and some come from other repositories.
- [`.claude/skills/`](.claude/skills/) exists as the Claude Code mirror location, but it is empty in the current checkout.
- [`skills-lock.json`](skills-lock.json) records the pinned skill set used for installed skill packages.
- [`opencode.jsonc`](opencode.jsonc) stores OpenCode configuration. It currently enables the Context7 MCP server.

## First-party skills

Most first-party skills belong to the shared work-item workflow or to standalone utilities. Every workflow phase is platform-agnostic: each skill detects Jira or GitHub from its input and loads the matching per-platform playbook just in time.

### Work-item workflow

Phases run in order. `<KEY>` is `TICKET_KEY` for Jira or `ISSUE_SLUG` for GitHub; the `TICKET_KEY` parameter name carries either value.

- [`orchestrating-workflow`](skills/orchestrating-workflow/SKILL.md) runs the full Jira or GitHub workflow through the active platform playbook.
- Phase 1 — [`fetching-work-item`](skills/fetching-work-item/SKILL.md) saves a Jira ticket or GitHub issue snapshot to `docs/<KEY>.md`.
- Phase 2 — [`planning-work-item-tasks`](skills/planning-work-item-tasks/SKILL.md) turns the snapshot into a task plan in `docs/<KEY>-tasks.md`.
- Phases 3 and 6 — [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) handles upfront plan questions and task-level critique.
- Phase 4 — [`creating-work-item-children`](skills/creating-work-item-children/SKILL.md) creates or reconciles Jira subtasks or GitHub child issues after approval.
- Phase 5 — [`planning-task-execution`](skills/planning-task-execution/SKILL.md) writes the brief, execution plan, test spec, and refactoring plan for one task.
- Phase 7 — [`executing-work-item-task`](skills/executing-work-item-task/SKILL.md) carries one planned task through implementation and review.

### Utility skills

- [`analyzing-recent-project-state`](skills/analyzing-recent-project-state/SKILL.md) summarizes recent repository changes, risks, validation gaps, and next steps.
- [`committing-scoped-changes`](skills/committing-scoped-changes/SKILL.md) creates reviewable commits from explicit file or folder paths.
- [`council-of-advisors`](skills/council-of-advisors/SKILL.md) runs a nine-seat decision council and writes a full decision handoff file with a compact recommendation summary.
- [`diagnosing-root-causes`](skills/diagnosing-root-causes/SKILL.md) identifies the root cause of runtime, CI/CD, and user-reported issues from provided resources and explains it with evidence-based, traceable, educational reporting.
- [`generate-flow-diagram`](skills/generate-flow-diagram/SKILL.md) creates, refines, repairs, or decomposes Markdown and Mermaid workflow diagrams with approval gates, staged writes, and Mermaid validation.
- [`generate-handoff-document`](skills/generate-handoff-document/SKILL.md) writes a handoff document for work that needs to be resumed later.
- [`improving-skill-definition`](skills/improving-skill-definition/SKILL.md) improves an existing skill package when inspection finds a material issue.
- [`improving-test-suites`](skills/improving-test-suites/SKILL.md) improves test files with focused, behavior-oriented test coverage.
- [`planning-codebase-restructuring`](skills/planning-codebase-restructuring/SKILL.md) analyzes repository architecture and produces an evidence-backed restructuring plan aligned with Domain-Driven Design and Screaming Architecture.
- [`pr-creator`](skills/pr-creator/SKILL.md) prepares and opens a pull request from the current branch.
- [`prompt-structurer`](skills/prompt-structurer/SKILL.md) turns prose prompts into structured XML prompts.
- [`recency-guard`](skills/recency-guard/SKILL.md) checks answers that depend on current external facts.
- [`refactoring-code`](skills/refactoring-code/SKILL.md) refactors existing code while preserving observable behavior.
- [`refine-task`](skills/refine-task/SKILL.md) reviews Jira tickets, Jira epics, GitHub issues, and GitHub parent issues for readiness.
- [`responding-to-pr-review-comments`](skills/responding-to-pr-review-comments/SKILL.md) assesses received PR review comments and drafts responses.
- [`review-pull-request`](skills/review-pull-request/SKILL.md) reviews one pull request through a confirmation-gated workflow.
- [`review-software-engineer-cv`](skills/review-software-engineer-cv/SKILL.md) reviews and tailors a software engineer CV against job postings.
- [`rewriting-code-strictly`](skills/rewriting-code-strictly/SKILL.md) rewrites Python, TypeScript, JavaScript, and Go code with stricter types and boundary handling.
- [`validate-implementation-plan`](skills/validate-implementation-plan/SKILL.md) audits implementation plans for requirements coverage, avoidable complexity, weak assumptions, and evidence gaps.
- [`workflow-skill-architect`](skills/workflow-skill-architect/SKILL.md) turns a repeatable process into a reusable skill package.

## Installed skill packages

These skill packages live under [`.agents/skills/`](.agents/skills/). The lockfile records their source and hash.

For first-party skill changes, pull requests should normally update the source package under [`skills/`](skills/) only. The vendored discovery copies under `.agents/skills/` and `.claude/skills/`, plus [`skills-lock.json`](skills-lock.json), are refreshed after the source PR merges by the managed [`skills` CLI](https://www.skills.sh/docs/cli) flow. Reviewers and agents should not request same-PR mirror or lockfile updates for ordinary first-party skill edits unless the PR explicitly claims to sync installed packages or already touches those managed artifacts.

| Skill | Source |
| --- | --- |
| [`code-review-excellence`](.agents/skills/code-review-excellence/SKILL.md) | `wshobson/agents` |
| [`committing-scoped-changes`](.agents/skills/committing-scoped-changes/SKILL.md) | `b-mendoza/agent-skills` |
| [`executing-plans`](.agents/skills/executing-plans/SKILL.md) | `obra/superpowers` |
| [`generate-flow-diagram`](.agents/skills/generate-flow-diagram/SKILL.md) | `b-mendoza/agent-skills` |
| [`pr-creator`](.agents/skills/pr-creator/SKILL.md) | `b-mendoza/agent-skills` |
| [`prompt-structurer`](.agents/skills/prompt-structurer/SKILL.md) | `b-mendoza/agent-skills` |
| [`receiving-code-review`](.agents/skills/receiving-code-review/SKILL.md) | `obra/superpowers` |
| [`recency-guard`](.agents/skills/recency-guard/SKILL.md) | `b-mendoza/agent-skills` |
| [`responding-to-pr-review-comments`](.agents/skills/responding-to-pr-review-comments/SKILL.md) | `b-mendoza/agent-skills` |
| [`review-pull-request`](.agents/skills/review-pull-request/SKILL.md) | `b-mendoza/agent-skills` |
| [`subagent-driven-development`](.agents/skills/subagent-driven-development/SKILL.md) | `obra/superpowers` |
| [`test-driven-development`](.agents/skills/test-driven-development/SKILL.md) | `obra/superpowers` |
| [`workflow-skill-architect`](.agents/skills/workflow-skill-architect/SKILL.md) | `b-mendoza/agent-skills` |
| [`writing-plans`](.agents/skills/writing-plans/SKILL.md) | `obra/superpowers` |

## Notes for editing

- Keep skills portable across OpenCode and Claude Code. Use simple frontmatter, plain Markdown links, and the [`runtime-portability-matrix`](docs/best-practices/runtime-portability-matrix.md) when changing tool, permission, or subagent behavior.
- Before editing a skill, subagent, or reference file, read the relevant guide in [`docs/best-practices/README.md`](docs/best-practices/README.md).
- There is no formal validator or CI pipeline for skill authoring yet. Run the manual checks listed in the project instructions.
- Do not hand-edit [`skills-lock.json`](skills-lock.json) or vendored installed packages under `.agents/skills/` or `.claude/skills/`. They are managed by the `skills` CLI flow after source changes are merged.
