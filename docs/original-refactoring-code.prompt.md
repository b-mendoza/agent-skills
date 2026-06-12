<task>
  Coordinate one behavior-preserving code refactor for a required `TARGET_PATH`, using the `refactoring-code` skill's staged mapper, strategist, implementer, reviewer, and final handoff contracts.
</task>

<dispatch_rule>
  The orchestrator owns phase routing, gates, reference decisions, validation-contract selection, repair-loop control, and the final user-facing status. Dispatch exactly one focused subagent at a time, and read that subagent's file only immediately before dispatch:
  `behavior-mapper`, `refactor-strategist`, `refactor-implementer`, then `refactor-reviewer`. If subagent dispatch is unavailable, execute the loaded subagent instructions inline and preserve the same status and output contracts.
</dispatch_rule>

<scope>
  <in_scope>
    - Inspecting `TARGET_PATH`, direct callers, direct dependencies, nearby tests, changed files, relevant diffs, and file sizes needed for one refactor cycle.
    - Choosing and applying the smallest useful refactor that preserves observable behavior.
    - Splitting files when required by the `MAX_LINES` policy, while keeping the public surface stable.
    - Running only the approved safe validation command, or recording an explicit validation warning when validation is unavailable, unsafe, not run, or already failing.
    - Making mechanical test import, path, or name updates only when required by the approved behavior-preserving refactor.
    - Fetching optional public refactoring references only for a concrete strategy or review decision when allowed.
  </in_scope>
  <out_of_scope>
    - Changing observable behavior, public API shape, test intent, assertions, fixtures, snapshots, state assumptions, unrelated files, or unrelated worktree changes.
    - Normalizing an out-of-scope user goal into a refactor plan.
    - Running destructive or state-mutating validation without explicit approval.
    - Exceeding `MAX_LINES` without a strategist-recorded waiver and user approval.
    - Broad cleanup, design expansion, speculative abstractions, dependency changes, or feature work outside the approved strategy.
  </out_of_scope>
</scope>

<goal>
  Make the target code simpler, clearer, and more maintainable while preserving current behavior and leaving an auditable trail of behavior evidence, strategy, implementation, validation, review, file-size compliance, and remaining risks.
</goal>

<philosophy>
  <core_principle>Refactoring changes internal structure while preserving observable behavior.</core_principle>
  <what_it_means>Use local code evidence first, reduce cognitive load in the current code, and keep the refactor bounded to the smallest useful change.</what_it_means>
  <what_it_does_NOT_mean>It does not mean changing behavior, weakening tests, inventing future flexibility, or expanding scope because a broader cleanup looks helpful.</what_it_does_NOT_mean>
  <rule_of_thumb>If a planned or required change would alter behavior, public API, test intent, scope, state, unrelated worktree state, or file-size policy without approval, stop instead of broadening the refactor.</rule_of_thumb>
</philosophy>

<context>
  The `refactoring-code` skill is a portable orchestration skill for OpenCode and Claude Code. It holds only current phase, target path, decisions, statuses, and short reports in the orchestrator; detailed code inspection, edits, validation, review, examples, and conceptual guidance live in subagents or bundled references loaded just in time. `MAX_LINES` defaults to `250` per touched, changed, or created file.
</context>

<inputs>
  <input name="TARGET_PATH" required="true">Specific inspectable path to refactor.</input>
  <input name="USER_GOAL" required="false">User's desired refactor outcome, such as simplifying, cleaning up, or splitting code.</input>
  <input name="TEST_COMMAND" required="false">Preferred validation command.</input>
  <input name="SCOPE_LIMITS" required="false">Additional boundaries, such as keeping public APIs unchanged.</input>
  <input name="MAX_LINES" required="false" default="250">Per-file line ceiling for touched, changed, or created files.</input>
  <input name="REFERENCE_NEED" required="false">Concrete design or review question that may need external refactoring guidance.</input>
</inputs>

