#!/usr/bin/env python3
r"""Usage: python3 -I post-review.py --dry-run RUN_DIR | --approved <sha256> RUN_DIR
       python3 -I post-review.py --snapshot OWNER/REPO NUMBER HEAD_SHA | --resume SAVED_REVIEW [--refresh] | -h
Paths: workspace-relative RUN_DIR and SAVED_REVIEW; run from the workspace root, no .. or symlinks.
SAVED_REVIEW must end in .md and have no .git component.
Resume is read-only unless --refresh follows the draft path. Both print JSON:
{run_dir,pr,base,base_sha,head_sha,output_sha256,history,refreshed}. history compares saved and live
posting bases (unchanged or changed); refreshed is true if context-refresh.txt exists, not proof of a swap.
Refusal prints one reason to stderr: package-missing, draft-differs, already-posted, not-postable,
drift:<state|head|base|merge-base> or read-failed. A live self-review requires a saved COMMENT decision;
otherwise resume refuses with not-postable. After the checks, --refresh replaces only context.txt from
context-refresh.txt via digest-guarded render.tmp. Only history, threads, feedback, posting_basis and
collection-time ci may differ. refresh-missing means no candidate; refresh-mismatch means invalid
context, changed retained evidence, incomplete or stale history, or a refused swap.
Environment: PATH locates gh; GH_TOKEN/GITHUB_TOKEN or gh saved login (github.com).
Exit: 0 posted/preview/snapshot/resume/help; 1 possible effect (POST_ERROR, never retry);
2 usage; 3 refused before effects (resume: NEEDS_CONTEXT; posting: POST_ERROR, draft kept).
Approval binds each reply's root ID, thread ID and URL; approved mode checks all three live before posting.
Side effects: approved posts a review, replies, then approved thread reopens;
saves receipts.json via run-local render.tmp after each mutation.
After posting attempts, one best-effort read for a receipted review with inline comments
fills inline and inline_error; complete records mutations and the final save, not read-back.
If stdout fails after the final save, exit 1 and keep the completed receipt unchanged.
Dry-run reads local files only. Never retry. Check: python3 -I post-review.py --dry-run RUN_DIR
"""
from collections import Counter, defaultdict
import hashlib
import json
import os
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

def pr_target(context):
    owner, name, _, number = context["pr"].removeprefix("https://github.com/").split("/")
    return owner + "/" + name, int(number)


def plan_for(run):
    context, author = load(run, "context.txt", "context"), load(run, "author.txt", "author")
    self_reviewer = shared["check_package"](context, author)
    if (context["state"] != "open" or context["history"] != "complete"
            or context.get("posting_basis") is None):
        raise ValueError("posting requires an open PR, complete history and recorded posting basis")
    threads = {t["root_comment_id"]: t for t in context["threads"]}
    comments, replies, reopens = [], [], []
    reopen_ids = set()
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
            thread = threads[root]
            target = dict(root_comment_id=root, thread_id=thread["thread_id"], url=thread["root_url"])
            replies.append(dict(target, body=finding["body"]))
            if finding.get("reopen") is True:
                if thread["thread_id"] in reopen_ids:
                    raise ValueError(f"{finding['id']}: duplicate reopen for thread {thread['thread_id']}")
                reopen_ids.add(thread["thread_id"])
                reopens.append(dict(target, finding=finding["id"]))
    repo, number = pr_target(context)
    plan = dict(repo=repo, number=number,
                base=context["base"], base_sha=context["base_sha"], posting_basis=context["posting_basis"],
                review=dict(commit_id=context["head_sha"], event=author["decision"],
                            body=author["summary"], comments=comments), replies=replies)
    if reopens:
        plan["reopens"] = reopens
    sha = hashlib.sha256(canonical(plan).encode()).hexdigest()
    return context, author, plan, sha, self_reviewer

