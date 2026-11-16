#!/usr/bin/env python3
r"""Usage: python3 -I post-review.py --dry-run RUN_DIR | --approved <sha256> RUN_DIR
       python3 -I post-review.py --snapshot OWNER/REPO NUMBER HEAD_SHA | -h
Paths: workspace-relative RUN_DIR; run from the workspace root, no .. or symlinks.
Environment: PATH locates gh; GH_TOKEN/GITHUB_TOKEN or gh saved login (github.com).
Exit: 0 posted/preview/help; 1 possible effect (POST_ERROR, never retry);
2 usage (REVIEW_ERROR); 3 refused before effects (POST_ERROR, draft kept).
Side effects: approved posts review/replies and saves receipts.json via run-local render.tmp.
Dry-run reads only. Never retry. Check: python3 -I post-review.py --dry-run RUN_DIR
"""
import hashlib
import json
from pathlib import Path
import re
import runpy
import subprocess
import sys
from urllib.parse import quote, urlsplit

shared = runpy.run_path(str(Path(__file__).with_name("render-review.py")))
load = shared["load"]

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def collect_threads(repo, number):
    owner, name = repo.split("/")
    result = subprocess.run(["sh", str(Path(__file__).with_name("collect-pr-review-comments.sh")),
                             owner, name, str(number)], text=True, encoding="utf-8",
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ValueError("fresh thread read failed or truncated; approval invalid: " + result.stderr.strip())
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]

def history_snapshot(repo, number, head, runner):
    # Runner is supplied by execute; the collector buffers every page and refuses truncation.
    api = ["api", "--hostname", "github.com"]
    viewer = runner([*api, "user"])
    if not isinstance(viewer.get("login"), str) or not viewer["login"]:
        raise ValueError("current account unavailable")
    threads = collect_threads(repo, number)
    histories = []
    for endpoint in (f"repos/{repo}/pulls/{number}/reviews", f"repos/{repo}/issues/{number}/comments"):
        pages = runner([*api, "--paginate", "--slurp", endpoint])
        if not isinstance(pages, list) or any(not isinstance(page, list) for page in pages):
            raise ValueError("fresh feedback pagination invalid")
        histories.append([item for page in pages for item in page])
    approvals = [review["html_url"] for review in histories[0]
                 if review.get("state") == "APPROVED" and review.get("commit_id") == head
                 and review.get("user", {}).get("login") == viewer["login"]]
    basis = dict(viewer=viewer["login"], approval_urls=approvals,
                 history_sha256=hashlib.sha256(canonical([threads, *histories]).encode()).hexdigest())
    return dict(posting_basis=basis, evidence=dict(threads=threads, reviews=histories[0],
                                                 discussion=histories[1]))

def plan_for(run):
    context, author = load(run, "context.txt", "context"), load(run, "author.txt", "author")
    if (context["state"] != "open" or context["history"] != "complete"
            or context.get("posting_basis") is None):
        raise ValueError("posting requires an open PR, complete history and recorded posting basis")
    threads = {t["root_comment_id"]: t for t in context["threads"]}
    comments, replies = [], []
    for finding in author["findings"]:
        placement = finding["placement"]
        if placement == "unknown":
            raise ValueError(f"{finding['id']}: unknown placement disables posting")
        if placement == "inline":
            comment = dict(finding["anchor"], body=finding["body"])
            if "start_line" in comment:
                comment["start_side"] = comment["side"]
            comments.append(comment)
        if placement == "reply":
            root = finding["root_comment_id"]
            if root not in threads:
                raise ValueError(f"{finding['id']}: reply target absent from context threads")
            replies.append(dict(root_comment_id=root, body=finding["body"]))
    owner, repo, _, number = context["pr"].removeprefix("https://github.com/").split("/")
    plan = dict(repo=owner + "/" + repo, number=int(number),
                base=context["base"], base_sha=context["base_sha"], posting_basis=context["posting_basis"],
                review=dict(commit_id=context["head_sha"], event=author["decision"],
                            body=author["summary"], comments=comments), replies=replies)
    sha = hashlib.sha256(canonical(plan).encode()).hexdigest()
    return context, author, plan, sha

def preview(context, plan, sha):
    review = plan["review"]
    basis = plan["posting_basis"]
    parts = [f"POST review to {plan['repo']}#{plan['number']}",
             f"Submit a new review as {basis['viewer']} (not an author-response workflow).",
             f"Inline comments: {len(review['comments'])}; thread replies: {len(plan['replies'])}",
             "base: " + plan["base"],
             "merge-base: " + plan["base_sha"], "commit_id: " + review["commit_id"],
             "event: " + review["event"], "Summary body:", review["body"]]
    if review["event"] == "APPROVE" and basis["approval_urls"]:
        parts += ["This account already approved this head: " + ", ".join(basis["approval_urls"]),
                  "APPROVED explicitly confirms submitting another approval; otherwise choose ABORT."]
    for comment in review["comments"]:
        location = {key: value for key, value in comment.items() if key != "body"}
        parts += ["Inline: " + canonical(location), comment["body"]]
    threads = {t["root_comment_id"]: t for t in context["threads"]}
    for reply in plan["replies"]:
        parts += [f"Reply to root {reply['root_comment_id']}: "
                  f"{threads[reply['root_comment_id']]['root_url']}", reply["body"]]
    print("\n\n".join(parts) + "\napproval-sha256: " + sha)

