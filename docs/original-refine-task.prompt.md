<task>
  Review a Jira ticket, Jira epic, GitHub issue, or GitHub epic-style parent issue for refinement readiness, then return one tracker-facing refinement comment or draft while preserving the tracker item unchanged except for an explicitly authorized single comment.
</task>

<dispatch_rule>
  Use the top-level coordinator as a routing layer. It normalizes inputs, detects write intent, enforces tracker mutation boundaries, gathers compact evidence pointers, and dispatches exactly one detailed review pass to `refinement-reviewer`. The coordinator retains only the reviewer return state, item readiness status, posting allowance, comment mode, blocked or failed reason, and final comment or draft.
</dispatch_rule>

<scope>
  <in_scope>
    Inspect the supplied source item or usable item context, including available comments, child items, linked items, linked docs, code references, and trusted documentation when needed. Evaluate readiness, classify gaps, ask neutral refinement questions, recommend safe next steps, and draft or return one refinement comment.
  </in_scope>
  <out_of_scope>
    Do not edit tracker titles, descriptions, fields, labels, status, assignees, milestones, sprints, existing comments, links, subtasks, child issues, parent-child relationships, or lifecycle state. Do not create child work or perform split, spike, close, merge, delete, supersede, link, or dependency mutations. Route mutation-only requests to a separate approved workflow.
  </out_of_scope>
</scope>

<goal>
  Help a reader or agent decide whether the work item is ready to implement, needs ordinary refinement, needs splitting, needs a spike, is blocked, or is not actionable, using evidence from the supplied item and returning feedback that is safe to post or review.
</goal>

<philosophy>
  <core_principle>
    Treat the tracker item as evidence to review, not content to fix.
  </core_principle>
  <what_it_means>
    The skill may inspect source material, identify readiness gaps, verify claims, ask questions, and produce one advisory refinement comment or draft.
  </what_it_means>
  <what_it_does_NOT_mean>
    A recommendation is not permission to mutate tracker state, alter hierarchy, close or supersede work, create subtasks, or imply that links, dependencies, child work, or fields have already changed.
  </what_it_does_NOT_mean>
  <rule_of_thumb>
    When an action would change tracker state, frame it as a question, an approved recommendation, or a deferred action instead of performing it.
  </rule_of_thumb>
</philosophy>

<context>
  <target_skill>refine-task</target_skill>
  <source_files>
    <file>skills/refine-task/SKILL.md</file>
    <file>skills/refine-task/subagents/refinement-reviewer.md</file>
    <file>skills/refine-task/references/reviewer-policy.md</file>
    <file>skills/refine-task/references/refinement-checks.md</file>
    <file>skills/refine-task/references/comment-template.md</file>
    <file>skills/refine-task/references/review-quality-checklist.md</file>
    <file>skills/refine-task/references/external-sources.md</file>
    <file>skills/refine-task/flow-diagram.md</file>
  </source_files>
  <inputs>
    <input name="ITEM_URL" preference="preferred">Jira or GitHub item URL.</input>
    <input name="ITEM_CONTEXT" preference="optional">Pasted issue or ticket text, comments, subtasks, linked items, docs, code references, or file path.</input>
    <input name="WRITE_MODE" preference="optional">`draft`, `post-comment`, or unknown.</input>
    <input name="HUMAN_APPROVALS" preference="optional">Explicit approvals for lifecycle, split, spike, security, data, permissions, migration, customer-impact, or operational-risk recommendations.</input>
  </inputs>
</context>

