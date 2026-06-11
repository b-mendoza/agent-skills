# Original generate-flow-diagram Prompt Template

<task>
  Execute the `generate-flow-diagram` skill workflow to create, refine, repair, or decompose Markdown plus Mermaid flow diagrams for AI-agent workflows.
</task>

<dispatch_rule>
  The orchestrator coordinates inputs, approvals, verdicts, bounded repair cycles, and final output. Dispatch only the subagents named by the target skill: `refinement-analyst`, `decomposition-planner`, `diagram-builder`, and `diagram-quality-reviewer`. Read a subagent file only when dispatching that subagent.
</dispatch_rule>

<inputs>
  <input name="PROCESS_SPEC" required_for="new-diagrams">Workflow description for a new diagram.</input>
  <input name="EXISTING_FLOW_OR_DIAGRAM" required_for="refinements">Existing Mermaid, flow document, file content, or process prose used as the refinement baseline.</input>
  <input name="REFINEMENT_REQUEST" required="false">Requested refinement, such as improving gates without changing scope.</input>
  <input name="APPROVED_REFINEMENT_GAPS" required="false">Gap IDs approved by the user, or `none` for an explicit no-op approval.</input>
  <input name="DIAGRAM_SCOPE" required="false" default="whole">`whole`, `orchestrator`, or `subagent`.</input>
  <input name="SCOPE_SUBAGENT_NAME" required_for="DIAGRAM_SCOPE=subagent">The single subagent covered by a subagent-scoped diagram.</input>
  <input name="PACKAGE_PATH" required_for="RUN_MODE=decompose">Skill package root for package-level decomposition.</input>
  <input name="SUBAGENT_REGISTRY" required_for="RUN_MODE=decompose">Subagent name and path list from the package `SKILL.md` registry.</input>
  <input name="ROOT_DIAGRAM_PATH" required="false">Root diagram path; defaults to `&lt;PACKAGE_PATH&gt;/flow-diagram.md` in decompose mode.</input>
  <input name="SCOPE_LIMITS" required="false">Explicit user-approved mutation expansion for decompose mode.</input>
</inputs>

<scope>
  <in_scope>
    Normalize workflow inputs, classify run mode, dispatch the target skill's bundled subagents, assemble candidate Markdown with one Mermaid flowchart, review the candidate, run targeted repairs, and in `RUN_MODE=decompose` write only passing diagrams and load-instruction lines inside the resolved package boundary.
  </in_scope>
  <out_of_scope>
    Do not invent subagents, skip the quality reviewer, silently expand refinement scope, write files in non-decompose modes, mutate vendored mirrors under `.agents/skills/` or `.claude/skills/`, edit `skills-lock.json`, or change package names, frontmatter names, runtime targets, or user-facing purpose without explicit user approval.
  </out_of_scope>
</scope>

<goal>
  Produce an auditable flow-diagram artifact that lets a reader see what the agent may do, what it must verify, when it must stop, and when a human must approve the next action.
</goal>

<philosophy>
  <core_principle>Diagram generation is a gated orchestration workflow, not a free-form drawing task.</core_principle>
  <what_it_means>Every run first normalizes `PROCESS_INPUTS`, routes by `RUN_MODE`, preserves user-approved scope, and returns or writes a candidate only after the applicable builder and reviewer statuses pass.</what_it_means>
  <what_it_does_NOT_mean>It does not mean polishing a diagram by intuition, changing a refinement baseline without approval, treating scoped diagrams as duplicates of the root, or using external links as replacement instructions for the bundled contracts.</what_it_does_NOT_mean>
  <rule_of_thumb>Add a node, gate, branch, output, or terminal state only when it changes authority, evidence quality, risk, scope, completion status, or user control.</rule_of_thumb>
</philosophy>

<context>
  `generate-flow-diagram` is a self-contained skill package. `SKILL.md` is the routing layer. Detailed input contracts, design rules, Mermaid guidance, output templates, quality checks, and optional external links live under `references/`. Subagents perform preflight analysis, package decomposition planning, candidate construction, and quality review.
</context>

