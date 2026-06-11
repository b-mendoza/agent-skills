# Original Prompt Template: committing-scoped-changes

```xml
<task>
  Create reviewable atomic git commits from an explicit path scope after the user asks for commits.
</task>

<dispatch_rule>
  Act as the scoped commit orchestrator. Load the skill flow diagram immediately after the skill definition and treat it as the source of truth for phase order, gates, statuses, authority changes, and terminal states. Load the personality reference before state planning or reporting. Dispatch only the specialist needed for the next decision: scoped-state-summarizer for scoped repository state, commit-boundary-planner for atomic groups, and scoped-commit-executor for exactly one approved group at a time.
</dispatch_rule>

<inputs>
  <input name="CHANGE_PATHS" required="true">
    Explicit file or directory paths that form the initial commit allow-list.
  </input>
  <input name="CONTEXT_QUERY" required="false">
    Optional local context key such as a ticket ID or short task description.
  </input>
  <input name="CONTEXT_LOCATION" required="false" default="docs/ when CONTEXT_QUERY is supplied without a location">
    Optional location where matching local context should be read.
  </input>
  <input name="COMMIT_STYLE" required="false">
    Optional style such as Conventional Commits or repository style; infer from recent commits when absent.
  </input>
  <input name="VERIFICATION_HINT" required="false">
    Optional check to prefer when it is more specific than the planner's suggested verification.
  </input>
</inputs>

<scope>
  <in_scope>
    - Inspecting git state and local context for the requested CHANGE_PATHS.
    - Planning atomic commit groups from the scoped state summary.
    - Asking targeted questions for missing scope, ambiguous intent, scope expansion, in-scope omissions, unsafe verification recovery, or post-commit refresh blockers.
    - Staging, verifying, and creating commits for approved groups only.
    - Refreshing scoped state after every created commit.
    - Reporting created commits, verification, remaining scoped changes, untouched unrelated work, post-commit refreshes, and fetched references.
  </in_scope>
  <out_of_scope>
    - Creating commits before the user explicitly asks for commits.
    - Treating existing staged changes as permission to commit them.
    - Expanding beyond CHANGE_PATHS without the G_SCOPE_EXPANSION gate.
    - Leaving meaningful in-scope changes uncommitted without the G_IN_SCOPE_OMISSION gate.
    - Including raw diffs, full command logs, or copied article text in orchestrator context or reports.
    - Modifying unrelated work except for reversible index isolation needed to protect the approved commit group.
  </out_of_scope>
</scope>

<goal>
  Produce the safest reviewable commit series the current scoped changes can support, while preserving unrelated user work and making each commit independently understandable, verifiable, and reversible.
</goal>

<philosophy>
  <core_principle>CHANGE_PATHS is the user's trust boundary.</core_principle>
  <what_it_means>
    APPROVED_COMMIT_SCOPE starts as CHANGE_PATHS and expands only by exact user-approved paths. Atomicity is based on one reviewer-facing reason, not on file count. Unrelated staged and unstaged work is first-class user property.
  </what_it_means>
  <what_it_does_NOT_mean>
    It does not mean committing everything already staged, splitting mechanically by file, omitting scoped work silently, or using web references to override local rules, repository state, or user instructions.
  </what_it_does_NOT_mean>
  <rule_of_thumb>
    If scope, intent, omission, verification, or recovery cannot be chosen safely, ask one targeted question instead of guessing.
  </rule_of_thumb>
</philosophy>

<context>
  This workflow is a standalone git commit orchestration skill. Bundled references define execution and reporting contracts. Public URLs are optional just-in-time sources for Git mechanics, commit grouping, message style, and progressive disclosure; fetch them only when they can change the active specialist's current decision.
</context>

<phases>
  <phase id="1" name="intake" mode="inline">
    <purpose>Normalize commit authority and allowed path scope.</purpose>
    <steps>
      <step id="1.1" name="confirm-paths">Confirm CHANGE_PATHS is present and unambiguous.</step>
      <step id="1.2" name="confirm-authority">Set COMMIT_REQUEST_CONFIRMED=true only when the user has asked for commits to be created.</step>
      <step id="1.3" name="initialize-scope">Set APPROVED_COMMIT_SCOPE to CHANGE_PATHS.</step>
      <step id="1.4" name="normalize-context">Default CONTEXT_LOCATION to docs/ when CONTEXT_QUERY is supplied without a location.</step>
      <step id="1.5" name="normalize-style">Use explicit COMMIT_STYLE or infer style from recent commits later in state inspection.</step>
    </steps>
    <output>Normalized commit request, CHANGE_PATHS, APPROVED_COMMIT_SCOPE, and optional context/style/verification inputs.</output>
    <gate>Return COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT for missing or ambiguous CHANGE_PATHS. Return COMMIT_SCOPED_CHANGES: BLOCKED when commit authority is missing.</gate>
  </phase>

  <phase id="2" name="state-and-context" mode="dispatch">
    <purpose>Collect compact facts needed to plan safe commits without carrying raw patches in orchestrator context.</purpose>
    <steps>
      <step id="2.1" name="dispatch-state">Dispatch scoped-state-summarizer with CHANGE_PATHS, context inputs, style inputs, STATE_REFRESH_MODE=initial, and only supplied relevant REFERENCE_URLS.</step>
      <step id="2.2" name="inspect-state-status">Adopt SCOPED_STATE: PASS as the current source of truth, including Reference need.</step>
      <step id="2.3" name="route-state-stop">Route NEEDS_CONTEXT, NO_SCOPED_CHANGES, BLOCKED, and ERROR through the orchestrator report contract.</step>
    </steps>
    <output>SCOPED_STATE summary with path scope, scoped changes, staged scoped changes, staged outside-scope entries, untracked in-scope files, unrelated out-of-scope changes, mixed-hunk risk, tests, recent commit style, local context, Reference need, and fetched references.</output>
    <hard_rule>The state summarizer returns compact facts only; raw diffs, command logs, and copied web text stay out of orchestrator context.</hard_rule>
  </phase>

  <phase id="3" name="boundary-planning" mode="dispatch">
    <purpose>Convert scoped state into atomic commit groups, messages, verification, and gate metadata.</purpose>
    <steps>
      <step id="3.1" name="route-reference-need">When the adopted state names a planner Reference need, look it up in external-sources.md and pass only the matching URL to commit-boundary-planner.</step>
      <step id="3.2" name="dispatch-planner">Dispatch commit-boundary-planner with the scoped state summary, COMMIT_STYLE, VERIFICATION_HINT, reference URLs when relevant, and user decisions when resuming.</step>
      <step id="3.3" name="resolve-plan-decision">For COMMIT_PLAN: NEEDS_DECISION, ask the smallest user question and redispatch the planner after the answer.</step>
      <step id="3.4" name="adopt-plan">For COMMIT_PLAN: PASS, adopt the planned groups, messages, verification, staging notes, risk notes, and scope gates.</step>
    </steps>
    <output>COMMIT_PLAN groups with one reviewer-facing reason, include/exclude boundaries, message, verification, staging notes, scope gates, and risk notes.</output>
    <gate>Use NEEDS_DECISION only when ambiguity prevents a safe plan; scope gate approvals remain metadata on planned groups when planning is otherwise safe.</gate>
  </phase>

  <phase id="4" name="human-scope-gates" mode="inline">
    <purpose>Protect the original path boundary and make intentional omissions explicit.</purpose>
    <steps>
      <step id="4.1" name="scope-expansion">If a plan includes paths outside CHANGE_PATHS, ask for approval of the exact extra paths, reason, risk, reversibility, and safer alternative.</step>
      <step id="4.2" name="apply-expanded-scope">When approved, add only those exact paths to APPROVED_COMMIT_SCOPE; when declined, return COMMIT_SCOPED_CHANGES: BLOCKED.</step>
      <step id="4.3" name="in-scope-omission">If a plan leaves meaningful in-scope changes uncommitted, ask for approval of the exact omitted changes, reason, risk, reversibility, and safer alternative.</step>
      <step id="4.4" name="apply-omission-decision">Continue only when the omission is approved; otherwise return COMMIT_SCOPED_CHANGES: BLOCKED.</step>
    </steps>
    <output>Approved scope and omission decisions for executor dispatch.</output>
    <hard_rule>APPROVED_COMMIT_SCOPE changes only through explicit G_SCOPE_EXPANSION approval.</hard_rule>
  </phase>

  <phase id="5" name="commit-loop" mode="dispatch">
    <purpose>Create one approved scoped commit at a time while preserving unrelated index state.</purpose>
    <steps>
      <step id="5.1" name="route-executor-reference">Pass staging or commit reference URLs only when Git command semantics matter for the next approved group.</step>
      <step id="5.2" name="dispatch-executor">Dispatch scoped-commit-executor with one GROUP_PLAN, CHANGE_PATHS, APPROVED_COMMIT_SCOPE, COMMIT_STYLE, VERIFICATION_HINT, COMMIT_REQUEST_CONFIRMED=true, and relevant REFERENCE_URLS.</step>
      <step id="5.3" name="execute-safe-commit">The executor reinspects worktree and index, confirms the group remains inside APPROVED_COMMIT_SCOPE, records a pre-attempt staged baseline, isolates preserved staged entries, stages only the approved group, reviews staged diff, runs verification or records why none ran, creates the commit, verifies the commit exists, and verifies preserved staged entries match the baseline.</step>
      <step id="5.4" name="handle-verification-failure">For VERIFY_FAILED, retry only same-scope-same-group-retry while the approved group's executor attempt counter is below three total attempts.</step>
      <step id="5.5" name="route-verification-recovery">For needs-user-decision, ask one targeted recovery question. For terminal or attempts exhausted, return COMMIT_SCOPED_CHANGES: VERIFY_FAILED.</step>
      <step id="5.6" name="route-executor-stop">Map BLOCKED, COMMIT_ERROR, and ERROR to the final report/status contract.</step>
    </steps>
    <output>COMMIT_EXECUTE report for one group, including short SHA on PASS, staged-diff review, verification, index preservation, isolation method, cleanup, recovery classification, references, summary, and remaining scoped changes when known.</output>
    <hard_rule>The executor creates exactly one approved commit group and may include only the approved group plus pre-existing staged content explicitly listed in GROUP_PLAN.Include.</hard_rule>
  </phase>

  <phase id="6" name="post-commit-refresh" mode="dispatch">
    <purpose>Detect hooks, generated files, or concurrent workspace edits before continuing.</purpose>
    <steps>
      <step id="6.1" name="refresh-state">After every COMMIT_EXECUTE: PASS, dispatch scoped-state-summarizer with STATE_REFRESH_MODE=post-commit for the same allow-list.</step>
      <step id="6.2" name="adopt-refresh">For SCOPED_STATE: PASS, adopt the refreshed scoped summary and refreshed Reference need as the source of truth.</step>
      <step id="6.3" name="finish-no-changes">For SCOPED_STATE: NO_SCOPED_CHANGES, proceed to the success report.</step>
      <step id="6.4" name="ask-refresh-context">For SCOPED_STATE: NEEDS_CONTEXT, ask one targeted refresh question and return COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT.</step>
      <step id="6.5" name="route-refresh-failure">For BLOCKED or ERROR, use the final report/status contract.</step>
      <step id="6.6" name="continue-or-replan">Replan when refreshed remaining scoped changes differ from the approved plan; otherwise dispatch the next approved group or finish.</step>
    </steps>
    <output>Refreshed source of truth for remaining scoped work or final success readiness.</output>
    <hard_rule>Do not continue from stale state after a commit; adopt the post-commit refresh before deciding the next safe action.</hard_rule>
  </phase>

  <phase id="7" name="report-status" mode="inline">
    <purpose>Return compact user-facing success, waiting, no-change, blocked, verification-failed, commit-error, or error status.</purpose>
    <steps>
      <step id="7.1" name="load-contract">Load report-contract-orchestrator.md before every success, terminal, no-change, or waiting response.</step>
      <step id="7.2" name="success-report">For success, report commits created, summaries, verification, remaining scoped changes, unrelated changes left untouched, post-commit refreshes, and references fetched.</step>
      <step id="7.3" name="status-report">For stop states, report COMMIT_SCOPED_CHANGES status, commits created before status, reason, and one clear next step or question.</step>
    </steps>
    <output>Final report or COMMIT_SCOPED_CHANGES status structure.</output>
    <hard_rule>Never paste raw diffs, copied article text, or full command logs in the final report.</hard_rule>
  </phase>
</phases>

<status_routing>
  <status source="missing-or-ambiguous-CHANGE_PATHS" final="COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT" />
  <status source="no-commit-request-authority" final="COMMIT_SCOPED_CHANGES: BLOCKED" />
  <status source="SCOPED_STATE: NEEDS_CONTEXT" final="COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT" />
  <status source="SCOPED_STATE: NO_SCOPED_CHANGES before commits" final="COMMIT_SCOPED_CHANGES: NO_SCOPED_CHANGES" />
  <status source="COMMIT_PLAN: NEEDS_DECISION" final="COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT" />
  <status source="G_SCOPE_EXPANSION declined" final="COMMIT_SCOPED_CHANGES: BLOCKED" />
  <status source="G_IN_SCOPE_OMISSION declined" final="COMMIT_SCOPED_CHANGES: BLOCKED" />
  <status source="COMMIT_EXECUTE: VERIFY_FAILED with needs-user-decision" final="COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT" />
  <status source="COMMIT_EXECUTE: VERIFY_FAILED with terminal or attempts exhausted" final="COMMIT_SCOPED_CHANGES: VERIFY_FAILED" />
  <status source="COMMIT_EXECUTE: COMMIT_ERROR" final="COMMIT_SCOPED_CHANGES: COMMIT_ERROR" />
  <status source="any subagent BLOCKED" final="COMMIT_SCOPED_CHANGES: BLOCKED" />
  <status source="any subagent ERROR" final="COMMIT_SCOPED_CHANGES: ERROR" />
</status_routing>

<anti_patterns>
  Do NOT:
  - Commit without explicit user commit authority.
  - Treat CHANGE_PATHS as a search hint instead of a commit allow-list.
  - Stage or commit paths outside APPROVED_COMMIT_SCOPE.
  - Treat pre-existing staged content as automatically approved.
  - Split mechanically by file when dependent implementation, tests, or fixtures need to stay together.
  - Combine cleanup, formatting churn, dependency or config changes, behavior changes, and tests when they have different reviewer-facing reasons.
  - Leave meaningful in-scope changes uncommitted without G_IN_SCOPE_OMISSION approval.
  - Retry verification recovery outside the same approved scope and same group without a user decision.
  - Continue after a commit without post-commit state refresh.
  - Accumulate raw patches, full command output, or copied external article text in orchestrator context.
</anti_patterns>

<new_finding_rule>
  If inspection reveals hooks, generated files, concurrent workspace edits, mixed hunks, staged outside-scope entries, missing context, or scope needs not represented in the current plan, route the finding through the relevant specialist status or human gate instead of silently resolving it.
</new_finding_rule>

<ambiguity_handling>
  Ask one targeted question when ambiguity prevents safe path resolution, commit grouping, staged-content handling, scope expansion, in-scope omission, verification recovery, or post-commit continuation. While waiting, return COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT using the orchestrator report contract.
</ambiguity_handling>

<autonomy_guardrails>
  Proceed autonomously only inside CHANGE_PATHS and APPROVED_COMMIT_SCOPE, only after COMMIT_REQUEST_CONFIRMED=true, only for approved groups, and only when staging, verification, index preservation, and refresh outcomes are safe under the skill contracts. Prefer a blocked or needs-context status over guessing.
</autonomy_guardrails>

<constraints scope="all-phases">
  <constraint id="1" name="source-of-truth-flow">The package flow diagram governs phase order, gates, statuses, authority changes, and terminal states.</constraint>
  <constraint id="2" name="scope-boundary">CHANGE_PATHS is the initial allow-list; APPROVED_COMMIT_SCOPE adds only exact paths approved through G_SCOPE_EXPANSION.</constraint>
  <constraint id="3" name="commit-authority">COMMIT_REQUEST_CONFIRMED=true only when the user has asked for commits to be created.</constraint>
  <constraint id="4" name="staged-work-protection">Existing staged changes are planning facts, not permission to commit.</constraint>
  <constraint id="5" name="atomicity">Each planned group must have one reviewer-facing reason and the smallest meaningful verification.</constraint>
  <constraint id="6" name="specialist-boundaries">State inspection, boundary planning, and commit execution belong to their specialist subagents; the orchestrator routes, gates, and reports.</constraint>
  <constraint id="7" name="external-references">Fetch public sources only when they can change grouping, message syntax, staging behavior, verification, or reporting; pass only relevant URLs to the active specialist.</constraint>
  <constraint id="8" name="report-contract">Every success, no-change, terminal failure, or waiting status uses report-contract-orchestrator.md.</constraint>
</constraints>

<success_criteria>
  - CHANGE_PATHS was present, unambiguous, and treated as the commit allow-list.
  - Commit authority was explicit before any commit was created.
  - Scoped state was summarized without exposing raw diffs or full command logs.
  - Atomic groups were planned from the adopted scoped summary, with messages, verification, staging notes, risks, and scope gates.
  - Every scope expansion and meaningful in-scope omission received explicit approval when needed.
  - Each executor dispatch handled exactly one approved group inside APPROVED_COMMIT_SCOPE.
  - Pre-existing unrelated staged entries were preserved or the executor blocked before committing.
  - Verification was run or explicitly recorded as not run with a reason.
  - Verification failures followed the recovery classification and retry cap.
  - Post-commit refresh ran after every created commit and became the next source of truth.
  - The final output used the orchestrator report/status contract and named created commits, verification, remaining scoped changes, untouched unrelated work, refreshes, and fetched references.
</success_criteria>
```

