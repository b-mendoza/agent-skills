<task>
  Generate a resumable cold-start handoff package for an in-progress conversation, review, debugging session, or investigation.
</task>

<dispatch_rule>
  The orchestrator does exactly three things: think, decide, and dispatch. It delegates extraction, insight capture, claim validation, document assembly, and final review to the co-located subagents listed in the registry. For every dispatch, read only the selected subagent definition, pass only that subagent's explicit inputs, collect its structured summary, retain only verdicts, paths, counts, warnings, rerun targets, and unresolved-question counts, then route the status through the skill's status vocabulary.
</dispatch_rule>

<scope>
  <in_scope>
    - Confirming or deriving `TARGET_FILE`, optional `SUBJECT`, optional `TRACKING_FILES`, and optional `CONTEXT_SOURCE`.
    - Reading the current conversation or named transcript and any supplied tracking files.
    - Writing `TARGET_FILE` and sibling structured artifacts beside it after path and write checks pass.
    - Fetching at most one external source only when the local contracts are insufficient for the current decision or when a required current external dependency is needed.
    - Running bounded repair cycles when final review fails.
  </in_scope>
  <out_of_scope>
    - Mutating product code.
    - Treating tracking-file claims as ground truth without verification.
    - Keeping raw extraction, insight, claim, assembly, or review payloads in orchestrator context.
    - Fetching external background when bundled contracts answer the current workflow question.
  </out_of_scope>
</scope>

<goal>
  Produce a handoff document and supporting artifacts that let a fresh agent resume from cold without relying on the original chat history.
</goal>

<philosophy>
  <core_principle>Preserve resumability through structured, source-backed artifacts rather than conversational memory.</core_principle>
  <what_it_means>The orchestrator keeps the run small and routeable while subagents write durable context, insights, claims, and the final handoff to disk.</what_it_means>
  <what_it_does_NOT_mean>It does not mean smoothing away uncertainty, copying unverified notes into the handoff as facts, or expanding the orchestrator into the subagents' detailed work.</what_it_does_NOT_mean>
  <rule_of_thumb>If a detail matters for continuation, put it in a structured artifact or the final handoff; if it only matters for routing, keep the compact verdict, count, path, warning, or rerun target.</rule_of_thumb>
</philosophy>

<context>
  The package is standalone. Core behavior is defined by `SKILL.md`, `references/data-contracts.md`, `references/handoff-template.md`, `references/quality-checklist.md`, and five subagent definitions: `context-extractor`, `insight-documenter`, `claim-validator`, `document-assembler`, and `handoff-reviewer`. Bundled contracts win over fetched content when they conflict.
</context>

<inputs>
  <input name="TARGET_FILE" required="true">Path to the final handoff document, such as `docs/auth-review-handoff.md`.</input>
  <input name="SUBJECT" required="false">Human-readable subject for the handoff, such as `Authentication review`.</input>
  <input name="TRACKING_FILES" required="false">Comma-separated notes, plans, or tracking files whose factual claims should be validated.</input>
  <input name="CONTEXT_SOURCE" required="false">The source conversation or transcript, such as `current conversation` or `docs/transcript.md`.</input>
</inputs>

