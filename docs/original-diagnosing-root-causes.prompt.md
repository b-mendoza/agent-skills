<task>
  Diagnose a reported software, pipeline, or user-reported problem by building an evidence-backed root cause analysis report without changing protected artifacts or systems.
</task>

<dispatch_rule>
  The orchestrator performs intake, source classification, approval handling, and final delivery inline; it dispatches evidence collection, root-cause analysis, and report review to the local subagents defined by the skill.
</dispatch_rule>

<inputs>
  <input name="ISSUE" required="true">The reported problem and symptoms.</input>
  <input name="RESOURCES" required="true">Paths or links to codebase, logs, tests, configuration, dependencies, version history, recent changes, or local documentation.</input>
  <input name="ISSUE_SOURCE" required="false">`runtime`, `CI/CD`, or `user-report`; classify during intake if omitted.</input>
  <input name="REPRODUCTION" required="false">Steps to reproduce or a failing example.</input>
  <input name="ENVIRONMENT" required="false">OS, runtime versions, affected version, branch, or commit.</input>
  <input name="APPROVED_ACTIONS" required="false">Specific human-approved sensitive validations, or `none`.</input>
</inputs>

<scope>
  <in_scope>
    - Read and inspect supplied artifacts.
    - Run safe, non-destructive local checks or reproductions outside production.
    - Trace symptoms through code, configuration, data shape, dependencies, logs, tests, CI/CD output, and recent changes.
    - Produce an evidence-based RCA report with hypotheses, causal chain, educational explanation, fix direction, verification recommendation, and terminal status.
  </in_scope>
  <out_of_scope>
    - Editing code, data, configuration, dependencies, deployments, CI/CD pipelines, credentials, or production systems.
    - Applying a fix, bypassing CI, deploying, rolling back, rotating credentials, or running destructive commands.
    - Treating user reports, logs, summaries, or external pages as confirmed facts without validation.
  </out_of_scope>
</scope>

<goal>
  Help the reader understand what failed, why it failed, how the recommended fix direction addresses the root cause rather than the symptom, and what evidence supports that conclusion.
</goal>

<philosophy>
  <core_principle>Every input is a claim to verify, not a fact to repeat.</core_principle>
  <what_it_means>Root-cause claims, causal-chain links, and fix directions must trace to named sources such as file:line references, log lines, command output, commit SHAs, CI jobs or steps, or documentation sections.</what_it_means>
  <what_it_does_NOT_mean>Do not turn plausible narratives, stale artifacts, secondhand summaries, or unsupported hypotheses into confirmed causes.</what_it_does_NOT_mean>
  <rule_of_thumb>If the evidence cannot support a single root cause, label the gap and stop at `blocked`, `needs validation`, or `escalated` rather than forcing `ready`.</rule_of_thumb>
</philosophy>

<context>
  The skill works across `runtime`, `CI/CD`, and `user-report` issue sources. Source classification determines the minimum evidence set: runtime issues emphasize traces, logs, behavior, code paths, configuration, data shape, dependencies, and recent changes; CI/CD issues emphasize failing jobs and steps, pipeline config, runner environment, dependency drift, and diffs since the last green run; user reports emphasize reproduction steps, environment, versions, and expected-versus-actual behavior before deeper tracing.
</context>

