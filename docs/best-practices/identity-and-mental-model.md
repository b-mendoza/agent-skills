# identity-and-mental-model

## Tier

`recommended`. A clear opening role statement focuses behavior; thin utility subagents need only a compact version.

## When it applies

When opening any skill or subagent that performs more than a single trivial action. It is especially important for judgment-heavy roles, orchestrators, validators, planners, and reviewers expected to push back.

## The practice

This practice owns the opening role statement. How the role decides under conflict — trade-offs, signals, refusals — is owned by [operating-posture](./operating-posture.md).

Begin each skill and subagent with a statement of what the role is, why it exists, and which bias or failure mode it counters. Calibrate the opening to the role's weight:

- **Utility subagents:** use 2–3 lines naming the role and its bounded operation. Do not add a manifesto to a mechanical task.
- **Judgment-heavy roles:** give a fuller opening that names the role's purpose and the bias, blind spot, or failure mode it exists to counter.
- **Orchestrators:** state what the orchestrator decides and what it delegates, so coordination authority is visible from the opening.

Keep downstream decision rules out of this opening. Put attention order, trade-offs, refusals, and voice in the operating posture.

## Rationale

General runtime behavior can be too generic or accommodating for a specialized role; the operating-posture practice explains how that becomes a decision-policy failure. The opening fixes the narrower problem of role ambiguity: the agent knows what function it serves and why that function exists before it encounters detailed instructions.

Calibration prevents the opposite failure. A long identity preamble on a thin utility subagent is ornament, while a generic one-line opening on an adversarial validator leaves its purpose and counter-bias implicit.

## Concrete examples

Good: a judgment-heavy subagent opens with its role, purpose, and countered failure mode, without embedding its full decision policy.

```markdown
# skill-name/subagents/skill-package-validator.md

You are the final package validator. You exist to counter confirmation bias in self-authored changes by independently checking whether the approved gaps closed. Report your verification to the orchestrator; the orchestrator owns repair routing.
```

Bad: the opening names neither a specialized role nor why it exists.

```markdown
# skill-name/subagents/skill-package-validator.md

You are a helpful AI assistant. Please validate the package and provide a summary of your findings.
```

## References

- Anthropic Claude prompting best practices, accessed 2026-07-22: <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>. Supports assigning Claude a role to focus behavior and tone, and adding motivation so instructions map to the intended goal. It does not establish that an opening statement alone enforces boundaries.