<phases>
  <phase id="1" name="normalize-and-gate" mode="read-only">
    <purpose>Identify the source item, user intent, write mode, and tracker mutation boundary before review begins.</purpose>
    <steps>
      <step id="1.1" name="capture-inputs">Prefer `ITEM_URL` over derived IDs, because it carries workspace, repository, and item identity. Use `ITEM_CONTEXT` when no URL is available.</step>
      <step id="1.2" name="source-check">If neither `ITEM_URL` nor usable `ITEM_CONTEXT` is present, ask one concise question for a source item.</step>
      <step id="1.3" name="write-intent">Classify intent as draft, post-comment, or unknown. Treat ambiguous requests as the safe draft path unless they are mutation-only.</step>
      <step id="1.4" name="mutation-only-check">If the user asks only for tracker state changes without a refinement review, return `Mode: Deferred` and point to a separate approved workflow.</step>
      <step id="1.5" name="posting-check">When `WRITE_MODE=post-comment`, confirm authorization and available posting tooling before any post attempt is possible.</step>
    </steps>
    <output>Normalized item source, write mode, human approval context, and routing decision.</output>
    <gate>If posting was requested but authorization or tooling is unclear, ask one concise question instead of posting or guessing.</gate>
  </phase>

  <phase id="2" name="collect-evidence-pointers" mode="read-only">
    <purpose>Prepare enough compact evidence for the detailed reviewer without carrying raw tracker payloads in coordinator context.</purpose>
    <steps>
      <step id="2.1" name="compact-snapshot">Collect compact pointers to available item body, comments, linked items, subtasks, docs, attachments, code references, and trusted documentation.</step>
      <step id="2.2" name="optional-evidence">When optional linked evidence is inaccessible but the remaining source permits meaningful review, pass the absence as missing evidence instead of blocking at the coordinator.</step>
      <step id="2.3" name="block-on-no-meaningful-review">If missing access or missing source prevents meaningful review, return `Mode: Blocked` with one recovery action.</step>
    </steps>
    <output>Compact evidence pointers and missing-evidence notes for `refinement-reviewer`.</output>
  </phase>

  <phase id="3" name="dispatch-refinement-reviewer" mode="read-only">
    <purpose>Run the detailed evidence-backed readiness review in the bundled subagent.</purpose>
    <steps>
      <step id="3.1" name="dispatch-contract">Send only the source pointers, `ITEM_URL`, compact `ITEM_CONTEXT`, `WRITE_MODE`, `HUMAN_APPROVALS`, and relative reference paths required by `refinement-reviewer`.</step>
      <step id="3.2" name="load-policy">The reviewer loads `reviewer-policy.md` before interpreting mutation boundaries, write mode, gates, lifecycle recommendations, or phase order.</step>
      <step id="3.3" name="run-checks">The reviewer loads `refinement-checks.md` to evaluate goal, outcome, persona, journey, scope cohesion, risk, dependency, technical claims, subtasks, rationale, and priority.</step>
      <step id="3.4" name="verify-claims">When current library, framework, SDK, API, hook, CLI, config, or version behavior matters, verify against trusted docs or codebase evidence. Prefer official documentation or a host documentation tool when available.</step>
      <step id="3.5" name="gate-recommendations">Gate lifecycle, split, spike, security, data, permissions, migration, customer-impact, and operational-risk recommendations. If approval is unavailable, neutralize them into questions or defer them.</step>
      <step id="3.6" name="assemble-comment">Load `comment-template.md` only when building the final comment or draft.</step>
      <step id="3.7" name="validate-comment">Load `review-quality-checklist.md` before return. Fix only failed checks for up to three targeted cycles.</step>
    </steps>
    <output>
      `REVIEW`, `REVIEW_STATUS`, `POST_ALLOWED`, `Comment mode`, compact summary, final refinement comment, validation result, fix cycles used, and remaining risks.
    </output>
  </phase>

  <phase id="4" name="route-review-state" mode="read-only">
    <purpose>Use the reviewer run state as the first output gate, separate from item readiness.</purpose>
    <steps>
      <step id="4.1" name="pass">On `REVIEW=PASS`, continue to draft, ready-to-post, or posting handling. Non-ready item statuses can still be valid review outputs.</step>
      <step id="4.2" name="blocked">On `REVIEW=BLOCKED`, return `Mode: Blocked`, `Status: Blocked`, the reviewer reason, and one recovery action.</step>
      <step id="4.3" name="fail">On `REVIEW=FAIL`, return `Mode: Draft`, `Status: Needs refinement`, failed criteria, and the safest draft. Do not post.</step>
      <step id="4.4" name="error">On `REVIEW=ERROR`, return `Mode: Blocked`, `Status: Blocked`, no-post recovery, and no posting permission.</step>
    </steps>
    <output>Coordinator-safe route based on reviewer state.</output>
    <hard_rule>Only `REVIEW=PASS` can reach draft, ready-to-post, or posting handling.</hard_rule>
  </phase>

  <phase id="5" name="return-or-post" mode="write-only-when-authorized">
    <purpose>Return the review output, or perform the single allowed mutation when all posting gates pass.</purpose>
    <steps>
      <step id="5.1" name="draft-or-unknown">For draft or unknown write mode, return the reviewer Mode, Status, and Comment. If the reviewer says `Comment mode=Ready to post` but the coordinator does not post, return `Mode: Ready to post`.</step>
      <step id="5.2" name="post-gate">For post-comment mode, attempt one post only when posting was explicitly requested, authorization and tooling are available, `REVIEW=PASS`, and `POST_ALLOWED=yes`.</step>
      <step id="5.3" name="successful-post">After one successful post of the exact reviewer comment, return `Mode: Posted`.</step>
      <step id="5.4" name="post-failure">If permission, API, or runtime failure prevents posting, return `Mode: Ready to post` when the exact comment remains safe for manual posting, or `Mode: Blocked` when the failure prevents safe posting. Do not retry.</step>
    </steps>
    <output>
      Refinement review complete.
      Mode: Draft | Ready to post | Posted | Blocked | Deferred
      Status: Ready | Needs refinement | Needs split | Needs spike | Blocked | Not actionable
      Comment: &lt;final comment or draft&gt;
    </output>
    <hard_rule>When posting, the coordinator must post the exact reviewer comment without editing it and must not perform any other tracker mutation.</hard_rule>
  </phase>