<phases>
  <phase id="1" name="intake-and-classify" mode="inline">
    <purpose>Frame the issue, classify the source, and set the safety boundary before investigation.</purpose>
    <steps>
      <step id="1.1" name="capture-inputs">Capture `ISSUE`, `RESOURCES`, optional reproduction, environment, source, and approved actions.</step>
      <step id="1.2" name="classify-source">Classify `ISSUE_SOURCE` as `runtime`, `CI/CD`, or `user-report` if omitted, recording uncertainty.</step>
      <step id="1.3" name="state-boundary">State that the run is read-first and mutation-limited.</step>
      <step id="1.4" name="separate-claims">Separate facts, assumptions, risks, blockers, and open questions.</step>
    </steps>
    <output>Issue frame, source classification, safety boundary, and fact/assumption split.</output>
    <gate>If `ISSUE` or `RESOURCES` is missing and cannot be safely inferred, ask one concise question and stop at `needs_input`.</gate>
  </phase>

  <phase id="2" name="evidence" mode="dispatch evidence-collector">
    <purpose>Build a trustworthy evidence base without diagnosing the root cause.</purpose>
    <steps>
      <step id="2.1" name="minimum-evidence-gate">Confirm that the minimum evidence for the classified source is available.</step>
      <step id="2.2" name="dispatch-collector">Dispatch `evidence-collector` with the issue frame, source classification, resources, reproduction, and environment.</step>
      <step id="2.3" name="validate-artifacts">Validate each artifact for freshness, source reliability, environment match, affected version, and contradictions.</step>
      <step id="2.4" name="reproduce-or-trace">Attempt safe non-destructive reproduction when possible; otherwise trace statically from symptoms.</step>
    </steps>
    <output>`COLLECT: PASS | NEEDS_INPUT | BLOCKED | ERROR` plus evidence base, observations, trust summary, or failure details.</output>
    <gate>On `COLLECT: PASS`, continue; on `NEEDS_INPUT`, `BLOCKED`, or `ERROR`, stop with the reported missing item, blocker, or recovery action. If evidence is too weak or contradictory for analysis, stop at `needs validation` with the documented gap.</gate>
    <hard_rule>Do not form or rank root-cause hypotheses in this phase.</hard_rule>
  </phase>

  <phase id="3" name="analysis" mode="dispatch root-cause-analyst">
    <purpose>Rank hypotheses, safely test the leading explanation, determine whether a single root cause is supported, and draft the RCA report.</purpose>
    <steps>
      <step id="3.1" name="dispatch-analyst">Dispatch `root-cause-analyst` with the validated evidence base, observations, issue, source classification, and approved actions.</step>
      <step id="3.2" name="rank-hypotheses">For each hypothesis, list supporting evidence, opposing or weak evidence, named sources, assumptions, and disposition.</step>
      <step id="3.3" name="test-safely">Use only safe, non-destructive reasoning and checks unless a specific sensitive validation has already been approved.</step>
      <step id="3.4" name="build-causal-chain">When a single cause is supported, reconstruct `trigger -> contributing conditions -> mechanism -> observed symptom`, tying every link to evidence or labeling it as a hypothesis or gap.</step>
      <step id="3.5" name="educational-explanation">Draft plain-language explanation, fix direction, and verification recommendation without applying changes.</step>
    </steps>
    <output>`ANALYSIS: PASS | NEEDS_APPROVAL | UNSUPPORTED | NEEDS_INPUT | ERROR` plus RCA report, hypotheses, approval packet, or failure details.</output>
    <gate>On `PASS`, continue to review. On `NEEDS_APPROVAL`, enter the approval gate. On `UNSUPPORTED`, re-dispatch only if focused evidence or plausible hypotheses remain; otherwise stop at `escalated`. On `NEEDS_INPUT` or `ERROR`, stop with failure details.</gate>
  </phase>

  <phase id="4" name="approval-gate" mode="inline human">
    <purpose>Prevent sensitive or production-touching validation from happening without explicit human approval.</purpose>
    <steps>
      <step id="4.1" name="approval-packet">Prepare an approval packet containing action, target, reason, risk, reversibility, safer alternative, and expected evidence gain.</step>
      <step id="4.2" name="request-decision">Ask the human for approval for that specific action only.</step>
      <step id="4.3" name="route-decision">On approval, record the approval and either hand off to the approved workflow or re-dispatch analysis with the approval recorded. On decline, use a safer alternative or document the unresolved gap.</step>
    </steps>
    <output>Approved sensitive workflow handoff, updated approved actions, or documented validation gap.</output>
    <gate>Approval for one action never authorizes another. If no safe path remains after decline, stop at `needs validation`; if an approved sensitive workflow is required, stop at `escalated`.</gate>
  </phase>

  <phase id="5" name="review" mode="dispatch rca-report-reviewer">
    <purpose>Independently reject ungrounded, untraceable, unclear, unsafe, or status-inaccurate reports before delivery.</purpose>
    <steps>
      <step id="5.1" name="dispatch-reviewer">Dispatch `rca-report-reviewer` with the drafted RCA report, evidence base, source classification, and optional repair scope.</step>
      <step id="5.2" name="apply-checklist">Check source classification, evidence grounding, causal-chain traceability, hypothesis honesty, educational clarity, fact separation, fix relevance, safety, terminal status, and audit re-walk.</step>
      <step id="5.3" name="repair-if-needed">On failed checks, re-dispatch `root-cause-analyst` with only the failed checks, then re-review.</step>
    </steps>
    <output>`REVIEW: PASS | FAIL | BLOCKED | ERROR` plus findings, checks, and summary.</output>
    <gate>Deliver only on `REVIEW: PASS`. Stop after three repair cycles at `needs validation` and ask the user how to proceed.</gate>
  </phase>

  <phase id="6" name="deliver" mode="inline">
    <purpose>Return the final RCA report using the skill's output contract.</purpose>
    <steps>
      <step id="6.1" name="format-report">Use the RCA report template from `references/output-contract.md`.</step>
      <step id="6.2" name="single-status">End with exactly one terminal status: `ready`, `blocked`, `needs validation`, or `escalated`.</step>
      <step id="6.3" name="early-stop-statuses">If orchestration cannot proceed before a report is deliverable, use `needs_input` or `error` with failure detail and recovery action.</step>
    </steps>
    <output>RCA report with status, source, scope, evidence, reproduction or trace result, hypotheses, root cause, causal chain, educational explanation, fix direction, verification recommendation, gaps, risks, sensitive-validation state, and required human approvals.</output>
  </phase>
</phases>

<new_finding_rule>
  When new contradictions, weak evidence, stale artifacts, unsupported claims, or out-of-scope validation needs appear, label them explicitly and route to focused evidence, `needs validation`, `blocked`, or `escalated` instead of resolving them silently.
</new_finding_rule>

