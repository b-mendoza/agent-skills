# agent-skills

`agent-skills` is a repository of reusable skills for coding agents. The
repository itself is the main artifact: it contains the skills, their supporting
subagents and references, and the docs used to keep the skill format portable
across OpenCode and Claude Code.

## What is in this repository

- [`skills/`](skills/) contains 31 first-party skills. Each skill has its own
  `SKILL.md`, with `subagents/` and `references/` added where needed.
- [`docs/`](docs/) contains workflow notes, design specs, and project-specific
  planning documents.
- [`docs/best-practices/`](docs/best-practices/) is the best starting point for
  skill-authoring guidance.
- [`.agents/skills/`](.agents/skills/) contains 17 pinned skill packages for
  OpenCode discovery. Some come from this repository, and some come from other
  repositories.
- [`.claude/skills/`](.claude/skills/) exists as the Claude Code mirror
  location, but it is empty in the current checkout.
- [`skills-lock.json`](skills-lock.json) records the pinned skill set used for
  installed skill packages.
- [`opencode.jsonc`](opencode.jsonc) stores OpenCode configuration. It currently
  enables the Context7 MCP server.

## First-party skills

Most first-party skills belong to either the Jira workflow or the GitHub
workflow. The remaining skills are standalone utilities.

### Jira workflow

- [`orchestrating-jira-workflow`](skills/orchestrating-jira-workflow/SKILL.md)
  runs the full Jira ticket workflow.
- [`fetching-jira-ticket`](skills/fetching-jira-ticket/SKILL.md) saves a ticket
  snapshot to `docs/<TICKET_KEY>.md`.
- [`planning-jira-tasks`](skills/planning-jira-tasks/SKILL.md) turns the ticket
  snapshot into a task plan in `docs/<TICKET_KEY>-tasks.md`.
- [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) handles
  upfront plan questions and task-level critique.
- [`creating-jira-subtasks`](skills/creating-jira-subtasks/SKILL.md) creates or
  updates Jira subtasks after approval.
- [`planning-jira-task`](skills/planning-jira-task/SKILL.md) writes planning
  files for one Jira task.
- [`executing-jira-task`](skills/executing-jira-task/SKILL.md) carries one
  planned Jira task through implementation and review.

### GitHub workflow

- [`orchestrating-github-workflow`](skills/orchestrating-github-workflow/SKILL.md)
  runs the full GitHub issue workflow.
- [`fetching-github-issue`](skills/fetching-github-issue/SKILL.md) saves an
  issue snapshot to `docs/<ISSUE_SLUG>.md`.
- [`planning-github-issue-tasks`](skills/planning-github-issue-tasks/SKILL.md)
  turns the issue snapshot into a task plan in `docs/<ISSUE_SLUG>-tasks.md`.
- [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) is reused
  for the same plan review and task critique steps.
- [`creating-github-child-issues`](skills/creating-github-child-issues/SKILL.md)
  creates or updates child issues after approval.
- [`planning-github-task`](skills/planning-github-task/SKILL.md) writes planning
  files for one GitHub task.
- [`executing-github-task`](skills/executing-github-task/SKILL.md) carries one
  planned GitHub task through implementation and review.

### Utility skills

- [`analyzing-recent-project-state`](skills/analyzing-recent-project-state/SKILL.md)
  summarizes recent repository changes, risks, validation gaps, and next steps.
- [`committing-scoped-changes`](skills/committing-scoped-changes/SKILL.md)
  creates reviewable commits from explicit file or folder paths.
- [`generate-flow-diagram`](skills/generate-flow-diagram/SKILL.md) creates or
  refines Markdown and Mermaid workflow diagrams.
- [`generate-handoff-document`](skills/generate-handoff-document/SKILL.md)
  writes a handoff document for work that needs to be resumed later.
- [`improve-skill-definition`](skills/improve-skill-definition/SKILL.md)
  improves an existing skill package when inspection finds a material issue.
- [`improving-test-suites`](skills/improving-test-suites/SKILL.md) improves test
  files with focused, behavior-oriented test coverage.
- [`planning-codebase-restructuring`](skills/planning-codebase-restructuring/SKILL.md)
  analyzes repository architecture and produces an evidence-backed
  restructuring plan aligned with Domain-Driven Design and Screaming
  Architecture.
- [`pr-creator`](skills/pr-creator/SKILL.md) prepares and opens a pull request
  from the current branch.
- [`prompt-structurer`](skills/prompt-structurer/SKILL.md) turns prose prompts
  into structured XML prompts.
- [`recency-guard`](skills/recency-guard/SKILL.md) checks answers that depend on
  current external facts.