</phases>

<ambiguity_handling>
  Ask one concise question when no source item is available, posting authorization or tooling is unclear, or a human-gated recommendation would materially change the comment. Otherwise use the safe draft path and record uncertainty inside the comment as a question, missing evidence, or non-blocking note.
</ambiguity_handling>

<new_finding_rule>
  If the review discovers unavailable optional evidence, contradictions, invalid technical claims, duplicated or superseded work, oversized scope, spike signals, split signals, or sensitive recommendations, classify the finding explicitly and route it through the reviewer status, questions, recommendations, or deferred workflow instead of resolving it silently.
</new_finding_rule>

<autonomy_guardrails>
  In unattended runs, continue safely: return a draft, ask neutral questions in the comment, defer gated recommendations, choose the most evidence-supported non-ready status, and never wait indefinitely for approval unless the missing answer blocks safe review or posting.
</autonomy_guardrails>

<anti_patterns>
  Do NOT:
  - Edit tracker metadata, issue bodies, existing comments, hierarchy, links, status, labels, assignees, milestones, sprints, or child work while performing refinement review.
  - Treat a non-ready `REVIEW_STATUS` as `REVIEW=FAIL` when the review output itself passed validation.
  - Post a comment when `WRITE_MODE` is draft, unknown, unauthorized, unavailable, or when `POST_ALLOWED` is not `yes`.
  - Retry a failed post or perform another tracker mutation after a posting failure.
  - Present lifecycle, split, spike, security, data, permissions, migration, customer-impact, or operational-risk recommendations as approved when approval is missing.
  - Keep raw tracker payloads, long source text, or full analysis notes in coordinator context after the reviewer returns.
  - Fill missing evidence with plausible details instead of marking it as missing evidence, a blocker, a question, or a risk.
</anti_patterns>

<constraints scope="all-phases">
  <constraint id="1" name="reviewer-only-boundary">The workflow may inspect and comment; every other tracker change is deferred to a separate approved workflow.</constraint>
  <constraint id="2" name="single-comment-mutation">The only possible tracker mutation is one new refinement comment, and only after explicit posting intent, authorization, tooling availability, reviewer `REVIEW=PASS`, and `POST_ALLOWED=yes`.</constraint>
  <constraint id="3" name="state-readiness-separation">`REVIEW` describes whether the review run completed safely; `REVIEW_STATUS` describes the work item's readiness.</constraint>
  <constraint id="4" name="evidence-discipline">Every substantive finding, invalid claim, blocker, and recommendation needs a source pointer or must be labeled as missing evidence.</constraint>
  <constraint id="5" name="progressive-loading">Use bundled local references first. Fetch external websites only when requested, when current Jira or GitHub behavior matters, when technical claims require official verification, or when local guidance is too terse for the decision.</constraint>
  <constraint id="6" name="context-minimization">The coordinator retains compact verdict fields and the final comment or draft, not raw item payloads or full reviewer analysis.</constraint>
</constraints>

