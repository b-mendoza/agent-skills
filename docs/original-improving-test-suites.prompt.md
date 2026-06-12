<task>
  Improve an existing test suite into the smallest useful behavior-focused harness that protects public contracts, critical business logic, schema validation, security-sensitive behavior, meaningful failure handling, realistic edge cases, readability, and maintainability.
</task>

<inputs>
  <input name="TARGET_TEST_FILES" required="true">
    One path, multiple explicit paths, a directory, or a glob identifying the tests to improve.
  </input>
  <input name="USER_GOAL" required="false">
    A short user-facing goal such as "reduce brittle implementation-coupled tests".
  </input>
  <input name="TEST_COMMAND" required="false">
    The narrow command to validate the target suite, such as `pytest tests/test_billing.py -q`.
  </input>
  <input name="SCOPE_LIMITS" required="false">
    Any mutation boundary, such as "test files only".
  </input>
  <input name="REFERENCE_NEED" required="false">
    A testing topic that may require source-backed support, such as pytest parametrization.
  </input>
</inputs>

<dispatch_rule>
  The orchestrator thinks from compact reports, decides the minimal target harness, and dispatches focused subagents for raw file inspection, source lookup, test edits, command execution, and validation. Read a subagent definition only when dispatching that subagent, and retain only structured reports, fetched URLs, changed paths, blockers, and concise routing decisions.
</dispatch_rule>

<scope>
  <in_scope>
    - Normalize target tests, user goal, validation command, scope limits, and reference needs.
    - Read co-located skill files under `skills/improving-test-suites/`.
    - Dispatch the registered subagents: `test-value-reviewer`, `api-security-reviewer`, `test-maintainability-reviewer`, `test-refactorer`, and `test-validator`.
    - Edit target tests and directly related test helpers when a safe minimal harness decision justifies mutation.
    - Fetch a public URL from `references/external-sources.md` or a user-supplied official documentation URL only when it changes a concrete decision.
  </in_scope>
  <out_of_scope>
    - Broad implementation fixes unless `SCOPE_LIMITS` explicitly allows them and the user approves the expansion when required.
    - Unsupported external sources without user approval.
    - Exhaustive inventories when the user did not ask for one; reviewer reports keep each section to the top five highest-signal items.
    - Final user messaging by subagents; final handoff belongs to the orchestrator.
  </out_of_scope>
</scope>

<goal>
  Turn the named test suite into a smaller, clearer, higher-signal executable contract, or explain why no safe change, production-code fix, validation recovery, or continuation is justified.
</goal>

<philosophy>
  <core_principle>Treat tests as executable contracts, not coverage inventory.</core_principle>
  <what_it_means>A test earns its place when it would fail for a real break in public behavior, validation, security behavior, meaningful failure handling, or production-relevant edge cases.</what_it_means>
  <what_it_does_NOT_mean>It does not mean preserving tests that mainly protect private call order, trivial construction, incidental fixture shape, mock interaction order, internal layout, or coverage percentage.</what_it_does_NOT_mean>
  <rule_of_thumb>Prefer deleting, rewriting, or consolidating tests that cost more maintenance than the confidence they provide, while preserving high-value behaviors selected by the reviews.</rule_of_thumb>
</philosophy>

<context>
  This prompt represents the `improving-test-suites` skill as defined in `skills/improving-test-suites/SKILL.md`. Bundled paths are relative to the file that names them and must stay inside the skill folder. The skill is standalone: use only co-located files, public web URLs from `references/external-sources.md`, or an official documentation URL supplied by the user.
</context>

