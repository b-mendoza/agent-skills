# state-machine-artifacts

## Tier

`recommended`. External finite-state-machine artifacts are load-bearing when a workflow's branches and repair routes exceed what linear prose can express unambiguously; otherwise they are avoidable synchronization surface.

## When it applies

When a workflow has branching routes, wait states, parallel joins, status-based recovery, or bounded repair loops whose transitions cannot be carried clearly by a short linear execution list. A linear five-step skill does not need an external FSM; apply [earned complexity](./earned-complexity.md) before adding one.

## The practice

Use exactly one normative source for state transitions. When `state-machine.md` exists, it is the sole normative transition source. `SKILL.md` carries only a compact overview that explicitly defers to it, and `flow-diagram.md`, when present, is labeled illustrative.

Rules:

1. **Earn the artifact.** Add `state-machine.md` only when branching, repair cycles, wait states, parallel joins, or status routing would be ambiguous in ordinary steps. Do not add it to make a simple skill look architected.
2. **Declare one source of truth.** `state-machine.md` owns states, transitions, transition guards, guard precedence, terminals, and loop routes. `SKILL.md` says it is a summary and links to the canonical file. `flow-diagram.md` says it is illustrative and must not introduce normative behavior. Never declare two transition representations normative.
3. **Specify complete transitions.** The FSM lists every state and every transition with its guard or event. Declare whether competing guards use first-match order or explicit numeric priority, then make that precedence visible in the transition table.
4. **Define termination.** List every terminal state and its user-facing outcome. Every active or wait state must eventually advance, wait on a named event, or terminate; silence is not an implicit route.
5. **Bound every cycle.** Name each loop counter, its owner, initial value, increment point, cap, and over-cap route. A cycle without all six is unbounded even if prose says "retry a few times."
6. **Route every status.** Every status any subagent can return has an explicit transition somewhere. Malformed or unknown statuses also have a declared route, usually retry within a cap and then `Error` or `Blocked`.
7. **Define parallel joins.** After parallel dispatch, name the join state and specify all-success, partial-failure, blocked, error, and missing-result behavior. Completion order must not choose the route.
8. **Synchronize in one change.** Any FSM change updates the `SKILL.md` summary and illustrative diagram in the same change. Reviewers validate agreement before accepting the edit; the summary and diagram never override the FSM when drift is found.

Run these correctness checks:

| Check | Passing condition |
| --- | --- |
| Exit completeness | Every non-terminal state routes every possible input or status |
| Terminal reachability | Every terminal is reachable from the start under a documented guard |
| Dead-state absence | Every non-terminal has an outgoing transition or named wait event |
| Cycle boundedness | Every directed cycle has an owned counter, cap, and over-cap route |
| Status coverage | Every declared subagent status, malformed output, and unknown status is routed |
| Join completeness | Every parallel join defines full success, partial failure, blocked/error, and missing results |
| Artifact agreement | `SKILL.md` summary and diagram contain no state or route contradicting `state-machine.md` |

## Rationale

An external FSM improves reliability only when it removes ambiguity. It becomes a reverse-drift hazard when prose, a table, and a diagram all claim authority: an editor updates one representation, a reviewer reads another, and the executing agent chooses whichever route is most salient in that run.

The risk is common in this corpus: at the time of this audit, 16 of 31 first-party skills shipped `state-machine.md` and 25 of 31 shipped `flow-diagram.md`, but packages disagreed on which artifact was normative. A single transition source plus synchronized summaries preserves the compact routing value of `SKILL.md` and the visual value of a diagram without creating multiple executable contracts.

## Concrete examples

Good: one canonical transition table with explicit precedence and bounded routes; all other artifacts defer.

```markdown
# In SKILL.md

Canonical FSM: [`state-machine.md`](./state-machine.md) (sole transition source). The table below is a non-normative overview.

# In state-machine.md

Competing transitions use first-match order as listed.

| From   | To      | Guard / event                                   |
| ------ | ------- | ----------------------------------------------- |
| Review | Ready   | `REVIEW: PASS`                                  |
| Review | Repair  | `REVIEW: FAIL` and `repair_cycles < 3`          |
| Review | Blocked | `REVIEW: FAIL` and `repair_cycles >= 3`         |
| Review | Error   | malformed, unknown, or repeated `REVIEW: ERROR` |

# In flow-diagram.md

Illustrative only. If this diagram disagrees with `state-machine.md`, the FSM wins and this diagram must be repaired in the same change.
```

Bad: two normative files disagree, so route selection varies by which file the agent follows.

```markdown
# SKILL.md — "Execution and state-machine.md are both normative."

On `REVIEW: FAIL`, retry until the reviewer passes.

# state-machine.md — "This table is normative."

`REVIEW: FAIL` at the third repair routes to `Blocked`.

# Result

One run loops; another stops at the cap. The same status has two executable contracts.
```

## References

- [`skills/council-of-advisors/SKILL.md`](../../skills/council-of-advisors/SKILL.md) declares `state-machine.md` the canonical FSM and sole source while retaining only a compact state overview.
- [`skills/council-of-advisors/state-machine.md`](../../skills/council-of-advisors/state-machine.md) demonstrates states, guarded transitions, terminals, owned counters, caps, parallel-join routing, and reachability checks in one canonical artifact.
- [`skills/diagnosing-root-causes/SKILL.md`](../../skills/diagnosing-root-causes/SKILL.md) and [`skills/diagnosing-root-causes/state-machine.md`](../../skills/diagnosing-root-causes/state-machine.md) declare both the Execution section and transition table normative, showing the duplicate-authority pattern this practice rejects.
- [`skills/improving-skill-definition/SKILL.md`](../../skills/improving-skill-definition/SKILL.md), [`state-machine.md`](../../skills/improving-skill-definition/state-machine.md), and [`flow-diagram.md`](../../skills/improving-skill-definition/flow-diagram.md) show why packages that ship both tabular and visual artifacts need an explicit authority and synchronization rule.
- [Earned complexity](./earned-complexity.md) defines the material-issue gate for adding files and synchronization surface.
