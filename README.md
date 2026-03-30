# Agent skills

Skills for Cursor agents. Each skill is a markdown file that tells the agent
how to handle a specific type of task. Skills can delegate parts of the work to
subagents, which keeps the main agent from running out of context.

## Project skills

Stored in [`skills/`](skills/). Eleven in total: seven form the Jira workflow,
four are standalone.

### Jira workflow

Seven skills that take you from a Jira ticket to working code. The orchestrator
is the starting point. It calls the other six across seven phases, checks
results between steps, and can resume if something breaks along the way.

- [orchestrating-jira-workflow](skills/orchestrating-jira-workflow/SKILL.md)
  coordinates the whole workflow but never runs tools directly. It sends work to
  seven utility subagents (`preflight-checker`, `artifact-validator`,
  `progress-tracker`, `ticket-status-checker`, `codebase-inspector`,
  `code-reference-finder`, `documentation-finder`) and six phase skills.
  Progress is saved to `docs/<TICKET_KEY>-progress.md` so you can resume later.
  It always asks before changing anything in Jira. Architecture docs are in
  [`docs/orchestrating-jira-workflow/`](docs/orchestrating-jira-workflow/).

The seven phases, in order:

1. [fetching-jira-ticket](skills/fetching-jira-ticket/SKILL.md) pulls the
   ticket data from Jira (description, comments, subtasks, linked issues,
   custom fields) and writes it to `docs/<TICKET_KEY>.md`. A
   `ticket-retriever` subagent does the fetching through MCP.

2. [planning-jira-tasks](skills/planning-jira-tasks/SKILL.md) breaks the
   ticket into tasks. It uses a pipeline of subagents: `task-planner`,
   `dependency-prioritizer`, `task-validator`, with a `stage-validator`
   running structural checks between stages. The result goes into
   `docs/<TICKET_KEY>-tasks.md`.

3. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md)
   _(upfront mode)_ goes through the plan step by step, confirming
   assumptions, resolving open questions, and questioning defaults that lack
   justification. Only cross-cutting concerns are raised here; task-specific
   questions wait until Phase 6. A `critique-analyzer` subagent challenges
   decisions by researching alternatives, and a `decision-recorder` writes
   the resolved answers into a Decisions Log appended to the tasks file.

4. [creating-jira-subtasks](skills/creating-jira-subtasks/SKILL.md) is a
   small coordinator. It sends a `subtask-creator` subagent to read the plan,
   create subtasks in Jira, and update the local plan with the new subtask
   keys.

5. [planning-jira-task](skills/planning-jira-task/SKILL.md) plans how to
   execute a single task without writing any code. Four subagents produce the
   output: `execution-prepper` (branch setup, execution brief),
   `execution-planner` (codebase analysis, approach), `test-strategist`
   (test spec), and `refactoring-advisor` (refactoring evaluation). This
   output feeds Phase 6 before any implementation starts.

6. [clarifying-assumptions](skills/clarifying-assumptions/SKILL.md)
   _(critique mode)_ reviews the planning from Phase 5 (framework choices,
   library selections, testing approach, refactoring scope) and picks up any
   task-specific questions that were deferred earlier. Same skill as Phase 3,
   just scoped to the task about to be executed.

7. [executing-jira-task](skills/executing-jira-task/SKILL.md) takes one task
   and implements it using the output from Phase 5. Six subagents:
   `task-executor`, `documentation-writer`, `requirements-verifier`, followed
   by three review passes (`clean-code-reviewer`, `architecture-reviewer`,
   `security-auditor`). It marks the task done in both the plan file and
   Jira. If issues come up during review, it retries up to three times per
   task.

### Standalone

- [validate-implementation-plan](skills/validate-implementation-plan/SKILL.md)
  checks AI-generated plans for missing requirements, unnecessary work
  (YAGNI), and risky assumptions. Six subagents do the checking:
  `technical-researcher`, `requirements-extractor`, `requirements-auditor`,
  `yagni-auditor`, `assumptions-auditor`, `plan-annotator`. Anything
  unresolved gets flagged for the user before the final report.

- [recency-guard](skills/recency-guard/SKILL.md) runs four checks (Recency,
  Self-Verification, Completeness, Clarity) to catch outdated information,
  overconfident claims, and gaps. A `recency-checker` subagent searches the
  web for every factual claim, then a `claim-verifier` tests the most
  important ones more thoroughly.

- [pr-creator](skills/pr-creator/SKILL.md) creates GitHub pull requests from
  the current branch. It looks at the diff, generates a conventional-commit
  title and a structured description, suggests reviewers from CODEOWNERS, and
  runs `gh pr create` after you confirm. Also notes the GitLab and Bitbucket
  equivalents.

- [workflow-skill-architect](skills/workflow-skill-architect/SKILL.md) helps
  you turn a multi-step workflow into a skill with subagents. It walks you
  through each step, figures out what should be a subagent, a skill, or a
  command, and produces files you can use straight away.

## Installed skills

Third-party skills listed in [`skills-lock.json`](skills-lock.json), stored
under `.agents/skills/`. Symlinked into `.claude/skills/` for Claude Code
compatibility.

| Skill                                              | Source                   | Description                                       |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| [commit-work](.agents/skills/commit-work/SKILL.md) | softaworks/agent-toolkit | Staging and review workflow, Conventional Commits |
| [gh-cli](.agents/skills/gh-cli/SKILL.md)           | github/awesome-copilot   | Reference for the `gh` command line tool          |
| [humanizer](.agents/skills/humanizer/SKILL.md)     | blader/humanizer         | Remove signs of AI-generated writing from text    |