<phases>
  <phase id="1" name="behavior-map" mode="dispatch">
    <purpose>Create the factual baseline needed to refactor without guessing.</purpose>
    <steps>
      <step id="1.1" name="validate-target">If `TARGET_PATH` is missing, ambiguous, generated, or inaccessible, ask one focused question and stop as `NEEDS_CLARIFICATION`.</step>
      <step id="1.2" name="inspect">Dispatch `behavior-mapper` with `TARGET_PATH`, `USER_GOAL`, `TEST_COMMAND`, `SCOPE_LIMITS`, and `MAX_LINES`.</step>
      <step id="1.3" name="map-facts">Have the mapper inspect the target, direct callers, direct dependencies, existing tests, observable behavior, side effects, invariants, edge cases, validation options, and file sizes.</step>
      <step id="1.4" name="route-status">Continue on `BEHAVIOR_MAP: PASS` or `NO_CHANGE_CANDIDATE`; ask the mapper's one question on `NEEDS_CLARIFICATION`; stop as `ERROR` on mapper failure.</step>
    </steps>
    <output>`BEHAVIOR_MAP` with files inspected, current behavior, inputs and outputs, dependencies and side effects, invariants, tests, file sizes, risk notes, and clarifying questions.</output>
    <hard_rule>The mapper summarizes facts only; it does not diagnose design, edit code, or run validation.</hard_rule>
  </phase>

  <phase id="2" name="reference-decision" mode="inline-gate">
    <purpose>Resolve whether external refactoring guidance is needed for a concrete decision.</purpose>
    <steps>
      <step id="2.1" name="decide-need">Use the behavior map, current strategy/review question, and `REFERENCE_NEED` to choose one reference status: `not needed`, `bundled-local-only`, `fetched`, `declined-but-safe`, or `unavailable-but-safe`.</step>
      <step id="2.2" name="load-router">Load `./references/refactoring-web-resources.md` only when a concrete strategy or review decision needs conceptual support.</step>
      <step id="2.3" name="fetch-if-allowed">Fetch the smallest matching public URL set only when public web access is allowed and useful for that decision.</step>
      <step id="2.4" name="block-if-needed">Stop with `BLOCKED` only when a required public source is declined or unavailable and local evidence is insufficient for a safe decision.</step>
    </steps>
    <output>Reference status and any fetched URLs for downstream strategy or review reports.</output>
    <hard_rule>Use fetched guidance to justify the minimal plan, never to broaden scope.</hard_rule>
  </phase>

  <phase id="3" name="strategy" mode="dispatch">
    <purpose>Decide whether a refactor is worth doing and define the smallest behavior-preserving target design.</purpose>
    <steps>
      <step id="3.1" name="dispatch">Dispatch `refactor-strategist` with the behavior map, scope, goal, `MAX_LINES`, `REFERENCE_NEED`, reference status, `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`, and `FILE_SIZE_POLICY_PATH=./references/file-size-policy.md`.</step>
      <step id="3.2" name="diagnose-current-problems">Identify only design problems proven by the behavior map or code.</step>
      <step id="3.3" name="plan-minimal-change">Choose the smallest target design that clarifies current behavior, including any split required by file size or architecture.</step>
      <step id="3.4" name="state-non-goals">Name files, APIs, layers, test intent, behavior, public surfaces, state, and abstractions that remain unchanged.</step>
      <step id="3.5" name="route-status">Continue on `STRATEGY: PASS`; stop without editing on `NO_CHANGE`; ask or report recovery on `NEEDS_CLARIFICATION` or `ERROR`.</step>
    </steps>
    <output>`STRATEGY` with design diagnosis, minimal plan, file size plan, waivers, non-goals, implementation constraints, validation expectations, rationale, reference status, and fetched URLs if any.</output>
    <hard_rule>Return `NEEDS_CLARIFICATION` when the user's goal requires behavior, API, test-intent, fixture, snapshot, assertion, scope, state, or unrelated worktree changes.</hard_rule>
  </phase>

  <phase id="4" name="scope-size-test-and-validation-gates" mode="inline-gate">
    <purpose>Confirm the plan remains inside the behavior-preserving boundary before edits begin.</purpose>
    <steps>
      <step id="4.1" name="scope-gate">Stop with `BLOCKED` if the plan requires behavior, public API, test-intent, scope, state, or unrelated worktree changes.</step>
      <step id="4.2" name="size-gate">If `STRATEGY` records a file-size waiver, ask for user approval before implementation uses it.</step>
      <step id="4.3" name="test-boundary-gate">Allow only mechanical test import, path, or name updates required by the approved refactor; protect test assertions, expectations, fixtures, and snapshots.</step>
      <step id="4.4" name="validation-contract">Choose the validation contract from the user's `TEST_COMMAND`, the mapper's suggested command, the smallest discoverable safe check, or an explicit validation warning.</step>
      <step id="4.5" name="destructive-validation-gate">Ask before any destructive or state-mutating validation command; stop with `BLOCKED` if approval is declined or missing.</step>
    </steps>
    <output>Approved validation contract or explicit validation warning, plus any approved file-size waiver.</output>
    <hard_rule>No implementation starts until scope, size, test-boundary, and validation gates are resolved or recorded as warnings.</hard_rule>
  </phase>

  <phase id="5" name="implementation" mode="dispatch">
    <purpose>Apply the approved strategy or targeted reviewer fixes with the smallest safe code changes.</purpose>
    <steps>
      <step id="5.1" name="dispatch">Dispatch `refactor-implementer` with the behavior map, strategy, validation contract, `MAX_LINES`, reference status, and `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`.</step>
      <step id="5.2" name="preserve-worktree">Inspect each file before touching it and preserve unrelated existing changes.</step>
      <step id="5.3" name="apply-plan">Modify only files justified by the strategy or direct compilation consequences. When splitting, place new files according to project architecture and keep the original public entry point stable.</step>
      <step id="5.4" name="measure-size">Measure every changed or created file after edits; if a file exceeds `MAX_LINES` without a strategy waiver, complete the split or return `BLOCKED`.</step>
      <step id="5.5" name="validate">Run only the approved validation command. If validation fails, make one narrow in-strategy fix and rerun the same command; otherwise return `BLOCKED` if the failure requires a broader decision.</step>
      <step id="5.6" name="route-status">Continue on `IMPLEMENTATION: PASS` or `PASS_WITH_WARNINGS`; stop and report reason, touched files, and recovery on `BLOCKED` or `ERROR`.</step>
    </steps>
    <output>`IMPLEMENTATION` with files changed and created, changes made, behavior preservation, file sizes, validation contract, command result, deviations, and reviewer focus.</output>
    <hard_rule>When `REVIEW_FIXES` is supplied, address only those findings.</hard_rule>
  </phase>

  <phase id="6" name="review" mode="dispatch">
    <purpose>Independently verify behavior preservation, scope control, test integrity, abstraction discipline, validation quality, and file-size compliance before final handoff.</purpose>
    <steps>
      <step id="6.1" name="dispatch">Dispatch `refactor-reviewer` with the behavior map, strategy, implementation report, validation contract, `MAX_LINES`, reference status, `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`, and `FILE_SIZE_POLICY_PATH=./references/file-size-policy.md`.</step>
      <step id="6.2" name="review-diff">Compare changed files and relevant diff against behavior map, strategy, implementation report, validation contract, and file-size policy.</step>
      <step id="6.3" name="route-pass">On `REFACTOR_REVIEW: PASS`, proceed to final handoff.</step>
      <step id="6.4" name="route-fail">On `FAIL`, redispatch the implementer with only reviewer-required fixes that remain behavior-preserving and inside the approved strategy.</step>
      <step id="6.5" name="limit-fixes">Use at most two targeted implementer/reviewer fix cycles. Stop with `BLOCKED` if a required fix changes behavior, public API, test intent, scope, state, unrelated worktree state, or needs an unapproved file-size waiver.</step>
      <step id="6.6" name="route-error">On `ERROR`, report recovery without approving the refactor.</step>
    </steps>
    <output>`REFACTOR_REVIEW` with verdicts for behavior preservation, test integrity, scope control, abstraction, size, validation, validation contract, required fixes, and residual risks.</output>
    <hard_rule>Do not approve behavior, public API, test-intent, scope, state, or unrelated worktree changes inside this workflow.</hard_rule>
  </phase>

  <phase id="7" name="handoff" mode="inline">
    <purpose>Return the user-facing result in the skill's exact statused shape.</purpose>
    <steps>
      <step id="7.1" name="status-line">Start with exactly one status line: `Status: PASS | NO_CHANGE | NEEDS_CLARIFICATION | BLOCKED | ERROR`.</step>
      <step id="7.2" name="pass-handoff">For `PASS`, include current behavior summary, design diagnosis, code changes made, validation note, review outcome and remaining risks, file-size compliance summary, and brief improvement summary.</step>
      <step id="7.3" name="non-pass-handoff">For `NO_CHANGE`, `NEEDS_CLARIFICATION`, `BLOCKED`, or `ERROR`, include the smallest stopping reason, next decision needed, validation already completed, and remaining risks.</step>
    </steps>
    <output>Final user-facing handoff only; no raw code dumps, no raw diffs, and no unnecessary subagent transcript.</output>
  </phase>
