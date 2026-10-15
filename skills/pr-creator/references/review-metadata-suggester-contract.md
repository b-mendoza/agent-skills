# Contract: review-metadata-suggester

Return one JSON object, not raw CODEOWNERS/API content. Shared types and
boundary rules: [execution-contracts.md](./execution-contracts.md). Consumer
gate: `python3 -I "${SKILL_DIR}/scripts/validate-output.py"
review-metadata-suggester` on stdin. Resolve `ASSIGNEES` separately from
`REVIEWERS` and `LABELS_OVERRIDE`.

Status enum: `PASS | NEEDS_REVIEWER | INVALID_LABELS | AUTH | BLOCKED | ERROR |
TOOLS_MISSING`. Always required: `status`, `reason`, `decision_needed`.

| Key                                        | Type / values                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `reviewers`, `labels`, `assignees`         | Arrays of nonempty canonical strings or `null` when unresolved                      |
| `reviewer_source`                          | `user`, `CODEOWNERS`, `none-confirmed`, `none`                                      |
| `solo_repository`                          | Boolean or `null` when unknown                                                      |
| `codeowners_source`                        | Nonempty path/revision reference or `null`                                          |
| `codeowners_matches`                       | Array of `{pattern, owners}`; nonempty pattern, array of canonical nonempty strings |
| `label_source`                             | `override`, `inferred`, `none`                                                      |
| `invalid_labels`, `suggested_valid_labels` | Arrays of nonempty strings                                                          |
| `assignee_source`                          | `user` or `none`                                                                    |
| `assignment_support`                       | `supported`, `unsupported`, `unknown`                                               |
| `invalid_assignees`                        | Array of nonempty requested identities not validated as assignable                  |
| `missing_tools`                            | Nonempty capability array; required for `TOOLS_MISSING`                             |

`PASS` requires every fact key except `missing_tools`: metadata arrays nonnull,
invalid arrays empty, `decision_needed=null`. Empty reviewers requires
`reviewer_source=none-confirmed`; nonempty reviewers requires `user` or
`CODEOWNERS`. Nonempty assignees requires `assignee_source=user` and
`assignment_support=supported`; no assignees uses source `none`. `CODEOWNERS`
source requires a nonnull `codeowners_source`.

| Other status     | Additional required keys                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEEDS_REVIEWER` | Nonempty `decision_needed`.                                                                                                                                               |
| `INVALID_LABELS` | Nonempty `invalid_labels` and `decision_needed`; `suggested_valid_labels` (possibly empty).                                                                               |
| `BLOCKED`        | Nonempty requested `assignees`, `invalid_assignees` (possibly empty), `assignment_support`; explain invalid/unverifiable assignability or unsupported creation semantics. |
| `AUTH`, `ERROR`  | Common keys only.                                                                                                                                                         |
| `TOOLS_MISSING`  | Nonempty `missing_tools`.                                                                                                                                                 |

Strip one leading `@`, resolve exact platform identities, deduplicate and sort
metadata. A singular assignment request becomes the same `ASSIGNEES` list.
Omitted/none means no requested assignment, not automatic self-assignment.
`REVIEWERS=none` means no reviewers requested by this agent, not a ban on
CODEOWNERS/platform additions. Reviewer requestability does not establish
account assignability. Validate each requested assignee and the checked plan's
ability to assign during the approved create action. Invalid, unverifiable, or
unsupported assignment blocks before create; never silently drop it or plan a
later edit. Only platform-existing labels may be requested. `AUTH` is
insufficient metadata auth; `TOOLS_MISSING` is required missing/denied
capability; `ERROR` is unexpected lookup failure. Other established partial
facts may be included, never invented.
