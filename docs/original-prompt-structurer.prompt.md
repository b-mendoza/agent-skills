<task>
  Convert a prose prompt, instruction block, or prompt-suite entry into a compact structured XML prompt contract using the Prompt Structurer skill.
</task>

<dispatch_rule>
  Prompt Structurer is a routing orchestrator. It captures the supplied prompt inputs, selects the smallest deterministic flow, dispatches only the subagent passes required by that flow, routes on each pass status line, and returns the final XML prompt before assembly notes.
</dispatch_rule>

<inputs>
  <input name="PROMPT_TEXT" required="true">
    The original prose prompt, instruction block, or prompt-suite entry to structure.
  </input>
  <input name="RUN_STYLE" required="false">
    The intended run style, such as interactive, autonomous, or unknown.
  </input>
  <input name="SUITE_CONTEXT" required="false">
    Existing structured prompts or shared suite terminology, tag conventions, constraints, tone, and output conventions.
  </input>
  <input name="TERMINOLOGY" required="false">
    Terms to preserve exactly unless the user requests renaming.
  </input>
  <input name="CHANGE_REQUEST" required="false">
    A targeted revision request for an existing structured prompt.
  </input>
  <clarification_rule>
    Ask one targeted clarifying question only when the missing answer would change the final prompt contract.
  </clarification_rule>
</inputs>

<scope>
  <in_scope>
    Capture source prompt intent, classify prompt functions, surface hidden behavior assumptions, synthesize concrete anti-patterns, build observable success criteria, assemble a final XML prompt, and repair failed criteria by rerunning the earliest affected pass and downstream dependent passes.
  </in_scope>
  <out_of_scope>
    Inventing task scope absent from the source prompt, ignoring user terminology, loading every reference by default, fetching web resources when local references are sufficient, silently resolving suite conflicts, or replacing an existing prompt during a revision when the baseline is insufficient.
  </out_of_scope>
</scope>

<goal>
  Produce an executable XML prompt contract that preserves the user's intent, makes important behavior routeable and auditable, and stays as small as the prompt's risk profile allows.
</goal>

<philosophy>
  <core_principle>
    Structure is earned by risk: simple one-shot prompts should stay simple, while autonomous, multi-phase, safety-sensitive, or repeatedly failing prompts earn stronger contracts.
  </core_principle>
  <what_it_means>
    Add tags, phases, constraints, gates, anti-patterns, traceability, and success criteria only when removing them would change agent behavior or make validation weaker.
  </what_it_means>
  <what_it_does_NOT_mean>
    Do not pad prompts with generic XML sections, broad prompt-engineering advice, or unsupported behavior that was not present in the source prompt or surfaced as an explicit assumption.
  </what_it_does_NOT_mean>
  <rule_of_thumb>
    Preserve intent first, then choose the smallest tag set and pass sequence that makes the resulting contract reliable.
  </rule_of_thumb>
</philosophy>

<context>
  Prompt Structurer is a portable skill package for OpenCode and Claude Code style runtimes. Its bundled subagents and references are sufficient for offline execution. External URLs are optional just-in-time background sources used only when local references are insufficient, the user asks for rationale, or model and platform guidance may have changed.
</context>

<source_policy>
  <local_first>
    Use bundled references before web resources. Record LOCAL_ONLY when bundled sources are sufficient or no external rationale is needed.
  </local_first>
  <web_fetching>
    Fetch at most one targeted URL for a current source-backed rationale need when network access is available and permitted. Record fetched URLs in resources used.
  </web_fetching>
  <omitted_rationale>
    Record RATIONALE_OMITTED when current external rationale is needed but cannot be fetched.
  </omitted_rationale>
  <progressive_loading>
    Read a subagent file only when dispatching that pass, and read a reference file only when the current decision requires it.
  </progressive_loading>
</source_policy>

