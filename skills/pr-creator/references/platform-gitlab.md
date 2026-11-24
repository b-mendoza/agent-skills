# GitLab

Current-state reference. Update when platform capabilities or command mappings change.

## Tooling and auth

Use `glab api` against the selected GitLab host. Address the project by numeric ID or its full namespace path URL-encoded as one segment, including every subgroup and slash. MR and issue endpoints take the resource's project-local `iid`, not its global `id`. A read-only credential check that also returns the active identity:

```sh
glab api --hostname "$PLATFORM_HOST" --method GET user
```

## Facts

| Capability | Supported | How | Source | Checked |
| --- | --- | --- | --- | --- |
| Open MR lookup, including fork heads | yes | List `opened` MRs for the target project. Match `source_branch`, `target_branch`, `source_project_id` and `target_project_id`; branch names alone do not identify forks. | <https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests> | 2026-11-23 |
| Create and body from file | yes | POST to the source project's `merge_requests` with `source_branch`, `target_branch`, `title`, and `description` read from a file and JSON-encoded. For a fork supply the numeric `target_project_id`. | <https://docs.gitlab.com/api/merge_requests/#create-a-merge-request> | 2026-11-23 |
| Create as draft | yes | For REST, use the documented `Draft: ` title prefix. | <https://docs.gitlab.com/user/project/merge_requests/drafts/> | 2026-11-23 |
| CLI draft flag | yes | `glab mr create --draft`; `--description-file` supplies the description. | <https://docs.gitlab.com/cli/mr/create/> | 2026-11-23 |
| Create with reviewers | yes | `reviewer_ids`, an array of numeric user IDs. | <https://docs.gitlab.com/api/merge_requests/#create-a-merge-request> | 2026-11-23 |
| Create with labels | yes | `labels`, a comma-separated string of names. The API can create missing labels. | <https://docs.gitlab.com/api/merge_requests/#create-a-merge-request> | 2026-11-23 |
| Create with assignees | yes | `assignee_ids`, an array of numeric user IDs. | <https://docs.gitlab.com/api/merge_requests/#create-a-merge-request> | 2026-11-23 |
| Draft → ready | yes | Edit the title to remove the draft prefix. | <https://docs.gitlab.com/user/project/merge_requests/drafts/> | 2026-11-23 |
| Ready → draft | yes | Edit the title to add `Draft: ` (other documented forms are `[Draft]` and `(Draft)`). | <https://docs.gitlab.com/user/project/merge_requests/drafts/> | 2026-11-23 |
| Reviewer eligibility | unconfirmed | The review docs describe selection and approval-rule filters, not a general eligibility test for a supplied user ID. | <https://docs.gitlab.com/user/project/merge_requests/reviews/> | 2026-11-23 |
| Groups as Code Owners | yes | `@group` and `@group/subgroup` are supported; group eligibility applies to direct members, not inherited members. The MR reviewer write field takes user IDs, not group handles. | <https://docs.gitlab.com/user/project/codeowners/reference/> | 2026-11-23 |
| Owners-file locations | yes | On the target branch GitLab takes the first file in this order: `CODEOWNERS`, `docs/CODEOWNERS`, `.gitlab/CODEOWNERS`. | <https://docs.gitlab.com/user/project/codeowners/> | 2026-11-23 |
| MR labels and exact lookup | yes | `GET /projects/:id/labels/:label_id`, where `label_id` is a numeric ID or URL-encoded title. Ancestor groups are included by default. | <https://docs.gitlab.com/api/labels/#retrieve-a-label> | 2026-11-23 |
| Set MR labels | yes | `labels` to set the list, or `add_labels` to add on update. Check exact names: unknown names can create project labels. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| MR assignees and setter | yes | `assignees` in responses, `assignee_ids` on writes. The update array replaces the current set. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| Assignability check | unconfirmed | The project API did not document an assignability endpoint. A valid user ID alone is not evidence of assignability. | <https://docs.gitlab.com/api/projects/#list-all-assignees> | 2026-11-23 |
| Assignee self alias | unconfirmed | The CLI edit documentation describes usernames but does not specify a self alias. Use the ID returned by `GET /user` to refer to the active user in REST. | <https://docs.gitlab.com/cli/mr/update/> | 2026-11-23 |
| Readback: base ref | yes | `target_branch`. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: head ref | yes | `source_branch`. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: head SHA | yes | `sha` (not `merge_commit_sha`). | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: title | yes | `title`. The draft marker is title text when supplied as a title prefix. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: body | yes | `description`. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: draft state | yes | `draft` (boolean). | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: reviewers | yes | `reviewers` user objects. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: labels | yes | `labels` names. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: assignees | yes | `assignees` user objects, not the singular `assignee`. | <https://docs.gitlab.com/api/merge_requests/#retrieve-a-merge-request> | 2026-11-23 |
| Readback: closing issues | yes | Separate `closes_issues` endpoint; GitLab tracker entries have `project_id`, `iid` and `web_url`. | <https://docs.gitlab.com/api/merge_requests/#list-issues-that-close-on-merge> | 2026-11-23 |
| Closing keywords | yes | `close`, `fix`, `resolve`, `implement`, plus the documented `-s`, `-ed` and `-ing` forms (initial capitals also documented). Self-managed instances can customize the pattern. | <https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically> | 2026-11-23 |
| Closing keywords: default branch | yes | For an MR, merge into the default branch. Settings can disable automatic closure and the merger must have permission. | <https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically> | 2026-11-23 |
| Closing keywords: cross-project | yes | Use `group/project#123` (with full namespace) or the full issue URL. | <https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically> | 2026-11-23 |
| One closing keyword for a list | yes | `Closes #4, #6` closes both in an MR description. | <https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically> | 2026-11-23 |
| Closure readback | yes | `GET /projects/:id/merge_requests/:merge_request_iid/closes_issues` lists issues that would close. | <https://docs.gitlab.com/api/merge_requests/#list-issues-that-close-on-merge> | 2026-11-23 |
| Update title and body | yes | `PUT /projects/:id/merge_requests/:merge_request_iid` with `title` and `description`. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| Add reviewers on update | yes | Send the union of current and new `reviewer_ids`; the endpoint sets the list. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| Add labels on update | yes | Use `add_labels` for validated names. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| Add assignees on update | yes | Send the union of current and new `assignee_ids`; the endpoint sets the list. | <https://docs.gitlab.com/api/merge_requests/#update-a-merge-request> | 2026-11-23 |
| Issue lookup | yes | `GET /projects/:id/issues/:issue_iid`; read `iid`, `web_url`, `title`, and `state` (`opened` means open). | <https://docs.gitlab.com/api/issues/#retrieve-a-project-issue> | 2026-11-23 |
| Shared issue and MR numbers | unconfirmed | The REST guide defines project-local `iid` but does not state whether issues and MRs use one sequence. The endpoint and the reference sigil identify the resource type: `#` issue, `!` MR. | <https://docs.gitlab.com/api/rest/#id-vs-iid> | 2026-11-23 |
| Comment from file | yes | POST an issue note with `body` read from a file and JSON-encoded. | <https://docs.gitlab.com/api/notes/#create-an-issue-note> | 2026-11-23 |
| Comment readback by ID | yes | `GET /projects/:id/issues/:issue_iid/notes/:note_id`; read `id`, `author` and `body`. | <https://docs.gitlab.com/api/notes/#retrieve-an-issue-note> | 2026-11-23 |
| Stored comment is byte-for-byte unchanged | no | GitLab runs and removes quick actions, removes carriage returns, and strips trailing whitespace including final newlines. A plain POST is not a literal-text escape for quick actions. | <https://docs.gitlab.com/api/notes/> | 2026-11-23 |
| Close as not planned | no | The issue edit API supports `state_event=close` but no reason parameter; a plain close is not a not-planned close. | <https://docs.gitlab.com/api/issues/#edit-an-issue> | 2026-11-23 |
| Read back not-planned reason | unconfirmed | The issue read endpoint does not document a not-planned reason field. | <https://docs.gitlab.com/api/issues/#retrieve-a-project-issue> | 2026-11-23 |
| Authenticated user | yes | `GET /user` returns `id` and `username`. | <https://docs.gitlab.com/api/users/#retrieve-the-current-user> | 2026-11-23 |
| Resolve a username to a user ID | yes | `GET /users?username=...` looks up the user case-insensitively. The ID is identity evidence, not permission evidence. | <https://docs.gitlab.com/api/users/#list-users> | 2026-11-23 |
| Title length limit | unconfirmed | Create documents `title` but not a maximum. | <https://docs.gitlab.com/api/merge_requests/#create-a-merge-request> | 2026-11-23 |
| Project identity and default branch | yes | Project endpoint returns `id`, `path_with_namespace`, `default_branch` and `issues_access_level` (as visible to the caller). | <https://docs.gitlab.com/api/projects/#retrieve-a-project> | 2026-11-23 |

