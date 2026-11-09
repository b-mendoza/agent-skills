#!/usr/bin/env bash
# Post one reply body to a pull-request review comment. Caller must already
# hold an APPROVAL_RECORD matching this exact body.
set -euo pipefail
usage() {
  printf '%s\n' "usage: $0 <owner>/<repo> <pr-number> <comment-id> <body-file>" >&2
  exit 64
}
[ "$#" -eq 4 ] || usage
repo_path="$1"
pr_number="$2"
comment_id="$3"
body_file="$4"
[[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || usage
[[ "$comment_id" =~ ^[1-9][0-9]*$ ]] || usage
if [ ! -f "$body_file" ]; then
  printf '%s\n' "body file not found: $body_file" >&2
  exit 66
fi
if ! command -v gh >/dev/null 2>&1; then
  printf '%s\n' "gh CLI required" >&2
  exit 2
fi
# shellcheck disable=SC2016
gh api --method POST "repos/${repo_path}/pulls/${pr_number}/comments/${comment_id}/replies" \
  -f body="$(cat "$body_file")"
