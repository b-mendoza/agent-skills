# one-normative-state-machine

📝 Architect a skill with branches, loops, wait states, or approval gates as a finite state machine with one normative transition source; when `state-machine.md` exists, `SKILL.md` only summarises it.

✅ This rule is `recommended`: expected for non-trivial skills; scope it down with a stated reason.

Add `state-machine.md` only when branching routes, wait states, parallel joins, or status-based repair would be ambiguous in a short `Execution` list; a linear flow does not need one, and adding it creates synchronisation surface without removing ambiguity ([earn-every-part](./earn-every-part.md)). When it exists, it owns every state; every transition with its guard or event; the guard precedence (first-match order or explicit priority, stated once and visible in the table); every terminal with its user-facing outcome; every loop's named counter, cap, and over-cap route; and every parallel join, named, with all-success, partial, blocked, error, and missing-result behaviour that does not depend on completion order. Every status a subagent can return, including malformed and unknown output, has a transition. `SKILL.md` states that its overview is non-normative and links the file; `flow-diagram.md`, when present, states that it is illustrative.

The failure this prevents is two executable contracts for one status: an editor updates one representation, a reviewer reads another, and the run follows whichever is most salient. Any transition change therefore updates the overview and diagram in the same change, and neither overrides the FSM when drift is found. Status vocabulary and the loop-cap shape are owned by [route-every-status](./route-every-status.md); how `Execution` reads as routes by [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md).

## Examples

```markdown
<!-- ❌ two normative sources for the same status -->
# SKILL.md
Both the Execution section and `./state-machine.md` are normative and must match.
10. On `REVIEW: FAIL`, re-dispatch the analyst until the reviewer passes.

# state-machine.md
This table is normative. `REVIEW: FAIL` with `repair_cycles >= 3` → `TermBlocked`.
(One run loops without bound; another stops at the cap.)

<!-- ✅ one source; overview and diagram defer to it -->
# SKILL.md
Execution is a finite state machine. Canonical transitions: [`state-machine.md`](./state-machine.md);
the steps below are a non-normative overview.

# state-machine.md
Competing guards use first-match order as listed. `repair_cycles` starts at 0, increments on entry to `Repair`, cap 3.

| From | To | Guard / event |
| --- | --- | --- |
| Join | Analyze | every branch returned `COLLECT: PASS` |
| Join | TermBlocked | any branch returned `COLLECT: BLOCKED` or returned nothing |
| Review | TermReady | `REVIEW: PASS` |
| Review | Repair | `REVIEW: FAIL` and `repair_cycles < 3` |
| Review | TermBlocked | `REVIEW: FAIL` and `repair_cycles >= 3` |
| Review | TermError | `REVIEW: ERROR`, malformed, or unknown status |

Terminals: `TermReady`, `TermBlocked`, `TermError`; each is reachable from `Start` under a listed guard.

# flow-diagram.md
Illustrative only. If this diagram disagrees with `state-machine.md`, the FSM wins; repair the diagram in the same change.
```

## When not to use it

A skill whose `Execution` is a short linear sequence with at most one retry route keeps its routes in `Execution` and does not add `state-machine.md`.

## Related rules

- [route-every-status](./route-every-status.md)
- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md)
- [earn-every-part](./earn-every-part.md)