Unsupported fields: none

## Commands

Use fixed argument vectors or quoted shell arguments, never shell evaluation. `base_project` and `head_project` are numeric IDs or encoded full paths; `base_project_id` and `head_project_id` are numeric. Encode a label title as one segment in `label_segment`. Use positive validated IIDs and note IDs, and parse JSON text fields without stripping newlines. `glab api --input FILE` sends the JSON from that file. `create_json`, `edit_json` and `note_json` are payload paths under `RUN_DIR`.

### Project, lookup and metadata

```sh
glab api --hostname "$PLATFORM_HOST" --method GET --include "projects/$base_project"
glab api --hostname "$PLATFORM_HOST" --method GET --include "projects/$head_project"
glab api --hostname "$PLATFORM_HOST" --method GET --include "projects/$base_project/labels/$label_segment"
glab api --hostname "$PLATFORM_HOST" --method GET --paginate "projects/$base_project/labels"
glab api --hostname "$PLATFORM_HOST" --method GET --raw-field "username=$username" users
glab api --hostname "$PLATFORM_HOST" --method GET --paginate "projects/$base_project/merge_requests?state=opened"
git show "$base_sha:$owners_path"
```

Compare project IDs and branch names in the MR results. A matching branch in a different source project is not the same MR. The last command reads the first owners-file location on the pinned target tree.

