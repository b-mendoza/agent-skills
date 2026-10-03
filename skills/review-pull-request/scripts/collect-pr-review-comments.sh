#!/bin/sh
# POSIX sh + stdlib Python 3 + gh. Usage: this-script PR_REFERENCE|-h|--self-test.
# Env: PATH, inherited gh auth/config; host pinned to github.com, not GH_HOST.
# Exits: 0 COMPLETE/help/test; 2 TOOLS_MISSING; 64/65 BLOCKED args/reference;
# 1 incomplete history: route state/reason to PARTIAL/BLOCKED/RATE_LIMIT/ERROR.
# Side effects: none locally; read-only GitHub network, stdout/stderr only.
usage() {
  printf '%s\n' 'Usage: sh collect-pr-review-comments.sh PR_REFERENCE | -h | --self-test' \
    'PR_REFERENCE: https://github.com/OWNER/REPO/pull/NUMBER or OWNER/REPO/pull/NUMBER; NUMBER is positive.' \
    'Dependencies/env: POSIX sh, python3 and gh via PATH; inherited gh auth/config, GH_TOKEN/GITHUB_TOKEN; GH_HOST ignored.' \
    'Exits: 0 COMPLETE/help/offline self-test; 2 missing tool -> TOOLS_MISSING; 64 arity / 65 reference -> BLOCKED;' \
    '1 collection failure -> inspect PARTIAL/UNAVAILABLE state and reason, never infer success or retry.' \
    'Side effects: read-only GitHub network; stdout/stderr only, no local files or remote mutations.'
}
[ "$#" -eq 1 ] || { usage >&2; exit 64; }
[ "$1" != -h ] || { usage; exit 0; }
command -v python3 >/dev/null 2>&1 || { printf '%s\n' '{"state":"UNAVAILABLE","reason":"TOOLS_MISSING: python3 unavailable"}'; exit 2; }
exec python3 -I -B -c '
import json, re, shutil, subprocess, sys
PATTERN = r"(?:https://github\.com/)?([A-Za-z0-9][A-Za-z0-9-]*)/((?!\.{1,2}/)[A-Za-z0-9_.-]+)/pull/([1-9][0-9]*)"
def reference(value): return re.fullmatch(PATTERN, value)
def emit(state, reason=None, comments=None, code=0):
    result = dict(state=state)
    if reason is not None: result["reason"] = reason
    if comments is not None: result["comments"] = comments
    print(json.dumps(result, ensure_ascii=True, allow_nan=False))
    sys.exit(code)
if sys.argv[1] == "--self-test":
    good = ["a/b/pull/1", "https://github.com/a/b.c/pull/23"]
    bad = ["", "https://evil.test/a/b/pull/1", "a/b/pull/0", "a/b/pull/01", "a/b/pull/1?x", "a/../pull/1", "-a/b/pull/1", "a/b/pull/1/", "a/b/pull/1\n"]
    passed = all(reference(v) for v in good) and not any(reference(v) for v in bad)
    print("self-test: argument parsing " + ("PASS (11 cases, no network)" if passed else "FAIL"))
    sys.exit(0 if passed else 1)
match = reference(sys.argv[1])
if not match:
    print(sys.argv[2], file=sys.stderr)
    sys.exit(65)
if not shutil.which("gh"): emit("UNAVAILABLE", "TOOLS_MISSING: gh unavailable", code=2)
owner, repo, number = match.groups()
comments, page = [], 1
while True:
    endpoint = f"repos/{owner}/{repo}/pulls/{number}/comments?per_page=100&page={page}"
    try:
        response = subprocess.run(["gh", "api", "--hostname", "github.com", "--method", "GET", "--include", endpoint], capture_output=True, text=True, encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        emit("UNAVAILABLE" if page == 1 and isinstance(exc, OSError) else "PARTIAL", type(exc).__name__, comments or None, 1)
    if response.stderr: print(response.stderr, file=sys.stderr, end="")
    headers, separator, body = response.stdout.replace("\r\n", "\n").partition("\n\n")
    status = re.match(r"HTTP/\S+ ([0-9]{3})\b", headers)
    status = int(status[1]) if status else None
    if response.returncode or status != 200 or not separator:
        unavailable = page == 1 and (response.returncode == 4 or status in (401, 403, 404))
        emit("UNAVAILABLE" if unavailable else "PARTIAL", f"page {page}: HTTP {status}, gh exit {response.returncode}; inspect stderr", comments or None, 1)
    try:
        batch = json.loads(body)
        if not isinstance(batch, list) or any(
            not isinstance(c, dict) or type(c.get("id")) is not int or c["id"] <= 0 or not isinstance(c.get("path"), str) or not c["path"].strip() or not isinstance(c.get("body"), str)
            or "line" not in c or (c["line"] is not None and (type(c["line"]) is not int or c["line"] <= 0))
            or (c.get("in_reply_to_id") is not None and (type(c["in_reply_to_id"]) is not int or c["in_reply_to_id"] <= 0)) for c in batch): raise ValueError("invalid comment fields")
        json.dumps(batch, allow_nan=False)
    except (ValueError, RecursionError) as exc:
        emit("PARTIAL", f"page {page}: invalid comment JSON ({type(exc).__name__})", comments or None, 1)
    comments.extend(batch)
    if not re.search(r"<[^>]+>;\s*rel=\"next\"", headers, re.I): emit("COMPLETE", comments=comments)
    page += 1
' "$1" "$(usage)"
