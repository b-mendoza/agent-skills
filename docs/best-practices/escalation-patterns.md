# Escalation Patterns

## What it is

Define explicit failure categories and reporting formats for every subagent, so
the orchestrator can make informed decisions about how to handle failures
without reading raw error details.

## Why it matters

Without structured escalation, subagents either fail silently (producing
degraded output the orchestrator doesn't notice) or dump raw errors that
pollute the orchestrator's context. Categorized escalation enables the
orchestrator to route failures correctly: retry, skip, or escalate to the user.

## Failure categories

Calibrate escalation categories to the subagent's failure profile:

**Utility subagents** (simple pass/fail operations):

```markdown
## Escalation

If you encounter an unexpected error, report:

VALIDATION: ERROR
Phase: <N> | Direction: <direction>
Reason: <what went wrong>

The orchestrator will decide how to handle the error.
```

**Planning subagents** (three-category pattern):

| Category  | Meaning                             | Example                      |
| --------- | ----------------------------------- | ---------------------------- |
| `BLOCKED` | Cannot start — missing prerequisite | Required skill not installed |
| `FAIL`    | Completed with issues in output     | Circular dependency detected |
| `ERROR`   | Unexpected failure                  | Filesystem error, crash      |

**API-interacting subagents** (5+ categories for granular error handling):

| Category        | Meaning                             | Severity |
| --------------- | ----------------------------------- | -------- |
| `404`           | Resource not found                  | Fatal    |
| `401/403`       | Authentication failure              | Fatal    |
| `TOOLS_MISSING` | Required API tools unavailable      | Fatal    |
| `RATE_LIMIT`    | Rate limited after retry            | Warning  |
| `PARTIAL`       | Some items failed, others succeeded | Warning  |

**Judgment-heavy subagents** (specialized escalation):

When a subagent's core purpose depends on specific capabilities (e.g., web
search for bias correction), the absence of those capabilities is a FAIL, not
a graceful degradation. If a bias-correction subagent cannot search the web,
its output silently becomes biased training-data regurgitation — which
undermines the entire reason it exists.

## Key principle: Fail loudly, recover gracefully

Surface failures immediately with enough context for the orchestrator to act.
Never silently degrade output quality. The orchestrator — not the subagent —
decides whether to retry, skip, or escalate.