<flow_selection>
  <rule order="1" flow="revision">
    Use when CHANGE_REQUEST targets an existing structured prompt. Rerun affected analysis passes, required prerequisites, and then xml-prompt-assembler.
  </rule>
  <rule order="2" flow="suite">
    Use when SUITE_CONTEXT must govern conventions. Run the full flow and pass shared suite blocks into every pass.
  </rule>
  <rule order="3" flow="full">
    Use when the prompt is multi-phase, autonomous, safety-sensitive, or repeatedly failing. Run all six passes in order.
  </rule>
  <rule order="4" flow="light">
    Use when none of the higher-precedence triggers apply and the prompt is a short one-shot with low autonomy risk. Run semantic-decomposer and xml-prompt-assembler.
  </rule>
</flow_selection>

<subagent_registry>
  <pass id="1" name="semantic-decomposer" path="./subagents/semantic-decomposer.md">
    Maps meaningful sentences or clauses to prompt functions, flags double-duty and orphan content, preserves source terminology, and returns downstream notes.
  </pass>
  <pass id="2" name="philosophy-constraints-classifier" path="./subagents/philosophy-constraints-classifier.md">
    Separates interpretive philosophy, broad constraints, and phase-scoped hard rules from the semantic map.
  </pass>
  <pass id="3" name="implicit-behavior-surfacer" path="./subagents/implicit-behavior-surfacer.md">
    Surfaces ambiguity, new-finding, empty-output, phase-gate, traceability, autonomy, and wrong-path gaps.
  </pass>
  <pass id="4" name="anti-pattern-synthesizer" path="./subagents/anti-pattern-synthesizer.md">
    Turns exclusions, carve-outs, and failure risks into concrete anti-patterns plus matching negative success criteria.
  </pass>
  <pass id="5" name="success-criteria-builder" path="./subagents/success-criteria-builder.md">
    Builds an observable post-run checklist tied to phases, constraints, anti-patterns, outputs, and traceability.
  </pass>
  <pass id="6" name="xml-prompt-assembler" path="./subagents/xml-prompt-assembler.md">
    Assembles prior pass outputs into a self-contained XML prompt, applies tag selection, runs the removal test, and returns assembly notes.
  </pass>
</subagent_registry>

