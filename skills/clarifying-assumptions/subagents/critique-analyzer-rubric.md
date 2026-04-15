# Critique Analyzer Rubric

Load this file before deciding what to critique.

## Upfront Mode Dimensions

In `MODE=upfront`, look for these categories:

- **Problem framing**
  - End user identification
  - Underlying need
  - Solution-problem fit
  - Evidence basis
  - Alternative approaches
- **Technology and architecture critique**
  - Framework or library choices
  - Architectural defaults
  - Dependency ordering assumptions
  - Scope decisions that hide trade-offs

## Critique Mode Dimensions

In `MODE=critique`, look for these categories:

- **Task-level critique**
  - Framework or library choices
  - Testing strategy
  - Refactoring scope
  - Implementation approach
- **User impact**
  - Latency, data freshness, workflow friction
  - Accessibility or reliability consequences
  - Trade-offs that conflict with the end user and need captured in the plan's
    problem framing

## Severity Rubric

Use the same labels across all categories, but interpret them in context.

| Severity | Meaning |
| --- | --- |
| `HIGH` | A core assumption is unvalidated, the default choice looks unjustified, or a clearly better fit exists for this project |
| `MEDIUM` | Real alternatives or trade-offs exist and were not considered deeply enough |
| `LOW` | Worth surfacing for awareness, but not obviously the wrong call |

Problem-framing items also map to tiers:

- `HIGH` → Tier 3 hard gate
- `MEDIUM` and `LOW` → Tier 2

## Do Not Raise

Do not raise an item when:

- The existing stack already constrains the decision and the plan respects that constraint
- The developer already resolved the concern in a prior decisions file
- The difference is purely stylistic and has no meaningful trade-off
- You cannot name a concrete alternative or explain why it matters

## Good Critique Characteristics

Each critique item should:

- Name the exact decision being challenged
- Explain why it looks questionable for this project
- Name concrete alternatives
- Explain what would need to be true for each option to be correct
- Tie the consequence back to user value or implementation cost
