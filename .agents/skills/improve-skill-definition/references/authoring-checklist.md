# Authoring Checklist

Read this file before audit and validation, or when applying a checklist-driven
fix. It is an operational gate, not a rationale library. For source-backed
background, current runtime docs, or longer explanations, load
`./external-sources.md` and fetch only the one URL needed for the decision.

## Material Issue Gate

Make a change only when it fixes a concrete problem in reliability, portability,
standalone packaging, context efficiency, maintainability, validation, or user
comprehension. Leave the package unchanged when proposed edits would only rename,
reshuffle, or polish content without changing behavior.

## Core Package Checks

| Area | Pass condition |
| ---- | -------------- |
| Frontmatter | `name` and `description` are portable; `name` matches the skill directory or subagent file basename |
| Skill body | `SKILL.md` is under 500 lines and limited to identity, inputs, outputs, routing, workflow, validation, and a concise example |
| Flow contract | `flow-diagram.md` is loaded as the source of truth when the skill has multi-phase, gated, or subagent-heavy behavior; semantic diagram changes are routed through `generate-flow-diagram` and accepted only after `REVIEW: PASS` |
| Flow coherence | `SKILL.md`, subagents, references, scripts, and templates use the same phases, gates, statuses, artifact paths, and subagent names as the approved flow diagram |
| Personality | Non-trivial skills either define `references/personality.md` or explicitly justify `NOT_APPLICABLE`; personality fits the skill purpose, audience, workflow, and artifact contracts |
| Paths | Bundled paths are relative to the file that names them, exist on disk, and stay inside the skill package |
| Mutation boundaries | Planned or completed edits stay inside user `SCOPE_LIMITS` and orchestrator `MUTATION_LIMITS`; broader sync or lockfile work is reported as blocked unless explicitly in scope |
| Standalone package | Runtime behavior does not depend on repository-local docs, absolute paths, private config, sibling skills, or unavailable files |
| Progressive disclosure | Detailed templates, long examples, source indexes, mode guides, and large checklists live in `references/` and load just in time |
| Subagents | Each subagent has explicit inputs, instructions, output format, scope, and escalation behavior, and earns its complexity with a distinct non-overlapping contract |
| Context protection | The orchestrator keeps verdicts, summaries, paths, and decisions; raw files, diffs, command output, and large pages stay in subagents |
| Approval gate | Structural mutations, personality decisions, subagent removals/merges, and non-trivial rewrites require explicit user approval before edits |
| Validation | Observable checks, approved-gap closure, targeted fix cycles, and retry limits exist when quality gates can fail |
| External sources | URLs are optional background or current-doc sources; essential execution rules stay bundled |

## Artifact Placement Rules

| Put content in | When |
| -------------- | ---- |
| `SKILL.md` | The orchestrator needs it for every run: identity, inputs, registry, routing, core workflow, and success criteria |
| `flow-diagram.md` | The deterministic execution flow, phases, gates, statuses, authority changes, and terminal states |
| `references/` | Content is static, detailed, template-like, example-heavy, source-backed, or needed only in one phase |
| `references/personality.md` | The skill's identity, operating posture, tone boundaries, and user-facing critique style |
| `subagents/` | Work is self-contained and the orchestrator only needs a concise summary, verdict, path, or artifact |
| `scripts/` | Deterministic parsing, validation, or transformation is safer as executable code than prose |

## Improvement Decision Tests

- Would the change make the skill more reliable, portable, standalone, compact,
  maintainable, verifiable, or understandable in a concrete way?
- Would deleting the proposed change make future runs worse?
- Does the current or proposed flow diagram actually govern execution, or is it
  decorative documentation?
- Does the personality make the skill more coherent for its purpose, or is it
  just tone cosplay?
- Does each subagent return something the orchestrator needs only as a bounded
  verdict or summary?
- Is the content being moved genuinely just-in-time, or is it only being moved
  to make the package look more architected?
- Can the package still run without fetching external URLs?
- Does the edit fit within the user scope and mutation limits?
- Is there an observable validation check for the claimed improvement?

If any answer argues against the edit, prefer `NO_CHANGE` or a smaller fix.

## No-Change Report Checks

A `NO_CHANGE` result should include files inspected, evidence that contracts,
paths, mutation boundaries, standalone packaging, and disclosure boundaries are
already adequate, optional improvements rejected, and validation limits.