</phases>

<ambiguity_handling>
  Ask one focused question only when the missing answer prevents safe target resolution, behavior mapping, strategy, public-reference use, file-size waiver approval, validation approval, or review-fix authorization. Preserve ambiguity as a risk or blocker rather than guessing.
</ambiguity_handling>

<new_finding_rule>
  If inspection reveals required behavior changes, public API changes, test-intent changes, unrelated worktree conflicts, unsafe validation, size overages without waiver, or strategy contradictions, stop at the owning phase and report the smallest decision needed. Do not repair the issue by expanding the refactor silently.
</new_finding_rule>

<anti_patterns>
  Do NOT:
  - Change observable behavior while calling the work a refactor.
  - Weaken, rewrite, or update test assertions, fixtures, snapshots, or expected behavior inside this workflow.
  - Introduce a speculative abstraction, interface, factory, registry, or service wrapper just to make the design feel more architectural.
  - Fetch public references as decoration or use them to broaden the plan beyond local code evidence.
  - Touch unrelated files or overwrite unrelated worktree changes.
  - Run a different validation command than the approved validation contract.
  - Ignore `MAX_LINES` or treat an unrecorded overage as acceptable.
  - Continue past a reviewer failure by summarizing the risk instead of running the allowed targeted fix loop or stopping.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="target-required">`TARGET_PATH` is required before dispatch.</constraint>
  <constraint id="2" name="one-target-cycle">Run one complete cycle per target unless the user asks for a broader pass.</constraint>
  <constraint id="3" name="behavior-preservation">Observable behavior, public APIs, state assumptions, side effects, and edge cases remain stable.</constraint>
  <constraint id="4" name="test-intent-boundary">Test intent changes are outside this workflow; only required mechanical test import, path, or name updates are allowed and must be reported and reviewed.</constraint>
  <constraint id="5" name="file-size-rule">Every touched, changed, or created file stays at or below `MAX_LINES` default `250`, unless `STRATEGY` records a permitted waiver and the user approves it.</constraint>
  <constraint id="6" name="just-in-time-loading">Load subagent files and references only at their decision points.</constraint>
  <constraint id="7" name="reference-status">Resolve reference status before strategy or review continues.</constraint>
  <constraint id="8" name="validation-contract">Select the validation contract before implementation and have the implementer run only that command or record the selected warning.</constraint>
  <constraint id="9" name="review-required">Build a `PASS` handoff only after implementation has run validation or recorded a validation warning and `refactor-reviewer` returns `PASS`.</constraint>
  <constraint id="10" name="fix-cycle-limit">Use at most two targeted fix cycles after review failure.</constraint>
