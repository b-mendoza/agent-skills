import { describe, expect, it } from "vitest";

import { python } from "#/cases/review-pull-request-fixtures.ts";

// post-review.py setup shared by the cases ported from its former --self-test.
// invoke() fails any gh read the case does not stub and never reaches real gh.
const POSTER_SETUP = String.raw`
from unittest.mock import patch
post = runpy.run_path(str(scripts / "post-review.py"))
execute, plan_for = post["execute"], post["plan_for"]
execute.__globals__["collect_threads"] = lambda *args: []
def invoke(args, runner=None):
    with (contextlib.redirect_stdout(io.StringIO()) as output,
          contextlib.redirect_stderr(io.StringIO()) as error):
        code = execute(
            args, runner or (lambda *a: (_ for _ in ()).throw(AssertionError("unexpected gh"))))
    return code, output.getvalue(), error.getvalue()
dry = ["--dry-run", "."]
first = invoke(dry)
sha = first[1].split("approval-sha256: ")[-1].strip()
approved = ["--approved", sha, "."]
finding = author["findings"][0]
`;

function verified(source: string): string {
  return python(`${POSTER_SETUP}${source}\nprint("verified")\n`).trim();
}

describe("post-review.py live preflight", () => {
  it.each([
    "unchanged",
    "thread",
    "new-thread",
    "reply-text",
    "truncated",
    "review",
    "discussion",
    "viewer",
    "head",
    "base",
    "closed",
  ])("preflights history and preserves exact approved bytes: %s", (change) => {
    const output = python(`
post = runpy.run_path(str(scripts / "post-review.py"))
threads = [dict(thread_id="thread", is_resolved=False, path="file.py", line=1, root_comment_id="7", root_url="https://github.com/cli/cli/pull/1#discussion_r7", comments_total=1, comments_truncated=False, comments=[dict(body="Original")])]
post["execute"].__globals__["collect_threads"] = lambda *args: threads
calls = []
phase = "collection"
def runner(args, data=None):
 calls.append((args, data))
 endpoint = next((a for a in args if a == "user" or a.startswith("repos/")), "")
 if "--method" in args: return dict(id=len(calls), html_url="https://github.com/receipt/" + str(len(calls)))
 if endpoint == "user": return dict(login="other" if phase == "changed" and change == "viewer" else "reviewer")
 if endpoint.endswith("/reviews"): return [[dict(id=1, state="APPROVED", user=dict(login="reviewer"), commit_id=context["head_sha"], html_url="https://github.com/approval")]] if phase == "changed" and change == "review" else [[]]
 if endpoint.endswith("/comments"): return [[dict(body="New discussion")]] if phase == "changed" and change == "discussion" else [[]]
 if "/compare/" in endpoint: return dict(merge_base_commit=dict(sha="c" * 40 if change == "base" else context["base_sha"]))
 return dict(state="closed" if change == "closed" else "open", head=dict(sha="c" * 40 if change == "head" else context["head_sha"]), base=dict(ref=context["base"]))
change = ${JSON.stringify(change)}
context["posting_basis"] = post["history_snapshot"]("cli/cli", 1, context["head_sha"], runner)["posting_basis"]
put("context", context)
with contextlib.redirect_stdout(io.StringIO()) as preview:
 assert post["execute"](["--dry-run", "."], runner) == 0
sha = preview.getvalue().split("approval-sha256: ")[-1].strip()
phase = "changed"
if change == "thread": threads[0]["is_resolved"] = True
if change == "new-thread": threads.append(dict(threads[0], thread_id="new", root_comment_id="8"))
if change == "reply-text": threads[0]["comments"][0]["body"] = "Changed claim"
if change == "truncated":
 def fail_threads(*args): raise ValueError("truncated history")
 post["execute"].__globals__["collect_threads"] = fail_threads
calls.clear()
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
 code = post["execute"](["--approved", sha, "."], runner)
writes = [(args, json.loads(data)) for args, data in calls if data is not None]
assert code == (0 if change == "unchanged" else 3), (code, calls)
if change not in ("head", "base", "closed"):
 assert any("user" in args for args, data in calls)
if change == "unchanged":
 assert writes[0][1]["body"] == body
 assert "new review as reviewer" in preview.getvalue()
 assert "Inline comments: 1; thread replies: 0" in preview.getvalue()
else:
 assert writes == [], writes
print("verified")
`);
    expect(output.trim()).toBe("verified");
  });

  it.each(["closed", "merged"])(
    "refuses historical %s posting before mutation",
    (state) => {
      expect(
        python(`
post = runpy.run_path(str(scripts / "post-review.py"))
context["state"] = ${JSON.stringify(state)}
put("context", context)
with contextlib.redirect_stderr(io.StringIO()): print(post["execute"](["--dry-run", "."]))
`),
      ).toContain("3");
    },
  );
});

