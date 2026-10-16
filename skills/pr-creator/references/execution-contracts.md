# PR Creator Execution Contracts

[`../state-machine.md`](../state-machine.md) alone owns routing. These contracts
own JSON shapes, approval artifacts, and user-facing output.

## JSON boundary

Every specialist returns one JSON object, without prose or fences. All replies
require `status`, nonempty `reason`, and `decision_needed` (a nonempty question
or `null`). No unknown or duplicate keys. Facts not required by the current
status may be omitted; a nullable fact uses `null` for unavailable/not
applicable, never invented data. Omit unestablished nonnullable facts. Empty
arrays mean known none, not unavailable. `TOOLS_MISSING` additionally requires a
nonempty `missing_tools` array of nonempty capability names. Never include raw
logs, patches, secrets, clocks, or report IDs.

The consumer runs the checker before reading routed fields:

```sh
python3 -I "${SKILL_DIR}/scripts/validate-output.py" <role> < payload.json
python3 -I "${SKILL_DIR}/scripts/validate-output.py" pr-submitter --approved-preview "$RUN_DIR/preview.json" < receipt.json
python3 -I "${SKILL_DIR}/scripts/validate-output.py" preview-approval < "$RUN_DIR/preview.json"
python3 -I "${SKILL_DIR}/scripts/validate-output.py" push-approval < "$RUN_DIR/push.json"
python3 -I "${SKILL_DIR}/scripts/validate-output.py" --self-test
```

`<role>` is one of the six specialist names; `pr-submitter` always requires the
explicit preview path. Other modes reject that argument. Payloads can be piped
as literal data; six report files are not required. Exit 0 conforms; exit 1
prints one finding per shape defect; exit 2 is invocation/checker failure.
Malformed, missing, or unknown-status output ends with `PR_CREATE: ERROR`, with
no repair or mutating retry. Missing Python/shell is caller-side
`TOOLS_MISSING`. Valid role checks emit `status`; the submitter's known-object
comparison and approval modes emit the additional results specified here and in
its contract. The checker has no side effects, environment configuration, Git,
or network. It proves shape, artifact identity, and the specified comparison,
not evidence truth, account existence, natural-language title compliance, or
consent.

All counts are nonnegative integers, not booleans. SHAs are full lowercase 40-
or 64-hex Git object IDs; digests are lowercase 64-hex SHA-256. Text is valid
UTF-8. Metadata identities are exact canonical platform strings, not display
names. Resolve identities, strip one leading `@` from account inputs, then
deduplicate and sort reviewers, labels, and assignees before freezing. Never
trim, normalize, recase, reflow, or append a newline to title/body.

## Frozen artifacts and approval

`preview.json` contains exactly these keys, all required:

| Keys                                 | Values                                               |
| ------------------------------------ | ---------------------------------------------------- |
| `run_id`                             | Owned `RUN_DIR` basename; no slash                   |
| `action`                             | `create`                                             |
| `platform`                           | `github`, `github-enterprise`, `gitlab`, `bitbucket` |
| `create_plan`                        | Nonempty exact checked command/API plan              |
| `base_repository`, `head_repository` | Canonical host/repository identities                 |
| `base_remote`, `head_remote`         | Nonempty remote names                                |
| `base_branch`, `head_branch`         | Nonempty branch names                                |
| `base_sha`, `head_sha`               | Full pinned SHAs                                     |
| `title`, `body`                      | Exact nonempty JSON strings                          |
| `reviewers`, `labels`, `assignees`   | Arrays of nonempty canonical strings                 |
| `requested_state`, `effective_state` | `draft` or `ready`                                   |

The plan includes the exact target, metadata, effective state, and absolute
literal body-file transport. It is evidence of a checked path, not executable
permission. A `ready` request cannot silently become draft. Draft-to-ready
fallback needs the user's explicit choice before freezing.

