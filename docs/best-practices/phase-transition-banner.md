# Phase Transition Banner

## What it is

When an orchestrator skill transitions from one workflow phase to the next,
it prints a formatted banner in its user-visible output that names the new
phase, its position in the workflow, and (when applicable) the scope of the
phase iteration. The banner is the canonical visual marker that the workflow
has advanced; it is the same format across every orchestrator skill in this
repo.

## Why it matters

**Long orchestrations are hard to navigate.** A multi-phase workflow with
subagent dispatches, validator gates, and fix loops produces a lot of output.
Without phase markers, the user cannot tell which phase the orchestrator is
in, which sub-step belongs to which phase, or whether a retry has re-entered
a phase or moved forward. The banner is the lighthouse the user navigates by.

**Consistency across skills compounds.** A user who reads output from
`orchestrating-jira-workflow`, then `improving-skill-definition`, then
`committing-scoped-changes` should not have to learn a new phase-transition
convention each time. A single canonical format is recognizable at a glance
as "the workflow advanced," regardless of which orchestrator is running.

**Banners make retry cycles observable.** When a phase re-enters itself for a
fix loop, the user sees the banner re-printed. The trail of banners in the
output is the workflow's execution log; retries are not hidden inside
collapsed sub-steps.

## Rules

1. **Print the banner at the start of every phase transition.** Before any
   action in the new phase — including dispatching a subagent, loading a
   reference file, or reading a contract — the orchestrator emits the
   banner. The banner appears in the orchestrator's user-visible output, not
   only in internal logs.

2. **Use the canonical banner format.** The format is exactly:

   ```text
   ----------------------------------------
   Phase <N>/<TOTAL> - <Phase name>
   ----------------------------------------
   ```

   - `<N>` is the current phase number, 1-indexed.
   - `<TOTAL>` is the total number of phases declared in the skill's pipeline
     overview.
   - `<Phase name>` is the human-readable name of the phase, taken verbatim
     from the orchestrator's pipeline or phase table.
   - The horizontal rule is exactly forty hyphens (`-` × 40).

3. **Scoped phases append the scope on a second header line.** When a phase
   iterates over tasks, items, or sub-units (a per-task loop inside a single
   phase, for example), the banner adds the scope:

   ```text
   ----------------------------------------
   Phase 5/7 - Task Planning - Task 2
   ----------------------------------------
   ```

   The scope appears on the same banner line, separated from the phase name
   by ` - `. The horizontal rules stay forty hyphens.

4. **Re-entering a phase reprints the banner.** When a phase fails its gate
   and the workflow re-enters it for a targeted repair cycle, the banner is
   printed again at the start of the re-entry. Each repair cycle produces
   its own banner; the cycle count is not embedded in the banner itself, but
   the user can count banners to see how many cycles have run.

5. **Leaf skills with a single execution path do not need banners.** The
   rule applies to orchestrator skills with two or more declared phases in
   their pipeline overview. A leaf skill that runs one execution path end to
   end does not need to announce itself with a banner.

6. **Banners are not subagent output.** The orchestrator emits the banner
   from its own routing layer, before the subagent dispatch. Subagents do
   not print phase banners; that would conflate the orchestrator's routing
   UI with the subagent's structured output.

## Example

`orchestrating-jira-workflow` is the canonical reference. Its
`references/workflow-policy.md` declares the banner format, and every phase
in `references/phases-1-4.md` and `references/task-loop.md` starts with an
"Announce Phase N" instruction. A run that fetches a Jira ticket and reaches
the per-task loop produces banners like:

```text
----------------------------------------
Phase 1/7 - Fetch Ticket
----------------------------------------

[subagent dispatches, validator checks, progress updates]

----------------------------------------
Phase 2/7 - Plan Tasks
----------------------------------------

[...]

----------------------------------------
Phase 5/7 - Task Planning - Task 1
----------------------------------------

[...]

----------------------------------------
Phase 5/7 - Task Planning - Task 2
----------------------------------------

[...]
```

When Phase 3 fails its postcondition gate and the workflow re-enters Phase 3
for a repair cycle, the user sees the banner again, anchoring the retry in
the output stream.

## When it is overkill

- Single-phase skills with one execution path; the skill's purpose serves as
  its own banner.
- Skills whose primary output is a structured artifact (a generated file, a
  parsed payload) rather than a streamed user-visible execution log; a
  banner in a file is noise.

## References

- [Orchestrator as Routing UI](./orchestrator-as-routing-ui.md) — the banner
  is the orchestrator's UI; this practice is one expression of that role.
- [Validation Loops](./validation-loops.md) — retry cycles are made visible
  by re-printed banners.
- [Progressive Disclosure](./progressive-disclosure.md) — phases are the
  unit of progressive disclosure; banners mark the boundaries.
