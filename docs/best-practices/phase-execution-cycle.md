# phase-execution-cycle

## Tier

`recommended`. Multi-phase orchestrators and risk-bearing workflows should follow it; thin utility skills can use a smaller precondition and postcondition check.

## When it applies

When a skill orchestrates two or more phases, mutates files, calls external services with side effects, produces critical outputs, or consumes untrusted content. Single-phase utility skills can use a smaller precondition and postcondition check instead.

## The practice

Make every phase boundary checkable using a six-step cycle. When a quality gate fails, rerun only the failing gate and the producing work needed to repair it. Use an explicit retry cap, commonly three targeted fix cycles.

```text
1. Announce     — make the phase transition visible
2. Validate     — check preconditions
3. Execute      — invoke the skill, tool, or subagent
4. Validate     — check postconditions
5. Update       — record progress
6. Gate check   — advance, repair, re-plan, or escalate
```

Apply the full cycle where the risk earns it: mutating workflows, multi-phase orchestrators, external-effect actions, critical outputs, and workflows that consume untrusted content. Thin utility skills can use a smaller precondition and postcondition check when a full phase ceremony would fail [earned complexity](./earned-complexity.md).

The Announce step's rendering is style, not contract: any visible marker carrying the phase number, total count, and phase name is fine (a plain `Phase 4/8 - Audit` line, or the host UI's native progress marker). Only the orchestrator announces phases; subagents do not emit phase markers, or the markers collapse into noise.

## Rationale

LLM outputs can be fluent and wrong. A subagent can produce a clean-looking payload with one poisoned field, and the orchestrator may route every later phase incorrectly. The cycle forces preconditions and postconditions to be observable, makes the transition between phases visible to the user, and bounds the cost of repair: re-run the failing gate, not the whole pipeline.

The retry cap closes the other failure: an unbounded repair loop masks a genuine impossibility as "still trying" until the runtime exhausts itself. A capped loop forces the workflow to escalate when the producing phase cannot meet the gate.

## Concrete examples

Good: a phase that announces, validates, executes, re-validates, and gates with a bounded retry.

```markdown
# In skill-name/SKILL.md

9. Emit `Phase 6/8 - Edit`. (Announce)
10. Confirm `APPROVED_GAPS` and `MUTATION_LIMITS` are set. (Validate preconditions)
11. Dispatch `skill-definition-editor`. (Execute)
12. Read the editor report and confirm every approved gap is addressed. (Validate postconditions)
13. Increment the repair counter; if the editor returned `EDIT: BLOCKED` and the counter is below 3, re-dispatch with findings; otherwise route to the blocked handoff. (Gate check)
```

Bad: a phase that mutates without preconditions, never re-validates, and either loops forever or silently passes.

```markdown
# In skill-name/SKILL.md

9. Dispatch the editor with whatever inputs are around.
10. If the user pushes back, ask the editor to try again.
11. If they push back again, try again. (No retry cap; no postcondition check; no visible phase transition.)
```

## References

- Turpin et al., "Language Models Don't Always Say What They Think," arXiv:2305.04388: <https://arxiv.org/abs/2305.04388>. Supports caution against relying on model explanations as faithful self- report.
- IEEE, "Reliability engineering of software systems," IEEE Standard 982.1-2005, accessed 2026-06-03: <https://standards.ieee.org/ieee/982.1/1353/>. Supports the general principle of observable preconditions, postconditions, and bounded retry as reliability primitives.
