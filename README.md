# Agent Skills

A collection of skills for Cursor agents. Each skill is a markdown file that
tells the agent how to handle a specific task. Skills can delegate heavy
execution to co-located subagents, keeping orchestrator context windows lean.

## Project Skills

These live under [`skills/`](skills/). Nine skills total: six form the Jira
workflow pipeline and three are standalone.

### Jira Workflow Pipeline

Six skills that take you from a Jira ticket to working code. The orchestrator
is the entry point. It calls the other five in order, validates artifacts
between steps, and can resume from any phase if something interrupts it.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md) --
  Pure coordinator that never runs tool calls directly. Dispatches to seven
  utility subagents (`artifact-validator`, `progress-tracker`,
  `ticket-status-checker`, `codebase-inspector`, `code-reference-finder`,
  `documentation-finder`, `git-operator`) and five downstream phase skills.
  Saves progress to `docs/<TICKET_KEY>-progress.md` so workflows are
  resumable. Asks before making any changes in Jira.

The five phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) -- Pulls
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. A
   `ticket-retriever` subagent handles bulk fetching when there are many
   related issues.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) -- Breaks the
   ticket into tasks through a five-step subagent pipeline:
   `task-decomposer`, `task-planner`, `dependency-mapper`,
   `task-prioritizer`, `task-validator`. Output goes to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md) -- Goes
   through the plan one question at a time, sorting out anything unclear.
   Answers go into a Decisions Log appended to the tasks file.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) -- Reads
   the plan and creates subtasks in Jira. If the plan has more than three
   tasks, a `subtask-creator` subagent does the work. Updates the local plan
   with the new subtask keys afterwards.

5. [executing-subtask](skills/executing-subtask/SKILL.md) -- Takes one task
   from the plan, runs it through a `task-executor` subagent with review and
   retry, then marks it done in both the plan file and Jira.

### Standalone

- [validate-implementation-plan](skills/validate-implementation-plan/SKILL.md) --
  Audits AI-generated plans for requirements traceability, YAGNI compliance,
  and assumption risks. Six subagents handle the work: `technical-researcher`,
  `requirements-extractor`, `requirements-auditor`, `yagni-auditor`,
  `assumptions-auditor`, and `plan-annotator`. Unresolved assumptions get
  escalated to the user before the final annotated report is produced.

- [recency-guard](skills/recency-guard/SKILL.md) -- Four-step validation
  pipeline (Recency, Self-Verification, Completeness, Clarity) that catches
  stale information, overconfident claims, and missing requirements. A
  `recency-checker` subagent web-searches every factual claim, then a
  `claim-verifier` pressure-tests the three most important ones.

- [workflow-skill-architect](skills/workflow-skill-architect/SKILL.md) --
  Helps you turn a multi-step workflow into a skill with co-located
  subagents. Walks you through each step, decides whether it should be a
  subagent, skill, or command, and produces copy-paste-ready files.

## Installed Skills

Third-party skills listed in [`skills-lock.json`](skills-lock.json), stored
under `.agents/skills/`. Symlinked into `.claude/skills/` for Claude Code
compatibility.

| Skill                                              | Source                   | Description                                       |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md) | softaworks/agent-toolkit | Staging and review workflow, Conventional Commits |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)           | github/awesome-copilot   | Reference for the `gh` command line tool          |
| [humanizer](.agents/skills/humanizer/SKILL.md)     | blader/humanizer         | Remove signs of AI-generated writing from text    |
