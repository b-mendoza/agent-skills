# Contract: repo-state-inspector

Return one JSON object. Shared types, null/omission rules, and the consumer gate
are in [execution-contracts.md](./execution-contracts.md). Check with `python3
-I "${SKILL_DIR}/scripts/validate-output.py" repo-state-inspector` on stdin
before routing. No raw commands/logs.

Status enum: `PASS | BLOCKED | ERROR | TOOLS_MISSING`. Always required:
`status`, `reason`, `decision_needed`.

| Key                                  | Type / values                                                           |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `current_branch`                     | Nonempty string or `null`                                               |
| `target_branch`                      | Nonempty user input or `null`; never silently selected                  |
| `target_branch_candidate`            | Nonempty default-branch candidate or `null`                             |
| `requested_state`                    | `draft` or `ready`                                                      |
| `remotes`                            | Array of `{name, url, platform}`; strings nonempty, platform enum below |
| `head_remote`, `base_remote`         | Nonempty names or `null`                                                |
| `head_repository`, `base_repository` | Canonical host/repository identities or `null`                          |
| `topology`                           | `same-remote`, `fork`, or `ambiguous`                                   |
| `topology_candidates`                | Array of `{head_remote, base_remote}` nonempty strings                  |
| `platform`                           | `github`, `github-enterprise`, `gitlab`, `bitbucket`, `unknown`         |
| `platform_adapter_needed`            | Boolean                                                                 |
| `safe_create_path`                   | Checked nonempty command/API capability description or `null`           |
| `requested_state_support`            | `supported`, `unsupported`, or `unknown`                                |
| `uncommitted_work`                   | Nonempty boundary summary, including known none                         |
| `missing_tools`                      | Nonempty array of capability names; required for `TOOLS_MISSING`        |

`PASS` requires every fact key in the table except `missing_tools`. It means
reportable topology/capabilities, not permission to advance with unresolved
facts: `remotes` is nonempty and `current_branch` is nonnull. Ambiguous topology
requires candidates and a question. Resolved topology requires nonnull remotes
and repository identities; both remote names must occur in `remotes`.
`requested_state_support=supported` requires a known platform and nonnull
`safe_create_path`. Unknown support never means supported. The inspector does
not derive effective state or approve a ready fallback; the orchestrator does.

Other statuses require only the common keys (and `missing_tools` as applicable);
include established partial facts only. `BLOCKED`: not a repository, detached or
unsafe branch, invalid requested state, unusable facts. `TOOLS_MISSING`:
required shell/Git/platform/capability lookup unavailable or denied. `ERROR`:
unexpected inspection failure. Missing target or ambiguous topology is a `PASS`
fact plus `decision_needed`, resolved by the state machine before preflight.
