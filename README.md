# Agent skills

This repo is a small skill library for Cursor-style coding agents. Each skill
is a Markdown file with instructions, references, and co-located subagents.
The main pattern in this repo is to keep orchestration thin and push detailed
work into subagents so the top-level agent does not drown in context.

## Current layout

- [`skills/`](skills/) contains 12 first-party skills.
- [`docs/`](docs/) contains design notes, improvement plans, and supporting
  workflow documentation.
- [`.agents/skills/`](.agents/skills/) contains 16 vendored third-party skills.
- [`.claude/skills/`](.claude/skills/) mirrors those installed skills for
  Claude-style discovery.
- [`skills-lock.json`](skills-lock.json) tracks the installed third-party skill
  set.

## First-party skills

Seven of the 12 first-party skills form the Jira workflow. The other five are
standalone utilities.

### Jira workflow

The Jira workflow starts with
[`orchestrating-jira-workflow`](skills/orchestrating-jira-workflow/SKILL.md).
It coordinates the full ticket-to-code flow, saves progress to
`docs/<TICKET_KEY>-progress.md`, and resumes from disk when needed. It relies
on utility subagents for preflight checks, validation, progress tracking,
ticket status checks, codebase inspection, code reference lookup, and
documentation lookup.

The seven workflow phases are:

1. [`fetching-jira-ticket`](skills/fetching-jira-ticket/SKILL.md) fetches a
   Jira ticket and writes a local snapshot to `docs/<TICKET_KEY>.md`.
2. [`planning-jira-tasks`](skills/planning-jira-tasks/SKILL.md) breaks the
   ticket into ordered tasks and writes `docs/<TICKET_KEY>-tasks.md`.
3. [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) in
   upfront mode pressure-tests the overall plan before task execution starts.
4. [`creating-jira-subtasks`](skills/creating-jira-subtasks/SKILL.md) creates
   Jira subtasks from the approved task plan and records the new keys.
5. [`planning-jira-task`](skills/planning-jira-task/SKILL.md) creates an
   execution plan for one task, including codebase analysis, testing, and
   refactoring guidance.
6. [`clarifying-assumptions`](skills/clarifying-assumptions/SKILL.md) in
   critique mode reviews the single-task plan and surfaces task-specific gaps.
7. [`executing-jira-task`](skills/executing-jira-task/SKILL.md) implements the
   task, runs review passes, and updates both the local plan and Jira.

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

### Standalone skills

- [`generate-handoff-document`](skills/generate-handoff-document/SKILL.md)
  creates a resumable handoff package for an in-progress session, including
  structured context, insights, optional claim validation, and a final
  cold-start handoff document.
- [`validate-implementation-plan`](skills/validate-implementation-plan/SKILL.md)
  audits AI-generated implementation plans for missing requirements, YAGNI
  violations, and shaky assumptions before execution starts.
- [`recency-guard`](skills/recency-guard/SKILL.md) checks factual claims for
  freshness, completeness, and confidence by combining web research with
  verification passes.
- [`pr-creator`](skills/pr-creator/SKILL.md) prepares a pull request from the
  current branch, drafts the title and body, and creates it after confirmation.
- [`workflow-skill-architect`](skills/workflow-skill-architect/SKILL.md) helps
  design new multi-step skills by deciding what should stay inline, become a
  subagent, or move into references.

## Installed third-party skills

The repo currently vendors 16 third-party skills. They are stored under
[`.agents/skills/`](.agents/skills/) and exposed through
[`.claude/skills/`](.claude/skills/). The source of truth is
[`skills-lock.json`](skills-lock.json).

| Skill                                                                                | Source                               |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| [`api-security-best-practices`](.agents/skills/api-security-best-practices/SKILL.md) | `sickn33/antigravity-awesome-skills` |
| [`architecture-patterns`](.agents/skills/architecture-patterns/SKILL.md)             | `wshobson/agents`                    |
| [`clean-code`](.agents/skills/clean-code/SKILL.md)                                   | `sickn33/antigravity-awesome-skills` |
| [`code-review-excellence`](.agents/skills/code-review-excellence/SKILL.md)           | `wshobson/agents`                    |
| [`commit-work`](.agents/skills/commit-work/SKILL.md)                                 | `softaworks/agent-toolkit`           |
| [`executing-plans`](.agents/skills/executing-plans/SKILL.md)                         | `obra/superpowers`                   |
| [`find-skills`](.agents/skills/find-skills/SKILL.md)                                 | `vercel-labs/skills`                 |
| [`gh-cli`](.agents/skills/gh-cli/SKILL.md)                                           | `github/awesome-copilot`             |
| [`grill-me`](.agents/skills/grill-me/SKILL.md)                                       | `mattpocock/skills`                  |
| [`humanizer`](.agents/skills/humanizer/SKILL.md)                                     | `blader/humanizer`                   |
| [`progressive-disclosure`](.agents/skills/progressive-disclosure/SKILL.md)           | `flpbalada/my-opencode-config`       |
| [`receiving-code-review`](.agents/skills/receiving-code-review/SKILL.md)             | `obra/superpowers`                   |
| [`subagent-driven-development`](.agents/skills/subagent-driven-development/SKILL.md) | `obra/superpowers`                   |
| [`test-driven-development`](.agents/skills/test-driven-development/SKILL.md)         | `obra/superpowers`                   |
| [`vitest`](.agents/skills/vitest/SKILL.md)                                           | `antfu/skills`                       |
| [`writing-plans`](.agents/skills/writing-plans/SKILL.md)                             | `obra/superpowers`                   |

## Notes for editing

- Skills in this repo need to work in both OpenCode and Claude Code, so keep the
  format simple and portable.
- Before editing a skill, subagent, or reference file, read the relevant guide in
  [`docs/best-practices/README.md`](docs/best-practices/README.md).
- There is no formal validator or CI pipeline for skill authoring at the moment,
  so checks are manual.
- Progress files under `docs/` are local working files. Do not commit them.