<phases>
  <phase id="1" name="intake-and-safety-checks" mode="routing">
    <purpose>Confirm the target path, validate local read/write safety, and derive working artifact paths.</purpose>
    <steps>
      <step id="1.1" name="confirm-target">Confirm `TARGET_FILE`; ask one short question only when the path is unclear.</step>
      <step id="1.2" name="validate-paths">Validate readable inputs, writable target location, and sibling artifact locations.</step>
      <step id="1.3" name="load-contracts">Read `references/data-contracts.md` before deriving sibling artifact paths or checking status contracts.</step>
      <step id="1.4" name="derive-artifacts">Derive `<stem>.context.json`, `<stem>.insights.json`, and optional `<stem>.claims.json` beside `TARGET_FILE`.</step>
    </steps>
    <output>Safe target path plus sibling artifact paths, or a named blocked state.</output>
    <gate>Stop with `Blocked: unclear target path` when `TARGET_FILE` is unclear. Stop with `Blocked: unsafe writes or missing readable/writable path` when a read, write, or sibling-path check is unsafe.</gate>
  </phase>

  <phase id="2" name="external-source-decision" mode="routing">
    <purpose>Decide whether local contracts are enough or whether one optional external source is needed.</purpose>
    <steps>
      <step id="2.1" name="check-local-sufficiency">Use bundled contracts first for workflow, schemas, templates, validation gates, and status vocabulary.</step>
      <step id="2.2" name="record-external-status">Record `EXTERNAL: SKIPPED`, `EXTERNAL: USED`, or `EXTERNAL: UNAVAILABLE`.</step>
      <step id="2.3" name="block-if-required">Block only when a required external dependency is unavailable.</step>
    </steps>
    <output>One external-source status for the final summary.</output>
    <gate>Continue local-only on optional `EXTERNAL: UNAVAILABLE`; stop with `Blocked: required external dependency unavailable` when required current external information is unavailable.</gate>
  </phase>

  <phase id="3" name="extract-context" mode="dispatch">
    <purpose>Capture the original mandate, instruction amendments, and chronological Q&A for a cold-start reader.</purpose>
    <steps>
      <step id="3.1" name="load-subagent">Read `subagents/context-extractor.md`.</step>
      <step id="3.2" name="dispatch">Pass `CONTEXT_SOURCE` and `CONTEXT_FILE`.</step>
      <step id="3.3" name="route-status">Continue on `CONTEXT: PASS` or `CONTEXT: WARN`; block on `CONTEXT: ERROR`, unexpected `CONTEXT: FAIL`, or unexpected `CONTEXT: SKIPPED`.</step>
    </steps>
    <output>`CONTEXT_FILE` with `original_instructions`, `qa_log`, and `amendments`.</output>
  </phase>

  <phase id="4" name="document-insights" mode="dispatch">
    <purpose>Extract evidence-backed findings, risks, recommendations, and verification states that matter for continuation.</purpose>
    <steps>
      <step id="4.1" name="load-subagent">Read `subagents/insight-documenter.md`.</step>
      <step id="4.2" name="dispatch">Pass `CONTEXT_SOURCE` and `INSIGHTS_FILE`.</step>
      <step id="4.3" name="route-status">Continue on `INSIGHTS: PASS` or `INSIGHTS: WARN`; block on `INSIGHTS: ERROR`, unexpected `INSIGHTS: FAIL`, or unexpected `INSIGHTS: SKIPPED`.</step>
    </steps>
    <output>`INSIGHTS_FILE` with an `insights` array containing title, claim, rationale, evidence, verification status, category, and priority.</output>
  </phase>

  <phase id="5" name="validate-tracking-claims" mode="conditional-dispatch">
    <purpose>Prevent a resuming agent from inheriting unexamined factual assertions from notes, plans, or tracking documents.</purpose>
    <steps>
      <step id="5.1" name="branch">If `TRACKING_FILES` exist, dispatch `claim-validator`; otherwise record `CLAIMS: SKIPPED`.</step>
      <step id="5.2" name="dispatch">When dispatched, pass `TRACKING_FILES`, optional `INSIGHTS_FILE`, and `CLAIMS_FILE`.</step>
      <step id="5.3" name="route-status">Continue on `CLAIMS: PASS`, `CLAIMS: WARN`, or intentional `CLAIMS: SKIPPED`; block on `CLAIMS: ERROR` or unexpected `CLAIMS: FAIL`.</step>
    </steps>
    <output>Optional `CLAIMS_FILE` with directive, claims, and summary counts, or a visible no-tracking-files warning.</output>
  </phase>

  <phase id="6" name="assemble-handoff" mode="dispatch">
    <purpose>Turn the structured working artifacts into the final cold-start handoff document.</purpose>
    <steps>
      <step id="6.1" name="load-subagent">Read `subagents/document-assembler.md`.</step>
      <step id="6.2" name="load-template">The assembler reads `references/handoff-template.md` only when ready to assemble.</step>
      <step id="6.3" name="dispatch">Pass `TARGET_FILE`, optional `SUBJECT`, `CONTEXT_FILE`, `INSIGHTS_FILE`, and optional `CLAIMS_FILE`.</step>
      <step id="6.4" name="route-status">Continue on `HANDOFF: PASS` or `HANDOFF: WARN`; block on `HANDOFF: ERROR`, unexpected `HANDOFF: FAIL`, or unexpected `HANDOFF: SKIPPED`.</step>
    </steps>
    <output>`TARGET_FILE` with exactly five major sections: original instructions and scope, Q&A log, observations and insights, unverified claims and validation checklist, and open questions and recommended next steps.</output>
    <hard_rule>Every major section starts with a `**Fulfills:**` line, and Section 4 includes either claim-validation output or the explicit no-tracking-files note.</hard_rule>
  </phase>

  <phase id="7" name="review-and-repair" mode="dispatch-and-loop">
    <purpose>Verify the handoff is cold-start ready and rerun the smallest failing stage set when quality gates fail.</purpose>
    <steps>
      <step id="7.1" name="load-subagent">Read `subagents/handoff-reviewer.md`.</step>
      <step id="7.2" name="dispatch">Pass `TARGET_FILE` and available structured artifact paths.</step>
      <step id="7.3" name="complete-or-warn">Complete on `REVIEW: PASS` or `REVIEW: WARN`.</step>
      <step id="7.4" name="repair">On `REVIEW: FAIL`, parse rerun targets, normalize them into canonical order, rerun the earliest named upstream stage plus downstream consumers, then rerun review.</step>
      <step id="7.5" name="limit">Stop after three repair cycles if gates still fail.</step>
    </steps>
    <output>Final review verdict, or `Blocked: repair limit exhausted`.</output>
  </phase>
