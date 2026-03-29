# Agent skills

Skills for Cursor agents. A skill is a markdown file that tells the agent what
to do for a given task. Skills can hand off work to subagents so the main agent
doesn't run out of context.

## Project skills

These live under [`skills/`](skills/). Ten in total: six form the Jira
workflow and four are standalone.

### Jira workflow

Six skills that go from a Jira ticket to working code. The orchestrator is the
entry point. It calls the other five in order, checks results between steps,
and can pick up where it left off if something breaks.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md) --
  Coordinates the whole workflow but never runs tools itself. It sends work to
  seven subagents (`preflight-checker`, `artifact-validator`,
  `progress-tracker`, `ticket-status-checker`, `codebase-inspector`,
  `code-reference-finder`, `documentation-finder`) and five phase skills.
  Saves progress to `docs/<TICKET_KEY>-progress.md` so you can resume later.
  Asks before changing anything in Jira.

The five phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) -- Gets
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. A
   `ticket-retriever` subagent handles the fetching via MCP.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) -- Splits the
   ticket into tasks using a pipeline of subagents: `task-planner`,
   `dependency-prioritizer`, `task-validator`, with `stage-validator`
   running structural checks between stages. Output goes to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md) -- Walks
   through the plan using progressive disclosure, confirming assumptions
   and resolving open questions. Only asks about cross-cutting concerns
   upfront; task-specific questions wait until execution (Phase 5).
   A `decision-recorder` subagent writes resolved answers into a
   Decisions Log appended to the tasks file.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) -- Pure
   coordinator that dispatches a `subtask-creator` subagent to read the
   plan, create subtasks in Jira, and update the local plan with the new
   subtask keys.

5. [executing-jira-task](skills/executing-jira-task/SKILL.md) -- Picks one
   task from the plan and runs it through a pipeline of ten specialist
   subagents: `execution-prepper`, `execution-planner`,
   `test-strategist`, `refactoring-advisor`, `task-executor`,
   `documentation-writer`, `requirements-verifier`, then three quality
   gates (`clean-code-reviewer`, `architecture-reviewer`,
   `security-auditor`). Marks the task done in the plan file and in Jira.
   Caps targeted fix cycles at three per task.

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

- [pr-creator](skills/pr-creator/SKILL.md) -- Creates GitHub pull requests
  from the current branch. Analyzes the diff, generates a conventional-commit
  title and structured description, suggests reviewers from CODEOWNERS, and
  runs `gh pr create` after a confirmation step. Also notes GitLab and
  Bitbucket equivalents.

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
