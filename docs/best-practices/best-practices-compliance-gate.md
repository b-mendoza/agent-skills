# best-practices-compliance-gate

## Tier

`recommended`. Tier-aware compliance is the right tool for skill
review; flat-checklist auditing causes noise that hides genuine gaps.

## When it applies

When reviewing or auditing a skill package — either as part of
authoring a new skill, refactoring an existing one, or running an
adversarial audit such as `improving-skill-definition`.

## The practice

Treat the [`docs/best-practices/` README](./README.md) as a
quality gate for skill review, but apply it by the tier guidance in
that index instead of as a flat checklist. The README is the source
of truth for practice membership, order, and tier definitions; this
gate consumes the index rather than maintaining its own list. Each
applicable practice is evaluated against the package and assigned a
verdict.

Every checked practice gets a concrete verdict:

- `pass`: observable evidence shows conformance.
- `fail`: observable evidence shows deviation.
- `not applicable`: the practice does not apply, with a one-line
  reason.

A declared exception can pass when the skill names the deviation and
explains why it is intentional. Reporting a failure does not
authorize mutation; the audit surfaces the gap, and the user approves
the fix.

## Rationale

A flat checklist treats every practice as equally blocking. The
result is review-thrash: an audit flags a gerund-form naming
deviation (`optional-style`) at the same severity as a missing
`mutation-scope-boundaries` declaration (`mandatory`). The
user cannot tell which gap is real. Tiered evaluation makes the
weight of each verdict observable; the `mandatory` row tells the user
"do not ship this," the `optional-style` row tells the user "fix when
convenient."

The `not applicable` verdict closes a related failure: forcing a
verdict on practices that do not apply to a particular skill produces
either dishonest passes or noisy fails. A one-line reason for `not
applicable` keeps the practice honest without forcing out-of-scope
conformance.

## Concrete examples

Good: a tiered compliance table with `pass`, `fail`, and `not
applicable` verdicts and evidence.

```markdown
## Best-Practices Compliance

| Practice                  | Tier           | Verdict        | Evidence                                                                       |
| ------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------ |
| context-window-protection | mandatory      | pass           | Orchestrator keeps raw inspection in subagents and retains only verdicts/paths |
| template-extraction       | recommended    | not applicable | No output template exceeds 80 lines                                            |
| naming-conventions        | optional-style | fail           | Subagent file uses verb phrase instead of role noun                            |
```

Bad: a flat pass/fail checklist that mixes tiers and provides no
evidence.

```markdown
## Best-Practices Compliance

- [x] context-window-protection
- [ ] template-extraction
- [ ] naming-conventions
```

## References

- ISO/IEC 25010:2023, "Software product quality model," accessed
  2026-06-03: <https://www.iso.org/standard/78176.html>. Supports
  tier-based quality evaluation over flat checklists.
- Martin Fowler, "Refinement Code Review," accessed 2026-06-03:
  <https://martinfowler.com/bliki/RefinementCodeReview.html>.
  Practitioner support for matching review intensity to risk —
  routine refinement for most code, focused targeted review for
  safety- or security-critical areas.