</phases>

<status_routing>
  <continue statuses="PASS,WARN">Continue after recording warnings and relevant counts.</continue>
  <claims_skip>Only `CLAIMS: SKIPPED` is an intentional skipped stage, and it is allowed when no tracking files were provided or the claim stage explicitly reports an intentional skip.</claims_skip>
  <review_fail>`REVIEW: FAIL` enters the bounded repair loop instead of blocking immediately.</review_fail>
  <block statuses="ERROR,unexpected FAIL,unexpected SKIPPED">Stop with the matching blocked state when a non-review, non-claims stage returns an error, failure, or unexpected skip.</block>
</status_routing>

<output>
  <output_file name="target_handoff">`TARGET_FILE`, written by `document-assembler`.</output_file>
  <output_file name="context_artifact">`<stem>.context.json`, written by `context-extractor`.</output_file>
  <output_file name="insights_artifact">`<stem>.insights.json`, written by `insight-documenter`.</output_file>
  <output_file name="claims_artifact">`<stem>.claims.json`, optionally written by `claim-validator` when `TRACKING_FILES` are supplied.</output_file>
  <final_response>After `REVIEW: PASS` or `REVIEW: WARN`, return the target handoff path, sibling artifact paths, external status, stage verdicts, counts, warnings, open-question count, and `Completed: review pass`.</final_response>
</output>

<ambiguity_handling>
  Ask one short question only when `TARGET_FILE` is unclear. For optional missing inputs, infer from the session when safe; otherwise proceed with explicit warnings or `CLAIMS: SKIPPED` as defined by the local contracts.
</ambiguity_handling>

<new_finding_rule>
  If a subagent or reviewer exposes incomplete, contradictory, weakly evidenced, or unreadable output, route it through the status vocabulary and targeted rerun rules instead of silently repairing unrelated stages.
</new_finding_rule>

<autonomy_guardrails>
  Keep working data on disk as structured artifacts. Keep only verdicts, file paths, counts, warnings, rerun targets, and unresolved-question counts in orchestrator context. Treat tracking-file claims as provisional even after validation, and keep that caution visible in the final handoff.
</autonomy_guardrails>