<phases>
  <phase id="1" name="intake" mode="inline">
    <purpose>Normalize target, goal, scope, command, and reference inputs before any delegated work.</purpose>
    <steps>
      <step id="1.1" name="normalize">Build a dispatch packet containing `TARGET_TEST_FILES`, `USER_GOAL`, `TEST_COMMAND`, `SCOPE_LIMITS`, `REFERENCE_NEED`, `HEURISTICS_PATH`, and the relevant report template path values.</step>
      <step id="1.2" name="target-gate">Ask one focused question only when `TARGET_TEST_FILES` is missing and cannot be inferred safely.</step>
      <step id="1.3" name="load-routing">Load `references/orchestration-protocol.md` after intake and before the first reviewer dispatch.</step>
    </steps>
    <output>A dispatch packet and the routing protocol needed for downstream status handling.</output>
    <gate>If the target tests are missing and not safely inferable, stop and hand off as `COMPLETE_BLOCKED`.</gate>
  </phase>

  <phase id="2" name="test-value-review" mode="subagent">
    <purpose>Identify low-value tests, high-value behaviors, missing high-value coverage, and follow-up review routes.</purpose>
    <steps>
      <step id="2.1" name="dispatch">Dispatch `subagents/test-value-reviewer.md` with `HEURISTICS_PATH=../references/test-quality-heuristics.md` and `REPORT_TEMPLATE_PATH=../references/test-value-review-template.md`.</step>
      <step id="2.2" name="inspect">The reviewer inspects each target test plus enough related production code to understand public behavior under test.</step>
      <step id="2.3" name="route">Route immediately on `VALUE_STATUS` from `TEST_VALUE_REVIEW`.</step>
    </steps>
    <output>`TEST_VALUE_REVIEW` with suite diagnosis, low-value tests, high-value behaviors, missing high-value tests, minimal target harness recommendations, and `API_SECURITY_REVIEW` / `MAINTAINABILITY_REVIEW` routing.</output>
    <gate>`PASS` continues; `BLOCKED` or `NEEDS_CLARIFICATION` hands off as `COMPLETE_BLOCKED`; `ERROR` hands off as `COMPLETE_ERROR`.</gate>
  </phase>

  <phase id="3" name="api-security-review" mode="subagent-when-routed">
    <purpose>Check API, schema, authorization, validation, unsafe-input, filesystem, network, permission, and security-sensitive coverage when required or useful.</purpose>
    <steps>
      <step id="3.1" name="decide-route">Set `API_ROUTE` to `required`, `optional`, or `not needed` from the value review and visible target or goal signals.</step>
      <step id="3.2" name="dispatch">For required or optional routes, dispatch `subagents/api-security-reviewer.md` with prior compact reports, heuristics, and `REPORT_TEMPLATE_PATH=../references/api-security-review-template.md`.</step>
      <step id="3.3" name="route-status">Route immediately on `API_STATUS` from `API_SECURITY_REVIEW`.</step>
    </steps>
    <output>`API_SECURITY_REVIEW`, `API_SECURITY_REVIEW: NOT_APPLICABLE`, or a recorded optional-review risk.</output>
    <gate>Required blockers, clarification needs, or errors stop with the matching handoff. Optional blockers or errors may be recorded as remaining risk only when value evidence is sufficient for a safe harness decision.</gate>
  </phase>

  <phase id="4" name="maintainability-review" mode="subagent-when-routed">
    <purpose>Check fixture design, mocking, duplication, readability, parametrization, and cognitive cost when required or useful.</purpose>
    <steps>
      <step id="4.1" name="decide-route">Set `MAINT_ROUTE` to `required`, `optional`, or `not needed` from the value review and visible target or goal signals.</step>
      <step id="4.2" name="dispatch">For required or optional routes, dispatch `subagents/test-maintainability-reviewer.md` with prior compact reports, heuristics, and `REPORT_TEMPLATE_PATH=../references/test-maintainability-review-template.md`.</step>
      <step id="4.3" name="route-status">Route immediately on `MAINT_STATUS` from `MAINTAINABILITY_REVIEW`.</step>
    </steps>
    <output>`MAINTAINABILITY_REVIEW` or a recorded optional-review risk.</output>
    <gate>Required blockers, clarification needs, or errors stop with the matching handoff. Optional blockers or errors may be recorded as remaining risk only when value evidence is sufficient for a safe harness decision.</gate>
  </phase>

  <phase id="5" name="synthesis" mode="inline">
    <purpose>Choose the smallest target harness from compact reports.</purpose>
    <steps>
      <step id="5.1" name="load-heuristics">Load `references/test-quality-heuristics.md` before synthesizing `MINIMAL_HARNESS_DECISION`.</step>
      <step id="5.2" name="apply-priority">Resolve trade-offs in this order: public contracts and production behavior; schema validation, security behavior, and meaningful failure handling; realistic edge cases and compatibility; readability and fixtures; coverage metrics.</step>
      <step id="5.3" name="decide">Record keep, rewrite, delete, consolidate, and add recommendations; public behavior contracts; failure modes to preserve; scope boundaries; materially used external URLs; and preferred validation command.</step>
      <step id="5.4" name="no-op-path">When no safe test or helper edit is justified, record no-op rationale, scope limits, optional-review risks, and fetched URLs, then validate with `CHANGED_FILES=none`.</step>
    </steps>
    <output>`MINIMAL_HARNESS_DECISION` or a no-op rationale.</output>
  </phase>

  <phase id="6" name="refactor" mode="subagent">
    <purpose>Apply approved minimal harness edits to tests and directly related test helpers.</purpose>
    <steps>
      <step id="6.1" name="scope-gate">Confirm the safe edit stays within tests and directly related helpers.</step>
      <step id="6.2" name="production-approval">Ask before production-code fixes; include target, reason, risk, reversibility, and safer alternative. If declined, hand off as `COMPLETE_PRODUCTION_BUG_EXPOSED` when applicable.</step>
      <step id="6.3" name="dispatch">Dispatch `subagents/test-refactorer.md` with `MINIMAL_HARNESS_DECISION`, concise review reports, any validation failure summary during repair, and `REPORT_TEMPLATE_PATH=../references/test-refactor-template.md`.</step>
      <step id="6.4" name="route-status">Route immediately on `REFACTOR_STATUS` from `TEST_REFACTOR`.</step>
    </steps>
    <output>`TEST_REFACTOR` with changed files, actions applied, production changes, unapplied decisions, potential production bugs, and suggested validation command.</output>
    <hard_rule>Keep implementation code unchanged unless scope explicitly allows implementation fixes.</hard_rule>
    <gate>`PASS` continues to validation; `BLOCKED` or `NEEDS_CLARIFICATION` hands off as `COMPLETE_BLOCKED`; `FAIL` either hands off as `COMPLETE_PRODUCTION_BUG_EXPOSED` or `COMPLETE_BLOCKED`; `ERROR` hands off as `COMPLETE_ERROR`.</gate>
  </phase>

  <phase id="7" name="validate" mode="subagent">
    <purpose>Run the narrow relevant test command after refactoring or after a no-op decision.</purpose>
    <steps>
      <step id="7.1" name="dispatch">Dispatch `subagents/test-validator.md` with target files, changed files or `none`, supplied or suggested command, scope limits, and `REPORT_TEMPLATE_PATH=../references/test-validation-template.md`.</step>
      <step id="7.2" name="command-selection">Use `TEST_COMMAND` when supplied, then `SUGGESTED_VALIDATION_COMMAND`, then an inferable narrow command from repository conventions.</step>
      <step id="7.3" name="classify">Classify validation failures as `test refactor regression`, `production bug exposed`, `pre-existing failure`, or `unknown` when evidence supports the classification.</step>
      <step id="7.4" name="route-status">Route immediately on `VALIDATION_STATUS` from `TEST_VALIDATION`.</step>
    </steps>
    <output>`TEST_VALIDATION` with command, result, likely cause, failure summary, recommended next action, reason, and decision needed.</output>
    <gate>`PASS` with changes hands off as `CHANGED_PASS`; `PASS` without changes hands off as `COMPLETE_NO_SAFE_CHANGE`; `BLOCKED` hands off as `COMPLETE_BLOCKED`; `ERROR` hands off as `COMPLETE_ERROR`; changed-file `FAIL` enters repair routing.</gate>
  </phase>

  <phase id="8" name="repair-or-handoff" mode="inline-dispatch">
    <purpose>Handle changed-file validation failures with targeted repair cycles or final handoff.</purpose>
    <steps>
      <step id="8.1" name="load-repair">Load `references/repair-protocol.md` only after changed-file validation fails, or while already in a repair cycle after a repair dispatch returns `BLOCKED` or repeated `ERROR`.</step>
      <step id="8.2" name="repair-count">Initialize `REPAIR_COUNT=0` for the current validation failure, increment immediately before each repair subagent dispatch or validation retry, and stop before a fourth repair attempt.</step>
      <step id="8.3" name="targeted-dispatch">Redispatch only the subagent that can fix or clarify the smallest failing gate, or retry only the failing validation command when command or environment instability is plausible.</step>
      <step id="8.4" name="final-template">Load `references/final-handoff-template.md` immediately before the final response and choose exactly one handoff status.</step>
    </steps>
    <output>One final handoff status: `CHANGED_PASS`, `COMPLETE_NO_SAFE_CHANGE`, `COMPLETE_PRODUCTION_BUG_EXPOSED`, `VALIDATION_FAILED_AFTER_REPAIR`, `COMPLETE_ERROR`, or `COMPLETE_BLOCKED`.</output>
    <gate>Stop repair when `REPAIR_COUNT` is three before another targeted repair attempt and report the remaining blocker or validation failure.</gate>
  </phase>
