# Agent skills

Skills for Cursor agents. A skill is a markdown file that tells the agent what
to do for a given task. Skills can hand off work to subagents so the main agent
doesn't run out of context.

## Project skills

These live under [`skills/`](skills/). Eleven in total: seven form the Jira
workflow and four are standalone.

### Jira workflow

Seven skills that go from a Jira ticket to working code. The orchestrator is
the entry point. It calls the other six across seven phases, checks results
between steps, and can pick up where it left off if something breaks.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md) --
  Coordinates the whole workflow but never runs tools itself. It sends work to
  seven utility subagents (`preflight-checker`, `artifact-validator`,
  `progress-tracker`, `ticket-status-checker`, `codebase-inspector`,
  `code-reference-finder`, `documentation-finder`) and six downstream phase
  skills. Saves progress to `docs/<TICKET_KEY>-progress.md` so you can
  resume later. Asks before changing anything in Jira. Architecture docs
  live in [`docs/orchestrating-jira-workflow/`](docs/orchestrating-jira-workflow/).

The seven phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) -- Gets
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. A
   `ticket-retriever` subagent handles the fetching via MCP.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) -- Splits the
   ticket into tasks using a pipeline of subagents: `task-planner`,
   `dependency-prioritizer`, `task-validator`, with `stage-validator`
   running structural checks between stages. Output goes to
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md)
   _(upfront mode)_ -- Walks through the plan using progressive disclosure,
   confirming assumptions, resolving open questions, and critiquing the
   task plan for unjustified defaults. Only asks about cross-cutting
   concerns; task-specific questions wait until Phase 6. A
   `critique-analyzer` subagent challenges planning decisions by
   researching alternatives, and a `decision-recorder` subagent writes
   resolved answers into a Decisions Log appended to the tasks file.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) -- Pure
   coordinator that dispatches a `subtask-creator` subagent to read the
   plan, create subtasks in Jira, and update the local plan with the new
   subtask keys.

5. [planning-jira-task](skills/planning-jira-task/SKILL.md) -- Plans HOW to
   execute one task from the plan without implementing anything. Four
   subagents produce planning artifacts: `execution-prepper` (branch
   setup, execution brief), `execution-planner` (codebase analysis,
   approach), `test-strategist` (behaviour-driven test spec), and
   `refactoring-advisor` (refactoring evaluation). Output feeds Phase 6
   critique before any code is written.

6. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md)
   _(critique mode)_ -- Critiques per-task planning artifacts from Phase 5
   (framework choices, library selections, testing approach, refactoring
   scope) and resolves deferred task-specific questions. Same skill as
   Phase 3 but scoped to the task about to execute.

7. [executing-jira-task](skills/executing-jira-task/SKILL.md) -- Picks one
   task and implements it using the planning artifacts from Phase 5. Six
   subagents: `task-executor`, `documentation-writer`,
   `requirements-verifier`, then three quality gates
   (`clean-code-reviewer`, `architecture-reviewer`, `security-auditor`).
   Marks the task done in the plan file and in Jira. Caps targeted fix
   cycles at three per task.

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