<anti_patterns>
  Do NOT:
  - Mutate product code while generating the handoff package.
  - Skip path and write checks before deriving or writing sibling artifacts.
  - Load every subagent, reference, or external source up front when a smaller just-in-time load answers the current question.
  - Treat unverified tracking-file claims as confirmed facts in the final handoff.
  - Omit Section 4 when no tracking files are supplied; use the explicit no-tracking-files directive.
  - Keep raw subagent payloads in orchestrator context after dispatch.
  - Retry only the final assembler when the reviewer identifies an upstream extraction, insight, or claim-validation failure.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="target-file-required">`TARGET_FILE` is the only required user input; stop for clarification only when it is unclear.</constraint>
  <constraint id="2" name="sibling-artifacts">Structured artifacts are derived from the full `TARGET_FILE` stem and written in the same directory.</constraint>
  <constraint id="3" name="local-contracts-first">Use bundled contracts for workflow, schemas, template, status vocabulary, and quality gates; external content is optional just-in-time background unless required for the current decision.</constraint>
  <constraint id="4" name="status-vocabulary">Record and route statuses exactly as returned by the subagents and reviewer.</constraint>
  <constraint id="5" name="bounded-repair">Run at most three repair cycles after `REVIEW: FAIL`.</constraint>
  <constraint id="6" name="final-section-contract">The final handoff has exactly the five required major sections, each beginning with `**Fulfills:**`.</constraint>
</constraints>

<success_criteria>
  - `TARGET_FILE` and required sibling artifacts were written only after path and write checks passed.
  - `CONTEXT_FILE` contains original instructions, chronological Q&A, and amendments, or the run blocked with a context-stage error.
  - `INSIGHTS_FILE` contains evidence-backed insights with verification status, category, and priority, or the run blocked with an insights-stage error.
  - `CLAIMS_FILE` exists when `TRACKING_FILES` were supplied, or the run records `CLAIMS: SKIPPED` and the final handoff tells the next agent to verify factual claims independently.
  - The final handoff contains exactly the five required major sections, and every section starts with `**Fulfills:**`.
  - The reviewer returned `REVIEW: PASS` or `REVIEW: WARN`, or the orchestrator reported one of the named blocked states.
  - The final response reports the handoff path, artifact paths, external status, stage verdicts, counts, warnings, open-question count, and `Completed: review pass`.
  - No product-code changes were made by the handoff-generation workflow.
</success_criteria>

## Assembly Notes

### Sections Omitted
- `suite_alignment`: Omitted because this is a standalone prompt template for one skill, not a prompt-suite revision.

### Non-Obvious Decisions
- `dispatch_rule` is placed near the top because `SKILL.md` defines the orchestrator as a routing layer and requires delegation to subagents.
- `status_routing` is separated from `phases` because the same PASS/WARN/ERROR/SKIPPED conventions govern multiple stages.
- The prompt uses `TARGET_FILE`, `SUBJECT`, `TRACKING_FILES`, and `CONTEXT_SOURCE` exactly as the skill defines them.

### Suite Alignment
- none

### Assumptions
- The receiving agent has access to the `generate-handoff-document` package files and can resolve bundled paths relative to the skill directory.

### Resources Used
- Local: `skills/generate-handoff-document/SKILL.md`; `skills/generate-handoff-document/subagents/context-extractor.md`; `skills/generate-handoff-document/subagents/insight-documenter.md`; `skills/generate-handoff-document/subagents/claim-validator.md`; `skills/generate-handoff-document/subagents/document-assembler.md`; `skills/generate-handoff-document/subagents/handoff-reviewer.md`; `skills/generate-handoff-document/references/data-contracts.md`; `skills/generate-handoff-document/references/handoff-template.md`; `skills/generate-handoff-document/references/quality-checklist.md`; `skills/generate-handoff-document/references/dispatch-example.md`; `skills/generate-handoff-document/references/external-sources.md`; `.agents/skills/prompt-structurer/SKILL.md`; `.agents/skills/prompt-structurer/subagents/*`; `.agents/skills/prompt-structurer/references/template-skeleton.md`; `.agents/skills/prompt-structurer/references/tag-taxonomy.md`; `.agents/skills/prompt-structurer/references/failure-modes.md`.
- Web: `LOCAL_ONLY` for prompt assembly; no external source was needed to structure the target skill prompt.

### Suggested Follow-Ups
- none
