# Validation and Escalation

## What it is

Define how skill workflows check their own work, repair failed outputs, and
escalate when the workflow cannot safely proceed. This practice replaces the
former standalone guidance for validation loops, critical-output gates,
best-practices compliance gates, empirical validation, and escalation patterns.

## Why it matters

LLM outputs can be fluent and wrong. A subagent can produce a clean-looking
payload with one poisoned field, and the orchestrator may route every later
phase incorrectly. Validation must be observable, independent where it matters,
and bounded so repair loops do not become infinite.

## Standard phase execution cycle

Every phase boundary should make the state transition checkable:

```text
1. Announce     — make the phase transition visible
2. Validate     — check preconditions
3. Execute      — invoke the skill, tool, or subagent
4. Validate     — check postconditions
5. Update       — record progress
6. Gate check   — advance, repair, re-plan, or escalate
```

When a quality gate fails, rerun only the failing gate and the producing work
needed to repair it. Avoid full-pipeline reruns when prior stages already
passed. Use an explicit retry cap, commonly three targeted fix cycles.

Apply the full cycle where the risk earns it: mutating workflows, multi-phase
orchestrators, external-effect actions, critical outputs, and workflows that
consume untrusted content. Thin utility skills can use a smaller precondition
and postcondition check when a full phase ceremony would fail
[Earned Complexity](./earned-complexity.md).

## Critical-output gates

A skill that produces outputs other components rely on must declare those
critical outputs and protect them with named gates.

Rules:

1. **Declare critical outputs in `SKILL.md`.** Outputs not declared critical do
   not require gates.
2. **Give each critical output a named gate.** Use identifiers such as
   `G_TICKET_FETCH`, `G_PLAN_COMPLETENESS`, or `G_ATOMIC_HISTORY`.
3. **Use an independent checker where practical.** The producer's self-report
   does not count as a gate verdict. A validator subagent, inline structural
   check, external tool, or separate phase should inspect the output.
4. **Repair through bounded loops.** Re-run the producing phase with validator
   findings as input; stop at the retry cap and return a blocked handoff if
   the gate still fails.
5. **Surface gate evidence.** Final handoffs name which gates ran, which
   passed, which failed, and the evidence for each verdict.
6. **Missing gates are material gaps.** A declared critical output without a
   gate is incomplete.

Do not gate prose opinions as if "is this a good opinion" were an objective
check. Recommendations that the user will judge themselves may not need a
workflow gate.

## Best-practices compliance gate

Treat the `docs/best-practices/` index as a quality gate for skill review, but
apply it by tier instead of as a flat checklist.

Tiers:

- `mandatory`: safety, portability, mutation scope, output contracts, and
  lifecycle rules whose failure can cause agent misbehavior or data loss.
- `recommended`: architecture and maintainability rules that should apply to
  most non-trivial skills but may be intentionally scoped down.
- `optional-style`: house conventions and UI affordances that improve
  consistency but should not block a skill unless strict repo style is required.

Every checked practice gets a concrete verdict:

- `pass`: observable evidence shows conformance.
- `fail`: observable evidence shows deviation.
- `not applicable`: the practice does not apply, with a one-line reason.

A declared exception can pass when the skill names the deviation and explains
why it is intentional. Reporting a failure does not authorize mutation; the
audit surfaces the gap, and the user approves the fix.

Example output shape:

```markdown
## Best-Practices Compliance

| Practice | Tier | Verdict | Evidence |
| --- | --- | --- | --- |
| context-and-payload-management | mandatory | pass | Orchestrator keeps raw inspection in subagents and retains only verdicts/paths |
| template extraction | recommended | not applicable | No output template exceeds 80 lines |
| naming convention | optional-style | fail | Subagent file uses verb phrase instead of role noun |
```

## Empirical validation over self-report

Validate improvements by observing behavior on real tasks, not by asking the
agent whether the fix will work.

Apply this loop:

1. Identify the observed deviation.
2. Implement the fix using the best available evidence.
3. Run the workflow with a real or representative task.
4. Observe whether the deviation recurs.
5. If it recurs, investigate further instead of trusting the agent's
   explanation.

Prompt-level controls are useful but insufficient for hard safety boundaries.
Use framework-level enforcement, tool permissions, runtime restrictions,
mutation scopes, and independent validation where the boundary matters.

## Escalation patterns

Define failure categories and reporting formats for every subagent so the
orchestrator can route failures without reading raw error details.

Common categories:

| Category | Meaning | Typical route |
| --- | --- | --- |
| `BLOCKED` | Cannot start because prerequisite input, permission, or user decision is missing | Ask user or stop |
| `FAIL` | Completed but output violates a gate or contract | Repair loop or re-plan |
| `ERROR` | Unexpected runtime/tool/filesystem failure | Retry if bounded, otherwise escalate |
| `PARTIAL` | Some items succeeded and others failed | Route remaining scope explicitly |
| `TOOLS_MISSING` | Required runtime capability is unavailable | Stop or ask user to enable/install |
| `RATE_LIMIT` | External service throttled after retry | Wait, reschedule, or escalate |

Judgment-heavy subagents should fail loudly when a missing capability defeats
their purpose. For example, a bias-correction subagent that cannot perform the
required current research should report a failure instead of silently
regurgitating stale training data.

## References

- [Input and Output Contracts](./input-output-contracts.md) — escalation
  reports and validator outputs need structured contracts.
- [Mutation Scope Boundaries](./mutation-scope-boundaries.md) — gates and
  validators enforce approved edit scope.
- [Runtime Portability Matrix](./runtime-portability-matrix.md) — runtime
  permissions and tool availability affect validation strategy.
- Turpin et al., "Language Models Don't Always Say What They Think,"
  arXiv:2305.04388: <https://arxiv.org/abs/2305.04388>. Supports caution
  against relying on model explanations as faithful self-report; it does not
  prescribe this repo's validation-loop structure.
- Sharma et al., "Towards Understanding Sycophancy in Language Models,"
  arXiv:2310.13548: <https://arxiv.org/abs/2310.13548>. Supports treating
  agreement and self-report as fallible signals.
- Agent-SafetyBench — arXiv:2412.14470:
  <https://arxiv.org/abs/2412.14470>. Supports the need for stronger checks
  than prompt-only safety instructions in agent settings.
- OpenAI, "Understanding prompt injections," accessed 2026-05-27:
  <https://openai.com/safety/prompt-injections/>. Supports layered defenses and
  limiting agent access when untrusted content enters context.