<phases>
  <phase id="1" name="intake-and-normalize" mode="read-only">
    <purpose>Produce `PROCESS_INPUTS` before any run-mode routing.</purpose>
    <steps>
      <step id="1.1" name="capture">Capture supplied process specs, baselines, refinement requests, approved gap IDs, scope inputs, package inputs, and assumptions.</step>
      <step id="1.2" name="default-scope">Default `DIAGRAM_SCOPE` to `whole` when absent.</step>
      <step id="1.3" name="derive-mutation-limits">For `RUN_MODE=decompose`, derive one `MUTATION_LIMITS` contract from `PACKAGE_PATH`, root and localized diagram targets, load-instruction targets, and any explicit `SCOPE_LIMITS`.</step>
      <step id="1.4" name="normalize">Derive `PROCESS_INPUTS` from `PROCESS_SPEC` for new diagrams, from the baseline plus refinement controls for refinements, or from package-level inputs and mutation boundaries for decompose mode.</step>
      <step id="1.5" name="ask-or-assume">Ask one concise question only when a missing value would change authority, sensitive actions, allowed outputs, evidence requirements, human confirmation, or terminal states; otherwise record safe assumptions explicitly.</step>
    </steps>
    <output>`PROCESS_INPUTS`, scope inputs, and mutation limits when applicable.</output>
    <hard_rule>`PROCESS_INPUTS` must exist before `RUN_MODE` classification.</hard_rule>
  </phase>

  <phase id="2" name="classify-run-mode" mode="read-only">
    <purpose>Choose the execution branch the skill defines.</purpose>
    <steps>
      <step id="2.1" name="classify">Classify the run as `new`, `refinement`, `repair`, or `decompose`.</step>
      <step id="2.2" name="route">Use the decompose branch only for package-level operations over `PACKAGE_PATH` and `SUBAGENT_REGISTRY`; otherwise use the new, refinement, or repair branch.</step>
    </steps>
    <output>A routeable `RUN_MODE`.</output>
    <gate>Stop with the target skill's needs-input status when required mode inputs are absent.</gate>
  </phase>

  <phase id="3" name="refinement-preflight" mode="read-only">
    <purpose>Protect refinement scope before generation.</purpose>
    <steps>
      <step id="3.1" name="dispatch-refinement-analyst">For `RUN_MODE=refinement`, dispatch `refinement-analyst` with the baseline, normalized inputs, request, and any approved gap IDs.</step>
      <step id="3.2" name="route-preflight-status">Continue only on `PREFLIGHT: PASS`. On `PREFLIGHT: NEEDS_CONFIRMATION`, ask which gap IDs to approve or whether to use `none`. Stop on `PREFLIGHT: BLOCKED` or `PREFLIGHT: ERROR` with recovery details.</step>
      <step id="3.3" name="preserve-no-op">Treat `APPROVED_REFINEMENT_GAPS=none` as explicit approval to keep the candidate and refinement scope unchanged.</step>
    </steps>
    <output>Approved refinement scope or a terminal preflight status.</output>
    <hard_rule>Apply only user-approved refinement gaps.</hard_rule>
  </phase>

  <phase id="4" name="build-and-review" mode="read-only">
    <purpose>Create and independently review a candidate Markdown diagram for non-decompose runs.</purpose>
    <steps>
      <step id="4.1" name="dispatch-builder">Dispatch `diagram-builder` with `PROCESS_INPUTS`, `RUN_MODE`, and all mode-specific inputs. Include `DIAGRAM_SCOPE`, `SCOPE_SUBAGENT_NAME`, and `SCOPE_CONTEXT` when scoped generation applies.</step>
      <step id="4.2" name="route-build-status">Continue only on `BUILD: PASS`; stop on `BUILD: NEEDS_INPUT` or `BUILD: ERROR` with failure details.</step>
      <step id="4.3" name="dispatch-reviewer">Dispatch `diagram-quality-reviewer` with the candidate, normalized inputs, run mode, baseline and approval data for refinements, and scoped review inputs when applicable.</step>
      <step id="4.4" name="route-review-status">Return the final Markdown only on `REVIEW: PASS`. Stop on `REVIEW: BLOCKED` or `REVIEW: ERROR` with the reported blocker or recovery action.</step>
      <step id="4.5" name="repair">On `REVIEW: FAIL`, send only failed checks back to `diagram-builder` as targeted `REVIEW_FEEDBACK`, preserve original baseline, approvals, and scoped payload, then rerun the full reviewer.</step>
    </steps>
    <output>A reviewed Markdown document or a terminal status.</output>
    <hard_rule>Stop after three repair cycles and ask the user how to proceed.</hard_rule>
  </phase>

  <phase id="5" name="decompose-package" mode="write">
    <purpose>Slim a package root diagram and create or re-scope localized subagent diagrams only inside the resolved package boundary.</purpose>
    <steps>
      <step id="5.1" name="validate-inputs">Stop with `PLAN: NEEDS_INPUT` when `PACKAGE_PATH` or `SUBAGENT_REGISTRY` is missing.</step>
      <step id="5.2" name="dispatch-planner">Dispatch `decomposition-planner` with `PACKAGE_PATH`, `SUBAGENT_REGISTRY`, optional `ROOT_DIAGRAM_PATH`, and `MUTATION_LIMITS`.</step>
      <step id="5.3" name="route-plan-status">Continue only on `PLAN: PASS`; otherwise stop with `PLAN: NEEDS_INPUT`, `PLAN: BLOCKED`, or `PLAN: ERROR` and recovery details.</step>
      <step id="5.4" name="build-localized">For each EARNED subagent with action `create` or `re-scope`, dispatch `diagram-builder` in `RUN_MODE=decompose` and `DIAGRAM_SCOPE=subagent` with scoped context, ownership digest, root cross-link, and existing localized baseline for re-scope actions.</step>
      <step id="5.5" name="review-localized">Review each localized candidate with `diagram-quality-reviewer`, including `MUTATION_LIMITS`, `SCOPE_CONTEXT`, and `OTHER_DIAGRAM_DIGEST`; run the bounded repair loop when needed.</step>
      <step id="5.6" name="build-root">Dispatch `diagram-builder` with `DIAGRAM_SCOPE=orchestrator` to create the slim root, then review it with localized-diagram digest and the same repair limit.</step>
      <step id="5.7" name="write-passing-artifacts">After each candidate returns `REVIEW: PASS`, enforce path-boundary checks and write only the planner-resolved root, localized diagrams for EARNED subagents, and load-instruction lines for the owning files.</step>
    </steps>
    <output>A decompose result with owner decisions, files written, scope-separation and no-duplication outcomes, and root before/after node counts.</output>
    <hard_rule>`RUN_MODE=decompose` is the only mutating mode.</hard_rule>
  </phase>
