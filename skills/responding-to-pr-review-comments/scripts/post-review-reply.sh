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
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' "python3 required for byte-exact read-back; nothing posted" >&2
  exit 2
fi
# Keep JSON decoding and byte comparison out of shell substitutions. No retries.
python3 -I - "$repo_path" "$pr_number" "$comment_id" "$body_file" <<'PY'
import json
from pathlib import Path
import subprocess
import sys

repo, number, root_id, body_file = sys.argv[1:]
try:
    approved = Path(body_file).read_bytes()
    approved.decode("utf-8")
except (OSError, UnicodeError) as error:
    print(f"cannot read UTF-8 approved body: {error}; nothing posted", file=sys.stderr)
    sys.exit(66)

posted = subprocess.run([
    "gh", "api", "--method", "POST",
    f"repos/{repo}/pulls/{number}/comments/{root_id}/replies",
    "-F", f"body=@{body_file}",
], stdout=subprocess.PIPE, check=False)
if posted.returncode != 0:
    sys.exit(posted.returncode)

created_id = None
created_url = "unknown URL"

def readback_failed(reason):
    print(f"POST succeeded; reply {created_id} at {created_url} may already be live. "
          f"Read-back failed: {reason}; do not retry.", file=sys.stderr)
    sys.exit(74)

try:
    receipt = json.loads(posted.stdout)
    if not isinstance(receipt, dict):
        readback_failed("POST response is not an object")
    created_id = receipt.get("id")
    created_url = receipt.get("html_url", created_url)
    if type(created_id) is not int or created_id <= 0:
        readback_failed("POST response has no valid created comment ID")
    fetched = subprocess.run([
        "gh", "api", "--method", "GET", f"repos/{repo}/pulls/comments/{created_id}",
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if fetched.returncode != 0:
        readback_failed(f"GET exited {fetched.returncode}")
    reply = json.loads(fetched.stdout)
    if not isinstance(reply, dict) or reply.get("id") != created_id:
        readback_failed("GET returned a different comment")
    body = reply.get("body")
    if not isinstance(body, str) or body.encode("utf-8") != approved:
        readback_failed("returned body differs from the approved bytes")
    url = reply.get("html_url")
    if not isinstance(url, str) or not url:
        readback_failed("GET response has no reply URL")
except (ValueError, UnicodeError, OSError) as error:
    readback_failed(str(error))

print(json.dumps({"id": created_id, "html_url": url}))
PY
