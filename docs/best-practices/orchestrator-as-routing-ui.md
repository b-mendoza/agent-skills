# orchestrator-as-routing-ui

## Tier

`recommended`. Multi-subagent workflows benefit; single-purpose
skills with one execution path do not need this framing.

## When it applies

When a skill orchestrates two or more subagents (or chains of work)
and must decide which subagent to dispatch next from accumulated
workflow state.

## The practice

An orchestrator skill is the workflow's routing layer. Subagents are
its contracted backends: they accept structured inputs, normalize
unstructured upstream data into structured outputs, and return control
to the orchestrator. The orchestrator renders the final user-facing
handoff from those outputs.

Rules:

1. **Make `Execution` a readable routing sequence.** Write it as a
   sequence of dispatch decisions keyed on enumerated statuses: given
   input X, dispatch subagent Y; on Y's status Z, dispatch W, retry,
   stop, or render a handoff.
2. **Give subagents structured input and output contracts.** Each
   subagent declares every input with a typed example and every output
   field with verdict enums and example payloads. Unstructured-in or
   unstructured-out subagents indicate a missing contract; see
   [input and output contracts](./input-output-contracts.md).
3. **Use subagents as normalization boundaries.** A subagent that
   consumes a raw ticket, file, API payload, or web response converts
   it into the structured fields named by its output contract.
4. **Keep the routing table in the orchestrator by default.** Nested
   dispatch support varies by runtime and version. Portable skills
   therefore keep routing decisions in the orchestrator or main
   conversation as the conservative default, and defer current
   runtime-specific support and syntax to the
   [runtime portability matrix](./runtime-portability-matrix.md). A
   subagent may return a structured recommendation for the next phase;
   the orchestrator makes the dispatch decision.
5. **Follow the bounded-context policy in
   [context window protection](./context-window-protection.md) for raw
   inspection, retained workflow state, and retrieved content.**
6. **Treat the user-facing handoff as rendered output.** Return a
   structured decision, evidence summary, artifact paths, and next
   steps. The handoff is the UI; contracted subagent outputs are the
   backend data from which it is rendered.
7. **Phase transitions are visible.** Multi-phase orchestrators make
   each phase transition visible before the new phase starts; the
   announce step and its rendering are owned by
   [phase execution cycle](./phase-execution-cycle.md). Subagents
   do not emit phase markers.

## Rationale

**Readable routing makes the workflow auditable.** The orchestrator's
`Execution` section should expose the state machine directly: which
status triggers which dispatch, retry, stop, or handoff. When branching
and re-dispatch are buried inside subagents, the workflow becomes a
call graph that authors and reviewers must trace.

**Structured contracts make subagents reusable.** A subagent whose
inputs and outputs are named, typed, and bounded behaves like a stable
backend. The normalization boundary lets different upstream sources
feed the same route without forcing the orchestrator to understand each
source's native shape.

**Central routing is the portable default.** Runtime and version
capabilities change. Keeping the routing table at the top level avoids
making the workflow's required control flow depend on nested dispatch,
while still allowing runtime-specific implementations to optimize when
they explicitly support it.

**The handoff completes the UI analogy.** Users need the orchestrator's
rendered decision and evidence, not a transcript of backend calls. A
stable handoff shape also makes blocked, partial, and successful runs
easy to compare.

## Concrete examples

Good: `Execution` exposes enumerated statuses, routing decisions, and
the rendered user handoff.

```markdown
# In skills/orchestrating-workflow/SKILL.md

## Execution

1. Dispatch `fetching-work-item`.
2. Route on `FETCH_STATUS`:
   - `FETCH: PASS` -> dispatch `artifact-validator` with `REPORT_PATH`.
   - `FETCH: NOT_FOUND` -> render a `BLOCKED` handoff.
   - `FETCH: ERROR` -> retry once, then render a `BLOCKED` handoff.
3. Route on `VALIDATE_STATUS`:
   - `VALIDATE: PASS` -> dispatch `planning-work-item-tasks`.
   - `VALIDATE: FAIL` -> render the validation-failure handoff.
4. Render the final handoff with `DECISION`, `EVIDENCE_SUMMARY`,
   `ARTIFACT_PATHS`, and `NEXT_STEPS`.
```

Bad: required routing is hidden inside a subagent and assumes nested
dispatch without declaring runtime support.

```markdown
## Execution

1. Dispatch `workflow-runner` with the work-item URL.
2. `workflow-runner` decides which other subagents to launch, retries
   them internally, and returns `done` when finished.
3. Return whatever `workflow-runner` reports.

(The top-level workflow no longer exposes status routes, retry rules,
or the handoff contract, and its required control flow depends on
runtime-specific nested dispatch.)
```

## References

- Claude Code subagents documentation, accessed 2026-05-27:
  <https://code.claude.com/docs/en/sub-agents>. Supports explicit
  subagent contracts and orchestration; current runtime-specific
  dispatch behavior should be revalidated before changing a portable
  workflow.
- Anthropic, "Effective context engineering for AI agents," accessed
  2026-05-27:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  Supports separating orchestration state from backend processing and
  using bounded handoffs between agentic steps.