<phases>
  <phase id="1" name="capture-and-check-inputs" mode="read-only">
    <purpose>Establish the source of truth and detect blockers before analysis.</purpose>
    <steps>
      <step id="1.1" name="capture">Capture PROMPT_TEXT, explicit constraints, RUN_STYLE, SUITE_CONTEXT, TERMINOLOGY, and CHANGE_REQUEST.</step>
      <step id="1.2" name="require-prompt">Return BLOCKED when PROMPT_TEXT is missing.</step>
      <step id="1.3" name="reject-contradictions">Return FAIL with the smallest targeted clarification when contradictions change task meaning.</step>
    </steps>
    <output>Validated intake state or a routeable terminal status.</output>
  </phase>

  <phase id="2" name="resolve-source-needs" mode="read-only">
    <purpose>Choose local references or a single targeted external source only when needed.</purpose>
    <steps>
      <step id="2.1" name="local-first">Use bundled references first for tag selection, failure modes, template skeleton, and resource routing.</step>
      <step id="2.2" name="targeted-url">Fetch at most one current URL only when local references are insufficient, the user requests rationale, or current model and platform behavior matters.</step>
      <step id="2.3" name="record-status">Record fetched URLs, LOCAL_ONLY, or RATIONALE_OMITTED for assembly notes.</step>
    </steps>
    <output>Resource status for downstream passes and final notes.</output>
  </phase>

  <phase id="3" name="select-flow" mode="read-only">
    <purpose>Select the smallest deterministic analysis flow.</purpose>
    <steps>
      <step id="3.1" name="revision-first">If CHANGE_REQUEST targets an existing structured prompt, choose revision.</step>
      <step id="3.2" name="suite-second">If SUITE_CONTEXT must govern conventions, choose suite.</step>
      <step id="3.3" name="full-third">If the prompt is multi-phase, autonomous, safety-sensitive, or repeatedly failing, choose full.</step>
      <step id="3.4" name="light-last">Otherwise choose light for a short low-risk one-shot prompt.</step>
    </steps>
    <output>Selected FLOW and intentional omission reasons for skipped passes.</output>
  </phase>

  <phase id="4" name="dispatch-analysis-passes" mode="read-only">
    <purpose>Run only the passes required by the selected flow and preserve routeable status behavior.</purpose>
    <steps>
      <step id="4.1" name="send-payload">Send each dispatched pass the original prompt, selected flow, resource status, suite context when present, relevant prior outputs, and any omission reasons.</step>
      <step id="4.2" name="route-status">Read only the first RESULT line for routing: PASS, BLOCKED, FAIL, or ERROR.</step>
      <step id="4.3" name="handle-non-pass">For BLOCKED, FAIL, or ERROR, surface the matching status and the smallest useful question or recovery action.</step>
    </steps>
    <output>Compact pass outputs for assembly, or a terminal routeable status.</output>
  </phase>

  <phase id="5" name="assemble-final-prompt" mode="read-only">
    <purpose>Compose the user-facing XML prompt contract from prior pass outputs.</purpose>
    <steps>
      <step id="5.1" name="load-skeleton">Load template-skeleton before final assembly.</step>
      <step id="5.2" name="preserve-terms">Preserve user terminology unless renaming was requested.</step>
      <step id="5.3" name="include-load-bearing-tags">Walk the skeleton top to bottom and include only sections that change behavior.</step>
      <step id="5.4" name="revision-preservation">For revision flow, preserve unaffected sections from the existing XML prompt and assemble only affected outputs plus prerequisites.</step>
      <step id="5.5" name="suite-alignment">For suite flow, preserve shared suite tags, terminology, constraints, tone, output shape, and invariants unless they conflict with the prompt-specific request.</step>
    </steps>
    <output>Final XML prompt first, followed by assembly notes.</output>
  </phase>

  <phase id="6" name="validate-and-repair" mode="read-only">
    <purpose>Ensure the assembled prompt satisfies run-level quality checks.</purpose>
    <steps>
      <step id="6.1" name="check-criteria">Check source coverage, behavioral tags, aligned constraints, routeable statuses, assembly notes, and progressive disclosure.</step>
      <step id="6.2" name="map-failures">When a criterion fails, map it to the earliest affected pass.</step>
      <step id="6.3" name="rerun-dependencies">Rerun that pass and downstream dependent passes while preserving unaffected sections.</step>
      <step id="6.4" name="limit-repair">Stop after three fix cycles with REPAIR_NEEDED.</step>
    </steps>
    <output>Terminal status: PASS, BLOCKED, FAIL, ERROR, or REPAIR_NEEDED.</output>
  </phase>
</phases>

<output_contract>
  <primary_output>
    Return the final XML prompt first. When xml-prompt-assembler returns RESULT: PASS, strip the internal status from the user-facing response.
  </primary_output>
  <assembly_notes>
    After the XML prompt, include assembly notes covering sections omitted, non-obvious decisions, suite alignment, assumptions, local and web resources used, LOCAL_ONLY or RATIONALE_OMITTED status, and suggested follow-ups.
  </assembly_notes>
  <status_outputs>
    For BLOCKED, FAIL, ERROR, or REPAIR_NEEDED, return the status and the smallest useful clarification, blocker, recovery action, or unresolved repair summary.
  </status_outputs>
</output_contract>

<anti_patterns>
  Do NOT:
  - Load every subagent, reference, or URL before knowing that it is needed.
  - Treat a vague prompt as permission to invent missing scope, outputs, or constraints.
  - Let suite conventions and prompt-specific instructions conflict silently.
  - Treat an omitted pass in light or revision flow as accidentally missing; provide OMITTED_PASS_REASON values to the assembler.
  - Retry only final wording when a failed criterion belongs to an earlier analysis pass.
  - Return internal pass transcripts as the main deliverable.
