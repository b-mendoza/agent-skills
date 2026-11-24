# Bitbucket Cloud

Current-state reference. Update when platform capabilities or command mappings change. Not for Bitbucket Data Center.

**Create path unconfirmed.** Resolve PR labels and their readback mapping before using the create path. The commands below show only documented operations; they do not establish that missing capability.

## Tooling and auth

This skill bundles no Bitbucket CLI. Use a user-approved tool for Bitbucket Cloud REST API 2.0. The examples show `curl` with an OAuth bearer header supplied by the approved credential setup; `auth_headers` names the protected header file, not the token. Use the fixed origin `https://api.bitbucket.org/2.0` and address repositories as `repositories/{workspace}/{repo_slug}`. The read-only auth check is `GET /user`:

```sh
curl --fail-with-body --silent --show-error --header "@$auth_headers" \
  --url 'https://api.bitbucket.org/2.0/user'
```

## Facts

| Capability | Supported | How | Source | Checked |
| --- | --- | --- | --- | --- |
| Open PR lookup, including fork heads | yes | List the target repository's PRs, open by default; page through results and match the source repository and both branches. Use individual PR detail for any incomplete list entry. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-get> | 2026-11-23 |
| Create and body from file | yes | POST JSON to the destination repo with `title`, `description` and branch objects at `source` and `destination`. Specify `source.repository` for a fork. Load `description` from a file before JSON encoding. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-23 |
| Create as draft | yes | Set JSON `draft: true`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-23 |
| Create with reviewers | yes | Send `reviewers` as an array of user objects with `uuid`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-23 |
| Create with labels | unconfirmed | No writable label property is documented by the create operation. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-23 |
| Create with assignees | no | The create request does not have an assignee field. `reviewers` and `participants` are distinct. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-24 |
| Draft → ready | unconfirmed | The draft article URL returned HTTP 404. | <https://support.atlassian.com/bitbucket-cloud/docs/create-a-draft-pull-request/> | 2026-11-23 |
| Ready → draft | unconfirmed | The draft article URL returned HTTP 404. | <https://support.atlassian.com/bitbucket-cloud/docs/create-a-draft-pull-request/> | 2026-11-23 |
| Reviewer eligibility | unconfirmed | The default-reviewers article URL returned HTTP 404. | <https://support.atlassian.com/bitbucket-cloud/docs/use-default-reviewers-on-a-repository/> | 2026-11-23 |
| Teams or groups as Code Owners | yes | Code Owners can name teams and workspace groups. Teams can be defined in `.bitbucket/teams.yaml`; the create reviewers payload still takes user objects. | <https://support.atlassian.com/bitbucket-cloud/docs/set-up-and-use-code-owners/> | 2026-11-23 |
| Owners-file locations | yes | `.bitbucket/CODEOWNERS` on the target branch. | <https://support.atlassian.com/bitbucket-cloud/docs/set-up-and-use-code-owners/> | 2026-11-23 |
| PR labels and exact lookup | unconfirmed | No PR label lookup or explicit statement of support was in the reference. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/> | 2026-11-23 |
| Set PR labels | unconfirmed | The update operation does not document a label setter. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| PR assignees | no | Neither create request nor 201 response carries assignees. Do not map reviewers or participants to assignees. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-24 |
| Assignability, setter and self alias | no | Not applicable to the unsupported PR assignees field. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-24 |
| Readback: base ref | yes | `destination.branch.name`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: head ref | yes | `source.branch.name`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: head SHA | yes | `source.commit.hash`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: title | yes | `title`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: body | yes | `rendered.description.raw`; use raw text, not rendered HTML. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: draft state | yes | `draft` (boolean). | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: reviewers | yes | `reviewers`, not `participants`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: labels | unconfirmed | The PR response does not document a label mapping. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Readback: assignees | no | No assignee field in the create response. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-24 |
| Readback: closing issues | unconfirmed | The PR response does not document a closing-issues field. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-get> | 2026-11-23 |
| Closing keywords | unconfirmed | The page served Jira integration guidance, not PR description closing keywords for the Bitbucket tracker. | <https://support.atlassian.com/bitbucket-cloud/docs/resolve-issues-automatically-when-users-push-code/> | 2026-11-23 |
| Closing keywords: default branch | unconfirmed | The returned page does not document this rule for PR descriptions. | <https://support.atlassian.com/bitbucket-cloud/docs/resolve-issues-automatically-when-users-push-code/> | 2026-11-23 |
| Closing keywords: cross-repo | unconfirmed | The returned page does not document cross-repo syntax for PR descriptions. | <https://support.atlassian.com/bitbucket-cloud/docs/resolve-issues-automatically-when-users-push-code/> | 2026-11-23 |
| One closing keyword for a list | unconfirmed | The returned page does not document list syntax for PR descriptions. | <https://support.atlassian.com/bitbucket-cloud/docs/resolve-issues-automatically-when-users-push-code/> | 2026-11-23 |
| Closure readback | unconfirmed | No closure readback operation was documented in the PR reference. Jira integration is not closure readback. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/> | 2026-11-23 |
| Update title | unconfirmed | The generic PUT request example includes `title` but the operation text does not state that it is writable. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| Update body | yes | PUT `description` to the open PR. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| Add reviewers on update | unconfirmed | The generic PUT example includes `reviewers` but does not state whether or how reviewer additions work. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| Add labels on update | unconfirmed | The update reference does not document a write mapping. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| Add assignees on update | unconfirmed | The update operation does not document it. Create has no assignee field. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-pull-request-id-put> | 2026-11-23 |
| Issue lookup | unconfirmed | The issue tracker reference returned no operation documentation. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Shared issue and PR numbers | unconfirmed | The issue tracker reference did not state how numbers are allocated. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Comment from file | unconfirmed | The issue tracker reference returned no comment-create operation. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Comment readback by ID | unconfirmed | The issue tracker reference returned no comment-read operation. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Stored comment is byte-for-byte unchanged | unconfirmed | The issue tracker reference did not state text storage behavior. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Close as not planned | unconfirmed | The issue tracker reference returned no operation documenting close and reason. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Read back not-planned reason | unconfirmed | The issue tracker reference returned no close-reason field. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-issue-tracker/> | 2026-11-23 |
| Authenticated user | yes | `GET /user` returns the current user, including `uuid`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-users/#api-user-get> | 2026-11-23 |
| Title length limit | unconfirmed | The create reference documents `title` but not a maximum. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post> | 2026-11-23 |
| Repository identity and default branch | yes | Repository response carries `full_name`, `uuid` and `mainbranch`. | <https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/#api-repositories-workspace-repo-slug-get> | 2026-11-23 |

