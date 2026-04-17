# Template Skeleton

This is the skeleton for a fully-structured XML prompt. Use it as the assembly frame for the final output. Not every section is required — omit sections that don't apply, but run the full list as a mental checklist so omission is conscious, not accidental.

---

## Section order rationale

Tags appear in this order for a reason. The agent reads top to bottom; early tags frame how later tags are interpreted.

1. `<task>` first — establishes the thesis before anything else.
2. `<dispatch_rule>` second if applicable — critical cross-cutting behavior can't wait.
3. `<scope>` and `<goal>` next — bound and motivate the work.
4. `<philosophy>` before `<constraints>` — philosophy shapes how constraints are read.
5. `<context>` / `<problem_context>` when needed — the agent should know the backstory before the method.
6. `<phases>` / `<method>` / `<steps>` — the actual work.
7. `<anti_patterns>`, escape hatches, autonomy guardrails — behavior shaping that surrounds the method.
8. `<constraints>` with `scope="all-phases"` — cross-cutting rules, placed here because they refer back to everything above.
9. `<success_criteria>` last — the audit checklist naturally reads last.

---

## Skeleton

```xml
<task>
  [One sentence: what this prompt accomplishes.]
</task>

<dispatch_rule>
  [Only if using subagents] How work is distributed.
</dispatch_rule>

<scope>
  [What's in-bounds: files, systems, entities.]
</scope>

<goal>
  [The outcome in human terms. Distinct from success criteria.]
</goal>

<philosophy>
  <core_principle>
    [The mental model the agent should adopt.]
  </core_principle>
  <what_it_means>
    [Positive framing of the approach.]
  </what_it_means>
  <what_it_does_NOT_mean>
    [Negative framing — common misinterpretations to block.]
  </what_it_does_NOT_mean>
  <rule_of_thumb>
    [A quick decision heuristic.]
  </rule_of_thumb>
</philosophy>

<context>
  [If needed] Background the agent can't infer from the task alone.
</context>

<phases>
  <phase id="N" name="..." mode="...">
    <purpose>[What this phase accomplishes.]</purpose>
    <steps>
      <step id="N.M" name="...">
        [Step instructions.]
      </step>
    </steps>
    <o>[What this phase produces.]</o>
    <hard_rule>[Anything absolute about this phase.]</hard_rule>
    <gate>[If applicable] Stop condition before next phase.</gate>
  </phase>
</phases>

<anti_patterns>
  [Explicit list of things NOT to do that would look like completing the task.]
</anti_patterns>

<new_finding_rule>
  [What to do when the agent discovers something the prompt didn't anticipate.]
</new_finding_rule>

<ambiguity_handling>
  [What to do when multiple interpretations are plausible.]
</ambiguity_handling>

<autonomy_guardrails>
  [If running autonomously] Rules that keep the agent from asking the user mid-run.
</autonomy_guardrails>

<constraints scope="all-phases">
  <constraint id="1" name="...">
    [Rule description.]
  </constraint>
</constraints>

<success_criteria>
  [Checkable statements of done. Mix of positive and negative.]
</success_criteria>
```

---

## Assembly rules

**When a section is empty, omit the tag entirely rather than leaving it blank.** Empty tags create noise.

**Nest sub-tags consistently.** If `<philosophy>` has sub-tags in one prompt, use the same sub-tag names (where applicable) in the next prompt. Internal consistency across a prompt suite matters.

**Prefer specific tag names over generic ones.** `<harmonization_philosophy>` is better than `<philosophy>` if the prompt suite includes multiple philosophy-like blocks. Specificity aids scanning.

**Use XML attributes for metadata.** `<phase id="0" name="validate" mode="report-only">` puts workflow metadata in attributes without cluttering content. Attributes include `id`, `name`, `mode`, `scope`, `status`.

**Preserve the user's technical terminology.** If the user said "issue key" don't rename it "ticket ID." If they said "subagent" don't generalize to "helper agent." Technical terms anchor the prompt to the user's mental model.

---

## When to deviate from the skeleton

**Short prompts (one-shot, single-phase):** drop `<phases>`, `<dispatch_rule>`, `<gate>`, and most edge-case handlers. Keep `<task>`, `<scope>`, `<constraints>`, `<success_criteria>`. The skeleton is for prompts that do real work; a simple prompt just needs clear boundaries.

**Interview-style prompts:** add `<gate>` tags to enforce turn-taking. Move `<ambiguity_handling>` out of autonomy mode and into "ask the user" mode.

**Fully autonomous prompts:** require `<autonomy_guardrails>`, durable output files in each phase, and explicit DEFER buckets instead of user prompts.

**Multi-prompt suites:** extract shared blocks (philosophy, constraints) into identical copies across prompts. Consistency across the suite matters more than cleverness within any single prompt.

---

## Final check before delivery

Before returning the assembled prompt, walk the skeleton top to bottom and ask:

- Is `<task>` a single sentence that captures the thesis?
- Does `<philosophy>` explicitly block the most dangerous misinterpretations?
- Does each `<phase>` have a clear purpose, output, and hard rule?
- Do `<anti_patterns>` cover the plausible-but-wrong interpretations?
- Do `<success_criteria>` let you verify correctness post-run by inspection?
- Would removing any tag change the agent's behavior? If no, consider removing it.

The last check — the removal test — is the most important. Every tag should earn its place.