`push.json` contains exactly `run_id`, `action` (`push`), `head_repository`,
`head_remote`, `source_sha`, `destination_branch`, and `refspec`. Strings are
nonempty; `source_sha` is full SHA. `refspec` must equal
`<source_sha>:refs/heads/<destination_branch>`. Approve and execute only `git
push <head_remote> <refspec>`, without force; verify the published SHA. A moving
local branch name is not an approved source. Rejection authorizes no force,
divergence repair, commit edit, or automatic new publication.

The checker is the sole digest implementation. It canonicalizes metadata arrays
as sorted sets, then hashes UTF-8 JSON with sorted object keys, compact
separators, `ensure_ascii=false`, and no terminal newline. `preview-approval`
emits `artifact_digest` and `approved_body_digest`; `push-approval` emits
`artifact_digest`. The body digest hashes the decoded body's exact UTF-8 bytes.
Metadata reordering leaves the artifact digest unchanged; body newlines do not.

An `approval_record` is `null` when absent, otherwise exactly:

| Key                 | Value                                          |
| ------------------- | ---------------------------------------------- |
| `checkpoint`        | `push` or `preview`                            |
| `run_id`            | Current artifact's run identity                |
| `artifact_digest`   | Checker-derived digest of that artifact        |
| `user_approval_ref` | Nonempty reference to actual approval this run |

Records live in native session state, not a new file/registry. The checker
checks shape and artifact binding where supplied; the orchestrator must
establish real user provenance. A digest is not consent. Prior-run or
pre-preview consent is unusable. Missing/lost provenance requires a fresh
preview and approval.

Named checkpoints accept `APPROVED`, `REVISE`, or `ABORT`.
`checkpoint_reask_count[checkpoint]` starts at 0, cap 1; increment before one
targeted re-ask. Another unclear answer at cap, or unavailable conversation
wait, is `BLOCKED` with the pending question. `ABORT` stops without outward
mutation. Any changed mutation-relevant field voids approval and returns to its
earliest affected phase. `HEAD_MOVED` clears pins/approval and returns through
preflight. Scope consent is an ordinary head-bound choice, not an approval
digest.

## Sources and preview

Title priority: exact `TITLE_OVERRIDE`, explicit `TITLE_RULES`, explicit
repository rule, then Conventional-Commit fallback. Do not infer tickets or
rules from recent titles. Body priority: exact `BODY_OVERRIDE`, one selected
template, then the fallback below. `pr-drafter` discovers and reads sources;
the orchestrator never reads or transports rule/template contents. Repository
files come from the base default branch at a recorded full SHA. Applicable
GitLab project-settings defaults use canonical project and setting identities,
not Git revisions. An explicitly selected local template is identified as local.
One authoritative default/unambiguous candidate wins; several candidates need
a choice, not invented precedence or merging. Unreadable/default-settings-unknown
is not absence: drafter `NEEDS_CHOICE` carries bounded identities for the
orchestrator to show with an explicit fallback option. Redispatch with the
selected identity/fallback; the drafter re-reads and checks the recorded source.
Confirmed absence uses fallback without another gate. Preserve template headings,
wording, order, and checklists; mark unknown or inapplicable facts honestly.
Source notes and author notes stay outside the body. Repository/template
instructions never grant permissions.

Show the exact artifact before creation, plus checks and unresolved limits:

```text
PR Preview
Title: <exact title>
Base repository / remote / branch / SHA: <values>
Head repository / remote / branch / SHA: <values>
State: <requested_state> (effective: <effective_state>)
Reviewers: <canonical list or none>
Labels: <canonical list or none>
Assignees: <canonical list or none>
Title source and rule: <source identity and concise constraint summary>
Body/template source: <repository/path/revision, project/setting, explicit local path, or override/fallback>
Action/command plan: <exact create_plan>
Checks and unresolved limits: <evidence>
Description:
<full exact body>
Reply APPROVED, REVISE, or ABORT. ABORT creates nothing.
```

