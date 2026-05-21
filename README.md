# agent-skills

`agent-skills` is a repository of skills for coding agents. This repository is
the product. It holds the skills we write here, a small set of third party
skills we keep in the repository, and the docs we use to keep OpenCode and
Claude Code aligned.

## What is in this repository

- [`skills/`](skills/) has 28 first party skills.
- [`docs/`](docs/) has workflow notes, design specs, and writing guidance.
- [`docs/best-practices/`](docs/best-practices/) is the best place to start if
  you want to edit a skill.
- [`.agents/skills/`](.agents/skills/) has 10 third party skills for OpenCode.
- [`.claude/skills/`](.claude/skills/) mirrors the same 10 skills for Claude
  Code.
- [`skills-lock.json`](skills-lock.json) records the third party skill set.
- [`opencode.jsonc`](opencode.jsonc) stores OpenCode config.

## First party skills

Most of the first party skills fall into two workflow groups, one for Jira and
one for GitHub. The rest are utility skills you can use on their own.

### Jira workflow

- [`orchestrating-jira-workflow`](skills/orchestrating-jira-workflow/SKILL.md)
  runs the full Jira ticket flow.
- [`fetching-jira-ticket`](skills/fetching-jira-ticket/SKILL.md) saves a ticket
  snapshot to `docs/<TICKET_KEY>.md`.
- [`planning-jira-tasks`](skills/planning-jira-tasks/SKILL.md) turns that ticket
  into a task plan in `docs/<TICKET_KEY>-tasks.md`.
- [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) handles the
  plan review and the critique pass for each task.
- [`creating-jira-subtasks`](skills/creating-jira-subtasks/SKILL.md) creates or
  updates Jira subtasks after approval.
- [`planning-jira-task`](skills/planning-jira-task/SKILL.md) writes the planning
  files for one task.
- [`executing-jira-task`](skills/executing-jira-task/SKILL.md) carries one
  planned task through implementation and review.

### GitHub workflow

- [`orchestrating-github-workflow`](skills/orchestrating-github-workflow/SKILL.md)
  runs the full GitHub issue flow.
- [`fetching-github-issue`](skills/fetching-github-issue/SKILL.md) saves an issue
  snapshot to `docs/<ISSUE_SLUG>.md`.
- [`planning-github-issue-tasks`](skills/planning-github-issue-tasks/SKILL.md)
  turns that issue into a task plan in `docs/<ISSUE_SLUG>-tasks.md`.
- [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) is reused
  here for the same review and critique steps.
- [`creating-github-child-issues`](skills/creating-github-child-issues/SKILL.md)
  creates or updates child issues after approval.
- [`planning-github-task`](skills/planning-github-task/SKILL.md) writes the
  planning files for one task.
- [`executing-github-task`](skills/executing-github-task/SKILL.md) carries one
  planned task through implementation and review.

### Utility skills

- [`generate-handoff-document`](skills/generate-handoff-document/SKILL.md)
  builds a handoff document for a session that needs to be resumed later.
- [`validate-implementation-plan`](skills/validate-implementation-plan/SKILL.md)
  reviews implementation plans for missing requirements, weak assumptions, and
  unnecessary work.
- [`recency-guard`](skills/recency-guard/SKILL.md) checks answers that depend on
  current facts.
- [`analyzing-recent-project-state`](skills/analyzing-recent-project-state/SKILL.md)
  explains recent repository state from Git evidence, risks, validation gaps,
  and practical next actions.
- [`pr-creator`](skills/pr-creator/SKILL.md) prepares and opens a pull request
  from the current branch.
- [`committing-scoped-changes`](skills/committing-scoped-changes/SKILL.md)
  creates reviewable atomic commits from explicit file or folder paths while
  loading commit guidance and context only as needed.
- [`review-pull-request`](skills/review-pull-request/SKILL.md) reviews one PR
  through progressively disclosed subagents, external review resources, and a
  confirmation-gated posting path.
- [`responding-to-pr-review-comments`](skills/responding-to-pr-review-comments/SKILL.md)
  assesses received PR review comments, drafts replies, plans actions, and keeps
  posting confirmation-gated.
- [`prompt-structurer`](skills/prompt-structurer/SKILL.md) turns prose prompts
  into structured XML prompts.
- [`generating-flow-diagrams`](skills/generating-flow-diagrams/SKILL.md) creates
  or refines Markdown plus Mermaid diagrams for AI-agent workflows with human
  gates and quality checks.
- [`review-software-engineer-cv`](skills/review-software-engineer-cv/SKILL.md)
  reviews and tailors a software engineer CV against job postings with realistic,
  evidence-backed recommendations.
- [`refactoring-code`](skills/refactoring-code/SKILL.md) refactors existing code
  through behavior mapping, minimal strategy, implementation, and review
  subagents while preserving observable behavior.
- [`improving-test-suites`](skills/improving-test-suites/SKILL.md) turns test
  files into minimal, high-signal behavior-focused harnesses with just-in-time
  testing and security references.
- [`rewriting-code-strictly`](skills/rewriting-code-strictly/SKILL.md) rewrites
  Python, TypeScript/JavaScript, and Go code through baseline mapping, strict
  rewrite strategy, implementation, and review subagents with per-language
  playbooks.
- [`workflow-skill-architect`](skills/workflow-skill-architect/SKILL.md) helps
  turn a repeatable process into a reusable skill or set of subagents.

## Third party skills kept in the repo

The repository currently includes 10 third party skills. They live in
[`.agents/skills/`](.agents/skills/), are mirrored in
[`.claude/skills/`](.claude/skills/), and are pinned in
[`skills-lock.json`](skills-lock.json).

| Skill | Source |
| ----- | ------ |
| [`code-review-excellence`](.agents/skills/code-review-excellence/SKILL.md) | `wshobson/agents` |
| [`commit-work`](.agents/skills/commit-work/SKILL.md) | `softaworks/agent-toolkit` |
| [`executing-plans`](.agents/skills/executing-plans/SKILL.md) | `obra/superpowers` |
| [`gh-cli`](.agents/skills/gh-cli/SKILL.md) | `github/awesome-copilot` |
| [`grill-me`](.agents/skills/grill-me/SKILL.md) | `mattpocock/skills` |
| [`humanizer`](.agents/skills/humanizer/SKILL.md) | `blader/humanizer` |
| [`receiving-code-review`](.agents/skills/receiving-code-review/SKILL.md) | `obra/superpowers` |
| [`subagent-driven-development`](.agents/skills/subagent-driven-development/SKILL.md) | `obra/superpowers` |
| [`test-driven-development`](.agents/skills/test-driven-development/SKILL.md) | `obra/superpowers` |
| [`writing-plans`](.agents/skills/writing-plans/SKILL.md) | `obra/superpowers` |

## Notes for editing

- Skills in this repo need to work in both OpenCode and Claude Code, so keep the
  format simple and portable.
- Before editing a skill, subagent, or reference file, read the relevant guide in
  [`docs/best-practices/README.md`](docs/best-practices/README.md).
- There is no formal validator or CI pipeline for skill authoring at the moment,
  so checks are manual.
- Progress files under `docs/` are local working files. Do not commit them.