### Create, read back and update

Build `create_json` with a JSON encoder. `wire_title` is the normal title or the full draft-prefixed title; `reviewer_ids` and `assignee_ids` are JSON arrays of validated numeric IDs. `label_csv` contains exact existing names; no individual name can contain the separator. Omit optional keys when no values are being sent. The create endpoint is on the source project; lookups and edits use the target project and its MR IID.

```sh
jq -n --arg title "$wire_title" --rawfile description "$RUN_DIR/body.md" \
  --arg source "$HEAD_BRANCH" --arg target "$TARGET_BRANCH" --argjson project "$base_project_id" \
  --argjson reviewers "$reviewer_ids" --argjson assignees "$assignee_ids" --arg labels "$label_csv" \
  '{title:$title,description:$description,source_branch:$source,target_branch:$target,target_project_id:$project}
   + (if $reviewers == [] then {} else {reviewer_ids:$reviewers} end)
   + (if $assignees == [] then {} else {assignee_ids:$assignees} end)
   + (if $labels == "" then {} else {labels:$labels} end)' > "$create_json"
glab api --hostname "$PLATFORM_HOST" --method POST --input "$create_json" "projects/$head_project/merge_requests"
glab api --hostname "$PLATFORM_HOST" --method GET "projects/$base_project/merge_requests/$MR_IID"
glab api --hostname "$PLATFORM_HOST" --method GET --paginate "projects/$base_project/merge_requests/$MR_IID/closes_issues"
```

For a same-project draft, the CLI also has a file-based form (`base_project_url` is the validated HTTPS project URL). This is an alternative to the REST POST, not a second create request:

```sh
glab mr create --repo "$base_project_url" --source-branch="$HEAD_BRANCH" \
  --target-branch="$TARGET_BRANCH" --title="$title" --description-file="$RUN_DIR/body.md" --draft --yes
```

For `edit_json`, encode only changed keys: `title`, `description` (read from file as above), `add_labels`, and the complete union arrays `reviewer_ids` and `assignee_ids` when adding members. The same PUT accepts a title-only JSON object for either draft transition: add or remove the draft prefix. In responses, `web_url` gives the MR URL and `iid` gives its number. For closing references, an example MR description line is:

```text
Closes #<issue-iid>, <group>/<project>#<issue-iid>
```

```sh
glab api --hostname "$PLATFORM_HOST" --method PUT --input "$edit_json" \
  "projects/$base_project/merge_requests/$MR_IID"
```

### Issues and comments

```sh
glab api --hostname "$PLATFORM_HOST" --method GET --include "projects/$encoded_project_path"
glab api --hostname "$PLATFORM_HOST" --method GET --include "projects/$encoded_project_path/issues/$issue_number"
glab api --hostname "$PLATFORM_HOST" --method GET --paginate "projects/$encoded_project_path/issues/$issue_number/notes"
jq -n --rawfile body "$RUN_DIR/comment-${QUEUE_INDEX}.md" '{body:$body}' > "$note_json"
glab api --hostname "$PLATFORM_HOST" --method POST --input "$note_json" \
  "projects/$encoded_project_path/issues/$issue_number/notes"
glab api --hostname "$PLATFORM_HOST" --method GET "projects/$encoded_project_path/issues/$issue_number/notes/$note_id"
```

Issue note text is interpreted for quick actions before storage. The POST shows transport, not a guarantee that arbitrary file bytes are inert or round-trip unchanged. `web_url` is identity evidence from the issue response, not a new request target.
