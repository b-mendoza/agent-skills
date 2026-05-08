# Template Skeleton

> Read this file only during final assembly. It is a checklist, not a
> requirement to emit every tag. Fetch one URL from `web-resource-index.md`
> (Anthropic XML tags guide or Anthropic prompting best practices) only when
> a section choice still feels uncertain after this skeleton.

Use this skeleton to assemble a structured XML prompt. Include only sections
that change agent behavior; omit the rest.

## Section Order

| Order | Section | Reason |
| --- | --- | --- |
| 1 | `<task>` | Establishes the thesis first |
| 2 | `<dispatch_rule>` | Keeps delegation visible before work starts |
| 3 | `<scope>` and `<goal>` | Bounds and motivates the work |
| 4 | `<philosophy>` | Frames interpretation before rules and steps |
| 5 | `<context>` | Supplies background before execution |
| 6 | `<phases>` or `<steps>` | Defines the work sequence |
| 7 | `<anti_patterns>` and edge handlers | Blocks wrong paths around execution |
| 8 | `<constraints>` | States broad rules with full context available |
| 9 | `<success_criteria>` | Ends with the audit checklist |

## XML Skeleton

```xml
<task>
  [One sentence describing what this prompt accomplishes.]
</task>
<dispatch_rule>
  [Only when delegation matters.]
</dispatch_rule>
<scope>
  <in_scope>[What the agent may inspect, change, or decide.]</in_scope>
  <out_of_scope>[What remains outside the task.]</out_of_scope>
</scope>
<goal>
  [Human outcome, distinct from mechanical success criteria.]
</goal>
<philosophy>
  <core_principle>[Central mental model.]</core_principle>
  <what_it_means>[Positive interpretation.]</what_it_means>
  <what_it_does_NOT_mean>[Misinterpretations to block.]</what_it_does_NOT_mean>
  <rule_of_thumb>[Decision heuristic.]</rule_of_thumb>
</philosophy>
<context>
  [Background the agent cannot infer.]
</context>
<phases>
  <phase id="1" name="..." mode="...">
    <purpose>[Why this phase exists.]</purpose>
    <steps>
      <step id="1.1" name="...">[Instruction.]</step>
    </steps>
    <output>[What this phase produces.]</output>
    <hard_rule>[Phase-specific non-negotiable.]</hard_rule>
    <gate>[Stop condition, if applicable.]</gate>
  </phase>
</phases>
<anti_patterns>
  Do NOT:
  - [Specific wrong action.]
</anti_patterns>
<new_finding_rule>
  [How to route unexpected discoveries.]
</new_finding_rule>
<ambiguity_handling>
  [Fallback when multiple interpretations are plausible.]
</ambiguity_handling>
<autonomy_guardrails>
  [Rules for unattended runs.]
</autonomy_guardrails>
<constraints scope="all-phases">
  <constraint id="1" name="...">[Broad rule.]</constraint>
</constraints>
<success_criteria>
  - [Observable post-run check.]
</success_criteria>
```

## Assembly Rules

- Omit empty sections.
- Preserve user terminology exactly unless the user asked for renaming.
- Use specific tag names for suite prompts where generic names would
  collide.
- Use attributes for metadata instead of prose clutter.
- Repeat the most important rule at the phase or step where violation is
  likely.
- Prefer separate prompt versions for substantially different modes.
- Run the removal test: every emitted tag should earn its place.

## Common Deviations

| Situation | Deviation |
| --- | --- |
| Short one-shot prompt | Use `<task>`, `<scope>`, `<output>`, and `<success_criteria>` only |
| Interview-style prompt | Add `<gate>` tags for turn-taking |
| Autonomous prompt | Add `<autonomy_guardrails>`, traceability, and defer handling |
| Prompt suite | Keep shared philosophy and constraints consistent across prompts |

## Going Deeper

- For tag-by-tag rationale, naming patterns, and parsing benefits: fetch the
  Anthropic XML tags guide via `web-resource-index.md`.
- For long-context section ordering and grounding: fetch the Anthropic
  prompting best practices guide via `web-resource-index.md`.
