# Agent skills

A collection of skills for Cursor agents. Each skill is a markdown file that
tells the agent how to handle a specific task.

## Project skills

These live under [`skills/`](skills/).

### Jira workflow pipeline

Six skills that take you from a Jira ticket to working code. The orchestrator
is the entry point. It calls the other five in order, tracks progress, and
can resume if something interrupts it.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md) -
  Runs the whole pipeline. Calls each phase, checks results between steps,
  and saves progress to `docs/<TICKET_KEY>-progress.md`. Asks before making
  any changes in Jira. You can resume from any phase.

The five phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) - Pulls
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. When there are
   many related issues, a `ticket-retriever` subagent handles the fetching.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) - Breaks the
   ticket into tasks through a five-step subagent pipeline: decompose,
   detail, map dependencies, prioritize, validate. Output goes to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md) - Goes
   through the plan one question at a time, sorting out anything unclear.
   Answers go into a Decisions Log.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) - Reads
   the plan and creates subtasks in Jira. If the plan has more than three
   tasks, a `subtask-creator` subagent does the work. Updates the local plan
   with the new subtask keys afterwards.

5. [executing-subtask](skills/executing-subtask/SKILL.md) - Takes one task
   from the plan, runs it through a `task-executor` subagent with review and
   retry, then marks it done in both the plan file and Jira.

### Standalone

- [validate-implementation-plan](skills/validate-implementation-plan/SKILL.md) -
  Reviews AI-generated plans for missing requirements, unnecessary work, and
  risky assumptions. Expert personas annotate issues by severity.

- [recency-guard](skills/recency-guard/SKILL.md) - Checks whether factual
  responses are recent, accurate, complete, and clear. Good for catching
  outdated info or overconfident claims.

- [workflow-skill-architect](skills/workflow-skill-architect/SKILL.md) -
  Helps you turn a multi-step workflow into a skill with subagents. Walks
  you through splitting the work and setting subagent defaults.

## Installed skills

Third-party skills listed in [`skills-lock.json`](skills-lock.json), stored
under `.agents/skills/`.

| Skill                                              | Source                   | Description                                       |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md) | softaworks/agent-toolkit | Staging and review workflow, Conventional Commits |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)           | github/awesome-copilot   | Reference for the `gh` command line tool          |
| [humanizer](.agents/skills/humanizer/SKILL.md)     | blader/humanizer         | Remove signs of AI-generated writing from text    |
