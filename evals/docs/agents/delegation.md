# Delegating Evals Work

Load this file when dispatching a subagent to work inside `evals/`.

Give every subagent:

- an explicit objective and a definition of done;
- the guardrails from [`../../AGENTS.md`](../../AGENTS.md) — eval runs
  spend money and need explicit user approval, and `report.md` is rewritten
  only by the eval runner;
- the long-lived guides and current-state references from
  [`../../AGENTS.md`](../../AGENTS.md) that its task needs.

When it is unclear whether delegation fits the task or which agent should
own it, escalate to the user.
