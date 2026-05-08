# Failure Modes

> Read this file only when deciding whether a prompt needs edge-case handling. Fetch external resources through `web-resource-index.md` only when these local patterns are insufficient.

Use this compact map to connect common agent failures to prompt structures that prevent them.

## Risk Map

| Failure Mode | Symptom | Structural Safeguard |
| --- | --- | --- |
| Critical rule is forgotten | Later phases ignore a rule mentioned once near the top | Hoist the rule into `<constraints>`, `<hard_rule>`, or `<dispatch_rule>` |
| Ambiguous term is misread | The agent satisfies the wording but misses the intent | Add `<philosophy>` with `what_it_means` and `what_it_does_NOT_mean` |
| Prohibition is softened | A rule like "avoid X" becomes optional | Use a concrete `<hard_rule>` and repeat it at the point of action |
| Empty output disappears | A report omits categories with zero findings | Require explicit zero-finding statements in `<output>` or `<success_criteria>` |
| Phase boundary is skipped | The agent continues when the user expected review | Add a `<gate>` with the stop condition |
| Autonomous run stalls | The agent asks the user mid-run | Add `<autonomy_guardrails>` and a defer-and-record rule |
| Unexpected finding is resolved silently | The agent makes an unreviewed decision | Add `<new_finding_rule>` with a durable reporting path |
| Decision history is lost | The final answer lacks traceability | Require durable outputs or evidence fields |
| Broad cleanup expands scope | The agent changes tools, dependencies, or unrelated files | Add `what_it_does_NOT_mean`, `<anti_patterns>`, and negative success criteria |
| Mode branches mix together | Interactive and autonomous instructions both apply | Prefer separate prompt versions over complex branching |
| Success resembles failure | Output looks plausible but cannot be checked | Add specific `<success_criteria>` tied to outputs and constraints |

## Diagnostic Questions

- Is the prompt multi-phase? Consider hoisted rules, phase outputs, and gates.
- Is a key word overloaded, such as `harmonize`, `clean up`, `review`, or `safe`? Add philosophy and anti-patterns.
- Will the prompt run without a human present? Add autonomy guardrails, traceability, and defer handling.
- Can output categories be empty? Require explicit zero-finding statements.
- Could a helpful-looking action violate scope? Add concrete anti-patterns and matching negative criteria.

## Application Rule

Add safeguards in proportion to risk. A simple one-shot prompt usually needs a clear task, scope, output, and criteria. A production autonomous workflow usually needs philosophy, constraints, gates or guardrails, anti-patterns, traceability, and success criteria.
