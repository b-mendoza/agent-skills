#!/usr/bin/env python3
"""Post one exact APPROVAL_RECORD-approved reply, then verify it with a GET.
Usage: python3 -I post-review-reply.py <owner>/<repo> <pr-number> <comment-id> <body-file>
Environment: PATH locates gh; gh uses its normal authentication environment.
Exits: 0 verified, JSON {id, html_url}; 2 gh missing (TOOLS_MISSING);
64 bad arguments (ERROR); 66 unreadable UTF-8 body (ERROR);
74 live POST with failed read-back (PARTIAL, do not retry).
A failed POST returns gh's exit code (AUTH or ERROR); no GET follows.
Side effects: reads the body file, posts one GitHub reply, then reads it; no retries.
Smoke: python3 -I scripts/post-review-reply.py -h  # exits 0, no network
"""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

args = sys.argv[1:]
if args == ["-h"]:
    print(__doc__)
    sys.exit(0)
if len(args) != 4 or any(re.fullmatch(r"[1-9][0-9]*", n) is None for n in args[1:3]):
    print(__doc__, file=sys.stderr)
    sys.exit(64)
repo, number, root_id, body_file = args
try:
    approved = Path(body_file).read_bytes()
    approved.decode("utf-8")
except (OSError, UnicodeError) as error:
    print(f"cannot read UTF-8 approved body: {error}; nothing posted", file=sys.stderr)
    sys.exit(66)
if shutil.which("gh") is None:
    print("gh CLI required; nothing posted", file=sys.stderr)
    sys.exit(2)
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
