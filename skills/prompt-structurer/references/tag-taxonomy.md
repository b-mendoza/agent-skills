# Tag Taxonomy

> Read this file only when choosing, renaming, or validating XML tags. For broader prompt-engineering background, read `web-resource-index.md` and fetch one relevant URL.

This is the local minimum tag catalog for structured prompts. It is intentionally compact so subagents can use it without loading long prompt-engineering explanations.

## Core Tags

| Tag | Purpose | Include When |
| --- | --- | --- |
| `<task>` | Single thesis of the prompt | Always |
| `<scope>` | In-bounds and out-of-bounds boundaries | The agent could look, touch, or infer too broadly |
| `<goal>` | Human outcome or reason the task matters | The prompt needs motivation distinct from mechanics |
| `<context>` or `<problem_context>` | Background the agent cannot infer | Missing history would change behavior |
| `<reference_material>` | Documents or links to consult as context | Material informs but is not itself an instruction |

## Behavioral Tags

| Tag | Purpose | Include When |
| --- | --- | --- |
| `<philosophy>` | Mental model for interpreting the task | Words have multiple plausible meanings |
| `<core_principle>` | Central framing idea inside philosophy | One idea should govern tradeoffs |
| `<what_it_means>` | Positive interpretation of philosophy | The frame needs a concrete restatement |
| `<what_it_does_NOT_mean>` | Misinterpretations to block | A carve-out or exclusion matters |
| `<rule_of_thumb>` | Fast decision heuristic | The agent needs a fallback choice rule |
| `<constraints>` | Broad task rules | A rule applies across most or all phases |
| `<constraint>` | One named broad rule | The rule should be individually auditable |
| `<hard_rule>` | Non-negotiable behavior | Violation means the task failed |

## Workflow Tags

| Tag | Purpose | Include When |
| --- | --- | --- |
| `<dispatch_rule>` | How work is delegated | Subagents or specialized workers are part of execution |
| `<phases>` | Multi-stage workflow container | Work has distinct stages with different outputs |
| `<phase>` | One workflow stage | A stage has its own purpose, output, or rules |
| `<steps>` and `<step>` | Ordered instructions inside a phase | Order matters within the phase |
| `<gate>` | Stop or confirmation condition | The agent should pause before continuing |

## Output And Edge Tags

| Tag | Purpose | Include When |
| --- | --- | --- |
| `<output>` | Deliverable content or format | Any output shape matters |
| `<output_file>` | Path and file rules | The deliverable is a file |
| `<required_contents>` | Required sections or fields | Omission would make output unusable |
| `<anti_patterns>` | Wrong actions that might look helpful | The task has plausible misreadings |
| `<new_finding_rule>` | Handling unexpected discoveries | The agent may find unplanned information |
| `<ambiguity_handling>` | Fallback for multiple plausible readings | Guessing would be risky |
| `<autonomy_guardrails>` | Rules for unattended runs | The prompt should not stall on questions |
| `<success_criteria>` | Post-run audit checklist | The user needs observable verification |

## Selection Tests

- Use a new tag when the content changes how the agent behaves and no existing tag fits cleanly.
- Prefer specific tag names when generic names hide intent, such as `<audit_philosophy>` instead of `<philosophy>` in a prompt suite.
- Use attributes for metadata: `id`, `name`, `mode`, `scope`, and `status`.
- Omit empty tags. An absent tag is clearer than a blank tag.
- Run the removal test before final delivery: if removing a tag would not change behavior, remove it.