def gh(args, data=None):
    result = subprocess.run(["gh", *args], input=data, text=True, encoding="utf-8",
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ValueError(f"gh exit {result.returncode}: {result.stderr.strip()}; outcome may be uncertain")
    return json.loads(result.stdout)

def receipt_for(result):
    identifier, url = result.get("id"), result.get("html_url")
    if (type(identifier) is not int or identifier < 1 or not isinstance(url, str) or
            urlsplit(url).scheme != "https" or not urlsplit(url).netloc):
        raise ValueError("invalid mutation receipt; outcome uncertain, never retry")
    return dict(id=identifier, url=url)

def save_receipts(path, receipts, create=False):
    if path.is_symlink() or (not create and not path.is_file()):
        raise ValueError("receipts path changed; refusing replacement")
    data = (json.dumps(receipts, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    expected = None if create else shared["digest"](shared["read_bytes"](path))
    shared["write_file"](path.parent, path, data, expected)

def execute(args, runner=gh):
    if args == ["-h"]:
        print(__doc__.strip())
        return 0
    if (len(args) == 4 and args[0] == "--snapshot"
            and re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args[1])
            and re.fullmatch(r"[1-9][0-9]*", args[2]) and re.fullmatch(r"[0-9a-f]{40}", args[3])):
        try:
            print(canonical(history_snapshot(args[1], int(args[2]), args[3], runner)))
            return 0
        except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
            print(str(error), file=sys.stderr)
            return 3
    dry = len(args) == 2 and args[0] == "--dry-run"
    approved = len(args) == 3 and args[0] == "--approved" and re.fullmatch(r"[0-9a-f]{64}", args[1])
    if not (dry or approved):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    attempted = False
    try:
        run = Path(args[-1])
        context, author, plan, sha = plan_for(run)
        if dry:
            preview(context, plan, sha)
            return 0
        if args[1] != sha:
            raise ValueError("approval sha256 mismatch; preview changed")
        path = run / "receipts.json"
        if path.exists() or path.is_symlink():
            raise ValueError("receipts already exist; never retry a posting run")
        api = ["api", "--hostname", "github.com"]
        endpoint = f"repos/{plan['repo']}/pulls/{plan['number']}"
        live = runner([*api, endpoint])
        if (live.get("state") != "open" or live.get("head", {}).get("sha") != context["head_sha"] or
                live.get("base", {}).get("ref") != context["base"] or live.get("merged_at")):
            raise ValueError("live PR state/head/base changed; approval invalid")
        comparison = runner([*api, f"repos/{plan['repo']}/compare/"
                             f"{quote(context['base'], safe='')}...{context['head_sha']}"])
        if comparison.get("merge_base_commit", {}).get("sha") != context["base_sha"]:
            raise ValueError("live merge-base changed; approval invalid")
        if (history_snapshot(plan["repo"], plan["number"], context["head_sha"], runner)["posting_basis"]
                != plan["posting_basis"]):
            raise ValueError("live account/history changed; approval invalid; re-assess and preview anew")
        receipts = dict(review=None, replies=[], failed=[], complete=False)
        save_receipts(path, receipts, create=True)
        current = dict(review="review")
        attempted = True
        result = runner([*api, "--method", "POST", endpoint + "/reviews", "--input", "-"],
                        canonical(plan["review"]))
        receipts["review"] = receipt_for(result)
        save_receipts(path, receipts)
        findings = [finding for finding in author["findings"] if finding["placement"] == "reply"]
        for finding, reply in zip(findings, plan["replies"]):
            current = dict(finding=finding["id"])
            result = runner([*api, "--method", "POST", endpoint +
                             f"/comments/{reply['root_comment_id']}/replies", "--input", "-"],
                            canonical(dict(body=reply["body"])))
            receipts["replies"].append(dict(finding=finding["id"], **receipt_for(result)))
            save_receipts(path, receipts)
        receipts["complete"] = True
        try:
            save_receipts(path, receipts)
        except (OSError, ValueError) as error:
            receipts["complete"] = False
            print("All GitHub actions posted; local completion receipt write failed: " +
                  str(error) + "; stop, never retry", file=sys.stderr)
            print(json.dumps(receipts, ensure_ascii=False), file=sys.stderr)
            return 1
        print(json.dumps(receipts, ensure_ascii=False))
        return 0
    except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
        if attempted:
            receipts["failed"] = [dict(current, detail=str(error) + "; stop, never retry")]
            try:
                save_receipts(path, receipts)
            except (OSError, ValueError) as receipt_error:
                print("Receipt write failed: " + str(receipt_error), file=sys.stderr)
            print(json.dumps(receipts, ensure_ascii=False), file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 1 if attempted else 3

if __name__ == "__main__":
    sys.exit(execute(sys.argv[1:]))