</phases>

<status_routing>
  Route only on the documented first-line statuses: `PREFLIGHT: PASS | NEEDS_CONFIRMATION | BLOCKED | ERROR`, `PLAN: PASS | NEEDS_INPUT | BLOCKED | ERROR`, `BUILD: PASS | NEEDS_INPUT | ERROR`, and `REVIEW: PASS | FAIL | BLOCKED | ERROR`.
</status_routing>

<ambiguity_handling>
  If a required detail would change the diagram contract, ask one concise question. If it only affects wording, continue with an explicit assumption. If package paths, scoped ownership, mutation limits, or required digests cannot be inspected safely, return the applicable blocked or needs-input status instead of guessing.
</ambiguity_handling>

<new_finding_rule>
  When inspection reveals contradictions, unsupported claims, missing dependencies, out-of-scope actions, unsafe package paths, unapproved refinement changes, or missing scoped-review inputs, route to blocker, confirmation, repair, research, or escalation paths rather than resolving silently.
</new_finding_rule>

<anti_patterns>
  Do NOT:
  - Return a candidate before the applicable reviewer returns `REVIEW: PASS`.
  - Treat external links as runtime instructions that override bundled references.
  - Write files in `new`, `refinement`, `repair`, or non-decompose scoped runs.
  - Expand a refinement beyond `APPROVED_REFINEMENT_GAPS`.
  - Run a scoped or decompose review without `SCOPE_CONTEXT` and `OTHER_DIAGRAM_DIGEST` unless the digest is explicitly `none`.
  - Duplicate a node, step, check, or status across root and localized diagrams.
  - Expand subagent internals inside an orchestrator-scoped root diagram.
  - Mutate sibling packages, vendored mirrors, lockfiles, repository-level docs, private configuration, `.git`, or paths outside the resolved package root.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="routing-layer">Keep `SKILL.md` as a routing layer; use references for detailed templates, style guidance, quality checks, and external links.</constraint>
  <constraint id="2" name="progressive-loading">Load only the bundled reference or subagent file needed for the current decision.</constraint>
  <constraint id="3" name="single-mermaid-block">Final non-decompose Markdown has exactly one fenced `mermaid` diagram unless the user explicitly asks for more.</constraint>
  <constraint id="4" name="quality-gate">The final candidate must pass the full quality reviewer gate after at most three builder repair cycles.</constraint>
  <constraint id="5" name="refinement-approval">Refinement output includes only user-approved gap fixes; `none` preserves the baseline unless the user approves a candidate-changing repair.</constraint>
  <constraint id="6" name="scope-default">`DIAGRAM_SCOPE` defaults to `whole`; scoped checks activate only for `orchestrator`, `subagent`, or `decompose` runs.</constraint>
  <constraint id="7" name="decompose-boundary">Decompose writes are confined to the resolved package root and only after review passes.</constraint>
