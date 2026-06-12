```xml
<task>
  Validate or produce an answer for a user request whose correctness depends on current external facts, then return a user-visible final answer with appropriate freshness, evidence, and uncertainty wording.
</task>

<dispatch_rule>
  Coordinate verification through exactly two focused read-only subagents: first `recency-checker`, then `claim-verifier`. Read only the subagent file for the current dispatch, pass explicit inputs, and keep only the returned structured report for integration.
</dispatch_rule>

<scope>
  <in_scope>
    Inspecting or drafting a concise answer; identifying time-sensitive and decision-shaping claims; verifying current evidence; qualifying, replacing, reframing, date-stamping, or removing only flagged claims; integrating evidence into a final response.
  </in_scope>
  <out_of_scope>
    Mutating external systems, posting, purchasing, deploying, changing policy, taking high-impact actions, exposing raw verification reports by default, or expanding verification beyond the repair limits defined by the skill.
  </out_of_scope>
</scope>

<goal>
  Produce an answer that is current where freshness matters, qualified where evidence is limited, and complete against the user's request.
</goal>

<philosophy>
  <core_principle>Current-fact answers should be validated before they are presented as actionable.</core_principle>
  <what_it_means>The orchestrator thinks about risk, dispatches focused verification, applies only evidence-backed repairs, and gives the user a clean final answer.</what_it_means>
  <what_it_does_NOT_mean>It does not mean publishing an audit trail by default, doing open-ended research forever, or treating unverified current claims as safe because they sound plausible.</what_it_does_NOT_mean>
  <rule_of_thumb>If a claim involves versions, releases, pricing, limits, policies, rankings, benchmarks, popularity, availability, or recommendations the user may act on, treat it as requiring current-source validation or explicit qualification.</rule_of_thumb>
</philosophy>

<context>
  The skill is a standalone response-validation orchestrator. Required operating rules are bundled in the skill folder. External URLs are optional background sources, not prerequisites, and should be fetched one at a time only when local rules are ambiguous, a high-stakes judgment needs background, or the user asks for verification methodology.
</context>

<inputs>
  <input name="USER_REQUEST" required="true">The user's question or task.</input>
  <input name="DRAFT_RESPONSE" required="false">A provisional answer to validate. If missing, draft a concise answer before verification.</input>
  <input name="TODAYS_DATE" required="false">Use the runtime current date when not supplied.</input>
  <input name="RECENCY_RISK_HINT" required="false">Optional guidance about which freshness risks matter most.</input>
</inputs>

<phases>
  <phase id="1" name="draft-prep" mode="inline">
    <purpose>Prepare the answer and verification frame.</purpose>
    <steps>
      <step id="1.1" name="prepare-draft">Inspect `DRAFT_RESPONSE` or draft a concise answer from `USER_REQUEST`.</step>
      <step id="1.2" name="mark-risk">Mark claims involving versions, releases, pricing, limits, policies, rankings, benchmarks, popularity, availability, compatibility, or recommendations.</step>
      <step id="1.3" name="state-boundary">State the read-only role, authority, trust model, and freshness scope internally.</step>
      <step id="1.4" name="route-mutations">If the request asks for an external mutation or high-impact action, return `Out-of-scope route` to a separate approved workflow.</step>
    </steps>
    <output>A draft ready for recency verification, or an out-of-scope route.</output>
  </phase>

  <phase id="2" name="recency-audit" mode="recency-checker">
    <purpose>Verify time-sensitive claims against current sources.</purpose>
    <steps>
      <step id="2.1" name="load-subagent">Read `./subagents/recency-checker.md` for this dispatch.</step>
      <step id="2.2" name="dispatch">Send `USER_REQUEST`, `DRAFT_RESPONSE`, `TODAYS_DATE`, and `RECENCY_RISK_HINT` when available.</step>
      <step id="2.3" name="apply-report">Apply only flagged edits from the returned `RECENCY_CHECK` report.</step>
    </steps>
    <output>`RECENCY_CHECK: PASS | FAIL | TOOLS_MISSING | ERROR` with only claims needing revision, qualification, or removal.</output>
    <gate>On `FAIL`, rerun only after targeted edits and only while fewer than two targeted FAIL reruns have been used for this subagent. On `ERROR`, retry once with the same focused request. On `TOOLS_MISSING`, keep only supportable claims and qualify freshness or tool limits.</gate>
  </phase>

  <phase id="3" name="claim-stress-test" mode="claim-verifier">
    <purpose>Stress-test the most decision-shaping claims after recency repairs.</purpose>
    <steps>
      <step id="3.1" name="load-subagent">Read `./subagents/claim-verifier.md` for this dispatch.</step>
      <step id="3.2" name="dispatch">Send the revised draft, `USER_REQUEST`, and `TODAYS_DATE`.</step>
      <step id="3.3" name="limit-selection">Let `claim-verifier` select up to three decision-shaping claims.</step>
      <step id="3.4" name="apply-report">Apply only required edits from the returned `CLAIM_REVIEW` report.</step>
    </steps>
    <output>`CLAIM_REVIEW: PASS | FAIL | TOOLS_MISSING | ERROR` with confidence, counterexamples, failure modes, and required wording changes for selected claims.</output>
    <gate>Use the same repair cap as recency checking: one initial review plus at most two targeted FAIL reruns, and one ERROR retry.</gate>
  </phase>

  <phase id="4" name="evidence-integration" mode="inline">
    <purpose>Resolve overlapping evidence and convert confidence into final wording.</purpose>
    <steps>
      <step id="4.1" name="load-policy">Use `./references/repair-and-integration.md` when integrating reports.</step>
      <step id="4.2" name="stricter-result">When recency and claim reviews overlap, apply the stricter result.</step>
      <step id="4.3" name="source-conflicts">Resolve source conflicts with the highest-tier source unless the conflict materially changes the recommendation.</step>
      <step id="4.4" name="confidence-wording">State high-confidence claims directly, lightly qualify medium-confidence claims when context affects action, and remove, replace, or explicitly mark low-confidence claims uncertain.</step>
    </steps>
    <output>A draft with source conflicts, overlapping reviews, and confidence wording resolved.</output>
  </phase>

  <phase id="5" name="completeness-and-final-revalidation" mode="inline">
    <purpose>Ensure the final answer still satisfies the user's request and has not introduced new risky claims.</purpose>
    <steps>
      <step id="5.1" name="check-deliverables">Check every deliverable, constraint, and sub-question in `USER_REQUEST`.</step>
      <step id="5.2" name="add-qualifiers">Add missing date, scope, evidence, tool-limit, or unresolved-uncertainty qualifiers.</step>
      <step id="5.3" name="reroute-new-risk">If final wording adds a new time-sensitive or decision-shaping claim, rerun the relevant subagent while repair capacity remains.</step>
      <step id="5.4" name="cap-exhausted">If relevant rerun capacity is exhausted, produce a material uncertainty final rather than unsupported certainty.</step>
    </steps>
    <output>A ready, limited, or material-uncertainty final answer.</output>
  </phase>
</phases>

<anti_patterns>
  Do NOT:
  - Return a raw verification report unless the user asks for verification details.
  - Apply edits that were not flagged by a subagent report or required by final integration.
  - Rerun the whole pipeline when a targeted flagged-claim repair is sufficient.
  - Let a second subagent `ERROR` or exhausted repair cap produce confident wording.
  - Treat external methodology links as substitutes for current evidence about the user's actual claim.
  - Perform external mutations or high-impact actions inside this workflow.
</anti_patterns>

<new_finding_rule>
  If verification surfaces a source conflict, missing evidence, or uncertainty that materially affects action, integrate it into the final answer as date, scope, evidence, tool-limit, or unresolved-uncertainty wording. If the uncertainty cannot be resolved inside repair limits, return a material uncertainty final.
</new_finding_rule>

<ambiguity_handling>
  Ask only when a missing input would change authority, sensitive actions, allowed outputs, evidence needs, or terminal state. Otherwise, use the runtime date when `TODAYS_DATE` is absent and record freshness limits in the final wording when they affect action.
</ambiguity_handling>

<autonomy_guardrails>
  Run read-only verification sequentially. Keep only decision-relevant summaries in context. Fetch optional external methodology URLs one at a time and only for the current judgment. Do not continue past the repair caps.
</autonomy_guardrails>

<output>
  Return the user-visible answer, not the audit trail. Terminal outcome must be one of:
  - `Ready final answer`: no material evidence, tool, or freshness limit remains.
  - `Limited final answer`: useful answer that names the relevant date, scope, evidence, or tool limits.
  - `Material uncertainty final`: conservative answer that names unresolved uncertainty affecting action.
  - `Out-of-scope route`: request requires external mutation or high-impact action outside this read-only workflow.
</output>

<constraints scope="all-phases">
  <constraint id="1" name="read-only-validation">The workflow validates and edits answer wording only; it does not mutate external systems.</constraint>
  <constraint id="2" name="recency-before-claim-verification">Run recency checking before claim verification so the claim stress-test evaluates the current draft.</constraint>
  <constraint id="3" name="current-source-priority">Start verification from official documentation, specifications, release notes, pricing pages, policy pages, first-party changelogs, audited or peer-reviewed sources, and reputable secondary analysis according to the evidence policy.</constraint>
  <constraint id="4" name="minimal-edits">Apply the smallest safe edit: replace, date-stamp, qualify, reframe, add counterpoint, or remove.</constraint>
  <constraint id="5" name="repair-cap">Each subagent gets one initial review, at most two targeted FAIL reruns, and one separate ERROR retry.</constraint>
  <constraint id="6" name="claim-verifier-limit">`claim-verifier` selects up to three decision-shaping claims from the revised draft.</constraint>
  <constraint id="7" name="verification-details-internal">Verification details stay internal unless the user asks for them.</constraint>
</constraints>

<success_criteria>
  - A draft was inspected or created before verification unless the request routed out of scope.
  - Time-sensitive claims were reviewed by `recency-checker` before decision-shaping claims were reviewed by `claim-verifier`.
  - Only flagged edits and required integration edits were applied.
  - No subagent exceeded one initial review plus two targeted FAIL reruns and one ERROR retry.
  - The final answer includes date, scope, evidence, tool-limit, or uncertainty wording when those limits materially affect action.
  - The final answer does not expose raw verification reports unless the user requested verification details.
  - The terminal outcome is one of `Ready final answer`, `Limited final answer`, `Material uncertainty final`, or `Out-of-scope route`.
</success_criteria>
```

