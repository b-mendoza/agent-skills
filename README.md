# Agent skills

Skills for Cursor agents. A skill is a markdown file that tells the agent what
to do for a given task. Skills can hand off work to subagents so the main agent
doesn't run out of context.

## Project skills

These live under [`skills/`](skills/). Nine in total: six form the Jira
workflow and three are standalone.

### Jira workflow

Six skills that go from a Jira ticket to working code. The orchestrator is the
entry point. It calls the other five in order, checks results between steps,
and can pick up where it left off if something breaks.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md) --
  Coordinates the whole workflow but never runs tools itself. It sends work to
  seven subagents (`artifact-validator`, `progress-tracker`,
  `ticket-status-checker`, `codebase-inspector`, `code-reference-finder`,
  `documentation-finder`, `git-operator`) and five phase skills.
  Saves progress to `docs/<TICKET_KEY>-progress.md` so you can resume later.
  Asks before changing anything in Jira.

The five phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) -- Gets
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. A
   `ticket-retriever` subagent handles bulk fetching when there are many
   related issues.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) -- Splits the
   ticket into tasks using five subagents in sequence:
   `task-decomposer`, `task-planner`, `dependency-mapper`,
   `task-prioritizer`, `task-validator`. Output goes to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md) -- Walks
   through the plan one question at a time, confirming assumptions and
   resolving open questions. Adapts to whatever platform it runs on
   (Cursor, Claude Code, Claude.ai, etc.). Answers go into a Decisions
   Log appended to the tasks file.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) -- Reads
   the plan and creates subtasks in Jira. If there are more than three
   tasks, a `subtask-creator` subagent handles it. Updates the local plan
   with the new subtask keys afterwards.

5. [executing-subtask](skills/executing-subtask/SKILL.md) -- Picks one task
   from the plan, runs it through a `task-executor` subagent with review
   and retry, then marks it done in the plan file and in Jira.

### Standalone

- [validate-implementation-plan](skills/validate-implementation-plan/SKILL.md) --
  Checks AI-generated plans for missing requirements, unnecessary work
  (YAGNI), and risky assumptions. Six subagents do the actual checking:
  `technical-researcher`, `requirements-extractor`, `requirements-auditor`,
  `yagni-auditor`, `assumptions-auditor`, `plan-annotator`. Unresolved
  assumptions get flagged for the user before the final report.

- [recency-guard](skills/recency-guard/SKILL.md) -- Runs four checks
  (Recency, Self-Verification, Completeness, Clarity) to catch outdated
  information, overconfident claims, and gaps. A `recency-checker` subagent
  web-searches every factual claim, then a `claim-verifier` pressure-tests
  the most important ones.

- [workflow-skill-architect](skills/workflow-skill-architect/SKILL.md) --
  Helps you turn a multi-step workflow into a skill with subagents. Walks
  you through each step, figures out what should be a subagent, a skill, or
  a command, and gives you files you can use right away.

## Installed skills

Third-party skills listed in [`skills-lock.json`](skills-lock.json), stored
under `.agents/skills/`. Symlinked into `.claude/skills/` for Claude Code
compatibility.

| Skill                                              | Source                   | Description                                       |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md) | softaworks/agent-toolkit | Staging and review workflow, Conventional Commits |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)           | github/awesome-copilot   | Reference for the `gh` command line tool          |
| [humanizer](.agents/skills/humanizer/SKILL.md)     | blader/humanizer         | Remove signs of AI-generated writing from text    |