<ambiguity_handling>
  If source classification, evidence meaning, blast radius, or root cause remains ambiguous, record the uncertainty, prefer direct evidence over inference, and ask one concise question only when the missing answer would change the investigation contract.
</ambiguity_handling>

<autonomy_guardrails>
  Continue autonomously only through read-only inspection, safe local checks, static tracing, report drafting, and review. Defer, ask, or hand off whenever a step would mutate state, touch production, require credentials, bypass CI, deploy, roll back, or rely on unverified external facts.
</autonomy_guardrails>

<anti_patterns>
  Do NOT:
  - Modify files, dependencies, data, configuration, deployments, CI/CD pipelines, credentials, or production systems while diagnosing.
  - Run destructive commands or production-touching validation without an explicit approval packet and human approval for the exact action.
  - Diagnose from a reporter claim, stale log, secondhand summary, or external page without validating it against named evidence.
  - Assert a plausible root cause when the evidence supports only competing hypotheses.
  - Hide weak, contradictory, missing, or inferred evidence inside confident prose.
  - Recommend a fix direction that does not follow from the supported root cause.
  - Mark the report `ready` when the correct status is `blocked`, `needs validation`, or `escalated`.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="source-grounded">Every root-cause claim and causal-chain link cites a named source or is labeled as an assumption, hypothesis, or unresolved gap.</constraint>
  <constraint id="2" name="read-first-mutation-limited">The workflow is read-first and mutation-limited unless a specific human-approved handoff is required.</constraint>
  <constraint id="3" name="source-specific-evidence">Evidence collection must match the classified issue source.</constraint>
  <constraint id="4" name="fact-separation">Facts, assumptions, risks, blockers, recommendations, and unresolved questions stay distinct.</constraint>
  <constraint id="5" name="educational-report">The final report explains why the failure happened and how the recommended fix addresses the root cause, not only the symptom.</constraint>
  <constraint id="6" name="single-terminal-status">The RCA report ends with exactly one terminal status from the output contract.</constraint>
  <constraint id="7" name="progressive-loading">Load subagent files and references only when the corresponding phase needs them.</constraint>
</constraints>

<success_criteria>
  - The issue source was classified as `runtime`, `CI/CD`, or `user-report`, with uncertainty recorded when applicable.
  - The evidence base names sources a maintainer could re-locate and labels freshness, environment match, trust, weak evidence, contradictions, and missing evidence.
  - Any safe reproduction or static trace records expected behavior, actual behavior, error boundary, triggering condition, and trace result.
  - Hypotheses include supporting evidence, opposing or weak evidence, named sources, assumptions, and disposition.
  - A `ready` report identifies a single supported root cause, states scope and blast radius, and includes a causal chain whose links are evidence-backed or explicitly labeled.
  - The educational explanation is understandable to a non-expert and connects the recommended fix direction to the root cause rather than the symptom.
  - No protected artifact or system was modified, and no sensitive action ran without an explicit approval packet and human approval.
  - The independent review passed, or any failed review checks were repaired and re-reviewed within the three-cycle limit.
  - The final report follows `references/output-contract.md` and ends with exactly one status: `ready`, `blocked`, `needs validation`, or `escalated`.
  - No unsupported narrative, unrelated fix direction, or forced readiness appears in the delivered report.
</success_criteria>

## Assembly Notes

### Sections Omitted
- `suite alignment`: Not applicable; this prompt documents one target skill rather than a prompt suite.
- `external web rationale`: Omitted for the prompt contract because the target skill's local files define its behavior.

### Non-Obvious Decisions
- Flow selected from `prompt-structurer`: `full`, because the target skill is autonomous, multi-phase, dispatches subagents, includes safety gates, and has terminal statuses.
- The prompt keeps the target skill's status vocabulary rather than normalizing it to another RCA framework.
- The approval gate is repeated as both a phase and a guardrail because violating it changes the skill's safety boundary.

### Assumptions
- `diagnosing-root-causes` is the target skill slug because the user supplied `/home/b-mendoza/__pocs/agent-skills/skills/diagnosing-root-causes`.
- The prompt describes the skill as written; it does not add capabilities beyond the target files.

### Resources Used
- Target source: `skills/diagnosing-root-causes/SKILL.md`, `skills/diagnosing-root-causes/flow-diagram.md`, `skills/diagnosing-root-causes/subagents/evidence-collector.md`, `skills/diagnosing-root-causes/subagents/root-cause-analyst.md`, `skills/diagnosing-root-causes/subagents/rca-report-reviewer.md`, `skills/diagnosing-root-causes/references/investigation-guide.md`, `skills/diagnosing-root-causes/references/output-contract.md`, `skills/diagnosing-root-causes/references/review-checklist.md`, `skills/diagnosing-root-causes/references/external-sources.md`.
- Helper skill: `prompt-structurer`, including full-flow pass instructions and `references/template-skeleton.md`.
- Web: `LOCAL_ONLY`.

### Suggested Follow-Ups
- Use this prompt template as a documentation artifact only; do not replace the source skill unless the repository owner explicitly asks for a skill rewrite.