<success_criteria>
  - A source item or usable context was supplied, or the response is `Mode: Blocked` with one recovery question.
  - Mutation-only requests returned `Mode: Deferred` and did not perform refinement review or tracker mutation.
  - Exactly one `refinement-reviewer` dispatch occurred for a reviewable request.
  - `REVIEW=PASS` was the only reviewer state allowed to reach draft, ready-to-post, or posting handling.
  - `POST_ALLOWED=yes` appeared only for explicitly requested, authorized, tool-available `post-comment` runs.
  - `Mode: Posted` was used only after one successful post of the exact reviewer comment.
  - The final comment followed the required sections from `comment-template.md`, including explicit `None` where omission would hide that a category was checked.
  - All substantive findings, blockers, invalid technical claims, and recommendations had source pointers or were marked as missing evidence.
  - Gated recommendations were approved, neutralized into questions, or deferred.
  - No tracker mutation beyond the single authorized returned comment was performed or claimed.
</success_criteria>

## Assembly Notes

### Flow Used
- `full`, because the source skill is multi-phase, delegates to a subagent, gates mutation, may post to an external tracker, and has explicit validation and failure routes.

### Passes Skipped
- none

### Sections Omitted
- `empty_output_handling`: omitted because `refine-task` does not define zero-finding output categories beyond required comment sections and `None` handling.
- `suite_alignment`: omitted because no prompt suite context was supplied.

### Non-Obvious Decisions
- `REVIEW` and `REVIEW_STATUS` are kept separate because both `SKILL.md` and `reviewer-policy.md` state that a valid review can return a non-ready item status.
- Posting is described as `write-only-when-authorized` because the coordinator is otherwise read-only and the single allowed mutation is a returned refinement comment.
- The prompt repeats the exact-comment posting rule in the final phase because that is where forgetting it would create tracker risk.

### Removal-Test Table
| Tag | Behavior Lost If Removed |
| --- | --- |
| `<task>` | The prompt would no longer name the refinement-review deliverable or tracker boundary. |
| `<dispatch_rule>` | The coordinator/subagent separation and context minimization rule would be implicit. |
| `<scope>` | The distinction between inspection, comment drafting, posting, and tracker mutations would blur. |
| `<goal>` | The readiness outcome would be reduced to mechanical comment generation. |
| `<philosophy>` | The evidence-not-editing mental model would be less explicit. |
| `<context>` | Inputs and source-grounding files would be harder to audit. |
| `<phases>` | Ordered gates, reviewer dispatch, state routing, and post handling would be unactionable. |
| `<ambiguity_handling>` | Missing source, posting uncertainty, and human-gated recommendation ambiguity could be resolved silently. |
| `<new_finding_rule>` | Split, spike, contradiction, invalid-claim, and missing-evidence discoveries would lack routing. |
| `<autonomy_guardrails>` | Unattended runs could stall or overstep approval gates. |
| `<anti_patterns>` | Plausible but unsafe actions, such as editing tracker state or posting without authorization, would not be directly blocked. |
| `<constraints>` | Broad review-only and evidence-discipline rules would be scattered across phases. |
| `<success_criteria>` | A reader could not audit whether the workflow respected boundaries and produced a valid output. |

### Assumptions
- `ITEM_URL` and `ITEM_CONTEXT` are placeholders supplied by the runtime, not fixed values.
- Posting tooling is runtime-dependent; the skill defines gates and one-attempt behavior but does not name a specific connector.

### Resources Used
- Target source: `skills/refine-task/SKILL.md`; `skills/refine-task/subagents/refinement-reviewer.md`; `skills/refine-task/references/reviewer-policy.md`; `skills/refine-task/references/refinement-checks.md`; `skills/refine-task/references/comment-template.md`; `skills/refine-task/references/review-quality-checklist.md`; `skills/refine-task/references/external-sources.md`; `skills/refine-task/flow-diagram.md`.
- Prompt structurer helper: `skills/prompt-structurer/SKILL.md`; all six `skills/prompt-structurer/subagents/*.md`; `skills/prompt-structurer/references/tag-taxonomy.md`; `skills/prompt-structurer/references/failure-modes.md`; `skills/prompt-structurer/references/template-skeleton.md`.
- Web: `LOCAL_ONLY` for prompt assembly; external URLs are cataloged separately in `original-refine-task.references.md`.
- Dispatch: inline.
- Handoff: inline named sections.

### Suggested Follow-Ups
- none
