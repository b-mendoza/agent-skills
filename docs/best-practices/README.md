# Best practices for skills and subagents

> Current-state reference: update this index when a rule is added, removed, or renamed.

Open the rule for the decision at hand. Record `pass`, `fail`, or `not applicable` per applicable rule.

- Mandatory: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.
- Recommended: expected for non-trivial skills; scope down with a stated reason.
- Reference: dated runtime facts. Mixed-tier files label their recommendation clauses.

| Rule | Applies when | Tier |
| --- | --- | --- |
| [declare-input-output-contracts](./declare-input-output-contracts.md) | Declaring or validating consumed inputs, replies, artifacts, or scripts | Mandatory |
| [declare-mutation-limits](./declare-mutation-limits.md) | Mutating files, authorizing actions, or storing run files | Mandatory |
| [describe-when-to-use](./describe-when-to-use.md) | Naming a skill/subagent or writing routing descriptions | Mandatory; naming preferences recommended |
| [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md) | Dispatching work or defining branches, loops, waits, and joins | Mandatory delegation/transitions; routing layout, registry, and job scoping recommended |
| [keep-skills-self-contained](./keep-skills-self-contained.md) | Referencing dependencies or other skills | Mandatory packaging; external-source handling recommended |
| [progressive-disclosure](./progressive-disclosure.md) | Adding, extracting, or removing package parts | Recommended |
| [treat-retrieved-content-as-data](./treat-retrieved-content-as-data.md) | Consuming external or retrieved evidence | Mandatory |
| [validate-by-observation](./validate-by-observation.md) | Verifying skill, subagent, or reference changes | Mandatory; declared no-case exception |
| [runtime-portability-matrix](./runtime-portability-matrix.md) | Choosing frontmatter, discovery, capabilities, or dispatch adapters | Reference |

## Package layout

`SKILL.md` holds identity, contracts, and routing. Conditional information and templates live in `references/`; output assets in `assets/`; deterministic validators and helpers in `scripts/`. Co-located `subagents/` files are dispatch prompts, not a runtime registry. See the matrix for runtime registration and size limits.
