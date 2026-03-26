# Agent skills

Skills for AI-assisted development workflows. Each skill is a markdown file
that tells a Cursor agent how to do a specific task.

## Project skills

These live under [`skills/`](skills/).

### Jira workflow pipeline

Five skills that take you from a Jira ticket to implemented code, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) - Pulls
   Jira ticket data (metadata, description, comments, subtasks, links,
   custom fields) into a local `docs/<TICKET_KEY>.md` file. Hands off to a
   `ticket-retriever` subagent when there are too many related issues.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) - Runs a
   five-stage subagent pipeline (decompose, detail, map dependencies,
   prioritize, validate) and writes the result to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md) - Goes
   through the plan one question at a time, resolving ambiguities and
   recording answers in a Decisions Log.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) - Reads
   the task plan, builds a creation manifest, and creates Jira subtasks via
   MCP. For plans with more than three tasks, a `subtask-creator` subagent
   handles the work. Updates the local plan with subtask keys afterwards.

5. [executing-subtask](skills/executing-subtask/SKILL.md) - Picks up one
   task from the plan, runs it through a `task-executor` subagent with
   review and retry logic, then updates the plan status and Jira.

### Standalone

- [validate-implementation-plan](skills/validate-implementation-plan/SKILL.md) -
  Checks AI-generated implementation plans for requirements coverage, YAGNI
  compliance, and assumption risks. Uses expert personas to annotate plans
  with severity-leveled findings.

- [recency-guard](skills/recency-guard/SKILL.md) - Validates factual
  responses through four steps: recency, self-verification, completeness,
  and clarity. Catches stale information, overconfident claims, and missing
  requirements before they reach the user.

- [workflow-skill-architect](skills/workflow-skill-architect/SKILL.md) -
  Turns multi-step workflows into Claude Code skills with co-located
  subagents. Walks you through decomposition, subagent defaults, and
  general skill hygiene.

## Installed skills

Third-party skills managed via [`skills-lock.json`](skills-lock.json),
under `.agents/skills/`.

| Skill                                              | Source                   | Description                                           |
| -------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md) | softaworks/agent-toolkit | Staging and review workflow with Conventional Commits |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)           | github/awesome-copilot   | Full `gh` CLI reference for GitHub operations         |
| [humanizer](.agents/skills/humanizer/SKILL.md)     | blader/humanizer         | Remove signs of AI-generated writing from text        |