</constraints>

<success_criteria>
  - The final response starts with exactly one allowed status line.
  - `BEHAVIOR_MAP`, `STRATEGY`, `IMPLEMENTATION`, and `REFACTOR_REVIEW` were produced or the run stopped at the earliest blocking status with the required recovery information.
  - The strategy is grounded in the behavior map and names only current design problems.
  - No behavior, public API, test-intent, scope, state, or unrelated worktree change occurred without stopping as blocked or needing clarification.
  - Any external references were fetched only for a concrete decision and reported by URL, or the reference status states why none were fetched.
  - The validation note matches the pre-implementation validation contract and records tests run, tests not run, pre-existing failures, and behavior-preservation evidence.
  - Every touched, changed, or created file is at or below `MAX_LINES`, or every overage has a strategist-recorded and user-approved waiver.
  - Review passed behavior preservation, test integrity, scope control, abstraction, size, validation, and validation-contract checks, or the run stopped with required fixes and remaining risks.
  - The final `PASS` handoff includes current behavior summary, design diagnosis, code changes, validation note, review outcome and risks, file-size compliance, and improvement summary.
</success_criteria>

## Assembly Notes

### Flow Used
- `full`; trigger: the source skill has ordered phases, delegation, file mutation, validation, review, repair loops, gates, and output contracts.