</anti_patterns>

<new_finding_rule>
  When analysis surfaces ambiguity, a suite conflict, an unauditable requirement, or a wrong-but-plausible path not stated directly in the source prompt, represent it as an explicit assumption, blocker, FAIL condition, anti-pattern, or success criterion rather than silently resolving it.
</new_finding_rule>

<ambiguity_handling>
  If a missing answer would change the contract, ask one targeted question. If the uncertainty is safe and reversible, proceed with an explicit assumption in assembly notes.
</ambiguity_handling>

<autonomy_guardrails>
  For autonomous prompts, prefer defer-and-record behavior over mid-run questioning when safe. Add traceability, empty-output handling, phase gates, and new-finding handling when the risk applies.
</autonomy_guardrails>

<constraints scope="all-phases">
  <constraint id="1" name="preserve-intent">Preserve source prompt meaning and user terminology unless the user explicitly requests renaming or revision.</constraint>
  <constraint id="2" name="smallest-flow">Use the first matching flow in precedence order and avoid stronger flows when a lighter one satisfies the risk profile.</constraint>
  <constraint id="3" name="status-routing">Route subagent outputs on the first RESULT line only.</constraint>
  <constraint id="4" name="local-first">Use bundled references before fetching external resources.</constraint>
  <constraint id="5" name="one-url-maximum">Fetch at most one targeted URL for a current source-backed decision when needed and permitted.</constraint>
  <constraint id="6" name="removal-test">Every emitted XML tag must change agent behavior if removed.</constraint>
  <constraint id="7" name="repair-mapping">Repair failed criteria by rerunning the earliest affected pass and downstream dependencies, with at most three fix cycles.</constraint>
</constraints>

<success_criteria>
  - The selected flow matches the documented precedence rules.
  - Required inputs and contradictions route to BLOCKED or FAIL instead of unsupported assembly.
  - Each dispatched pass receives the source prompt, selected flow, resource status, required prior outputs, suite context when present, and omission reasons when needed.
  - The final XML prompt preserves the source meaning, requested terminology, and suite conventions or explicitly reports conflicts.
  - The final XML includes only load-bearing tags that pass the removal test.
  - Constraints, anti-patterns, edge behavior, and success criteria audit the same behaviors.
  - Assembly notes list assumptions, omitted sections, resources used, LOCAL_ONLY or RATIONALE_OMITTED, and follow-up options.
  - Terminal status is PASS, BLOCKED, FAIL, ERROR, or REPAIR_NEEDED.
</success_criteria>

## Assembly Notes

### Sections Omitted
- Examples: omitted from the prompt template because the target skill's examples are illustrative, while this artifact documents the operative contract.
- Web rationale inside the prompt: omitted because the target skill treats web resources as optional background, not required execution input.

### Non-Obvious Decisions
- Flow used to produce this artifact: full. The documentation request is multi-phase and source-grounded, so the prompt template needed the target skill's full pass model rather than the light flow.
- The target skill's own `prompt-structurer` helper role is not treated as a separate subject; the artifact documents the target package at `skills/prompt-structurer`.
- The `OMITTED_PASS_REASON` wording mirrors the target skill's pass-status contract where it names the assembler input concept.

### Suite Alignment
- none

### Assumptions
- `DOCS_DIR` is the repository `docs/` directory because the user did not supply a different directory.
- The target slug is `prompt-structurer`, derived from `/home/b-mendoza/__pocs/agent-skills/skills/prompt-structurer`.

### Resources Used
- Local: `skills/prompt-structurer/SKILL.md`, `skills/prompt-structurer/flow-diagram.md`, all files in `skills/prompt-structurer/subagents/`, and all files in `skills/prompt-structurer/references/`.
- Web: LOCAL_ONLY for prompt assembly; external resources are listed separately in `original-prompt-structurer.references.md`.

### Suggested Follow-Ups
- Use the same documentation prompt against another skill slug to compare how flow complexity and subagent structure differ across the repository.