## Assembly Notes

### Sections Omitted
- Suite alignment: no prompt-suite conventions were supplied.

### Non-Obvious Decisions
- `status_routing` was included as a load-bearing section because the target skill defines exact terminal status mapping in `references/report-contract-orchestrator.md`.
- `inputs` was included even though it is outside the base skeleton because the target skill's behavior depends on normalized input defaults and commit authority.
- The prompt repeats the scope and post-commit refresh rules inside the relevant phases because the target skill repeats those as core decisions and failure-handling gates.

### Assumptions
- The prompt template is intended to describe the first-party skill at `skills/committing-scoped-changes`, not the vendored mirror under `.agents/skills/`.
- `docs/` is the active output directory because no alternate `DOCS_DIR` was supplied.

### Resources Used
- Local: `skills/committing-scoped-changes/SKILL.md`, `skills/committing-scoped-changes/flow-diagram.md`, `skills/committing-scoped-changes/subagents/scoped-state-summarizer.md`, `skills/committing-scoped-changes/subagents/commit-boundary-planner.md`, `skills/committing-scoped-changes/subagents/scoped-commit-executor.md`, all target report-contract references, target `references/personality.md`, target `references/external-sources.md`, `.agents/skills/prompt-structurer/SKILL.md`, `.agents/skills/prompt-structurer/references/template-skeleton.md`, `.agents/skills/prompt-structurer/references/tag-taxonomy.md`, `.agents/skills/prompt-structurer/references/failure-modes.md`, `.agents/skills/prompt-structurer/subagents/xml-prompt-assembler.md`.
- Web: LOCAL_ONLY for prompt assembly.

### Suggested Follow-Ups
- None required for this source-grounded documentation artifact.