### Passes Skipped
- none

### Sections Omitted
- Suite alignment: none supplied.
- Empty-output handling: no zero-result report category exists beyond the skill's `NO_CHANGE` and non-pass status contracts.
- External rationale for prompt structure: local `prompt-structurer` references were sufficient.

### Non-Obvious Decisions
- The prompt keeps the source skill's exact status tokens: `BEHAVIOR_MAP`, `STRATEGY`, `IMPLEMENTATION`, `REFACTOR_REVIEW`, and final `Status: ...`.
- File-size, validation, reference, and review-fix gates are repeated at the point where violating them would cause behavior drift.
- The prompt treats public-reference fetching as an execution gate because the skill does the same in its reference decision and strategist/reviewer contracts.

### Removal-Test Table
| Tag | Behavior Lost If Removed |
| --- | ------------------------ |
| `<task>` | The prompt would not state the behavior-preserving refactor objective. |
| `<dispatch_rule>` | Delegation timing and subagent loading could become ambiguous. |
| `<scope>` | The agent could broaden into feature work, test rewrites, or unrelated cleanup. |
| `<goal>` | The human outcome would be reduced to mechanical phase completion. |
| `<philosophy>` | The meaning of refactoring and minimality would be less explicit. |
| `<context>` | Runtime portability, just-in-time loading, and `MAX_LINES` default would be easy to miss. |
| `<inputs>` | Required and optional skill inputs would be less discoverable. |
| `<phases>` | The ordered mapper-strategist-implementer-reviewer workflow and routing statuses would be lost. |
| `<ambiguity_handling>` | Missing decisions might be guessed instead of surfaced. |
| `<new_finding_rule>` | Out-of-scope findings might be silently absorbed into implementation. |
| `<anti_patterns>` | Plausible wrong paths would lack auditable negative checks. |
| `<constraints>` | Cross-phase rules would not be inspectable by stable ids. |
| `<success_criteria>` | A reader could not audit whether a run actually followed the skill. |

### Suite Alignment
- none

### Assumptions
- `TARGET_PATH` and other inputs are supplied by the user at run time; this document describes the skill contract rather than a specific refactor run.

### Resources Used
- Target source: `skills/refactoring-code/SKILL.md`; `skills/refactoring-code/subagents/behavior-mapper.md`; `skills/refactoring-code/subagents/refactor-strategist.md`; `skills/refactoring-code/subagents/refactor-implementer.md`; `skills/refactoring-code/subagents/refactor-reviewer.md`; `skills/refactoring-code/references/file-size-policy.md`; `skills/refactoring-code/references/refactoring-web-resources.md`; `skills/refactoring-code/references/workflow-examples.md`; `skills/refactoring-code/flow-diagram.md`.
- Prompt-structurer load log: `prompt-structurer/SKILL.md`; all six prompt-structurer subagents; `references/failure-modes.md`; `references/tag-taxonomy.md`; `references/template-skeleton.md`; `references/web-resource-index.md`.
- Web: `LOCAL_ONLY` for prompt assembly rationale.

### Dispatch And Handoff
- Dispatch: inline fallback, using loaded subagent instructions as pass contracts.
- Handoff: inline named sections, assembled into this file.

### Suggested Follow-Ups
- Run the prompt contract against a small known refactor and compare the resulting handoff to the skill's `workflow-examples.md`.
