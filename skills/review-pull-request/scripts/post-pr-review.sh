#!/bin/sh
# Usage: post-pr-review.sh [--dry-run] <owner>/<repo> <number> <APPROVE|REQUEST_CHANGES|COMMENT> <body-file> <reviewed-head-sha>
# Environment: PATH locates gh; GH_TOKEN/GITHUB_TOKEN or gh's saved login.
# Exit: 0 success/help/dry-run; 2 gh missing (TOOLS_MISSING); 64 usage;
# 65 invalid argument; 66 unreadable body (ERROR); 4 gh auth required (AUTH);
# 1 API/local failure (ERROR, posting may have occurred; never blindly retry).
# Side effects: reads body-file; posts ONE summary-only review unless --dry-run;
# stdout/stderr only in dry-run. No local writes. Caller owns exact approval.
# Check, no gh/network: f=$(mktemp); printf 'Review\n\n' > "$f"
# sh post-pr-review.sh --dry-run cli/cli 1 COMMENT "$f" 0123456789abcdef0123456789abcdef01234567; rm "$f"
set -eu

usage() {
  printf '%s\n' "Usage: $0 [--dry-run] <owner>/<repo> <number> <APPROVE|REQUEST_CHANGES|COMMENT> <body-file> <reviewed-head-sha>" \
    "       $0 -h" 'Environment: PATH; GH_TOKEN/GITHUB_TOKEN or gh saved login (github.com).'
}
fail() {
  printf '%s\n' "$2" >&2
  usage >&2
  exit "$1"
}

if [ "$#" -eq 1 ] && [ "$1" = -h ]; then usage; exit 0; fi
dry_run=false
if [ "${1-}" = --dry-run ]; then dry_run=true; shift; fi
if [ "$#" -ne 5 ]; then usage >&2; exit 64; fi
repo_path=$1
number=$2
event=$3
body_file=$4
head_sha=$5
case "$repo_path" in *[![:graph:]]* | */. | */..) fail 65 "invalid repository: $repo_path" ;; esac
if ! printf '%s\n' "$repo_path" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$'; then
  fail 65 "invalid repository: $repo_path"
fi
case "$number" in '' | *[!0-9]* | 0*) fail 65 "invalid PR number: $number" ;; esac
case "$event" in
  APPROVE | REQUEST_CHANGES | COMMENT) ;;
  *) fail 65 "invalid event: $event (expected APPROVE|REQUEST_CHANGES|COMMENT)" ;;
esac
case "$head_sha" in '' | *[!0-9a-fA-F]*) fail 65 'reviewed-head-sha must be 40 hex characters' ;; esac
if [ "${#head_sha}" -ne 40 ]; then fail 65 'reviewed-head-sha must be 40 hex characters'; fi
if [ ! -f "$body_file" ] || [ ! -r "$body_file" ]; then fail 66 "body file not readable: $body_file"; fi
# Prefix relative paths so a file named "-" cannot become gh stdin input.
case "$body_file" in /*) ;; *) body_file=./$body_file ;; esac
endpoint="repos/$repo_path/pulls/$number/reviews"

if "$dry_run"; then
  printf 'method: POST\nendpoint: %s\nevent: %s\ncommit_id: %s\nbody:\n' "$endpoint" "$event" "$head_sha"
  cat "$body_file"
  exit 0
fi
if ! command -v gh >/dev/null 2>&1; then
  printf '%s\n' 'gh CLI required' >&2
  exit 2
fi
if gh api --hostname github.com --method POST "$endpoint" \
  -f event="$event" -f commit_id="$head_sha" -F body="@$body_file"; then
  exit 0
else
  status=$?
  if [ "$status" -eq 4 ]; then exit 4; fi
  exit 1
fi