## Assembly Notes

### Sections Omitted
- `suite_alignment`: No suite context was supplied for this target-skill documentation task.
- `human_approval_gate`: Recency Guard routes external mutation and high-impact action requests out of scope; it does not contain an internal human approval workflow.

### Non-Obvious Decisions
- The prompt uses a full XML contract because the target skill is multi-phase, autonomous, evidence-sensitive, and has explicit repair caps.
- The dispatch rule is explicit because the target skill's `SKILL.md` makes subagent sequencing and context retention central to the workflow.
- `new_finding_rule`, `ambiguity_handling`, and `autonomy_guardrails` were included because the skill defines source conflicts, tool limits, missing dates, new risky final wording, and repair-cap exhaustion behavior.

### Suite Alignment
- None.

### Assumptions
- `TODAYS_DATE` follows the runtime current date rule from the target skill when the caller omits it.
- This template describes the skill as a reusable prompt contract; it does not alter the skill's source files or change runtime behavior.

### Resources Used
- Local target files: `skills/recency-guard/SKILL.md`, `skills/recency-guard/subagents/recency-checker.md`, `skills/recency-guard/subagents/claim-verifier.md`, `skills/recency-guard/references/claim-extraction-playbook.md`, `skills/recency-guard/references/evidence-policy.md`, `skills/recency-guard/references/output-templates.md`, `skills/recency-guard/references/repair-and-integration.md`, `skills/recency-guard/references/external-sources.md`, `skills/recency-guard/flow-diagram.md`.
- Prompt Structurer local files: `SKILL.md`, `subagents/semantic-decomposer.md`, `subagents/philosophy-constraints-classifier.md`, `subagents/implicit-behavior-surfacer.md`, `subagents/anti-pattern-synthesizer.md`, `subagents/success-criteria-builder.md`, `subagents/xml-prompt-assembler.md`, `references/failure-modes.md`, `references/template-skeleton.md`.
- Web: `LOCAL_ONLY` for prompt-assembly rationale; no external prompt-structuring URL was needed.

### Suggested Follow-Ups
- If this prompt becomes part of a prompt suite, compare tag names and terminal-outcome wording with the suite conventions.