def preview(context, plan, sha, self_reviewer):
    review = plan["review"]
    basis = plan["posting_basis"]
    parts = [f"POST review to {plan['repo']}#{plan['number']}",
             f"Submit a new review as {basis['viewer']} (not an author-response workflow)."]
    if self_reviewer:
        parts.append(f"Self-review: {self_reviewer} authored this PR; event is COMMENT.")
    parts.append(f"Inline comments: {len(review['comments'])}; thread replies: {len(plan['replies'])}")
    reopens = plan.get("reopens", [])
    if reopens:
        parts.append(f"Threads reopened after their replies: {len(reopens)}")
    parts += ["base: " + plan["base"],
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
        root = reply["root_comment_id"]
        thread = threads[root]
        label = f"Reply to root {root}: {reply['url']}"
        if thread["is_resolved"] and not thread["viewer_can_unresolve"]:
            label += " (resolved thread; this account cannot unresolve it)"
        parts += [label, reply["body"]]
    for action in reopens:
        parts.append(f"Then unresolve review thread {action['thread_id']}: {action['url']}")
    print("\n\n".join(parts) + "\napproval-sha256: " + sha)

def gh(args, data=None, *, timeout=None):
    result = subprocess.run(["gh", *args], input=data, text=True, encoding="utf-8",
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise ValueError(f"gh exit {result.returncode}: {result.stderr.strip()}; outcome may be uncertain")
    return json.loads(result.stdout)

def receipt_for(result):
    identifier, url = result.get("id"), result.get("html_url")
    if (type(identifier) is not int or identifier < 1 or not isinstance(url, str) or
            urlsplit(url).scheme != "https" or not urlsplit(url).netloc):
        raise ValueError("invalid mutation receipt; outcome uncertain, never retry")
    return dict(id=identifier, url=url)

def check_live_replies(replies, reopens, threads):
    if not replies:
        return
    by_root = {str(thread["root_comment_id"]): thread for thread in threads}
    reopen_roots = {action["root_comment_id"] for action in reopens}
    for reply in replies:
        root = reply["root_comment_id"]
        thread = by_root.get(str(root), {})
        if thread.get("thread_id") != reply["thread_id"] or thread.get("root_url") != reply["url"]:
            raise ValueError(f"root {root}: live reply target changed; approval invalid")
        if root in reopen_roots and (thread.get("is_resolved") is not True
                                     or thread.get("viewer_can_unresolve") is not True):
            raise ValueError(f"root {root}: live reopen target changed; approval invalid")

def reopen_thread(api, action, runner):
    query = "mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}"
    try:
        result = runner([*api, "--method", "POST", "graphql", "--input", "-"],
                        canonical(dict(query=query, variables=dict(id=action["thread_id"]))))
        thread = result["data"]["unresolveReviewThread"]["thread"]
        if (not result.get("errors") and thread["id"] == action["thread_id"]
                and thread["isResolved"] is False):
            return dict(finding=action["finding"], thread_id=thread["id"], url=action["url"])
    except (json.JSONDecodeError, UnicodeDecodeError, KeyError, TypeError):
        pass
    raise ValueError("invalid reopen receipt; outcome uncertain")

def inline_anchor(value):
    return tuple(value.get(field) for field in ("path", "side", "line", "start_line"))

def read_inline_receipts(api, endpoint, review, findings, runner):
    try:
        inline = [finding for finding in findings if finding["placement"] == "inline"]
        if review is None or not inline:
            return None, None
        pages = runner([*api, "--paginate", "--slurp", f"{endpoint}/reviews/{review['id']}/comments"],
                       timeout=15)
        if not isinstance(pages, list) or any(not isinstance(page, list) for page in pages):
            return None, "invalid review comments pagination"
        planned = Counter(inline_anchor(finding["anchor"]) for finding in inline)
        returned = defaultdict(list)
        for page in pages:
            for comment in page:
                if not isinstance(comment, dict):
                    continue
                path, side, line, start_line = key = inline_anchor(comment)
                if (isinstance(path, str) and isinstance(side, str) and type(line) is int
                        and (start_line is None or type(start_line) is int) and key in planned):
                    returned[key].append(comment)
        matched = []
        for finding in inline:
            key = inline_anchor(finding["anchor"])
            if planned[key] == 1 and len(returned[key]) == 1:
                try:
                    receipt = dict(finding=finding["id"], **receipt_for(returned[key][0]))
                    # Keep unencodable strings out of the final UTF-8 receipts write.
                    receipt["finding"].encode("utf-8")
                    receipt["url"].encode("utf-8")
                except ValueError:
                    continue
                matched.append(receipt)
        missing = len(inline) - len(matched)
        return matched, f"{missing} of {len(inline)} not matched" if missing else None
    except Exception:
        # A read-back problem must not change the mutation outcome or authorize a retry.
        return None, "review comments read failed"

def save_receipts(path, receipts, create=False):
    if path.is_symlink() or (not create and not path.is_file()):
        raise ValueError("receipts path changed; refusing replacement")
    data = (json.dumps(receipts, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    expected = None if create else shared["digest"](shared["read_bytes"](path))
    shared["write_file"](path.parent, path, data, expected)

class PinDrift(ValueError):
    def __init__(self, pin):
        self.pin = pin
        label = "merge-base" if pin == "merge-base" else "PR state/head/base"
        super().__init__(f"live {label} changed; approval invalid")


def check_live_pins(context, repo, number, runner, decision=None):
    api = ["api", "--hostname", "github.com"]
    live = runner([*api, f"repos/{repo}/pulls/{number}"])
    if live["state"] != "open" or live.get("merged_at"):
        raise PinDrift("state")
    if live["head"]["sha"] != context["head_sha"]:
        raise PinDrift("head")
    if live["base"]["ref"] != context["base"]:
        raise PinDrift("base")
    live_author = live["user"]["login"]
    if not isinstance(live_author, str) or not live_author.strip():
        raise ValueError("live PR author unavailable")
    if decision is not None:
        shared["check_self_review"](live_author, context["posting_basis"]["viewer"], decision)
    comparison = runner([*api, f"repos/{repo}/compare/"
                         f"{quote(context['base'], safe='')}...{context['head_sha']}"])
    if comparison["merge_base_commit"]["sha"] != context["base_sha"]:
        raise PinDrift("merge-base")
    return live_author


def retained_run(saved):
    # Trust the locator only to select a confined directory. Rendering, not the locator,
    # verifies that the package actually produced every byte of the supplied draft.
    pointers = re.findall(rb"^Saved package: (.*)$", saved, re.MULTILINE)
    if not pointers or b"\r" in pointers[-1]:
        raise ValueError("missing or invalid package line")
    raw = pointers[-1].decode("utf-8")
    run = Path(raw)
    if str(run) != raw or run.parent != Path(".handoffs/review-pull-request"):
        raise ValueError("expected retained run directory")
    run = shared["safe_path"](run)
    def fail_walk(error):
        raise error
    for parent, dirs, files in os.walk(run, onerror=fail_walk, followlinks=False):
        if any((Path(parent) / name).is_symlink() for name in dirs + files):
            raise ValueError("package contains symlink")
    return run


def matches_history(fresh, snapshot):
    # A current digest alone does not establish that the collector carried over its targets.
    def thread_target(thread):
        return (str(thread["root_comment_id"]), thread["thread_id"], thread["root_url"], thread["path"],
                thread["line"], thread["is_resolved"], thread["viewer_can_unresolve"])

    evidence = snapshot["evidence"]
    feedback = {("review-summary", r["html_url"]) for r in evidence["reviews"]}
    feedback.update(("discussion", c["html_url"]) for c in evidence["discussion"])
    return (fresh["posting_basis"] == snapshot["posting_basis"]
            and {thread_target(t) for t in fresh["threads"]} == {thread_target(t) for t in evidence["threads"]}
            and {(f["kind"], f["url"]) for f in fresh["feedback"]} == feedback)


def refresh_context(run, context, original, snapshot):
    name = "context-refresh.txt"
    try:
        candidate = shared["read_bytes"](run / name)
    except FileNotFoundError:
        return "refresh-missing"
    except (ValueError, OSError):
        return "refresh-mismatch"
    try:
        fresh = shared["parse_payload"](candidate, name, "context")
        refreshable = {"history", "threads", "feedback", "posting_basis", "ci"}
        if (any(fresh[key] != value for key, value in context.items() if key not in refreshable)
                or fresh["history"] != "complete" or not matches_history(fresh, snapshot)):
            return "refresh-mismatch"
        shared["write_file"](run, run / "context.txt", candidate, shared["digest"](original))
    except (ValueError, OSError, KeyError, TypeError):
        return "refresh-mismatch"
    return None


def resume(saved_review, runner, refresh=False):
    try:
        path = shared["draft_path"](saved_review)
        saved = shared["read_bytes"](path)
        run = retained_run(saved)
        if (run / "receipts.json").exists():
            return "already-posted"
        original = shared["read_bytes"](run / "context.txt")
        context = shared["parse_payload"](original, "context.txt", "context")
        author = load(run, "author.txt", "author")
        rendered = shared["render"](run, context, author)
    except (ValueError, OSError, KeyError, TypeError):
        return "package-missing"
    if saved != rendered:
        return "draft-differs"
    if context["state"] != "open" or context["history"] != "complete" or context["posting_basis"] is None:
        return "not-postable"
    try:
        repo, number = pr_target(context)
        live_author = check_live_pins(context, repo, number, runner)
        snapshot = history_snapshot(repo, number, context["head_sha"], runner)
    except PinDrift as drift:
        return "drift:" + drift.pin
    except (ValueError, OSError, KeyError, TypeError, AttributeError):
        return "read-failed"
    try:
        shared["check_self_review"](live_author, snapshot["posting_basis"]["viewer"], author["decision"])
    except ValueError:
        return "not-postable"
    history = "unchanged" if snapshot["posting_basis"] == context["posting_basis"] else "changed"
    if refresh:
        reason = refresh_context(run, context, original, snapshot)
        if reason:
            return reason
    fields = {key: context[key] for key in ("pr", "base", "base_sha", "head_sha")}
    print(canonical(dict(fields, run_dir=str(run), output_sha256=shared["digest"](saved), history=history,
                         refreshed=(run / "context-refresh.txt").exists())))
    return None


def execute(args, runner=gh):
    if args == ["-h"]:
        print(__doc__.strip())
        return 0
    if "--resume" in args or "--refresh" in args:
        if (len(args) < 2 or args[0] != "--resume" or args[2:] not in ([], ["--refresh"])
                or args[1] in ("--resume", "--refresh", "--dry-run", "--approved", "--snapshot", "-h")):
            print(__doc__.strip(), file=sys.stderr)
            return 2
        reason = resume(args[1], runner, refresh=bool(args[2:]))
        if reason:
            print(reason, file=sys.stderr)
            return 3
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
        context, author, plan, sha, self_reviewer = plan_for(run)
        if dry:
            preview(context, plan, sha, self_reviewer)
            return 0
        if args[1] != sha:
            raise ValueError("approval sha256 mismatch; preview changed")
        path = run / "receipts.json"
        if path.exists() or path.is_symlink():
            raise ValueError("receipts already exist; never retry a posting run")
        api = ["api", "--hostname", "github.com"]
        endpoint = f"repos/{plan['repo']}/pulls/{plan['number']}"
        check_live_pins(context, plan["repo"], plan["number"], runner, plan["review"]["event"])
        snapshot = history_snapshot(plan["repo"], plan["number"], context["head_sha"], runner)
        if snapshot["posting_basis"] != plan["posting_basis"]:
            raise ValueError("live account/history changed; approval invalid; re-assess and preview anew")
        reopens = plan.get("reopens", [])
        check_live_replies(plan["replies"], reopens, snapshot["evidence"]["threads"])
        receipts = dict(review=None, replies=[], reopened=[], failed=[], complete=False, inline=None, inline_error=None)
        save_receipts(path, receipts, create=True)
        current = dict(review="review")
        attempted = True
        try:
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
            for action in reopens:
                current = dict(reopen=action["finding"])
                receipts["reopened"].append(reopen_thread(api, action, runner))
                save_receipts(path, receipts)
        finally:
            receipts["inline"], receipts["inline_error"] = read_inline_receipts(
                api, endpoint, receipts["review"], author["findings"], runner)
        receipts["complete"] = True
        try:
            save_receipts(path, receipts)
        except (OSError, ValueError) as error:
            receipts["complete"] = False
            print("All GitHub actions posted; local completion receipt write failed: " +
                  str(error) + "; stop, never retry", file=sys.stderr)
            print(json.dumps(receipts, ensure_ascii=False), file=sys.stderr)
            return 1
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

    # The final receipt is durable; losing its stdout copy is not a failed action.
    try:
        print(json.dumps(receipts, ensure_ascii=False), flush=True)
    except (OSError, ValueError) as error:
        if sys.stdout is sys.__stdout__:
            sys.stdout = None  # Do not flush a broken pipe again at interpreter shutdown (exit 120).
        print(f"Receipts saved; result delivery failed: {error}; never retry", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(execute(sys.argv[1:]))
