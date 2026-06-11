# Input Contract

> Load this file only when normalizing process source material, checking whether
> required process details are missing, validating decompose path boundaries, or
> drafting a clarification question.

## Source Policy

Every run must produce a `PROCESS_INPUTS` bundle before `RUN_MODE` routing. For
new diagrams, derive it from `PROCESS_SPEC`. For refinements, derive it from
`EXISTING_FLOW_OR_DIAGRAM`, `REFINEMENT_REQUEST`, any supplied `PROCESS_SPEC`,
and explicit assumptions. For decompose runs, derive it from `PACKAGE_PATH`,
`SUBAGENT_REGISTRY`, the resolved `ROOT_DIAGRAM_PATH`, `MUTATION_LIMITS`, the
allowed write targets, and the mutation-boundary assumptions. Do not require a
separate `PROCESS_SPEC` when the baseline or package-level decompose inputs
already provide enough process contract to review and preserve scope.

## Required Process Fields

Every `PROCESS_INPUTS` bundle includes these dispatch keys. Values may come from
explicit user wording or from explicit assumptions when the clarification policy
allows them. Ask for clarification when a missing value changes the diagram
contract.

| Field | Purpose | Example |
| ----- | ------- | ------- |
| `PROCESS_NAME` | Names the diagram and workflow boundary | `AI-assisted deployment review` |
| `AGENT_ROLE` | Identifies who performs the workflow | `Deployment reviewer` |
| `PRIMARY_OBJECTIVE` | States the main decision or outcome | `Decide whether a release candidate is safe` |
| `INPUTS` | Lists source artifacts or incoming data | `PR, CI results, changelog, rollback plan` |
| `OUTPUTS` | Names produced artifacts or comments | `Deployment readiness comment` |
| `ALLOWED_ACTIONS` | States actions the agent may perform | `Read artifacts, summarize risks, post comment` |
| `BOUNDARIES_OR_LIMITS` | States where the agent stops or recommends instead of acting | `No deploy, merge, or CI bypass` |
| `SENSITIVE_ACTIONS` | Names actions that require explicit approval | `Deploy, rollback, change feature flags` |
| `HUMAN_CONFIRMATION_REQUIREMENTS` | Defines approval timing and evidence | `Approval before recommending deploy` |
| `EVIDENCE_SOURCES` | Lists trusted sources for claims | `CI, incident history, runbooks` |
| `COMPLETION_CRITERIA` | Defines terminal outcomes | `Ready, blocked, needs validation, escalated` |

## Clarification Policy

Ask one concise question when any missing field would change authority, sensitive
actions, allowed outputs, evidence requirements, human confirmation, or terminal
states. If a missing value only affects wording, continue with an explicit
assumption in `PROCESS_INPUTS`.

## Dispatch Shape

Send subagents a concise `PROCESS_INPUTS` bundle containing:

- Normalized fields from the table above, using explicit assumptions where the
  clarification policy allows them.
- Supplied optional context from the user.
- Explicit assumptions.

Keep refinement controls outside `PROCESS_INPUTS`: send
`EXISTING_FLOW_OR_DIAGRAM` as the baseline for refinement runs, send
`REFINEMENT_REQUEST` as refinement control data, keep
`APPROVED_REFINEMENT_GAPS` as a separate dispatch input so approval scope is
visible to the builder and reviewer, and send `RUN_MODE` as its own dispatch
input.

## Diagram Scope

`DIAGRAM_SCOPE` controls how much of a workflow a single generated diagram
covers. It is a separate dispatch input, not a `PROCESS_INPUTS` field.

| Value | Diagram covers | Also requires |
| ----- | -------------- | ------------- |
| `whole` (default) | The entire workflow in one diagram: orchestration plus every subagent's internals. Current behavior. | Nothing extra |
| `orchestrator` | Orchestration only: phases, banners, human and self gates, dispatch points (one node per subagent, cross-linked to its localized diagram), orchestration-level status routing, handoffs, repair-loop control, and terminal states. | Nothing extra |
| `subagent` | One named subagent's internal flow only: entry, internal decision branches, internal checks or clusters, repair or precondition self-gates, routeable status emission, and report write. | `SCOPE_SUBAGENT_NAME` |

`DIAGRAM_SCOPE` defaults to `whole`. When `DIAGRAM_SCOPE` is absent or `whole`,
the builder and reviewer behave exactly as they do today. When it is
`orchestrator` or `subagent`, the scope-separation, no-duplication, and
dispatch-collapse checks become active. A `subagent`-scoped run that omits
`SCOPE_SUBAGENT_NAME` is a missing-field stop: return needs input naming the
absent subagent.

Supporting scoped inputs stay outside `PROCESS_INPUTS` and travel with the
dispatch that consumes them:

| Input | Required | Purpose |
| ----- | -------- | ------- |
| `SCOPE_CONTEXT` | Required for scoped or decompose generation when ownership cannot be derived from the request alone | Bloat-map slice, owned nodes, sibling cross-links, root cross-link, action (`create`, `re-scope`, or `keep`), and any baseline path needed to keep the generated diagram inside scope |
| `OTHER_DIAGRAM_DIGEST` | Required for scoped or decompose review when scope checks are active; explicit `none` is allowed only when there is no root or sibling content to compare | Labels, step descriptions, checks, and status lists already owned by the root or sibling diagrams, used by the reviewer to prevent duplication |
| `ROOT_DIAGRAM_RELATIVE_LINK` | Required for localized subagent diagram templates when the root path is non-default | Link from a localized subagent diagram file back to the planner-resolved `ROOT_DIAGRAM_PATH` |

For `RUN_MODE=decompose`, build `OTHER_DIAGRAM_DIGEST` from planned ownership,
not the raw pre-slim root alone. A subagent digest includes root and sibling
content but excludes the nodes planned for extraction into that subagent, so the
no-duplication check does not reject valid movement from the root to the localized
diagram.

## Decompose Mode Inputs

`RUN_MODE=decompose` is a package-level operation. It takes the inputs below
instead of a single `PROCESS_SPEC`.

| Input | Required | Purpose |
| ----- | -------- | ------- |
| `PACKAGE_PATH` | Yes | Root directory of the skill package to decompose |
| `SUBAGENT_REGISTRY` | Yes | The package's subagent list (name plus file path), normally read from the target `SKILL.md` registry table |
| `ROOT_DIAGRAM_PATH` | No | Path to the package's existing root diagram; default convention is `<PACKAGE_PATH>/flow-diagram.md` |
| `SCOPE_LIMITS` | No | Explicit user-approved mutation expansion beyond the default `MUTATION_LIMITS` |

Localized subagent diagrams follow the convention
`<PACKAGE_PATH>/subagents/<subagent-name>-flow-diagram.md`. The coverage audit
treats a subagent as already covered when its file loads a localized diagram
through a relative link.

## Default Mutation Limits

`RUN_MODE=decompose` is the only mutating mode. Before any planner, builder,
reviewer, or write phase runs, derive `MUTATION_LIMITS` once from
`PACKAGE_PATH`, the resolved `ROOT_DIAGRAM_PATH`, localized diagram targets,
load-instruction targets, and any explicit `SCOPE_LIMITS` expansion. Pass the
same contract to dispatched subagents instead of letting them re-derive scope.

Unless `SCOPE_LIMITS` explicitly expands the run, `MUTATION_LIMITS` allows these
mutations only after the relevant candidate passes the quality gate:

- Write only inside the resolved `PACKAGE_PATH` skill package.
- Write the planner-resolved root diagram and localized
  `subagents/<subagent-name>-flow-diagram.md` files.
- Edit only the load-instruction lines in the package `SKILL.md` and EARNED
  subagent files.
- Preserve directory names, frontmatter names, runtime targets, and user-facing
  purpose unless the user explicitly approves changing them.

Out of scope: sibling packages, `.agents/skills/`, `.claude/skills/`,
`skills-lock.json`, repository-level docs, private configuration, `.git`, paths
outside the resolved package root, and `.handoffs/` files this run did not create.
During repair cycles, tighten the allowed mutation set to files tied to the
failed checks, original decomposition plan, and approved scope. All other modes
(`new`, `refinement`, `repair`) and all non-`decompose` scoped runs are read-only
and only emit content. Runtime mapping: Claude Code uses Write and Edit tools
only inside `MUTATION_LIMITS`; OpenCode uses `edit` permission scoped to the same
target package.

Before any read or write in decompose mode, resolve `PACKAGE_PATH` against the
workspace and record the normalized package root. The resolved path must be an
existing skill package directory, must not be the repository root, must not use
path traversal, and must not escape through a symlink. Writes are allowed only
inside that resolved package root. Exclude `.git`, vendored skill mirrors such as
`.agents/skills` and `.claude/skills`, lockfiles, and paths outside the resolved
package root. Treat an unsafe or out-of-scope `PACKAGE_PATH` as blocked rather
than repairing around the boundary.

**Missing-field handling.** Return `NEEDS_INPUT` when the caller omitted
`PACKAGE_PATH` or `SUBAGENT_REGISTRY` for a decompose run, or when
`SCOPE_SUBAGENT_NAME` is missing for a `subagent`-scoped run. For scoped or
decompose generation, return `NEEDS_INPUT` when required `SCOPE_CONTEXT` cannot be
derived from the user request, bloat map, or package files. For scoped or
decompose review, return `BLOCKED` when required `OTHER_DIAGRAM_DIGEST` is missing
and not explicitly `none`. After path resolution, treat missing or unreadable
files under the resolved package root as blocked: the caller supplied the inputs,
but the package cannot be inspected or mutated safely. Name the absent input or
blocked path and the recovery action.