</phases>

<new_finding_rule>
  If review or refactor work exposes a likely production bug outside approved scope, keep the high-signal test decision visible and hand off as `COMPLETE_PRODUCTION_BUG_EXPOSED` rather than silently fixing implementation code.
</new_finding_rule>

<ambiguity_handling>
  Ask one focused question only when a missing target, public contract, scope decision, validation command, prerequisite, permission, or unsupported-source approval blocks safe routing. Otherwise continue from local code and bundled heuristics, recording assumptions or remaining risks in the final handoff.
</ambiguity_handling>

<autonomy_guardrails>
  Continue without network access when local code and bundled heuristics are sufficient. Do not guess freshness-sensitive framework behavior, SDK APIs, CLI syntax, or security guidance; record a freshness gap or block only when that information is essential to the concrete decision.
</autonomy_guardrails>

<anti_patterns>
  Do NOT:
  - Treat code coverage percentage as a reason to add tests when no named high-value behavior is protected.
  - Preserve implementation-detail assertions, private call-order checks, or incidental fixture shapes as if they were public contracts.
  - Dispatch API/security or maintainability review without routing it as `required`, `optional`, or `not needed`.
  - Continue after a subagent status without routing that status before the next phase.
  - Change production code unless `SCOPE_LIMITS` explicitly allows it and any required user approval has been recorded.
  - Fetch unsupported external sources or use generic web advice when local code, public contracts, and bundled heuristics are enough.
  - Rerun the whole workflow for a changed-file validation failure when the repair protocol calls for targeted repair.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="source-grounded">Base harness decisions on target tests, related production code, public contracts, bundled heuristics, co-located templates, and fetched URLs only when they materially influence a concrete decision.</constraint>
  <constraint id="2" name="progressive-loading">Load each subagent, reference, template, or external URL only at the point named by the skill's progressive disclosure map or subagent contract.</constraint>
  <constraint id="3" name="bounded-mutation">Mutate only target tests and directly related test helpers unless production-code scope is explicitly allowed and approved where required.</constraint>
  <constraint id="4" name="status-routing">After every subagent dispatch, route the returned status before doing the next phase.</constraint>
  <constraint id="5" name="template-backed-output">Use the matching report template immediately before each subagent report and use the final handoff template immediately before the final response.</constraint>
  <constraint id="6" name="external-source-discipline">Use `references/external-sources.md` or a user-supplied official documentation URL for source-backed decisions; ask before unsupported external source use.</constraint>
  <constraint id="7" name="compact-retention">The orchestrator retains compact reports, statuses, changed file paths, fetched URLs, blockers, and decision summaries, not raw logs or full analysis transcripts.</constraint>
