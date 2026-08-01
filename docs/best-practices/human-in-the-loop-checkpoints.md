# human-in-the-loop-checkpoints

## Tier

`mandatory`. Any hard-to-reverse or outward-facing action without a
current, artifact-bound human decision is a material authorization gap.

## When it applies

Use a human checkpoint immediately before an action whose consequences
are difficult to undo, visible outside the workspace, broader than the
approved scope, materially ambiguous, destructive, or costly.

| Trigger | Representative actions |
| ------- | ---------------------- |
| Irreversibility | Rewrite history, rotate a credential, finalize a release |
| External side effect | Post a review, send a message, create a commit, call a write API |
| Scope expansion | Add paths, targets, recipients, or permissions not already approved |
| Destructive operation | Delete, overwrite, reset, purge, or force-update |
| High ambiguity | Choose among materially different interpretations of intent |
| Cost | Spend money, consume substantial quota, or start an expensive long-running job |

A checkpoint is required before every hard-to-reverse or outward-facing
action, even when earlier conversation suggests the user will probably
approve it.

## The practice

Treat a checkpoint as an authorization boundary over a concrete action,
not as a conversational courtesy.

Rules:

1. **Name the gate and place it immediately before the action.** Finish
   preparation and verification first; do not ask the user to approve an
   artifact that still needs routine edits.
2. **Present a decision-ready preview.** Show the exact artifact or action
   that will execute: final text, exact file list or path mapping, exact
   command and arguments, recipients or targets, and material options.
   Never substitute a summary of intent for the thing being approved.
3. **Include decision evidence and consequences.** The preview names the
   scope, the checks that passed, unresolved risk, and what happens on
   decline. The user should not need to reconstruct the action from prior
   turns.
4. **Bind approval to this run and artifact version.** Record the run,
   named artifact or action, version or digest when practical, and the
   user's decision. Any change to approved text, paths, command, target,
   or material option invalidates approval and requires a new preview.
5. **Reject pre-approval and stale approval.** Statements such as "yes to
   whatever you produce" before the artifact exists do not authorize the
   later action. Record them as `ignored_preapproval`. Approval from a
   prior run or an earlier artifact version is also invalid.
6. **Ask the smallest targeted question.** Request only the decision that
   blocks the next transition. Avoid broad prompts such as "Does this all
   look good?" when the real question is whether to post one exact body.
7. **Bound re-asks.** Declare a small attempt cap and the route when it is
   exhausted. Invalid or ambiguous answers may trigger a targeted re-ask;
   after the cap, route to `needs_input` or `blocked` instead of looping.
8. **Route every valid answer.** Declining is a first-class outcome, not an
   error.

| Answer | Route |
| ------ | ----- |
| Approve the exact current preview | `proceed` with that version only |
| Request a change or select an alternative | `revise`, regenerate the preview, invalidate prior approval |
| Decline or cancel | `abort` the side effect and preserve/report any safe draft when useful |
| Ambiguous or missing through the attempt cap | `needs_input` or `blocked`, with recovery stated |

Do not add a checkpoint for reversible, in-scope, expected actions such
as reading files, running a declared read-only check, or writing an
already-authorized staging artifact. Over-asking trains users to
rubber-stamp prompts and destroys the signal value of the gates that
matter.

Usage evidence in this repository:

| Skill | Checkpoint pattern |
| ----- | ------------------ |
| [`review-pull-request`](../../skills/review-pull-request/SKILL.md) | Approval covers the exact verified posting preview, not a paraphrase |
| [`workflow-skill-architect`](../../skills/workflow-skill-architect/SKILL.md) | Pre-approval is rejected until staged-to-real paths are visible |
| [`improving-skill-definition`](../../skills/improving-skill-definition/SKILL.md) | Intake approval is recorded as `ignored_preapproval`; approval occurs over the current run's handoff |
| [`committing-scoped-changes`](../../skills/committing-scoped-changes/SKILL.md) | Commit authority requires a verbatim user request from the current conversation |
| [`council-of-advisors`](../../skills/council-of-advisors/SKILL.md) | `ConfirmFraming` allows at most three total attempts, then routes to `needs_input` |

## Rationale

A bare "yes" is not reliable authorization when the user has not seen
what will happen. Approval over a paraphrase can hide changed wording,
extra files, a different command flag, or a broader target. Binding the
decision to the exact current artifact makes the authorization
reproducible and auditable.

Late gates also separate preparation from mutation: the skill can gather
evidence and verify a draft without causing the side effect. Bounded
questions preserve progress without turning ambiguity into an infinite
conversation. Explicit decline and exhaustion routes make refusal and
missing input normal state-machine outcomes rather than exceptional
failures.

## Concrete examples

Good: exact verified artifact, scope and decline consequence are visible;
approval is version-bound.

```text
HUMAN_GATE_FINAL_PREVIEW_APPROVAL
Run: review-1020
Artifact: verified-review-v3
Target: github.com/org/repo/pull/1020
Action: post one `REQUEST_CHANGES` review with the exact body and three
inline comments shown below.
Evidence: `VERIFY: PASS`; 3 new comments; 0 duplicate threads.
On decline: save the verified draft locally with posting `cancelled`.

<exact-review-body-and-comments>
...
</exact-review-body-and-comments>

Approve this exact preview, request revisions, or decline posting?
```

If the user requests a wording change, produce `verified-review-v4`,
show it in full, and ask again. Approval of v3 does not carry forward.

Bad: pre-approval plus a summary is treated as authority, and changed
content reuses stale approval.

```text
The user said at intake, "Go ahead with whatever you produce."
I changed the review after verification and summarized it as "three
important findings." Posting now under the earlier approval.
```

## References

- [`review-pull-request/SKILL.md`](../../skills/review-pull-request/SKILL.md)
- [`workflow-skill-architect/SKILL.md`](../../skills/workflow-skill-architect/SKILL.md)
- [`improving-skill-definition/SKILL.md`](../../skills/improving-skill-definition/SKILL.md)
- [`committing-scoped-changes/SKILL.md`](../../skills/committing-scoped-changes/SKILL.md)
- [`council-of-advisors/SKILL.md`](../../skills/council-of-advisors/SKILL.md)
