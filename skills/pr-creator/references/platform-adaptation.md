# Platform adaptation

Load for a nonstandard host, unknown capability, or a state, assignment, template,
or transport decision. These are checked paths, not promises of platform parity.
Routing belongs to [state-machine.md](../state-machine.md); artifact and receipt
shapes belong to [execution-contracts.md](./execution-contracts.md).

## Shared checks

Resolve base and head repository identities separately, including host, remotes,
branches, and fork relationships. Check the same head-repository/head-branch and
base-repository/base-branch pair in preflight and immediately before creation.
Use a checked CLI/API plan with literal UTF-8 body-file transport and supported
readback of the actual object. Normalize returned state vocabulary only through
that adapter. Do not treat a successful command as verified content.

The inspector supplies `safe_create_path` and `requested_state_support`. Unknown
is not supported. The orchestrator derives effective state only after checking
the path and obtaining any required ready-fallback choice. Metadata separately
checks account assignability and creation-time assignment semantics. Reviewer
requestability is not assignment support.

## Platform paths

| Platform                   | Checked creation and state path                                                                                                                                                                                                                                                           | Assignment path                                                                                                                                                                                                         | Template path                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub / GitHub Enterprise | Prefer installed `gh pr create` plus `gh pr view` or a checked API equivalent. Resolve fork head and base explicitly. Check draft/ready support against the actual host, CLI version, and policy; Enterprise capabilities need not match github.com.                                      | Check assignable canonical accounts and the installed create path's assignee option/API semantics. Include requested assignments in that plan, preview, and readback.                                                   | On the base repository's default branch at a recorded revision, inspect the documented single-template locations and multi-template directories below. Do not assume location or casing precedence.                            |
| GitLab                     | Prefer installed `glab mr create` or a checked MR API path. Resolve source and target projects. Check how that version represents draft/ready and whether its title handling preserves the exact approved title. A state mechanism that silently rewrites the title is not an exact plan. | Check assignable accounts, canonical identities, and supported creation-time assignee fields, including multiplicity. Do not infer support from reviewer fields or silently reduce a list.                              | Inspect the base project's default-branch `.gitlab/merge_request_templates/` and the applicable project-settings default. Check documented `Default.md` behavior and settings priority rather than using a local fork's files. |
| Bitbucket                  | Identify the offering and installed tooling first. Use only a documented, checked CLI/API create/query path with mapped source/destination identities. Check requested state on that offering; do not assume either draft support or its absence from another offering/version.           | No GitHub/GitLab assignee equivalence is assumed. A requested assignment without checked assignability and creation-time semantics blocks before creation. Reviewers/default reviewers do not substitute for assignees. | Use a documented safe repository convention for that offering, or ask for an explicit source/fallback. No GitHub/GitLab template-location parity is assumed.                                                                   |
| Unknown                    | Resolve host/tooling through one bounded authoritative lookup or a user choice. No creation until the required fields, state, transport, and query semantics are checked.                                                                                                                 | Unknown is unsupported for a requested assignment until checked.                                                                                                                                                        | Unknown discovery is not confirmed absence.                                                                                                                                                                                    |

All template paths here are paths in the user's target repository, not bundled
package dependencies. GitHub single-template discovery matches
`pull_request_template.md` or `pull_request_template.txt` case-insensitively in
the root, `docs/`, and `.github/`. Multiple candidates may live under
`PULL_REQUEST_TEMPLATE/`, `docs/PULL_REQUEST_TEMPLATE/`, or
`.github/PULL_REQUEST_TEMPLATE/`. Use [D1, D2, and D3](./external-resources.md#template-facts)
for current facts. Do not extend filename case-insensitivity to directory names
or invent precedence among coexisting GitHub locations. GitLab documents
case-insensitive `Default.md` selection and a Premium/Ultimate project-settings
default taking priority over that file. Read that value from the Projects API's
`merge_requests_template` response field; identify its canonical base project
and setting, not a repository path/SHA. A missing/unreadable field alone does not
establish absence. Its issue-template inheritance list is not an MR inheritance
algorithm.

## Source and capability decisions

`pr-drafter` owns title-rule/template discovery and reads. Automatic repository
files use base-repository default-branch content at a recorded full revision;
settings defaults use canonical project/setting identity without a SHA.
An explicitly user-selected local template is allowed and identified as local
in the preview. Use an authoritative default or one unambiguous candidate.
Multiple candidates require a selection, not a merge. Unreadable sources or
unknown relevant settings return `NEEDS_CHOICE` with bounded source identities
and an explicit fallback option, never source contents. Re-read selected
identities on redispatch; repository files must match their recorded revision.
Confirmed absence after a successful check uses fallback without another gate.
Exact overrides bypass their source discovery.

If draft is confirmed unsupported but a safe ready path is checked, ask whether
to proceed as ready or stop. Show requested and effective states separately.
Never silently change either direction. If ready itself is unsupported, stop.
Requested assignments that are invalid, unverifiable, or unsupported block;
omitted/none means no assignment request. Never add a later assignment edit.

Prefer installed CLI help for version-specific syntax. Fetch at most one
authoritative URL per uncertain decision and record the source. If the result
still leaves the plan unsafe, ask rather than improvise. Required unavailable or
denied tooling/network is `TOOLS_MISSING`, not evidence of absence or support.
After an object is known, unavailable readback is a verification gap, not a
reason to create again. Full routing and caps remain in the state machine.
