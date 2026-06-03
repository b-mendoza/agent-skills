# critical-output-gates

## Tier

`mandatory`. A declared critical output without a gate is a material
gap; downstream consumers will silently propagate the defect.

## When it applies

When a skill produces outputs other components, downstream skills, or
the user rely on as correct: planning artifacts that drive execution,
ticket snapshots, validator verdicts, audit synthesis reports, final
handoffs, or any artifact whose correctness gates user action.

## The practice

A skill that produces outputs other components rely on must declare
those critical outputs and protect them with named gates.

Rules:

1. **Declare critical outputs in `SKILL.md`.** Outputs not declared
   critical do not require gates.
2. **Give each critical output a named gate.** Use identifiers such
   as `G_TICKET_FETCH`, `G_PLAN_COMPLETENESS`, or `G_ATOMIC_HISTORY`.
3. **Use an independent checker where practical.** The producer's
   self-report does not count as a gate verdict. A validator
   subagent, inline structural check, external tool, or separate
   phase should inspect the output.
4. **Repair through bounded loops.** Re-run the producing phase with
   validator findings as input; stop at the retry cap and return a
   blocked handoff if the gate still fails.
5. **Surface gate evidence.** Final handoffs name which gates ran,
   which passed, which failed, and the evidence for each verdict.
6. **Missing gates are material gaps.** A declared critical output
   without a gate is incomplete.

Do not gate prose opinions as if "is this a good opinion" were an
objective check. Recommendations that the user will judge themselves
may not need a workflow gate.

## Rationale

Without explicit gates, "the skill succeeded" devolves to "the
producing phase did not throw." A producer can write a malformed
plan, an audit synthesis report missing the gap inventory, or a
ticket snapshot with the wrong fields, and the orchestrator routes
the next phase against the broken artifact. Named gates surface the
failure at the boundary where it happened, and independent checkers
prevent the producer from grading its own homework.

The independent-checker rule is the load-bearing one. Producers tend
to self-report success; the only reliable evidence is a separate
agent or check that reads the artifact against its declared shape.

## Concrete examples

Good: declared critical outputs, named gates, independent validator,
bounded repair.

```markdown
# In skill-name/SKILL.md

## Critical Outputs
| Gate | Protects | Checker |
| ---- | -------- | ------- |
| `G_HANDOFF_COMPLETENESS` | Every user-facing handoff has required sections | Inline structural check |
| `G_GAP_CLOSURE` | Every approved gap observably resolved | `skill-package-validator` |
| `G_FLOW_SYNC` | Diagram, SKILL.md, registry agree | `skill-package-validator` |

## Execution
11. Dispatch `skill-package-validator`.
12. On `VALIDATION: FAIL`, re-enter Edit with only validator findings;
    use at most three repair cycles.
13. Final handoff lists each gate, its verdict, and the evidence.
```

Bad: no declared critical outputs, no gates, success defined as
"editor returned `EDIT: PASS`."

```markdown
# In skill-name/SKILL.md

## Execution
11. Dispatch the editor.
12. If the editor says PASS, return success.
13. If not, ask the editor to fix it. (No checker, no retry cap, no
    evidence in the final handoff.)
```

## References

- Turpin et al., "Language Models Don't Always Say What They Think,"
  arXiv:2305.04388: <https://arxiv.org/abs/2305.04388>. Supports
  treating producer self-report as fallible.
- Sharma et al., "Towards Understanding Sycophancy in Language
  Models," arXiv:2310.13548: <https://arxiv.org/abs/2310.13548>.
  Supports treating agreement and self-report as fallible signals.
- Agent-SafetyBench — arXiv:2412.14470:
  <https://arxiv.org/abs/2412.14470>. Supports the need for stronger
  checks than prompt-only safety instructions in agent settings.

