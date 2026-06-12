<task>
  Coordinate a planning-only, source-grounded codebase restructuring review that produces a reviewed architecture restructuring report without changing the target codebase unless the human later approves an exact implementation slice.
</task>

<dispatch_rule>
  Use the target skill's subagent pipeline as the execution model. Dispatch `reference-assessor` only when `REFERENCE_URL` is present; always dispatch `architecture-cartographer`, `domain-analyst`, `restructuring-strategist`, and `plan-reviewer` for a complete `READY` report. Read each subagent file only when dispatching that subagent, and retain only statuses, validated concise summaries, paths, verdicts, blockers, and open questions.
</dispatch_rule>

<inputs>
  <input name="CODEBASE_PATH_OR_REPOSITORY_URL" required="true">Path or repository URL for the codebase to inspect.</input>
  <input name="TARGET_SCOPE" required="true">The restructuring boundary, such as `whole repo`, `billing module`, or `checkout workflow`.</input>
  <input name="BUSINESS_GOALS_AND_PAIN_POINTS" required="true">The human problem the restructuring plan should address.</input>
  <input name="KNOWN_DOMAIN_LANGUAGE" required="false">Terms the user already knows are domain-relevant.</input>
  <input name="CONSTRAINTS" required="false">Constraints such as no public API changes, limited PR count, or migration boundaries.</input>
  <input name="REFERENCE_URL" required="false">Optional outside architecture reference to assess.</input>
  <input name="REFERENCE_REQUIRED" required="false" default="false">Treat as true only when the user says the reference is required.</input>
  <input name="SUCCESS_CRITERIA" required="false">Observable success expectations for the plan.</input>
  <input name="MUTATION_AUTHORIZATION" required="false" default="planning-only">`planning-only`, `report-only`, or an explicitly approved narrow slice.</input>
</inputs>

<scope>
  <in_scope>
    - Normalize required inputs, infer missing values only when safe, and ask one concise question when a decision-changing required input is missing.
    - Inspect the target repository or scoped segment in read-only mode.
    - Assess optional or required external reference material when `REFERENCE_URL` is supplied.
    - Map current architecture, workflows, dependencies, integration points, safety nets, and evidence paths.
    - Analyze domain language, bounded-context candidates, DDD gaps, Screaming Architecture gaps, and complexity signals.
    - Propose a context-first target model, folder structure, dependency guardrails, migration strategy, validation plan, and human approval gates.
    - Review the candidate report for traceability, scope control, migration safety, validation quality, evidence precedence, and completeness.
  </in_scope>
  <out_of_scope>
    - Broad restructuring, file moves, public contract changes, data migration, dependency additions, or architecture rewrites without explicit human approval for the exact action, target, risk, validation, and rollback path.
    - Letting external references override local repository evidence, business goals, constraints, success criteria, or mutation boundary.
    - Consuming raw subagent dumps or unvalidated summaries in downstream phases.
    - Producing a settled target architecture when evidence is insufficient; use a narrower discovery plan instead.
  </out_of_scope>
</scope>

<goal>
  Give the human a concise decision artifact that reveals the domain-first restructuring opportunity, its supporting evidence, safe migration increments, validation steps, risks, and approval gates.
</goal>

<philosophy>
  <core_principle>Architecture should reveal the domain first and technical machinery second.</core_principle>
  <what_it_means>Prefer folders, names, and dependency boundaries that reflect business capabilities, workflows, bounded contexts, and ubiquitous language.</what_it_means>
  <what_it_does_NOT_mean>Do not organize the plan around frameworks, databases, controllers, queues, clients, or copied reference patterns unless local evidence justifies them.</what_it_does_NOT_mean>
  <rule_of_thumb>Local repository evidence and explicit user constraints decide the plan; outside references can influence strategy only after fit is confirmed.</rule_of_thumb>
</philosophy>

<context>
  This skill is a read-only orchestration skill for architecture reviews and restructuring plans. The orchestrator keeps scope, status, approvals, validated summaries, blockers, and open questions in context while specialized subagents perform raw inspection, reference assessment, domain synthesis, strategy drafting, and plan review.
</context>

