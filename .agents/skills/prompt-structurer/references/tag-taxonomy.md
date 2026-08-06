# Tag Taxonomy

> Load this file only when choosing, renaming, or validating XML tags. For external rationale, use `web-resource-index.md`; subagents request rationale with `FETCH_REQUESTED`, and only the orchestrator may fetch.

Use the smallest tag set that changes behavior. This local catalog is enough for offline execution.

## Tag Map

| Prompt Function | Preferred Tags | Include When |
| --- | --- | --- |
| Task | `<task>` | Always include one concise task statement |
| Boundaries | `<scope>`, `<in_scope>`, `<out_of_scope>` | The agent could inspect, modify, infer, or decide too broadly |
| Goal | `<goal>` | Human outcome differs from the mechanical task |
| Context | `<context>`, `<problem_context>`, `<reference_material>` | Missing information would change behavior |
| Philosophy | `<philosophy>`, `<core_principle>`, `<what_it_means>`, `<what_it_does_NOT_mean>`, `<rule_of_thumb>` | Key terms or intent have multiple plausible readings |
| Rules | `<constraints>`, `<constraint>`, `<hard_rule>` | Broad or non-negotiable behavior must be auditable |
| Workflow | `<dispatch_rule>`, `<phases>`, `<phase>`, `<steps>`, `<step>`, `<gate>` | Work is delegated, ordered, phase-scoped, or paused for review |
| Deliverables | `<output>`, `<output_file>`, `<required_contents>` | Format, path, sections, or content requirements matter |
| Edge Behavior | `<ambiguity_handling>`, `<new_finding_rule>`, `<autonomy_guardrails>` | The run may encounter ambiguity, surprises, or unattended decisions |
| Prevention | `<anti_patterns>` | A wrong action could look helpful while violating intent |
| Verification | `<success_criteria>` | The user needs observable post-run checks |

## Selection Tests

- Use a tag only when removing it would change agent behavior.
- Prefer suite-specific tag names when generic names would collide.
- Use attributes for metadata such as `id`, `name`, `mode`, `scope`, or `status`.
- Omit empty tags.
- If a tag cannot receive a removal-test justification, remove it before delivery.

## External Rationale

| Need                                   | Web Index Entry              |
| -------------------------------------- | ---------------------------- |
| XML tag parsing and naming             | Anthropic XML guidance       |
| Positive framing inside instructions   | Prompting Guide tips         |
| Prompt components and output structure | Microsoft prompt engineering |
