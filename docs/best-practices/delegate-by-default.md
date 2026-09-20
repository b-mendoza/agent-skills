# delegate-by-default

📝 Delegate steps to subagents by default, keeping only bounded results (statuses, paths, ids, summaries) in the orchestrator; run a step inline only when routing needs raw or conversational material.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

The orchestrator analyses, decides, routes, and evaluates; it does not execute. A step that reads files, parses command output, inspects an API payload, extracts web content, or produces an artifact is dispatched, and the subagent returns verdicts, statuses, paths, ids, and concise summaries while the raw material stays inside that subagent or on disk. Steps hand each other file paths, ticket keys, and status enums, never contents, and nothing is retained "just in case": when a later step needs a detail, dispatch a retrieval then. Raw material the orchestrator never routes on crowds out the headroom its later decisions need and puts untrusted text where instructions belong.

The one inline exception is a step whose raw material the next routing decision needs. Ask two questions: does the orchestrator need the raw material to coordinate the workflow (an ongoing user conversation, judgment over full evidence, live troubleshooting), and will a later route need raw detail rather than a bounded result? Run the step inline only when either answer is yes; when a step mixes both, split it into a dispatched evidence pass and an inline decision. Dispatch is not free — a fresh context, latency, and a contract to maintain — and that cost shapes how a subagent is scoped ([earn-every-part](./earn-every-part.md)), not whether the step is delegated. Decide per step; one skill mixes inline and dispatched steps.

This rule does not cover how retrieved text is trusted ([treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)), where handoff payloads live ([scope-run-files-to-the-run](./scope-run-files-to-the-run.md)), how the orchestrator routes on what comes back ([keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)), or which role a subagent plays ([subagent-roles](./subagent-roles.md)). Nesting depth and the inline fallback when no subagent tool exists are runtime facts in [runtime-portability-matrix](./runtime-portability-matrix.md).

## Examples

```markdown
<!-- ❌ raw material inlined and retained although only a verdict is routed on -->
## Execution

1. Call the Jira API for `TICKET_KEY` and paste the full response here.
2. Keep the response in context in case a later step needs a field.
3. Decide what to do next from the response.

<!-- ❌ the conversation is the routing material, yet it is dispatched turn by turn; every subagent starts without the prior answers -->
1. Dispatch `question-asker` to ask the user one clarifying question.
2. Dispatch `answer-reader` to read the reply.
3. Dispatch `next-question-picker` to choose the next question.

<!-- ✅ dispatched where a bounded result suffices; inline only where the next question depends on the last answer -->
## Execution

1. (Inline) Ask the user one clarifying question about the plan; the next question depends on this answer.
2. (Inline) Refine the assumption list from the reply.
3. Dispatch `ticket-fetcher` with `TICKET_KEY`. Retain only
   `FETCH: PASS | BLOCKED | ERROR` and `REPORT_PATH=.handoffs/clarifying-assumptions/<run-id>/ticket-report.yaml`.
4. Route on the fetch status; pass `REPORT_PATH`, not the report, to `critique-analyzer`.
   If a later step needs a ticket field, dispatch `ticket-fetcher` again with the field name.
```

## Related rules

- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)
- [subagent-roles](./subagent-roles.md)
- [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md)
- [scope-run-files-to-the-run](./scope-run-files-to-the-run.md)
- [earn-every-part](./earn-every-part.md)
