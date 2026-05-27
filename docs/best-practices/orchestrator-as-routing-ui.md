# Orchestrator as Routing UI

## What it is

An orchestrator skill is the routing layer of a workflow: it decides which
subagent to dispatch based on the inputs it received and the context it has
accumulated. Subagents are the backend: they take structured inputs, normalize
unstructured upstream data (file contents, API payloads, user prose) into
structured outputs, and return to the orchestrator. The orchestrator does
not do the unstructured work itself; it routes.

This is a conceptual analogy, not a literal restriction on how work is
decomposed. However, nested subagent dispatch is runtime-dependent. Claude Code
does not support subagents spawning other subagents, so portable skills should
chain subagent calls from the orchestrator or main conversation rather than
burying dispatch inside a subagent.

## Why it matters

**Orchestrators reason; subagents execute.** When an orchestrator does
inspection, parsing, or transformation work inline, its context fills with raw
artifacts — file contents, diffs, API responses, command output — and the
orchestrator loses the headroom it needs to reason about what to do next. The
routing decision becomes harder precisely as the data grows. Pushing the work
into subagents keeps the orchestrator's context lean and its routing logic
visible.

**Structured contracts make subagents reusable.** A subagent whose inputs and
outputs are named, typed, and bounded is composable. A subagent whose contract
is "I take unstructured stuff and return unstructured stuff" cannot be
reused without re-reading its source. The orchestrator-as-UI pattern presses
each subagent toward a clean function signature.

**The pattern surfaces dispatch logic.** The orchestrator's `Execution`
section reads as a sequence of routing decisions: "given input X, dispatch
subagent Y; given Y's status Z, dispatch subagent W or return a handoff."
When you read the orchestrator, you read the workflow. When dispatch logic is
buried inside subagents that branch and re-dispatch, the workflow becomes a
call graph you have to trace.

## Rules

1. **Orchestrators route; subagents execute.** The orchestrator's `Execution`
   section reads as a sequence of routing decisions keyed on enumerated
   subagent statuses, not as a sequence of inline file reads, diff parses, or
   API calls. Raw artifact processing belongs in a subagent.

2. **Subagents have structured input and output contracts.** Each subagent
   declares every input (with a typed example) and every output field (with
   verdict enums and example payloads). Unstructured-in or unstructured-out
   subagents indicate a missing contract — see [Input and Output
   Contracts](./input-output-contracts.md).

3. **Subagents normalize unstructured data.** A subagent that consumes a raw
   ticket, file, or web response is responsible for normalizing that data into
   the structured output its contract names. The orchestrator never sees the
   raw form.

4. **Nested delegation is runtime-dependent.** When the cleanest
   decomposition places a smaller workflow inside a larger one, model the
   smaller workflow as an orchestrator-visible phase unless the target runtime
   explicitly supports nested dispatch. For portable OpenCode/Claude Code
   skills, the orchestrator or main conversation chains subagent calls and
   retains the routing table. A subagent may still return a structured
   recommendation for which phase should run next.

5. **Orchestrators retain only verdicts, paths, ids, and concise summaries.**
   Raw data (full file contents, full diffs, full API payloads) stays inside
   the producing subagent. The orchestrator's accumulated context after each
   dispatch is a status enum, a set of paths, a verdict, and a short
   summary — never the raw input.

6. **The user-facing handoff is the orchestrator's UI output.** When the
   orchestrator returns to the user, it returns a structured handoff
   (decision, evidence, next steps). The handoff is the rendered UI; the
   subagent outputs that fed it are the backend data.

## Example

`orchestrating-jira-workflow` follows this pattern explicitly. The
orchestrator's `SKILL.md` execution sequence is a routing table: "Phase 1
dispatches `fetching-jira-ticket`; on success, Phase 2 dispatches
`artifact-validator` then `planning-jira-tasks`; on validator FAIL, re-enter
the failing phase." The orchestrator never reads the raw Jira API response;
`fetching-jira-ticket` normalizes that response into a structured
twelve-line fetch summary the orchestrator can route on.

`improving-skill-definition` follows the same pattern: the orchestrator
dispatches `skill-package-auditor`, retains only its verdict set and gap
inventory, dispatches `skill-definition-editor` after explicit approval, and
dispatches `skill-package-validator` to check the result. The raw target
package contents stay inside each subagent.

## When it is overkill

- Single-purpose skills with one execution path and no branching. A leaf
  skill that runs three steps in sequence and returns is not an orchestrator
  and does not need this framing.
- Tiny utility skills where the cost of defining a separate subagent contract
  exceeds the cost of doing the work inline. See [Subagent-Default
  Execution](./subagent-default-execution.md) for the inline-vs-dispatch
  decision.

## References

- [Subagent-Default Execution](./subagent-default-execution.md) — when each
  step should be inline vs. delegated.
- [Input and Output Contracts](./input-output-contracts.md) — explicit data
  boundaries between pipeline stages.
- [Context Window Protection](./context-window-protection.md) — keeping raw
  data out of the orchestrator's context.
- [Handoff-File Subagent Dispatch](./handoff-file-dispatch.md) — how large
  payloads cross the orchestrator-subagent boundary without breaking the
  dispatch tool.