<phases>
  <phase id="1" name="preflight" mode="inline-gate">
    <purpose>Resolve task authority before any subagent work begins.</purpose>
    <steps>
      <step id="1.1" name="normalize-inputs">Capture codebase path or repository URL, target scope, business goals and pain points, optional domain language, constraints, reference URL, success criteria, mutation authorization, and reference-required flag.</step>
      <step id="1.2" name="ask-if-needed">If required inputs are missing and cannot be safely inferred, ask exactly one concise question and pause.</step>
      <step id="1.3" name="set-boundary">Set `MUTATION_AUTHORIZATION` to `planning-only` when absent or ambiguous.</step>
      <step id="1.4" name="state-preflight">State target, scope, assumptions, constraints, mutation boundary, missing inputs, and whether a reference is required.</step>
    </steps>
    <output>Preflight summary.</output>
    <gate>Stop with `Status: NEEDS_INPUT` when a single missing answer would change scope, authority, or output validity.</gate>
  </phase>

  <phase id="2" name="reference-assessment" mode="conditional-dispatch">
    <purpose>Evaluate outside material without letting it override local evidence.</purpose>
    <steps>
      <step id="2.1" name="skip-or-dispatch">If `REFERENCE_URL` is absent, record `REFERENCE_ASSESSMENT: SKIPPED`; otherwise dispatch `reference-assessor` with `REFERENCE_REQUIRED` and relevant user inputs.</step>
      <step id="2.2" name="validate-summary">For `REFERENCE_ASSESSMENT: PASS`, validate that the summary is concise, schema-conforming, limitations-explicit, currentness-aware, and clear that local repository evidence outranks the reference.</step>
      <step id="2.3" name="repair-once">If a `PASS` summary fails the contract, re-dispatch once for targeted summary-contract repair.</step>
      <step id="2.4" name="degrade-optional">If an optional reference is inaccessible, stale, malformed, or still invalid after repair, record the limitation and continue with local-only planning.</step>
    </steps>
    <output>Validated reference summary, optional-reference limitation, or `REFERENCE_ASSESSMENT: SKIPPED`.</output>
    <gate>Required reference failure routes to `Status: BLOCKED` or `Status: ERROR`; optional reference failure degrades to a local-only limitation.</gate>
  </phase>

  <phase id="3" name="current-architecture-map" mode="dispatch">
    <purpose>Build a factual map of the current system before proposing target structure.</purpose>
    <steps>
      <step id="3.1" name="dispatch-cartographer">Dispatch `architecture-cartographer` with the target path or repository URL, scope, goals, domain language, constraints, success criteria, mutation boundary, and validated reference context or limitation.</step>
      <step id="3.2" name="inspect-read-only">The subagent inspects folder structure, modules, entry points, ownership boundaries, dependency direction, integrations, shared utilities, configuration, one to three representative workflows, and safety nets.</step>
      <step id="3.3" name="validate-map">Consume `ARCHITECTURE_MAP: PASS` only after the architecture map summary is schema-conforming, concise, evidence-backed, path-based, scoped to cartography, and explicit about zero-state findings.</step>
      <step id="3.4" name="repair-once">If a required `PASS` summary fails the contract, re-dispatch once for targeted summary-contract repair.</step>
    </steps>
    <output>Validated architecture map summary.</output>
    <gate>Route `ARCHITECTURE_MAP: NEEDS_INPUT`, `BLOCKED`, or `ERROR` exactly; invalid summary after one repair becomes `Status: BLOCKED`.</gate>
  </phase>

  <phase id="4" name="domain-and-complexity-analysis" mode="dispatch">
    <purpose>Compare the mapped system against Domain-Driven Design and Screaming Architecture principles.</purpose>
    <steps>
      <step id="4.1" name="dispatch-domain-analyst">Dispatch `domain-analyst` with the validated architecture map, business goals, known domain language, constraints, success criteria, and validated reference context or limitation.</step>
      <step id="4.2" name="analyze">The subagent extracts supported domain language, capabilities, bounded-context candidates, DDD gaps, Screaming Architecture gaps, complexity signals, contradictions, ambiguous terms, and zero-state findings.</step>
      <step id="4.3" name="validate-analysis">Consume `DOMAIN_ANALYSIS: PASS` only after the summary is schema-conforming, concise, evidence-backed, zero-state explicit, and grounded in observed workflows, names, tests, APIs, and ownership signals.</step>
      <step id="4.4" name="repair-once">If a required `PASS` summary fails the contract, re-dispatch once for targeted summary-contract repair.</step>
    </steps>
    <output>Validated domain analysis summary.</output>
    <gate>Route `DOMAIN_ANALYSIS: NEEDS_INPUT`, `BLOCKED`, or `ERROR` exactly; invalid summary after one repair becomes `Status: BLOCKED`.</gate>
  </phase>

  <phase id="5" name="evidence-precedence" mode="inline-gate">
    <purpose>Decide whether outside reference patterns may influence the target strategy.</purpose>
    <steps>
      <step id="5.1" name="compare-fit">Compare any reference patterns against the validated architecture map and validated domain analysis.</step>
      <step id="5.2" name="set-decision">Set `EVIDENCE_PRECEDENCE_DECISION` to `reference authorized`, `limitations only`, or `not applicable`.</step>
      <step id="5.3" name="limit-reference">Pass reference patterns to strategy only when fit is confirmed; otherwise pass them as limitations only.</step>
    </steps>
    <output>Evidence precedence decision.</output>
    <hard_rule>Local repository evidence, business goals, constraints, success criteria, and mutation boundary outrank external reference patterns.</hard_rule>
  </phase>

  <phase id="6" name="target-architecture-plan" mode="dispatch">
    <purpose>Turn evidence into a practical restructuring proposal and migration path.</purpose>
    <steps>
      <step id="6.1" name="dispatch-strategist">Dispatch `restructuring-strategist` with validated architecture and domain summaries, reference assessment only as allowed by evidence precedence, evidence precedence decision, goals, constraints, success criteria, and mutation boundary.</step>
      <step id="6.2" name="propose">The subagent proposes supported contexts or capability areas, folder tree sketch, dependency and naming guardrails, impact assessment, migration strategy, validation plan, human approval gates, safer alternatives, risks, assumptions, and open questions.</step>
      <step id="6.3" name="validate-strategy">Consume `RESTRUCTURING_PLAN: PASS` only after the summary is schema-conforming, concise, evidence-backed, explicit about approval gates, safe for incremental migration, and compliant with evidence precedence.</step>
      <step id="6.4" name="repair-once">If a required `PASS` summary fails the contract, re-dispatch once for targeted summary-contract repair.</step>
    </steps>
    <output>Validated restructuring plan summary.</output>
    <gate>Route `RESTRUCTURING_PLAN: NEEDS_INPUT`, `BLOCKED`, or `ERROR` exactly; invalid summary after one repair becomes `Status: BLOCKED`.</gate>
  </phase>

  <phase id="7" name="candidate-report" mode="inline-synthesis">
    <purpose>Assemble a user-facing report from validated summaries only.</purpose>
    <steps>
      <step id="7.1" name="confirm-inputs">Confirm that all consumed summaries are validated, concise, schema-conforming, evidence-backed, scoped to their responsibility, and safe to quote.</step>
      <step id="7.2" name="synthesize">Draft the candidate final report with concise path evidence, evidence-backed findings, migration plan, validation plan, approval gates, risks, assumptions, blockers, and open questions.</step>
      <step id="7.3" name="avoid-raw-dumps">Exclude raw file dumps, long command output, and unreviewed speculative architecture.</step>
    </steps>
    <output>Candidate final restructuring report.</output>
  </phase>

  <phase id="8" name="plan-review" mode="dispatch-and-repair">
    <purpose>Protect the final report from unsupported architecture claims, weak validation, missing gates, and copied reference patterns.</purpose>
    <steps>
      <step id="8.1" name="dispatch-reviewer">Dispatch `plan-reviewer` with preflight summary, validated subagent summaries, evidence precedence decision, candidate final report, success criteria, and current `review_repair_count`.</step>
      <step id="8.2" name="route-review">On `PLAN_REVIEW: PASS`, proceed to final report. On `FAIL`, increment `review_repair_count` exactly once for that failed review cycle.</step>
      <step id="8.3" name="repair-target">For each review failure, repair only the reviewer-identified issue by re-dispatching the smallest responsible subagent with `REPAIR_FINDINGS` or revising only the candidate report section from existing validated summaries.</step>
      <step id="8.4" name="rerun-review">Re-run `plan-reviewer` after each repair.</step>
    </steps>
    <output>`PLAN_REVIEW: PASS`, or a routed stopped status with completed phases and safe partial findings.</output>
    <gate>Use at most two review repair cycles. If the count is greater than two, return `Status: BLOCKED`.</gate>
  </phase>

  <phase id="9" name="final-report" mode="inline-synthesis">
    <purpose>Deliver the reviewed decision artifact.</purpose>
    <steps>
      <step id="9.1" name="ready-report">For `READY`, include preflight summary, current architecture map, domain model observations, DDD alignment gaps, Screaming Architecture folder proposal, complexity reduction opportunities, reference assessment or skipped/degraded state, migration strategy, validation plan, human approval gates, risks, assumptions, blockers, and open questions.</step>
      <step id="9.2" name="stopped-report">For `NEEDS_INPUT`, `BLOCKED`, or `ERROR`, include the smallest stopping reason, completed phases, next decision needed, repair counts when relevant, and safe partial findings.</step>
    </steps>
    <output>Final report beginning with `Status: READY | NEEDS_INPUT | BLOCKED | ERROR`.</output>
  </phase>