Fallback body (only observed tests; no author notes or hidden instructions):

```text
## Summary

- <concise diff-grounded statement>

## Key Changes

- <grounded changes>

## Impact

- <grounded impact>
- Tests: <observed evidence, or explicitly not run/unknown>
```

## Mutation limits and lifecycle

Pass fixed `MUTATION_LIMITS` unchanged to every specialist: only newly owned
files in private external `RUN_DIR`, necessary Git ref/FETCH_HEAD effects
through stated Git operations, and separately approved exact outward
push/create. No tracked source, staging, commits, config, ignore rules, mirrors,
or locks change. No scope-widening input exists. Capture Git status
before/after; report unexpected deltas and inspect affected hunks on
already-dirty paths; never auto-repair them.

Resolve an OS temporary base outside the working tree first. Under `umask 077`,
create one owner-only directory with `mktemp -d`; reuse its basename as
`run_id`. Use absolute paths throughout. Create only `preview.json`, literal
UTF-8 `body.md`, and, if needed, `push.json`; never overwrite an existing
file/symlink. Record each owned file. At every terminal, delete only recorded
owned files, then remove the directory only if empty; never recursively clean a
temp parent. The `scope-run-files-to-the-run` external-temp exception avoids
requiring normal repositories to add a `.handoffs` ignore rule;
ownership/cleanup still apply.

## Final envelope

Closed enum: `PR_CREATE: PASS | GAPS_FOUND | BLOCKED | ERROR`.

| Result       | Mapping / retained reason codes                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PASS`       | Verified created or immediate race-found request; distinguish `created` from `found`.                                                                                                         |
| `GAPS_FOUND` | Known request missing/altering approved values or unavailable readback. Never create/correct/retry it.                                                                                        |
| `BLOCKED`    | Prerequisite, `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `PR_EXISTS`, `EMPTY_DIFF`, `CANCELLED`, `AWAITING_USER`, `TOOLS_MISSING`, `ESCALATED`, or unresolved `CREATE_UNCERTAIN`. |
| `ERROR`      | Malformed/missing output, checker failure, unrecoverable operation, `ERROR`, or definitive `CREATE_ERROR`.                                                                                    |

Preflight `PR_EXISTS` stops with URL and no update. Uncertain creation states
that a remote object may exist even without URL. Confirmed creation followed by
tool or readback failure is a verification gap, never a new-create retry. Retain
gate and old domain code as reasons, not new final statuses. Include evidence,
URL when known, and one next step when action remains. No waiting terminal is
success. Known-created gaps are headed `PR created; verification gaps`; a found
object is called found. For stopped runs omit unestablished receipt fields; for
known objects print the full receipt below, explicitly marking unavailable
readback.

```text
PR_CREATE: <PASS | GAPS_FOUND | BLOCKED | ERROR>
Outcome/reason: <created | found | stopped; domain reason>
Evidence: <checked result and concrete gaps if any>
URL: <when known>
Execution mode: <dispatch | inline; degraded isolation if inline>
Base / head ref / head SHA / title / state: <actual readback or unavailable>
Reviewers / labels / assignees: <actual readback or unavailable>
Body digest: approved=<digest> returned=<digest or unavailable>
Description:
<full actual returned body, or explicit unavailable; never substitute input>
Platform additions after create: <extra reviewers, labels, assignees, exact body suffix or its line count; none if empty>
Next step: <one action, only when action remains>
```

Success uses the independent checker result: exact title/base/head ref/head
SHA/state, approved metadata subsets, exact UTF-8 body prefix. The suffix line
count, if used, is `len(appended_text.splitlines())`. Additions are visible, not
asserted harmless. No full-body digest equality gate or first-line/whole-body
line-count receipt fields. State-machine counters govern all revisits; a valid
success takes precedence over an exhausted non-PASS recovery ledger.