</constraints>

<success_criteria>
  - `TARGET_TEST_FILES` was normalized or the run handed off as `COMPLETE_BLOCKED` with the smallest target question.
  - `TEST_VALUE_REVIEW` was dispatched first and its `VALUE_STATUS` was routed before any downstream review, synthesis, refactor, or validation phase.
  - API/security and maintainability reviews were routed as `required`, `optional`, or `not needed`, and optional blockers were recorded as remaining risk only when value evidence was sufficient.
  - `MINIMAL_HARNESS_DECISION` used the trade-off priority from `references/test-quality-heuristics.md`.
  - Test edits, if any, stayed within approved scope and were applied through `test-refactorer`.
  - Validation was attempted through `test-validator` with the supplied, suggested, or inferable narrow command, or the blocker was reported.
  - Changed-file validation failures entered targeted repair routing and stopped before a fourth repair attempt.
  - The final handoff used exactly one allowed status and included changed files or no-op rationale, validation command and result, external URLs that materially influenced decisions, remaining risks or scope limits, and approvals or blockers.
  - No unsupported external source, production-code edit, or unreviewed implementation assumption was introduced.
</success_criteria>

## Assembly Notes

### Sections Omitted
- `suite_context`: omitted because this source skill is a standalone skill package, not a member of a prompt suite with shared XML conventions.
- `empty_output_handling`: folded into `ambiguity_handling`, no-op synthesis, and final handoff requirements because the skill does not define a separate empty-output section beyond no-safe-change and no-findings-style template slots.

### Non-Obvious Decisions
- This was assembled as a full prompt-structurer flow because the target skill is multi-phase, mutating, status-routed, and delegates to subagents.
- The prompt repeats production-code mutation limits in scope, refactor, anti-patterns, constraints, and success criteria because the target skill treats that as a critical approval boundary.
- The final handoff statuses are preserved verbatim from the target skill and its final handoff template.

### Suite Alignment
- none

### Assumptions
- `TARGET_TEST_FILES` remains the only required runtime input because the target `SKILL.md` marks all other inputs optional.
- External URLs are not embedded in the executable prompt body except by reference to the target skill's source-routing file, matching the target skill's progressive disclosure model.

### Resources Used
- Local: `skills/improving-test-suites/SKILL.md`; `skills/improving-test-suites/subagents/*.md`; `skills/improving-test-suites/references/orchestration-protocol.md`; `repair-protocol.md`; `test-quality-heuristics.md`; report templates; `final-handoff-template.md`; `external-sources.md`; `flow-diagram.md`; prompt-structurer subagents and references.
- Web: `LOCAL_ONLY` for prompt assembly; external references were verified separately for `original-improving-test-suites.references.md`.

### Suggested Follow-Ups
- Compare this prompt against future changes to `skills/improving-test-suites/flow-diagram.md` if the skill's repair routing or handoff statuses change.
