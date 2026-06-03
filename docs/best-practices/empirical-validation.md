# empirical-validation

## Tier

`mandatory`. Self-report from an LLM is not evidence of behavior; a
workflow whose validation collapses to "the agent says it works"
ships silent failures.

## When it applies

Whenever a skill claims to fix, validate, or guard a behavior — bug
fixes, instruction-following improvements, mutation safeguards,
output gates, prompt-injection defenses, and any audit that asserts a
gap is closed.

## The practice

Validate improvements by observing behavior on real tasks, not by
asking the agent whether the fix will work. Use a five-step loop and
treat prompt-level controls as useful but insufficient for hard
boundaries.

Apply this loop:

1. Identify the observed deviation.
2. Implement the fix using the best available evidence.
3. Run the workflow with a real or representative task.
4. Observe whether the deviation recurs.
5. If it recurs, investigate further instead of trusting the agent's
   explanation.

Prompt-level controls are useful but insufficient for hard safety
boundaries. Use framework-level enforcement, tool permissions,
runtime restrictions, mutation scopes, and independent validation
where the boundary matters.

## Rationale

LLM-authored explanations tend to be confidently wrong about whether
a fix will work. Asking the producing agent "did this fix the
problem?" is a sycophancy-prone signal: the agent often says yes,
even when behavior on the original failing task is unchanged. The
only reliable evidence is whether the deviation recurs when the
workflow runs against a real or representative task.

The framework-level enforcement rule closes a second failure: prompt
text that asks an agent to respect a mutation boundary, refuse a
tool, or not write outside scope is not a boundary, it is a request.
A real boundary lives in tool permissions, mutation scopes, runtime
restrictions, or an independent validator subagent that cannot be
talked out of its verdict.

## Concrete examples

Good: a five-step loop with a representative test case.

```markdown
1. Observed deviation: editor over-wrote unrelated files during repair.
2. Fix: tighten `MUTATION_LIMITS`, derive `VALIDATOR_FINDINGS` intersection in editor.
3. Run on a representative case: re-run `improving-skill-definition`
   on a known package with a deliberately broken validator finding.
4. Observe: editor only touches the named files.
5. If the editor still touches unrelated files, investigate runtime
   permissions, prompt drift, or missing scope-intersection logic.
   Do not stop at the editor's self-report that it respects scope.
```

Bad: self-report only, no representative run, no observable check.

```markdown
1. Editor over-wrote unrelated files.
2. Update the prompt to say "do not write outside scope."
3. Ask the editor: "do you respect scope now?" Editor: "Yes, I do."
4. Mark fixed.
```

## References

- Turpin et al., "Language Models Don't Always Say What They Think,"
  arXiv:2305.04388: <https://arxiv.org/abs/2305.04388>. Supports
  treating model explanations as fallible self-report.
- Sharma et al., "Towards Understanding Sycophancy in Language
  Models," arXiv:2310.13548: <https://arxiv.org/abs/2310.13548>.
  Supports treating agreement and self-report as fallible signals.
- Agent-SafetyBench — arXiv:2412.14470:
  <https://arxiv.org/abs/2412.14470>. Supports the need for
  framework-level enforcement over prompt-only safety in agent
  settings.

## Related practices

- [Critical output gates](./critical-output-gates.md) — gates supply
  the observable check this practice insists on.
- [Mutation scope boundaries](./mutation-scope-boundaries.md) — the
  canonical example of a hard boundary that prompt text cannot
  enforce alone.
- [Phase execution cycle](./phase-execution-cycle.md) — the
  postcondition step uses empirical evidence.
- [Escalation categories](./escalation-categories.md) — when an
  observed deviation recurs, escalate rather than self-report
  closure.