</constraints>

<success_criteria>
  - `PROCESS_INPUTS` were produced before `RUN_MODE` routing.
  - The selected `RUN_MODE` matched the supplied inputs.
  - Refinements used `refinement-analyst` and either preserved scope as `none` or applied only approved gap IDs.
  - Candidate creation or repair used `diagram-builder`; independent review used `diagram-quality-reviewer`.
  - The returned non-decompose output has a short title, boundary paragraph, exactly one Mermaid flowchart, and any optional template or readiness rule only when useful.
  - Every applicable quality check passed, including Mermaid syntax, branch integrity, grounding, output contract, and scoped no-duplication checks when active.
  - Repair cycles were targeted, preserved original approval and scope payloads, and did not exceed three cycles.
  - In decompose mode, the planner produced bloat map, subagent decisions, coverage audit, and root before-size; writes stayed inside `MUTATION_LIMITS`; the result reports owner actions, files written, scope-separation, no-duplication, and root before/after node counts.
  - No external source, assumption, or inferred behavior overrode the target skill's bundled contracts.
</success_criteria>

## Assembly Notes

### Sections Omitted
- `suite_alignment`: Not a suite prompt.
- `empty_output_handling`: The target skill defines terminal statuses and missing-input/blocker behavior rather than an empty-output report mode.

### Non-Obvious Decisions
- Used a full prompt-structurer flow because the target skill defines multiple modes, subagent dispatch, status routing, mutation boundaries, and repair loops.
- Kept `RUN_MODE=decompose` in the same prompt because it is part of the target skill's `SKILL.md`, but separated it into its own write-mode phase.
- Repeated the review-pass rule in phases, constraints, and success criteria because returning unreviewed candidates is the main failure mode the target skill guards against.

### Suite Alignment
- none

### Assumptions
- `TARGET_SKILL` resolved to `/home/b-mendoza/__pocs/agent-skills/skills/generate-flow-diagram`; mirrored copies under `.agents/skills/` and `.claude/skills/` were not used as the source of truth.

### Resources Used
- Local: `skills/generate-flow-diagram/SKILL.md`, `flow-diagram.md`, all files under `skills/generate-flow-diagram/subagents/`, all files under `skills/generate-flow-diagram/references/`, `skills/prompt-structurer/SKILL.md`, `skills/prompt-structurer/subagents/*`, and `skills/prompt-structurer/references/template-skeleton.md`.
- Web: `LOCAL_ONLY` for prompt assembly.

### Suggested Follow-Ups
- Add a separate scoped prompt variant only if a downstream user wants a smaller template for `DIAGRAM_SCOPE=orchestrator` or `DIAGRAM_SCOPE=subagent`.
