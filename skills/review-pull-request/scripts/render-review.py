#!/usr/bin/env python3
r"""Usage: python3 -I render-review.py RUN_DIR OUTPUT_FILE [--replace <sha256>] | -h
Paths: workspace-relative RUN_DIR and OUTPUT_FILE; run from the workspace root, no .. or symlinks.
OUTPUT_FILE must end in .md and have no .git component.
Environment: none. Python 3 stdlib only; use isolated mode (-I).
Exit: 0 written/help; 1 refused/invalid input; 2 usage.
Side effects: creates output exclusively or stages digest-guarded replacement in RUN_DIR/render.tmp.
Check (expect 1, nothing written): python3 -I render-review.py no-such-run out.md; echo $?
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from urllib.parse import quote


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(path):
    path = Path(path)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"{path}: expected workspace-relative path without .. components")
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError(f"{path}: symlinks refused")
    return path


def draft_path(path):
    path = safe_path(path)
    if any(part.casefold() == ".git" for part in path.parts):
        raise ValueError(f"{path}: .git components refused")
    if path.suffix != ".md":
        raise ValueError(f"{path}: expected .md file")
    return path


def read_bytes(path):
    path = safe_path(path)
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError(f"{path}: expected regular file")
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError(f"{path}: expected regular file")
        return stream.read()


def load(run, name, mode):
    return parse_payload(read_bytes(Path(run) / name), name, mode)


def parse_payload(data, name, mode):
    checked = subprocess.run(
        [sys.executable, "-I", str(Path(__file__).with_name("validate-output.py")), mode],
        input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if checked.returncode:
        raise ValueError((checked.stdout + checked.stderr).decode("utf-8", errors="replace").rstrip())
    status, _, body = data.decode("utf-8").partition("\n")
    if status != f"{mode.upper()}: PASS":
        raise ValueError(f"{name}: expected {mode.upper()}: PASS")
    return json.loads(body)


def write_file(run, path, data, expected=None):
    path = safe_path(path)
    if expected is None:
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600),
                       "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return digest(data)
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or digest(read_bytes(path)) != expected:
        raise ValueError(f"{path}: replacement sha256 mismatch")
    temporary = safe_path(Path(run) / "render.tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if digest(read_bytes(path)) != expected:
            raise ValueError(f"{path}: replacement basis changed")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return digest(data)


def check_self_review(pr_author, viewer, decision):
    if pr_author.casefold() != viewer.casefold():
        return None
    if decision != "COMMENT":
        raise ValueError("self-review requires a COMMENT decision")
    return viewer


def check_package(context, author):
    threads = {t["root_comment_id"]: t for t in context["threads"]}
    for index, finding in enumerate(author["findings"]):
        if finding["placement"] != "reply":
            continue
        target = threads.get(finding["root_comment_id"])
        if target is None:
            raise ValueError(f"{finding['id']}: reply target absent from context threads")
        if finding.get("reopen") is True:
            if not target["is_resolved"]:
                raise ValueError(f"findings[{index}].reopen: target thread is not resolved")
            if not target["viewer_can_unresolve"]:
                raise ValueError(f"findings[{index}].reopen: viewer cannot reopen the target thread")
    basis = context["posting_basis"]
    if basis is not None:
        return check_self_review(context["author"], basis["viewer"], author["decision"])
    return None


def render(run, context=None, author=None):
    if context is None:
        context = load(run, "context.txt", "context")
    if author is None:
        author = load(run, "author.txt", "author")
    chunks = [load(run, f"chunk-{d['name']}.txt", "chunk") for d in context["dimensions"]]
    verify = load(run, "verify.txt", "verify")
    self_reviewer = check_package(context, author)
    for dimension, chunk in zip(context["dimensions"], chunks):
        if dimension["name"] != chunk["dimension"]:
            raise ValueError(f"chunk-{dimension['name']}.txt: dimension mismatch")
    threads = {t["root_comment_id"]: t for t in context["threads"]}
    unresolved = {root for root, thread in threads.items() if not thread["is_resolved"]}
    if {a["root_comment_id"] for a in author["thread_assessments"]} != unresolved:
        raise ValueError("thread_assessments must cover exactly the collected unresolved roots")
    state = context["state"] + (" (historical assessment)" if context["state"] != "open" else "")
    parts = [f"# PR review: {context['title']}", f"PR: {context['pr']}", f"PR state: {state}"]
    if self_reviewer:
        parts.append(f"Review type: self-review by {self_reviewer}")
    parts += ["Dimensions reviewed: " + ", ".join(d["name"] for d in context["dimensions"]),
             f"Reviewed base: {context['base_sha']}", f"Reviewed head: {context['head_sha']}", "## Findings"]
    for finding in author["findings"]:
        parts += [f"### {finding['title']}",
                  f"ID: {finding['id']}\nConfidence: {finding['confidence']}\n"
                  f"Placement: {finding['placement']}"]
        anchor = finding["anchor"]
        if anchor:
            lines = (f"{anchor['start_line']}-{anchor['line']}" if "start_line" in anchor
                     else str(anchor["line"]))
            parts.append(f"Anchor: {anchor['path']}:{lines} {anchor['side']}")
            sha = context["head_sha" if anchor["side"] == "RIGHT" else "base_sha"]
            fragment = f"L{anchor.get('start_line', anchor['line'])}"
            if "start_line" in anchor:
                fragment += f"-L{anchor['line']}"
            repository = context["pr"].split("/pull/", 1)[0]
            parts.append(f"Code: [{anchor['path']}:{lines}]({repository}/blob/{sha}/"
                         f"{quote(anchor['path'], safe='/')}#{fragment})")
        for key, label in [("evidence", "Evidence"), ("failure_scenario", "Failure scenario"),
                           ("minimal_fix", "Fix")]:
            parts += [label + ":", finding[key]]
        parts += ["Sources:", "\n".join(finding["sources"]) or "None."]
        if finding["placement"] == "reply":
            parts.append("Reply target: " + threads[finding["root_comment_id"]]["root_url"])
            if finding.get("reopen") is True:
                parts.append("Planned action: reopen this thread.")
        if "body" in finding:
            parts += ["Exact body:", finding["body"]]
    if not author["findings"]:
        parts.append("No findings in the inspected scope. This is not proof of correctness.")
    parts += ["## Dropped candidates"] + [f"{d['candidate']}: {d['reason']}" for d in author["dropped"]]
    if not author["dropped"]:
        parts.append("None.")
    parts += ["## Unresolved thread assessment"]
    parts += [f"{threads[a['root_comment_id']]['root_url']}: {a['status']} — {a['evidence']}"
              for a in author["thread_assessments"]]
    if not author["thread_assessments"]:
        parts.append("No unresolved threads in collected history.")
    parts += ["## Review decision", author["decision"], "## Review summary", author["summary"], "## Coverage"]
    for chunk in chunks:
        parts.append("### " + chunk["dimension"])
        parts += [f"Inspected: {s['path']} {s['ranges']}" for s in chunk["inspected"]]
        parts += [f"Gap: {g['path']} ({g['kind']}): {g['detail']}" for g in chunk["gaps"]]
    parts += ["History: " + context["history"]] + context["limitations"] + ["## Residual risks"]
    risks = author["residual_risks"]
    parts += risks or ["None."]
    parts += (["## Verification notes"] + verify["observed_checks"] +
              ["CI as observed at collection:", context["ci"], "## Posting"])
    receipt = safe_path(Path(run) / "receipts.json")
    if receipt.exists():
        receipts = json.loads(read_bytes(receipt))
        parts += ["Review: " + json.dumps(receipts["review"], ensure_ascii=False)]
        for inline in receipts.get("inline") or []:
            label = re.sub(r"([\\\[\]])", r"\\\1", " ".join(inline["finding"].splitlines()))
            url = quote(inline["url"], safe=":/?#[]@!$&'()*+,;=%")
            parts.append(f"Inline: [{label}](<{url}>)")
        if receipts.get("inline_error"):
            parts.append(f"Inline comment URLs unavailable: {receipts['inline_error']}; open the review URL")
        parts += ["Reply: " + json.dumps(reply, ensure_ascii=False) for reply in receipts["replies"]]
        parts += ["Reopened: " + json.dumps(reopened, ensure_ascii=False) for reopened in receipts.get("reopened", [])]
        parts += ["Failed/uncertain: " + json.dumps(failure, ensure_ascii=False)
                  for failure in receipts["failed"]]
        if receipts.get("complete") is not True:
            parts.append("Posting is incomplete. An action without a receipt may still have taken effect "
                         "on GitHub. Check the PR before any manual follow-up; never re-run the poster.")
    else:
        parts.append("Not posted.")
    return ("\n\n".join(parts) + f"\nSaved package: {Path(run)}\n").encode("utf-8")


def main(args):
    if args == ["-h"]:
        print(__doc__.strip())
        return 0
    if (len(args) not in (2, 4) or
            (len(args) == 4 and (args[2] != "--replace" or not re.fullmatch(r"[0-9a-f]{64}", args[3])))):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        output = draft_path(args[1])
        sha = write_file(args[0], output, render(args[0]), args[3] if len(args) == 4 else None)
        print("sha256: " + sha)
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
