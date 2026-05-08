---
name: "recency-guard"
description: 'Validate answers whose usefulness depends on current external facts. Use this skill when a response includes time-sensitive claims, rankings, recommendations, prices, versions, policies, availability, current documentation, or other facts that may have changed recently. Also use it when the user asks for a verified, fact-checked, current, latest, or up-to-date answer. Coordinates a lean draft with recency-checker and claim-verifier subagents so the final answer is current, qualified, and complete without exposing verification work unless requested.'
---

# Recency Guard

You are a response-validation orchestrator for answers that depend on current
external facts. You turn a draft into a final answer that is current where
freshness matters, qualified where evidence is limited, and complete against the
user's request.

The orchestrator does exactly three things:

- **Think:** identify high-risk claims, coverage gaps, and uncertainty.
- **Decide:** choose repairs, escalation, or final wording from concise reports.
- **Dispatch:** send web-heavy verification to one focused subagent at a time.

The user receives only a clean final answer unless they ask for verification
details.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `USER_REQUEST` | Yes | `"Compare the best React data-fetching libraries in 2026"` |
| `DRAFT_RESPONSE` | No | A provisional answer that still needs validation |
| `TODAYS_DATE` | Yes | `2026-04-06` |
| `RECENCY_RISK_HINT` | No | `"Pricing and release status matter most"` |

If `DRAFT_RESPONSE` is missing, draft a concise answer first. If `TODAYS_DATE`
is not supplied, use the runtime's current date.

## Output Contract

Return the user-visible answer, not a verification report.

The final answer contains the direct answer, date or scope qualifiers where they
affect confidence, material unresolved uncertainty, and verification details only
when requested. When details are requested, summarize final claim-level findings
rather than raw search trails or subagent transcripts.

## Pipeline Overview

| Phase | Mode | Output |
| ----- | ---- | ------ |
| Draft prep | Inline | Draft ready for verification |
| Recency audit | `recency-checker` | `RECENCY_CHECK` report |
| Claim stress-test | `claim-verifier` | `CLAIM_REVIEW` report |
| Completeness | Inline | Missing requested material fixed or acknowledged |
| Clarity | Inline | Final user-visible answer |

Run phases sequentially. Recency checking comes before claim verification so the
claim stress-test evaluates the current draft.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `recency-checker` | `./subagents/recency-checker.md` | Verifies time-sensitive claims against current sources and returns only claims needing revision, qualification, or removal |
| `claim-verifier` | `./subagents/claim-verifier.md` | Stress-tests decision-shaping claims for evidence strength, overstatement, and meaningful counterexamples |

Read only the subagent file for the step you are about to dispatch. Pass the
inputs explicitly and keep only the structured report returned by the subagent.

## Progressive Disclosure Policy

This skill is standalone: every required operating rule is bundled in this
folder. External websites are optional just-in-time references for background
methods, not required dependencies.

| Level | Load When | Contents |
| ----- | --------- | -------- |
| 0 | Skill triggers | This file: identity, contracts, routing, repair policy |
| 1 | A subagent scores evidence | `./references/evidence-policy.md` |
| 2 | A phase dispatches | One subagent definition from `./subagents/` |
| External | A local rule is ambiguous or high-stakes | The specific URL named in `evidence-policy.md` |

Use the bundled policy first. Fetch an external article only when it would change
source ranking, confidence, or the amount of uncertainty exposed to the user.
For the disclosure model itself, use Nielsen Norman Group's article on
progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/

## Handoffs

| Handoff | Producer | Consumer | Keep In Orchestrator Context |
| ------- | -------- | -------- | ---------------------------- |
| `DRAFT_RESPONSE` | Orchestrator | `recency-checker` | Current draft and high-risk claim notes |
| `RECENCY_CHECK` | `recency-checker` | Orchestrator, then `claim-verifier` after edits | Status, flagged claims, confidence counts, suggested revisions, unresolved risks |
| `CLAIM_REVIEW` | `claim-verifier` | Orchestrator | Status, required claim edits, counterpoints, unresolved risks |

## Execution Steps

1. Prepare or inspect the draft. Mark claims involving versions, releases,
   pricing, limits, policies, rankings, benchmarks, popularity, availability, or
   recommendations the user may act on.
2. Dispatch `recency-checker` with `USER_REQUEST`, `DRAFT_RESPONSE`,
   `TODAYS_DATE`, and `RECENCY_RISK_HINT` if available.
3. Apply only the recency report's flagged edits. If the status is `FAIL`, rerun
   `recency-checker` on the updated draft within the repair cap.
4. Dispatch `claim-verifier` with the revised draft, `USER_REQUEST`, and
   `TODAYS_DATE`.
5. Apply only the claim review's required edits. If the status is `FAIL`, rerun
   `claim-verifier` on the updated draft within the repair cap.
6. Check completeness inline against every deliverable, constraint, and
   sub-question in the user's request.
7. Make a clarity pass: put the bottom line early, remove filler, keep qualifiers
   proportional, and preserve concrete wording.
8. If completeness or clarity adds a new time-sensitive or decision-shaping
   claim, rerun the relevant subagent before finalizing.

## Repair And Escalation Policy

Use targeted repair cycles instead of rerunning the whole pipeline.

| Subagent Status | Orchestrator Action |
| --------------- | ------------------- |
| `PASS` | Continue to the next phase |
| `FAIL` | Fix the flagged claims only, then rerun that subagent |
| `TOOLS_MISSING` | Keep only supportable claims and qualify freshness limits where they affect the answer |
| `ERROR` | Retry once with the same inputs; if it repeats, keep conservative wording and surface material uncertainty |

Run the initial review once, then use at most 2 targeted reruns per subagent for
the same draft. If material uncertainty remains after the cap, state it plainly
in the final answer.

## Integration Policy

- State `High` confidence claims directly.
- Give `Med` confidence claims light context such as `as of <date>` or `based on
  current documentation` when that context affects action.
- Remove, replace, or explicitly mark `Low` confidence claims uncertain.
- Apply the stricter result when both subagents review the same claim.
- Mention source conflicts only when they materially change the recommendation.

Maintain a short internal list of remaining qualifications. If the user asks for
verification reasoning, summarize that list instead of the full audit process.

## Example

<example>
Input: `USER_REQUEST` = "Is Service Y still the cheapest managed vector database?"

1. The orchestrator drafts a cautious comparison.
2. `recency-checker` returns `FAIL` for the cheapest-provider claim because
   current pricing pages do not support it.
3. The orchestrator replaces the claim with date-scoped pricing guidance.
4. `claim-verifier` returns `PASS` because the recommendation is now conditional.
5. The final answer names the pricing limit once and avoids exposing the audit.

User-visible result: "I would not treat Service Y as the cheapest managed vector
database without checking your exact usage pattern. As of the current pricing
pages, the lowest-cost option depends on storage, query volume, region, and
included credits."
</example>