- [`refactoring-code`](skills/refactoring-code/SKILL.md) refactors existing code
  while preserving observable behavior.
- [`refine-task`](skills/refine-task/SKILL.md) reviews Jira tickets, Jira epics,
  GitHub issues, and GitHub parent issues for readiness.
- [`responding-to-pr-review-comments`](skills/responding-to-pr-review-comments/SKILL.md)
  assesses received PR review comments and drafts responses.
- [`review-pull-request`](skills/review-pull-request/SKILL.md) reviews one pull
  request through a confirmation-gated workflow.
- [`review-software-engineer-cv`](skills/review-software-engineer-cv/SKILL.md)
  reviews and tailors a software engineer CV against job postings.
- [`rewriting-code-strictly`](skills/rewriting-code-strictly/SKILL.md) rewrites
  Python, TypeScript, JavaScript, and Go code with stricter types and boundary
  handling.
- [`validate-implementation-plan`](skills/validate-implementation-plan/SKILL.md)
  audits implementation plans for requirements coverage, avoidable complexity,
  weak assumptions, and evidence gaps.
- [`workflow-skill-architect`](skills/workflow-skill-architect/SKILL.md) turns a
  repeatable process into a reusable skill package.

## Installed skill packages

The repository currently has 17 pinned skill packages under
[`.agents/skills/`](.agents/skills/). The lockfile records their source and hash.

For first-party skill changes, pull requests should normally update the source
package under [`skills/`](skills/) only. The vendored discovery copies under
`.agents/skills/` and `.claude/skills/`, plus [`skills-lock.json`](skills-lock.json),
are refreshed after the source PR merges by the managed
[`skills` CLI](https://www.skills.sh/docs/cli) flow. Reviewers and agents should
not request same-PR mirror or lockfile updates for ordinary first-party skill
edits unless the PR explicitly claims to sync installed packages or already
touches those managed artifacts.

| Skill | Source |
| ----- | ------ |
| [`code-review-excellence`](.agents/skills/code-review-excellence/SKILL.md) | `wshobson/agents` |
| [`committing-scoped-changes`](.agents/skills/committing-scoped-changes/SKILL.md) | `b-mendoza/agent-skills` |
| [`executing-plans`](.agents/skills/executing-plans/SKILL.md) | `obra/superpowers` |
| [`generate-flow-diagram`](.agents/skills/generate-flow-diagram/SKILL.md) | `b-mendoza/agent-skills` |
| [`generate-handoff-document`](.agents/skills/generate-handoff-document/SKILL.md) | `b-mendoza/agent-skills` |
| [`grill-me`](.agents/skills/grill-me/SKILL.md) | `mattpocock/skills` |
| [`humanizer`](.agents/skills/humanizer/SKILL.md) | `blader/humanizer` |
| [`improve-skill-definition`](.agents/skills/improve-skill-definition/SKILL.md) | `b-mendoza/agent-skills` |
| [`pr-creator`](.agents/skills/pr-creator/SKILL.md) | `b-mendoza/agent-skills` |
| [`prompt-structurer`](.agents/skills/prompt-structurer/SKILL.md) | `b-mendoza/agent-skills` |
| [`receiving-code-review`](.agents/skills/receiving-code-review/SKILL.md) | `obra/superpowers` |
| [`recency-guard`](.agents/skills/recency-guard/SKILL.md) | `b-mendoza/agent-skills` |
| [`responding-to-pr-review-comments`](.agents/skills/responding-to-pr-review-comments/SKILL.md) | `b-mendoza/agent-skills` |
| [`review-pull-request`](.agents/skills/review-pull-request/SKILL.md) | `b-mendoza/agent-skills` |
| [`subagent-driven-development`](.agents/skills/subagent-driven-development/SKILL.md) | `obra/superpowers` |
| [`test-driven-development`](.agents/skills/test-driven-development/SKILL.md) | `obra/superpowers` |
| [`writing-plans`](.agents/skills/writing-plans/SKILL.md) | `obra/superpowers` |

## Notes for editing

- Keep skills portable across OpenCode and Claude Code. Use simple frontmatter
  and plain Markdown links.
- Before editing a skill, subagent, or reference file, read the relevant guide in
  [`docs/best-practices/README.md`](docs/best-practices/README.md).
- There is no formal validator or CI pipeline for skill authoring yet. Run the
  manual checks listed in the project instructions.
- Do not hand-edit [`skills-lock.json`](skills-lock.json) or vendored installed
  packages under `.agents/skills/` or `.claude/skills/`. They are managed by the
  `skills` CLI flow after source changes are merged.
