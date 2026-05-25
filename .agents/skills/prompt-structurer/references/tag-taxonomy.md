# Tag Taxonomy

> Read this file only when choosing, renaming, or validating XML tags. For
> detailed rationale, load `web-resource-index.md` and fetch at most one
> targeted URL when needed and permitted.

Use the smallest tag set that changes behavior. This local catalog is enough
for offline execution; external pages provide optional rationale and vendor
specifics.

## Tag Map

| Prompt Function | Preferred Tags | Include When |
| --------------- | -------------- | ------------ |
| Thesis | `<task>` | Always include one concise task statement |
| Boundaries | `<scope>`, `<in_scope>`, `<out_of_scope>` | The agent could inspect, modify, infer, or decide too broadly |
| Outcome | `<goal>` | The human outcome differs from the mechanical task |
| Background | `<context>`, `<problem_context>`, `<reference_material>` | Missing information would change behavior |
| Mental model | `<philosophy>`, `<core_principle>`, `<what_it_means>`, `<what_it_does_NOT_mean>`, `<rule_of_thumb>` | Key terms or task intent have multiple plausible readings |
| Rules | `<constraints>`, `<constraint>`, `<hard_rule>` | Broad or non-negotiable behavior must be auditable |
| Workflow | `<dispatch_rule>`, `<phases>`, `<phase>`, `<steps>`, `<step>`, `<gate>` | Work is delegated, ordered, phase-scoped, or paused for review |
| Deliverables | `<output>`, `<output_file>`, `<required_contents>` | Format, path, sections, or content requirements matter |
| Edge behavior | `<ambiguity_handling>`, `<new_finding_rule>`, `<autonomy_guardrails>` | The run may encounter ambiguity, surprises, or unattended decisions |
| Prevention | `<anti_patterns>` | A wrong action could look helpful while violating intent |
| Verification | `<success_criteria>` | The user needs an observable post-run audit checklist |

## Selection Tests

- Use a new tag only when existing tags hide a meaningful behavior difference.
- Prefer suite-specific tag names when generic names would collide.
- Use attributes for metadata such as `id`, `name`, `mode`, `scope`, or `status`.
- Omit empty tags.
- Run the removal test: if deleting a tag would not change agent behavior, remove it.

## External Rationale

- XML tag parsing and naming: fetch Anthropic XML guidance through `web-resource-index.md`.
- Positive framing inside instructions: fetch Prompting Guide tips through `web-resource-index.md`.
