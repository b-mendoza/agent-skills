# dispatch-for-bounded-results

📝 Dispatch a step to a subagent when the orchestrator needs only a bounded result from it; run it inline when routing needs the raw or conversational material.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

Decide inline-versus-dispatch per step, not per skill, with two questions: does the orchestrator need the step's raw material to coordinate the workflow (an ongoing user conversation, judgment over full evidence, live troubleshooting), and will a later route need raw detail rather than a bounded result? If either answer is yes, run the step inline. If both are no, dispatch it and read back verdicts, statuses, paths, ids, and concise summaries; raw data stays inside the producing subagent or on disk. Inspect raw material inline only when the next routing decision needs it, and do not retain it "just in case" — when a detail is needed later, dispatch a retrieval then.

Dispatch is not free: a subagent starts with a fresh context, may reread inputs the orchestrator already holds, adds latency, and adds a contract to maintain, so it earns its place when isolation, an independent verdict, or a reusable structured output outweighs that. One skill may mix inline and dispatched steps.

This rule does not cover how retrieved text is trusted ([treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)), where dispatch payloads live on disk ([scope-run-files-to-the-run](./scope-run-files-to-the-run.md)), or how the orchestrator routes on what comes back ([keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)). Nesting depth and the inline fallback when no subagent tool exists are runtime facts recorded in [runtime-portability-matrix](./runtime-portability-matrix.md).

## Examples

```markdown
<!-- ❌ every step dispatched; the orchestrator loses the conversation it needs to steer -->
## Execution

1. Dispatch `question-asker` to ask the user one clarifying question.
2. Dispatch `answer-reader` to read the reply.
3. Dispatch `next-question-picker` to choose the next question.

<!-- ❌ raw material inlined and retained although only a verdict is routed on -->
1. Call the Jira API for `TICKET_KEY` and paste the full response here.
2. Keep the response in context in case a later step needs a field.
3. Decide what to do next from the response.

<!-- ✅ inline where the conversation is the material; dispatched where a bounded result suffices -->
## Execution

1. (Inline) Ask the user one clarifying question about the plan; the next question depends on this answer.
2. (Inline) Refine the assumption list from the reply.
3. Dispatch `ticket-fetcher` with `TICKET_KEY`. Retain only
   `FETCH: PASS | BLOCKED | ERROR` and `REPORT_PATH=.handoffs/clarifying-assumptions/<run-id>/ticket-report.yaml`.
4. Route on the fetch status. If a later step needs a ticket field, dispatch `ticket-fetcher` again with the field name.
```

## Related rules

- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)
- [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)
- [earn-every-part](./earn-every-part.md)