Unsupported fields: assignees

## Commands

Use arguments literally; do not evaluate shell strings. `repo_url` is the fixed API origin and version followed by `/repositories/$workspace_segment/$repo_slug_segment`, using separately URL-encoded segments. `PR_NUMBER` is a validated positive ID. `auth_headers` has only the approved authentication header and is not printed. Do not send credentials to an origin from response data. `create_json` and `edit_json` are payload paths under `RUN_DIR`.

### Repository, owners and open PRs

```sh
curl --fail-with-body --silent --show-error --header "@$auth_headers" --url "$repo_url"
curl --fail-with-body --silent --show-error --header "@$auth_headers" --url "$repo_url/pullrequests?state=OPEN"
curl --fail-with-body --silent --show-error --header "@$auth_headers" --url "$repo_url/pullrequests/$PR_NUMBER"
git show "$base_sha:.bitbucket/CODEOWNERS"
git show "$base_sha:.bitbucket/teams.yaml"
```

List entries are in `values`. Follow pagination `next` only on the same authenticated API origin and repository collection. Compare `source.repository` and `destination.repository` identities (`uuid` or `full_name`) as well as `source.branch.name` and `destination.branch.name`; fetch detail by validated ID if a list entry is partial. Detail supplies the PR URL in `links.html.href`. Decode `rendered.description.raw` without shell newline stripping.

### Documented create and body-update transports

`head_repo` is the validated source repository identity object for `source.repository` (use JSON `null` for the same repository); `draft` is a JSON boolean; `reviewers` contains validated `{ "uuid": "<user-uuid>" }` objects. A JSON encoder reads the exact description from the file before constructing the payload. There are no label or assignee keys in this example.

```sh
jq -n --arg title "$title" --rawfile description "$RUN_DIR/body.md" \
  --arg head "$HEAD_BRANCH" --arg base "$TARGET_BRANCH" --argjson head_repo "$head_repo" \
  --argjson draft "$draft" --argjson reviewers "$reviewers" \
  '{title:$title,description:$description,draft:$draft,
    source:({branch:{name:$head}} + (if $head_repo == null then {} else {repository:$head_repo} end)),
    destination:{branch:{name:$base}}}
   + (if $reviewers == [] then {} else {reviewers:$reviewers} end)' > "$create_json"
curl --fail-with-body --silent --show-error --header "@$auth_headers" \
  --header 'Content-Type: application/json' --request POST --data-binary "@$create_json" \
  --url "$repo_url/pullrequests"
jq -n --rawfile description "$RUN_DIR/body.md" '{description:$description}' > "$edit_json"
curl --fail-with-body --silent --show-error --header "@$auth_headers" \
  --header 'Content-Type: application/json' --request PUT --data-binary "@$edit_json" \
  --url "$repo_url/pullrequests/$PR_NUMBER"
```
