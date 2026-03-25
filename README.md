# Agent Skills

A collection of reusable skills for AI-assisted development workflows. Skills are
self-contained, markdown-based instructions that Cursor agents follow to perform
specific tasks.

## Project Skills

Skills authored in this repo, located under [`skills/`](skills/).

### Jira Workflow Pipeline

These five skills form a sequential pipeline for turning a Jira ticket into
implemented code:

1. **[fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md)** — Pulls
   full Jira ticket data (metadata, description, comments, subtasks, links,
   custom fields) into a local `docs/<TICKET_KEY>.md` snapshot.

2. **[planning-jira-tasks](skills/planning-jira-tasks/SKILL.md)** — Orchestrates
   a five-stage subagent pipeline (decompose → detail → map dependencies →
   prioritize → validate) to produce a task plan at
   `docs/<TICKET_KEY>-tasks.md` from the ticket snapshot.

3. **[clarifying-assumptions](skills/clarifying-assumptions/SKILL.md)** — Walks
   the plan one question at a time, resolving ambiguities and recording answers
   in a Decisions Log.

4. **[creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md)** — Parses
   the task plan and creates one Jira subtask per task via MCP, updating the
   local plan with subtask keys.

5. **[executing-subtask](skills/executing-subtask/SKILL.md)** — Runs exactly one
   plan task through a `task-executor` subagent with review and retry logic,
   then updates the plan status and Jira.

### Standalone

- **[validate-implementation-plan](skills/validate-implementation-plan/SKILL.md)** —
  Audits AI-generated implementation plans for requirements traceability, YAGNI
  compliance, and assumption risks. Uses expert personas to annotate plans
  inline with severity-leveled findings.

## Installed Skills

Third-party and external skills managed via [`skills-lock.json`](skills-lock.json),
located under `.agents/skills/`.

| Skill                                                                                | Source                   | Description                                                            |
| ------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md)                                   | softaworks/agent-toolkit | Staging/review workflow with Conventional Commits and commit splitting |
| [executing-plans](.agents/skills/executing-plans/SKILL.md)                           | obra/superpowers         | Load a plan and execute tasks sequentially with review checkpoints     |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)                                             | github/awesome-copilot   | Comprehensive `gh` CLI reference for GitHub operations                 |
| [humanizer](.agents/skills/humanizer/SKILL.md)                                       | blader/humanizer         | Remove signs of AI-generated writing from text                         |
| [subagent-driven-development](.agents/skills/subagent-driven-development/SKILL.md)   | obra/superpowers         | Per-task subagent execution with spec and code quality review          |
| [test-driven-development](.agents/skills/test-driven-development/SKILL.md)           | obra/superpowers         | Strict red-green-refactor TDD workflow                                 |
| [validate-implementation-plan](.agents/skills/validate-implementation-plan/SKILL.md) | b-mendoza/agent-skills   | Plan auditing (locked copy of the project skill)                       |
| [writing-plans](.agents/skills/writing-plans/SKILL.md)                               | obra/superpowers         | Spec-to-plan generation with checkbox tasks and TDD steps              |
