# Failure Modes

> Read this file only when deciding whether a prompt needs explicit edge-case
> handling. For broader background, load `web-resource-index.md` and fetch one
> targeted URL.

Use this local risk map to connect common agent failures to prompt structures.
It is intentionally compact; external resources carry the long-form rationale.

## Risk Map

| Failure Mode | Symptom | Structural Safeguard |
| ------------ | ------- | -------------------- |
| Forgotten rule | Later phases ignore a rule mentioned once | Hoist it into `<constraints>`, `<hard_rule>`, or `<dispatch_rule>` |
| Ambiguous term | The output satisfies wording but misses intent | Add `<philosophy>` with meaning and non-meaning |
| Soft prohibition | `avoid X` becomes optional | Use a concrete `<hard_rule>` at the point of action |
| Empty output disappears | Zero-finding categories are omitted | Require explicit zero-state output or criteria |
| Phase boundary skipped | The agent continues when review was expected | Add a `<gate>` with the stop condition |
| Repair loop skips root cause | The assembler retries output wording while the failed criterion belongs to an earlier pass | Map the failed check to the earliest affected pass, then rerun downstream dependencies |
| Autonomous stall | The agent asks mid-run instead of proceeding safely | Add `<autonomy_guardrails>` and a defer-and-record rule |
| Surprise resolved silently | The agent makes an unreviewed decision | Add `<new_finding_rule>` with a reporting path |
| Traceability lost | The final answer cannot be audited | Require evidence, source locations, or durable outputs |
| Scope creep | The agent changes unrelated files, tools, or dependencies | Add `<scope>`, `<anti_patterns>`, and matching criteria |
| Mode mixing | Interactive and autonomous instructions both apply | Prefer separate prompt versions over complex branching |
| Uncheckable success | Output looks plausible but cannot be inspected | Add specific `<success_criteria>` tied to outputs and rules |

## Diagnostic Questions

- Is the prompt multi-phase? Check for hoisted rules, phase outputs, and gates.
- Can validation fail after assembly? Check that repair maps each failed
  criterion to the earliest affected pass before rerunning downstream work.
- Is a key word overloaded, such as `harmonize`, `clean up`, `review`, or `safe`? Check for philosophy and anti-patterns.
- Will the prompt run without a human present? Check for autonomy guardrails, traceability, and defer handling.
- Can output categories be empty? Require explicit zero-finding statements.
- Could a helpful-looking action violate scope? Add concrete anti-patterns and matching negative criteria.

## Application Rule

Add safeguards in proportion to risk. Simple one-shot prompts usually need task,
scope, output, and criteria. Autonomous production workflows usually need
philosophy, constraints, gates or guardrails, anti-patterns, traceability, and
success criteria.

## External Rationale

- General prompting and failure-mode background: fetch Lilian Weng through `web-resource-index.md`.
- Long-context retention failures: fetch Anthropic long-context tips through `web-resource-index.md`.
