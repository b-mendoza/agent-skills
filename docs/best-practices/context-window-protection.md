# Context Window Protection

## What it is

Treat the orchestrating agent's context window as the most expensive resource
in the system. Every byte of raw content that leaks into it degrades
decision-making for every subsequent step.

## Why it matters

Context pollution compounds. When an orchestrator reads raw file contents,
command output, or API responses directly, that data stays in context for the
entire remaining conversation. It crowds out the instructions and summaries the
agent needs for later decisions, leading to instruction-following failures and
degraded output quality.

## Rules

1. **Dispatch, don't execute.** The orchestrator coordinates, decides, and
   synthesizes. Subagents do the heavy lifting in isolation.

2. **Collect summaries, not raw output.** When a subagent returns a result,
   extract the verdict and summary. Discard everything else. If details are
   needed later, dispatch a subagent to retrieve them.

3. **Pass structured data between steps.** Use file paths, ticket keys, and
   concise summaries as handoffs — not full file contents or raw command output.

4. **Never cache "just in case."** If information might be needed later, the
   appropriate action is to dispatch a subagent to retrieve it at that time,
   not to hold it in the orchestrator's context.

## The orchestrator holds only

- Decision-relevant summaries from subagents
- Current workflow state (phase, task, status)
- User instructions and confirmations
- Error reports that require judgment

## Example: Good vs bad handoff

```markdown
# Bad — raw data leaks into orchestrator context

Orchestrator reads docs/PROJ-123-tasks.md (200 lines) directly,
then analyzes it inline.

# Good — subagent returns a summary

Orchestrator dispatches artifact-validator with:
  TICKET_KEY: PROJ-123, PHASE: 2, DIRECTION: postcondition
Subagent returns:
  VALIDATION: PASS (3 lines)
Orchestrator uses the verdict to decide the next step.
```

## References

- Anthropic Claude Code agent architecture — code.claude.com/docs/en/sub-agents
