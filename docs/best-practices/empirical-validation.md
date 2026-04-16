# Empirical Validation over Self-Report

## What it is

Validate skill and subagent improvements by running them against real tasks and
measuring whether deviations decrease — not by asking the agent whether the
fix will work.

## Why it matters

Research strongly challenges treating agent self-reports as reliable:

- Chain-of-thought explanations systematically misrepresent true reasons for
  model predictions (arXiv:2305.04388, NeurIPS 2023).
- Claude Opus 4.1 succeeded at introspective detection only ~20% of the
  time under optimized conditions (transformer-circuits.pub, 2025).
- Models adapt responses to match the questioner's implied expectations
  (sycophancy, arXiv:2310.13548, ICLR 2024).

An agent's explanation of "why I deviated" may be plausible and coherent
without being faithful to the actual computation. The fix should be validated
by observing whether the behavior changes in practice.

## How to apply

1. Identify the specific deviation observed (e.g., "orchestrator called Bash
   directly instead of dispatching to subagent").
2. Implement the fix based on the best available evidence (research, prompt
   engineering literature, official documentation).
3. Run the workflow with a real task and observe whether the deviation recurs.
4. If it recurs, investigate further rather than trusting the agent's
   explanation of why the fix didn't work.

## Long-term path: Framework-level enforcement

The research consensus (2024-2026) is clear that prompt-level controls —
whether allow-list, deny-list, or hybrid — are architecturally insufficient
for hard tool-use enforcement. The reliable long-term solution is
framework-level enforcement: using `allowedTools`/`disallowedTools` fields in
agent definitions, enforced by the harness rather than by prose.

Prompt-level controls remain valuable as a pragmatic layer, but they should
not be the only enforcement mechanism for safety-critical boundaries.

## References

- Unfaithful Explanations in CoT — arXiv:2305.04388, NeurIPS 2023
- Anthropic introspection research — transformer-circuits.pub (2025)
- Sycophancy in LLMs — arXiv:2310.13548, ICLR 2024
- Agent-SafetyBench — arXiv:2412.14470 (2024)
- Claude Code agent teams documentation — code.claude.com/docs