describe("post-review.py preview and approval hash", () => {
  it("refuses an absolute RUN_DIR", () => {
    expect(
      verified(String.raw`
assert invoke(["--dry-run", str(Path.cwd())])[0] == 3
`),
    ).toBe("verified");
  });

  it("prints a deterministic preview with the exact body, base and merge-base", () => {
    expect(
      verified(String.raw`
assert first[0] == 0 and first == invoke(dry) and body in first[1]
assert "base: main" in first[1] and "merge-base: " + "a" * 40 in first[1]
`),
    ).toBe("verified");
  });

  it("changes the approval hash when base or base_sha changes", () => {
    expect(
      verified(String.raw`
for key, value in [("base", "release"), ("base_sha", "c" * 40)]:
    put("context", dict(context, **{key: value}))
    assert plan_for(run)[3] != sha
`),
    ).toBe("verified");
  });

  it("changes the approval hash when the summary, an inline body or a reply body changes", () => {
    expect(
      verified(String.raw`
author["findings"] += [dict(author["findings"][0], id="R", placement="reply", root_comment_id=7)]
put("author", author)
for target, key in [(author, "summary"), (author["findings"][0], "body"),
                    (author["findings"][1], "body")]:
    before = plan_for(run)[3]
    target[key] += "changed"
    put("author", author)
    assert plan_for(run)[3] != before
`),
    ).toBe("verified");
  });
});

describe("post-review.py refusals before effects", () => {
  it("refuses a wrong approval hash and a missing gh CLI", () => {
    expect(
      verified(String.raw`
def gh_absent(*args):
    raise FileNotFoundError(2, "No such file or directory", "gh")
for args, runner in [(["--approved", "0" * 64, "."], None), (approved, gh_absent)]:
    assert invoke(args, runner)[0] == 3
`),
    ).toBe("verified");
  });

  it("refuses dry-run for a closed PR or partial history", () => {
    expect(
      verified(String.raw`
for change in [dict(state="closed"), dict(history="partial")]:
    put("context", dict(context, **change))
    assert invoke(dry)[0] == 3
`),
    ).toBe("verified");
  });

  it("refuses dry-run for an unknown placement or an absent reply root", () => {
    expect(
      verified(String.raw`
unknown = {key: value for key, value in finding.items() if key != "body"}
for invalid in [dict(unknown, placement="unknown"),
                dict(finding, placement="reply", root_comment_id=99)]:
    author["findings"] = [invalid]
    put("author", author)
    assert invoke(dry)[0] == 3
`),
    ).toBe("verified");
  });

  it("refuses live head drift, a closed live PR and an auth failure", () => {
    expect(
      verified(String.raw`
for runner in [lambda *a: dict(state="open", head=dict(sha="c" * 40), base=dict(ref="main")),
               lambda *a: dict(state="closed", head=dict(sha=context["head_sha"]),
                              base=dict(ref="main")),
               lambda *a: (_ for _ in ()).throw(ValueError("gh exit 4: auth required"))]:
    assert invoke(approved, runner)[0] == 3
`),
    ).toBe("verified");
  });

  it.each([
    ["a base-ref drift", String.raw`"release", "a" * 40`],
    ["a merge-base drift", String.raw`"main", "c" * 40`],
    ["a compare read failure", String.raw`"main", None`],
  ])("refuses %s with read-only calls and no receipts", (_label, row) => {
    expect(
      verified(String.raw`
base, merge_base = ${row}
calls = []
def preflight(args, data=None):
    calls.append((args, data))
    if len(calls) == 1:
        return dict(state="open", head=dict(sha=context["head_sha"]),
                    base=dict(ref=base, sha="c" * 40))
    if "/compare/" in args[-1]:
        if merge_base is None:
            raise ValueError("simulated compare read failure")
        return dict(merge_base_commit=dict(sha=merge_base))
    return dict(id=1, html_url="https://github.com/receipt/1")
assert invoke(approved, preflight)[0] == 3
assert not (run / "receipts.json").exists()
assert all("--method" not in args and data is None for args, data in calls)
assert len(calls) == (1 if base == "release" else 2)
if base == "main":
    assert calls[1][0][-1] == "repos/cli/cli/compare/main..." + "b" * 40
`),
    ).toBe("verified");
  });
});