</phases>

<human_approval_gate>
  Before any broad restructuring, file moves, public contract changes, data migration, dependency additions, or architecture rewrite, present the proposed action, exact affected files or modules, reason, expected benefit, risks and reversibility, validation plan, and smaller or safer alternative. Continue only after explicit approval for that exact scope.
</human_approval_gate>

<new_finding_rule>
  If repository inspection reveals contradictions, missing safety nets, unclear ownership, ambiguous domain terms, unsupported reference fit, or insufficient evidence, document the issue in the relevant summary and route it through the normal status or open-question path instead of resolving it silently.
</new_finding_rule>

<ambiguity_handling>
  Ask exactly one concise question when an ambiguity would materially change scope, authority, domain boundaries, migration strategy, or approval gates. Otherwise record the assumption and continue with planning-only behavior.
</ambiguity_handling>

<autonomy_guardrails>
  Default to `planning-only`. Keep recommendations traceable to validated evidence. Do not mutate files, install dependencies, rewrite code, or expand scope during the planning run.
</autonomy_guardrails>

<anti_patterns>
  Do NOT:
  - Start implementation work because the restructuring plan looks obvious.
  - Let an external reference dictate folder structure without confirmed local fit.
  - Consume unvalidated or raw subagent output in downstream phases.
  - Omit zero-state findings for inspected categories.
  - Present speculative bounded contexts, aggregates, or target modules as findings when the source evidence only supports questions.
  - Repair a failed review by broadening scope or rewriting unrelated report sections.
  - Skip the human approval gate for broad restructuring or sensitive work.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="planning-only-default">If mutation authorization is absent or ambiguous, stop at recommendations and migration planning.</constraint>
  <constraint id="2" name="read-only-inspection">Repository inspection must use read-only commands and metadata.</constraint>
  <constraint id="3" name="summary-contract-before-consumption">Every `PASS` subagent summary must pass its summary contract before another phase consumes it.</constraint>
  <constraint id="4" name="source-grounded-recommendations">Every recommendation must be traceable to observed code shape, workflow evidence, complexity signals, validated external reference fit, or explicit user constraints.</constraint>
  <constraint id="5" name="evidence-precedence">Local evidence and user constraints outrank outside references.</constraint>
  <constraint id="6" name="bounded-repairs">Summary-contract repairs are attempted once per required subagent phase; plan-review repairs are limited to two cycles.</constraint>
  <constraint id="7" name="zero-state-findings">When an inspected category has no issue, say so rather than omitting the category.</constraint>
