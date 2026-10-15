#!/bin/sh
# Usage: collect-pr-review-comments.sh [--dry-run] <PR_URL|owner/repo/pull/N>
# Environment: PATH locates gh; GH_TOKEN/GITHUB_TOKEN or gh's saved login.
# Exit: 0 complete/help/dry-run; 3 partial inner comments (NEEDS_CONTEXT);
# 2 gh missing (TOOLS_MISSING); 64 usage; 65 invalid reference (ERROR);
# 4 gh authentication required (AUTH); 1 API/GraphQL/response failure (ERROR).
# Side effects: GitHub reads and stdout/stderr only; no files or mutations.
# URL-only suffixes (trailing slash, path, query, fragment) are ignored.
# Check, no gh/network: sh collect-pr-review-comments.sh --dry-run cli/cli/pull/1
set -eu

usage() {
  printf '%s\n' "Usage: $0 [--dry-run] <PR_URL|owner/repo/pull/N>" \
    "       $0 -h" 'Environment: PATH; GH_TOKEN/GITHUB_TOKEN or gh saved login (github.com).'
}

if [ "$#" -eq 1 ] && [ "$1" = -h ]; then usage; exit 0; fi
dry_run=false
if [ "${1-}" = --dry-run ]; then dry_run=true; shift; fi
if [ "$#" -ne 1 ]; then usage >&2; exit 64; fi
pattern='[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+/pull/[1-9][0-9]*'
case "$1" in *[![:graph:]]*) reference= ;; *) reference=$1 ;; esac
if ! printf '%s\n' "$reference" | grep -Eq "^(https://github[.]com/$pattern([/?#].*)?|$pattern)$"; then
  printf 'unrecognized PR reference: %s\n' "$1" >&2
  usage >&2
  exit 65
fi
reference=${reference#https://github.com/}
owner=${reference%%/*}
reference=${reference#*/}
repo=${reference%%/*}
number=${reference#*/pull/}
number=${number%%[/?#]*}

# shellcheck disable=SC2016 # GraphQL variables must reach gh literally.
query='query($owner: String!, $repo: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved viewerCanUnresolve path line
          comments(first: 100) {
            totalCount
            pageInfo { hasNextPage }
            nodes { fullDatabaseId url author { login } body }
          }
        }
      }
    }
  }
}'
projection='
  def comment_id:
    if . == null then error("missing fullDatabaseId") else tostring end;
  if (.errors // [] | length) > 0 or
     (.data.repository.pullRequest.reviewThreads.nodes | type) != "array"
  then error("inaccessible or invalid review thread history")
  else [.data.repository.pullRequest.reviewThreads.nodes[] |
    if (.id | type) != "string" or (.isResolved | type) != "boolean" or
       (.viewerCanUnresolve | type) != "boolean" or (.path | type) != "string" or
       (.comments.totalCount | type) != "number" or
       (.comments.pageInfo.hasNextPage | type) != "boolean"
    then error("invalid review thread metadata")
    else {
      thread_id: .id, is_resolved: .isResolved,
      viewer_can_unresolve: .viewerCanUnresolve, path, line,
      root_comment_id: (.comments.nodes[0].fullDatabaseId | comment_id),
      root_url: .comments.nodes[0].url,
      comments_total: .comments.totalCount,
      comments_truncated: (.comments.pageInfo.hasNextPage or ((.comments.nodes | length) < .comments.totalCount)),
      comments: [.comments.nodes[] |
        {id: (.fullDatabaseId | comment_id), url, author: .author.login, body}]
    } end
  ][] | tojson end'

if "$dry_run"; then
  printf 'gh api graphql --hostname github.com --paginate -f owner=%s -f repo=%s -F number=%s \\\n' "$owner" "$repo" "$number"
  printf "  -f query='%s' \\\n  --jq '%s'\n" "$query" "$projection"
  exit 0
fi
if ! command -v gh >/dev/null 2>&1; then
  printf '%s\n' 'gh CLI required' >&2
  exit 2
fi
# Buffer all pages so a later API failure cannot publish a successful partial read.
if output=$(gh api graphql --hostname github.com --paginate \
  -f owner="$owner" -f repo="$repo" -F number="$number" \
  -f query="$query" --jq "$projection"); then
  if [ -n "$output" ]; then printf '%s\n' "$output"; fi
  case "$output" in *'"comments_truncated":true'*) exit 3 ;; esac
  exit 0
else
  status=$?
  if [ "$status" -eq 4 ]; then exit 4; fi
  exit 1
fi
