# Tag Taxonomy

This is the complete catalog of tags used in structured XML prompts, with the purpose of each tag and guidance on when to use it. The conversion process maps prose content into these tags.

Not every prompt needs every tag. Running the full taxonomy as a mental checklist forces a conscious decision about whether to include or omit each section.

---

## Core structural tags

### `<task>`
One sentence describing what the prompt accomplishes. The single thesis statement. Always present.

**Test:** If you had to summarize the prompt in a tweet, this is that tweet.

### `<scope>`
What's in-bounds for the task: files, systems, entities, skills. Defines the boundary of where the agent should look and touch.

**Test:** If the agent asks "should I look at file X?", the answer should be derivable from `<scope>`.

### `<goal>`
The outcome in human terms — what success looks like from the user's perspective. Distinct from mechanical `<success_criteria>`. This is aspirational; success criteria are checkable.

**Test:** This explains *why* the task matters; success criteria explains *how you'd verify* it.

### `<context>` / `<problem_context>`
Background the agent cannot infer from the task alone. History, current state, constraints imposed by prior decisions.

**Test:** If the agent would do the wrong thing without this information, it belongs here.

---

## Behavioral framing

### `<philosophy>` / `<principles>`
The mental model the agent should adopt. Shapes how everything else is interpreted.

Often contains nested tags:
- `<core_principle>` — the single most important framing idea
- `<what_it_means>` — positive restatement of the approach
- `<what_it_does_NOT_mean>` — common misinterpretations to block (the negative tag name matters)
- `<rule_of_thumb>` — a quick decision heuristic

**Test:** If two agents could interpret the same rule differently based on their priors, philosophy is what disambiguates them.

**Distinction from constraints:** Philosophy shapes interpretation; constraints prohibit or require specific actions.

### `<constraints>`
Rules that apply throughout the task. Usually numbered and named. Each constraint has an ID, a name, and a description.

**Test:** If the instruction starts with "always" or "never" and applies broadly, it's a constraint.

**Distinction from hard rules:** Constraints are the rules of play; hard rules are non-negotiables with teeth.

### `<hard_rule>` / `<hard_rules>`
The non-negotiables. Override everything else if there's a conflict. Typically scoped to a specific phase or location in the prompt.

**Test:** If violating this would mean the task failed entirely, it's a hard rule.

---

## Workflow structure

### `<phases>` / `<phase>` / `<method>` / `<steps>`
The sequence of work. Phases for multi-stage workflows; steps for single-stage ordered actions.

A `<phase>` typically contains:
- `id` and `name` attributes
- `<purpose>` — what this phase accomplishes
- `<steps>` or inline instructions
- `<output>` — deliverables
- `<hard_rule>` — phase-specific absolutes
- `<gate>` — stop conditions before next phase

### `<dispatch_rule>`
When using subagents, how work is distributed. Hoist this to the top of the prompt so it can't be forgotten mid-run.

### `<gate>`
An explicit stop condition. Distinct from a rule because it represents halt-and-wait behavior, not continuous prohibition.

**Test:** If the agent should stop and wait here, it's a gate.

---

## Output specification

### `<output>`
What deliverables the phase or task produces. Can include file paths, formats, structure requirements.

### `<output_file>`
When the deliverable is a file, specifies the path, naming pattern, and location rules.

### `<required_contents>`
When an output has a specific structure, enumerates what must be included.

---

## Edge case handling

### `<anti_patterns>`
Explicit list of things NOT to do that would look like completing the task. Preventive — blocks common misinterpretations at the source.

**Test:** If the agent could plausibly do X and think it was fulfilling the task, but X is wrong, it goes here.

### `<new_finding_rule>`
What to do when the agent discovers something the prompt didn't anticipate. Channels the unexpected into an auditable path instead of silent guessing.

**Test:** If reality doesn't match what this prompt predicted, what should happen?

### `<ambiguity_handling>`
What to do when multiple interpretations are plausible. Often paired with autonomy guardrails to say "defer, don't guess, don't ask."

**Test:** When facing a coin-flip between two reasonable readings, what's the fallback?

### `<autonomy_guardrails>`
Rules for autonomous runs that keep the agent from asking the user mid-run. Usually includes "never ask, defer instead" and traceability requirements.

**Test:** If the prompt runs without a human present, what rules prevent it from stalling or silently drifting?

---

## Verification

### `<success_criteria>`
Checkable statements of done. The self-audit checklist. Every constraint, anti-pattern, and phase should have a corresponding criterion.

Good criteria are:
- **Specific and observable** — "The spec file exists at `@docs/...`" not "the spec is complete."
- **Exhaustive** across the task's important dimensions
- **Mixed positive and negative** — "X happened" AND "Y did not happen"
- **Ordered by workflow** so they walk top-to-bottom as a post-run audit

**Test:** After the run, could you walk down this list and confirm each item by inspection?

---

## Reference-only tags

These rarely define behavior but clarify the structure:

### `<reference_material>` / `<documents>`
Files the agent should consult as context, not instructions to execute.

### `<scope>` sub-tags
`<in_scope>`, `<out_of_scope>` — explicit boundary markers when scope is contested.

---

## Tag selection heuristics

**When adding a tag, ask:**
- Does this information have a home in an existing tag?
- If not, is this a new *kind* of instruction that deserves its own tag?
- Would the agent treat this differently if it were in a different tag?

**When omitting a tag, ask:**
- Is the information that would go here implicit in the rest of the prompt?
- Could the agent derive the right behavior without this tag?
- Is this a case where explicitness would feel like over-specification?

Default to including tags when the decision is close. Over-specification is recoverable; under-specification causes silent drift.