describe("post-review.py posting sequence", () => {
  it.each([
    ["completes a clean run", "None"],
    ["records a failed reply", String.raw`"reply"`],
    ["reports a failed final receipt replacement", String.raw`"receipt"`],
    ["reports a failed final receipt flush", String.raw`"receipt-write"`],
  ])(
    "%s, keeps receipts ahead of each POST and refuses a re-run",
    (_label, failure) => {
      expect(
        verified(String.raw`
failure = ${failure}
author["findings"] = [finding, dict(finding, id="R1", placement="reply", root_comment_id=7)]
context["threads"].append(dict(context["threads"][0], thread_id="thread2", root_comment_id=8,
                              root_url="https://github.com/cli/cli/pull/1#discussion_r8"))
author["findings"].append(dict(finding, id="R2", placement="reply", root_comment_id=8))
put("context", context)
put("author", author)
calls = []
def stub(args, data=None):
    if args[-1] == "user":
        return dict(login="reviewer")
    if "--slurp" in args:
        return [[]]
    calls.append((args, data))
    if len(calls) == 1:
        return dict(state="open", head=dict(sha=context["head_sha"]),
                    base=dict(ref=context["base"], sha="c" * 40))
    if len(calls) == 2:
        assert args[-1] == "repos/cli/cli/compare/main..." + "b" * 40
        assert data is None and not (run / "receipts.json").exists()
        return dict(merge_base_commit=dict(sha=context["base_sha"]))
    if len(calls) == 3:
        assert json.loads((run / "receipts.json").read_bytes()) == dict(
            review=None, replies=[], failed=[], complete=False)
    if failure == "reply" and len(calls) == 4:
        raise ValueError("simulated reply failure")
    return dict(id=len(calls), html_url="https://github.com/receipt/" + str(len(calls)))
replace, fsync = os.replace, os.fsync
def replace_stub(source, target):
    if failure == "receipt" and json.loads(Path(source).read_bytes())["complete"]:
        raise OSError("simulated final receipt replacement failure")
    return replace(source, target)
def fsync_stub(fd):
    temporary = run / "render.tmp"
    if (failure == "receipt-write" and temporary.is_file() and
            json.loads(temporary.read_bytes())["complete"]):
        raise OSError("simulated final receipt flush failure")
    return fsync(fd)
current_sha = invoke(dry)[1].split("approval-sha256: ")[-1].strip()
with patch.object(os, "replace", replace_stub), patch.object(os, "fsync", fsync_stub):
    result = invoke(["--approved", current_sha, "."], stub)
assert result[0] == (1 if failure else 0)
receipts = json.loads((run / "receipts.json").read_bytes())
assert receipts["review"]["id"] == 3 and calls[2][0][-2:] == ["--input", "-"]
assert json.loads(calls[2][1])["body"] == body and json.loads(calls[3][1])["body"] == body
assert json.loads(calls[2][1])["comments"][0] == dict(finding["anchor"], body=body,
                                                     start_side="RIGHT")
assert (len(receipts["replies"]) == (0 if failure == "reply" else 2) and
        bool(receipts["failed"]) == (failure == "reply"))
assert receipts["complete"] is (not failure)
assert not (run / "render.tmp").exists()
if failure in ("receipt", "receipt-write"):
    assert "All GitHub actions posted; local completion receipt write failed" in result[2]
    assert "never retry" in result[2]
assert len(calls) == (4 if failure == "reply" else 5)
assert calls[3][0][-3].endswith("/comments/7/replies")
assert failure == "reply" or calls[4][0][-3].endswith("/comments/8/replies")
assert invoke(["--approved", current_sha, "."])[0] == 3
`),
      ).toBe("verified");
    },
  );
});