</constraints>

<success_criteria>
  - The final report starts with `Status: READY`, `Status: NEEDS_INPUT`, `Status: BLOCKED`, or `Status: ERROR`.
  - Required inputs were either resolved, safely inferred with assumptions, or routed to one concise `NEEDS_INPUT` question.
  - Mutation authorization defaulted to `planning-only` when absent or ambiguous.
  - `REFERENCE_URL` was either skipped, validated, degraded as optional, or treated as blocking/error when required.
  - Architecture map, domain analysis, restructuring plan, and plan review were all routed by their required status prefixes.
  - No downstream phase consumed a `PASS` summary before validating its summary contract.
  - The evidence precedence decision was recorded as `reference authorized`, `limitations only`, or `not applicable`.
  - The `READY` report includes all required output sections and zero-state findings for inspected categories.
  - Human approval gates are present for broad restructuring, file moves, public contract changes, data migration, dependency additions, and architecture rewrites.
  - No file mutation or implementation action occurred during the planning run unless a later human explicitly approved an exact implementation slice.
</success_criteria>

## Assembly Notes

### Sections Omitted
- Suite alignment: no suite context was supplied for this standalone prompt template.
- Web rationale: not needed for prompt assembly; the target skill source files were sufficient.

### Non-Obvious Decisions
- The template keeps `prompt-structurer`'s XML contract shape while preserving the target skill's original status prefixes, subagent names, and output sections.
- `reference-assessor` is conditional because the target `SKILL.md` dispatches it only when `REFERENCE_URL` is present.
- The human approval gate is repeated outside the phase list because violating it would change the skill from planning-only to implementation.

### Assumptions
- This template documents the skill as a reusable execution prompt; placeholders remain for user-provided codebase inputs.

### Resources Used
- Local prompt-structurer resources: `SKILL.md`, `semantic-decomposer.md`, `philosophy-constraints-classifier.md`, `implicit-behavior-surfacer.md`, `failure-modes.md`, `anti-pattern-synthesizer.md`, `success-criteria-builder.md`, `xml-prompt-assembler.md`, `template-skeleton.md`, `tag-taxonomy.md`.
- Target skill sources: `skills/planning-codebase-restructuring/SKILL.md`, `flow-diagram.md`, and all five subagent files under `subagents/`.
- Web: `LOCAL_ONLY`.

### Source Grounding
- Orchestration, inputs, pipeline, status routing, summary-contract gate, evidence precedence, execution steps, human approval gate, and output contract come from `skills/planning-codebase-restructuring/SKILL.md`.
- Existing route details and terminal-state handling are corroborated by `skills/planning-codebase-restructuring/flow-diagram.md`.
- Subagent responsibilities and output schemas come from `reference-assessor.md`, `architecture-cartographer.md`, `domain-analyst.md`, `restructuring-strategist.md`, and `plan-reviewer.md`.

