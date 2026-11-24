import { describe, expect, it } from "vitest";

import { python } from "#/cases/review-pull-request-fixtures.ts";

const SHA_LENGTH = 40;
// Same no-reopen run as the former 4cd1a9af… pin, now binding both replies' URLs and thread IDs.
const REPLY_APPROVAL =
  "c9177a559563da7e146f0805e9b343c5650fdcb4f7c6d02c74694b3ec73fd526";
// Keep the history identical on both sides of the legacy hash comparison.
const LEGACY_HISTORY =
  "6f364d6293f025fc5517bc09b3993b057579aa7fab92fde7cc6a10bd16ca863f";
const NO_REPLY_APPROVAL =
  "f125b894586b7415349da4d3f9c7513987265fbde61a53cee088bb70576ed913";

// One fake GitHub for every in-process row: it answers by endpoint from
// `live`, records each POST with the receipts saved on disk at that moment,
// and raises on any call whose "METHOD endpoint" contains live["fail"].
const POSTER_SETUP = String.raw`
from unittest.mock import patch
post = runpy.run_path(str(scripts / "post-review.py"))
execute, plan_for, history_snapshot = post["execute"], post["plan_for"], post["history_snapshot"]
context["threads"].append(dict(context["threads"][0], thread_id="thread2", root_comment_id=8,
                              root_url="https://github.com/cli/cli/pull/1#discussion_r8"))
finding = author["findings"][0]
author["findings"] = [finding, dict(finding, id="R1", placement="reply", root_comment_id=7),
                      dict(finding, id="R2", placement="reply", root_comment_id=8)]
live = dict(state="open", head=context["head_sha"], base_ref=context["base"],
            merge_base=context["base_sha"], viewer="reviewer", reviews=[], discussion=[],
            threads=[dict(t, root_comment_id=str(t["root_comment_id"]), comments=[dict(body="Original")])
                     for t in context["threads"]], fail=None)
inline_url = "https://github.com/cli/cli/pull/1#discussion_r101"
comment = dict(path="file.py", side="RIGHT", line=2, start_line=1, id=101, html_url=inline_url)
live["inline_pages"] = [[comment]]
calls, posts, read_timeouts = [], [], []
def github(args, data=None, *, timeout=None):
    endpoint = next(a for a in args if a in ("user", "graphql") or a.startswith("repos/"))
    method = args[args.index("--method") + 1] if "--method" in args else "GET"
    calls.append(key := method + " " + endpoint)
    if method == "POST": posts.append((endpoint, data, json.loads(receipts_bytes() or "null")))
    if endpoint == "repos/cli/cli/pulls/1/reviews/1/comments": read_timeouts.append(timeout)
    if live["fail"] and live["fail"] in key: raise ValueError("simulated gh failure")
    if method == "POST": return dict(id=len(posts), html_url="https://github.com/receipt/" + str(len(posts)))
    if endpoint == "user": return dict(login=live["viewer"])
    if endpoint == "graphql": return live["threads"]
    if endpoint == "repos/cli/cli/pulls/1/reviews/1/comments":
        if live.get("inline_timeout"): raise subprocess.TimeoutExpired(args, timeout)
        return live["inline_pages"]
    if endpoint.endswith("/reviews"): return [[review] for review in live["reviews"]]
    if endpoint.endswith("/issues/1/comments"): return [[comment] for comment in live["discussion"]]
    if "/compare/" in endpoint: return dict(merge_base_commit=dict(sha=live["merge_base"]))
    return dict(user=dict(login="someone"), state=live["state"], head=dict(sha=live["head"]), base=dict(ref=live["base_ref"]))
def invoke(args, runner=github):
    with (contextlib.redirect_stdout(io.StringIO()) as output,
          contextlib.redirect_stderr(io.StringIO()) as error):
        code = execute(args, runner)
    return code, output.getvalue(), error.getvalue()
def preview_sha():
    code, output, error = invoke(["--dry-run", "."])
    assert code == 0, error
    return output.split("approval-sha256: ")[-1].strip()
def receipts_bytes():
    return (run / "receipts.json").read_bytes() if (run / "receipts.json").exists() else None
def save():
    put("context", context)
    put("author", author)
execute.__globals__["collect_threads"] = lambda repo, number: github(["api", "graphql"])
context["posting_basis"] = history_snapshot("cli/cli", 1, context["head_sha"], github)["posting_basis"]
save()
calls.clear()
`;

function verified(source: string): string {
  return python(`${POSTER_SETUP}${source}\nprint("verified")\n`).trim();
}

// Every refusal exits 3 with its diagnostic, posts nothing and leaves receipts as they were.
function refused(invocation: string, family: string): string {
  return String.raw`
before = receipts_bytes()
code, _, error = invoke(${invocation})
assert (code, posts, receipts_bytes()) == (3, [], before), (code, error)
assert ${JSON.stringify(family)} in error, error
`;
}

const PLAN_INVALID =
  "posting requires an open PR, complete history and recorded posting basis";
const PR_CHANGED = "live PR state/head/base changed; approval invalid";
const HISTORY_CHANGED = "live account/history changed; approval invalid";
const MERGE_BASE_CHANGED = "live merge-base changed; approval invalid";

const HASH_INPUTS = [
  ["base branch", 'context["base"] = "release"'],
  ["merge-base", 'context["base_sha"] = "c" * 40'],
  ["posting basis", 'context["posting_basis"]["history_sha256"] = "0" * 64'],
  ["summary", 'author["summary"] += "changed"'],
  ["inline body", 'finding["body"] += "changed"'],
  ["inline target", 'finding["anchor"]["line"] = 3'],
  ["event", 'author["decision"] = "COMMENT"'],
  ["reply body", 'author["findings"][1]["body"] += "changed"'],
] as const;

const RUN_FILE_REFUSALS = [
  ["collected PR is not open", 'context["state"] = "closed"', PLAN_INVALID],
  ["history is partial", 'context["history"] = "partial"', PLAN_INVALID],
  ["posting basis is missing", 'context["posting_basis"] = None', PLAN_INVALID],
  [
    "finding placement is unknown",
    'author["findings"] = [{key: value for key, value in finding.items() if key != "body"} | dict(placement="unknown")]',
    "unknown placement disables posting",
  ],
  [
    "reply targets an uncollected thread",
    'author["findings"][1]["root_comment_id"] = 99',
    "reply target absent from context threads",
  ],
] as const;

const LIVE_CHANGES = [
  ["the live head moved", { head: "c".repeat(SHA_LENGTH) }, PR_CHANGED],
  ["the live PR closed", { state: "closed" }, PR_CHANGED],
  ["the live base branch changed", { base_ref: "release" }, PR_CHANGED],
  [
    "the merge-base moved",
    { merge_base: "c".repeat(SHA_LENGTH) },
    MERGE_BASE_CHANGED,
  ],
  ["the compare read fails", { fail: "/compare/" }, "simulated gh failure"],
  ["the account changed", { viewer: "other" }, HISTORY_CHANGED],
  ["a review was added", { reviews: [{ body: "LGTM" }] }, HISTORY_CHANGED],
  [
    "a discussion comment was added",
    { discussion: [{ body: "New discussion" }] },
    HISTORY_CHANGED,
  ],
] as const;

const GATE_REFUSALS = [
  ["with a wrong approval hash", 'args[1] = "0" * 64', "sha256 mismatch"],
  [
    "when receipts already exist",
    '(run / "receipts.json").write_text("{}")',
    "receipts already exist; never retry a posting run",
  ],
  [
    "when gh is missing",
    'os.environ["PATH"] = ""\nrunner = post["gh"]',
    "No such file or directory: 'gh'",
  ],
  [
    "for an absolute run directory",
    "args[2] = str(Path.cwd())",
    "expected workspace-relative path",
  ],
] as const;

describe("post-review.py preview", () => {
  it.each(["APPROVE", "REQUEST_CHANGES"])(
    "refuses local self-review %s before any GitHub call in either poster mode",
    (event) => {
      expect(
        verified(`
author["decision"] = "${event}"
save()
sha = preview_sha()
context["author"] = "REVIEWER"
save()
${refused('["--dry-run", "."]', "COMMENT")}
${refused('["--approved", sha, "."]', "COMMENT")}
assert calls == []
`),
      ).toBe("verified");
    },
  );

  it("prints a deterministic preview of the account, counts, event, pins, exact bodies and targets without calling GitHub", () => {
    expect(
      verified(String.raw`
context["posting_basis"]["history_sha256"] = "${LEGACY_HISTORY}"
save()
code, output, _ = invoke(["--dry-run", "."])
assert code == 0 and invoke(["--dry-run", "."])[1] == output and calls == []
assert output == "\n\n".join([
    "POST review to cli/cli#1", "Submit a new review as reviewer (not an author-response workflow).",
    "Inline comments: 1; thread replies: 2", "base: main", "merge-base: " + "a" * 40,
    "commit_id: " + "b" * 40, "event: REQUEST_CHANGES", "Summary body:", body,
    'Inline: {"line":2,"path":"file.py","side":"RIGHT","start_line":1,"start_side":"RIGHT"}', body,
    "Reply to root 7: https://github.com/cli/cli/pull/1#discussion_r7", body,
    "Reply to root 8: https://github.com/cli/cli/pull/1#discussion_r8", body,
]) + "\napproval-sha256: ${REPLY_APPROVAL}\n", output
`),
    ).toBe("verified");
  });

  it("preserves the approval pin of a plan without replies", () => {
    expect(
      verified(String.raw`
context["posting_basis"]["history_sha256"] = "${LEGACY_HISTORY}"
author["findings"] = [finding]
save()
code, output, _ = invoke(["--dry-run", "."])
assert code == 0 and output.endswith("approval-sha256: ${NO_REPLY_APPROVAL}\n")
assert hashlib.sha256(output.encode()).hexdigest() == "eb59f531d321cf2fc15a13eeb799cc2514329acfb7ce0e22bfa4b473a4698132"
`),
    ).toBe("verified");
  });

  it("warns when this account already approved this head", () => {
    expect(
      verified(String.raw`
context["posting_basis"]["approval_urls"] = ["https://github.com/approval"]
author["decision"] = "APPROVE"
save()
output = invoke(["--dry-run", "."])[1]
assert "This account already approved this head: https://github.com/approval" in output
assert "APPROVED explicitly confirms submitting another approval; otherwise choose ABORT." in output
`),
    ).toBe("verified");
  });

  it.each(HASH_INPUTS)(
    "changes the approval hash when the %s changes",
    (_label, statement) => {
      expect(
        verified(String.raw`
before = plan_for(run)[3]
${statement}
save()
assert plan_for(run)[3] != before
`),
      ).toBe("verified");
    },
  );
});

describe("post-review.py refusals before any effect", () => {
  it.each(RUN_FILE_REFUSALS)(
    "refuses to preview a run whose %s",
    (_label, statement, family) => {
      expect(
        verified(String.raw`
${statement}
save()
${refused('["--dry-run", "."]', family)}`),
      ).toBe("verified");
    },
  );

  it.each(LIVE_CHANGES)(
    "refuses an approved run when %s after the preview",
    (_label, override, family) => {
      expect(
        verified(String.raw`
sha = preview_sha()
live.update(json.loads(${JSON.stringify(JSON.stringify(override))}))
${refused('["--approved", sha, "."]', family)}`),
      ).toBe("verified");
    },
  );

  it("refuses an approved run when a thread reply's text changed after preview", () => {
    expect(
      verified(String.raw`
sha = preview_sha()
live["threads"][0]["comments"][0]["body"] = "Changed claim"
${refused('["--approved", sha, "."]', HISTORY_CHANGED)}`),
    ).toBe("verified");
  });

  it.each(GATE_REFUSALS)(
    "refuses an approved run %s",
    (_label, statement, family) => {
      expect(
        verified(String.raw`
args, runner = ["--approved", preview_sha(), "."], github
${statement}
${refused("args, runner", family)}`),
      ).toBe("verified");
    },
  );
});

const REVIEWS = "repos/cli/cli/pulls/1/reviews";
const REPLY_7 = "repos/cli/cli/pulls/1/comments/7/replies";
const REPLY_8 = "repos/cli/cli/pulls/1/comments/8/replies";
const READ_INLINE = "GET repos/cli/cli/pulls/1/reviews/1/comments";
const ALL_POSTS = `["POST ${REVIEWS}", "POST ${REPLY_7}", "POST ${REPLY_8}"]`;

const POSTING_RUNS = [
  [
    "preserves exact POST bytes and order, then reads and saves inline receipts once",
    String.raw`
code, output, error = invoke(["--approved", preview_sha(), "."])
assert code == 0 and "GET repos/cli/cli/compare/main..." + "b" * 40 in calls, error
assert calls[-4:] == ${ALL_POSTS} + ["${READ_INLINE}"] and calls.count("${READ_INLINE}") == 1, calls
assert [post[0] for post in posts] == ["${REVIEWS}", "${REPLY_7}", "${REPLY_8}"]
# Byte fingerprints captured from the pre-reopen review and reply POSTs.
legacy_review = "ccfc09e0e214bf179bb789f64668170994fea6abcc739964bf9fc36f1fe68eca"
legacy_reply = "5d36d69280a5068206fac345309dc0025f1aff55623798c517a3389cb5a2deae"
assert [hashlib.sha256(data.encode()).hexdigest() for _, data, _ in posts] == [legacy_review, legacy_reply, legacy_reply]
review = dict(id=1, url="https://github.com/receipt/1")
first = dict(finding="R1", id=2, url="https://github.com/receipt/2")
second = dict(finding="R2", id=3, url="https://github.com/receipt/3")
saved = dict(review=None, replies=[], reopened=[], failed=[], complete=False, inline=None, inline_error=None)
assert [post[2] for post in posts] == [saved, dict(saved, review=review),
                                       dict(saved, review=review, replies=[first])]
assert json.loads(output) == json.loads(receipts_bytes()) == dict(
    saved, review=review, replies=[first, second], complete=True,
    inline=[dict(finding="F1", id=101, url=inline_url)])
`,
  ],
  [
    "exits 1 and records the review as failed when the review POST fails",
    String.raw`
sha = preview_sha()
live["fail"] = "POST ${REVIEWS}"
code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and [post[0] for post in posts] == ["${REVIEWS}"], (code, error)
assert "${READ_INLINE}" not in calls, calls
assert json.loads(receipts_bytes()) == dict(review=None, replies=[], reopened=[], complete=False, inline=None, inline_error=None,
    failed=[dict(review="review", detail="simulated gh failure; stop, never retry")])
`,
  ],
  [
    "exits 1 after a failed reply, keeps the review and reads its inline URLs once",
    String.raw`
sha = preview_sha()
live["fail"] = "POST ${REPLY_7}"
code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and [post[0] for post in posts] == ["${REVIEWS}", "${REPLY_7}"], error
assert calls[-3:] == ["POST ${REVIEWS}", "POST ${REPLY_7}", "${READ_INLINE}"], calls
assert calls.count("${READ_INLINE}") == 1, calls
assert json.loads(receipts_bytes()) == dict(
    review=dict(id=1, url="https://github.com/receipt/1"), replies=[], reopened=[], complete=False,
    inline=[dict(finding="F1", id=101, url=inline_url)], inline_error=None,
    failed=[dict(finding="R1", detail="simulated gh failure; stop, never retry")])
`,
  ],
  [
    "exits 1 and says never retry when the completion receipt cannot be saved",
    String.raw`
sha = preview_sha()
replace = os.replace
def replace_unless_complete(source, target):
    if json.loads(Path(source).read_bytes())["complete"]:
        raise OSError("simulated completion receipt failure")
    return replace(source, target)
with patch.object(os, "replace", replace_unless_complete):
    code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and len(posts) == 3, (code, error)
assert calls[-4:] == ${ALL_POSTS} + ["${READ_INLINE}"] and calls.count("${READ_INLINE}") == 1, calls
assert "All GitHub actions posted; local completion receipt write failed" in error
assert "never retry" in error and not (run / "render.tmp").exists()
assert json.loads(receipts_bytes())["complete"] is False
`,
  ],
] as const;

const INLINE_MISSES = [
  [
    "two planned findings share an anchor",
    'author["findings"].append(dict(finding, id="F2"))\nsave()',
    "2 of 2 not matched",
  ],
  [
    "two returned comments share an anchor, even if one has an invalid receipt",
    'live["inline_pages"].append([dict(comment, id=102, html_url=None)])',
    "1 of 1 not matched",
  ],
  ["GitHub omits the URL", 'comment.pop("html_url")', "1 of 1 not matched"],
  [
    "GitHub returns a non-HTTPS URL",
    'comment["html_url"] = "http://github.com/unusable"',
    "1 of 1 not matched",
  ],
  [
    "GitHub returns a URL that cannot be written as UTF-8",
    String.raw`comment["html_url"] = "https://github.com/\ud800"`,
    "1 of 1 not matched",
  ],
  [
    "GitHub returns an invalid ID",
    'comment["id"] = True',
    "1 of 1 not matched",
  ],
  [
    "GitHub returns comments differing by path, side or line",
    'live["inline_pages"] = [[dict(comment, path="other.py"), dict(comment, side="LEFT"), dict(comment, line=3)]]',
    "1 of 1 not matched",
  ],
] as const;

describe("post-review.py posting", () => {
  it.each(POSTING_RUNS)("%s", (_label, source) => {
    expect(verified(source)).toBe("verified");
  });

  it.each(INLINE_MISSES)(
    "leaves the inline unmapped when %s",
    (_label, setup, reason) => {
      expect(
        verified(String.raw`
${setup}
code, _, error = invoke(["--approved", preview_sha(), "."])
assert code == 0 and error == "", (code, error)
assert calls[-4:] == ${ALL_POSTS} + ["${READ_INLINE}"] and len(posts) == 3, calls
saved = json.loads(receipts_bytes())
assert (saved.get("inline"), saved.get("inline_error"), saved["complete"], saved["failed"]) == (
    [], ${JSON.stringify(reason)}, True, []), saved
`),
      ).toBe("verified");
    },
  );

  it("keeps a valid inline receipt when another comment has no URL", () => {
    expect(
      verified(String.raw`
author["findings"].append(dict(finding, id="F2", anchor=dict(finding["anchor"], line=3)))
unusable = dict(comment, id=102, line=3)
del unusable["html_url"]
live["inline_pages"].append([unusable])
save()
code, _, error = invoke(["--approved", preview_sha(), "."])
assert code == 0 and error == "", (code, error)
assert calls[-4:] == ${ALL_POSTS} + ["${READ_INLINE}"] and len(posts) == 3, calls
saved = json.loads(receipts_bytes())
assert (saved.get("inline"), saved.get("inline_error"), saved["complete"]) == (
    [dict(finding="F1", id=101, url=inline_url)], "1 of 2 not matched", True), saved
`),
    ).toBe("verified");
  });

  it.each([
    ["the inline GET fails", `live["fail"] = "${READ_INLINE}"`],
    ["the inline GET times out", 'live["inline_timeout"] = True'],
    [
      "the inline GET returns malformed pages",
      'live["inline_pages"] = [comment]',
    ],
  ])("keeps posting successful when %s", (_label, setup) => {
    expect(
      verified(String.raw`
${setup}
code, output, error = invoke(["--approved", preview_sha(), "."])
assert code == 0 and error == "", (code, error)
assert calls[-4:] == ${ALL_POSTS} + ["${READ_INLINE}"] and calls.count("${READ_INLINE}") == 1, calls
assert len(posts) == 3, posts
assert len(read_timeouts) == 1 and read_timeouts[0] is not None and read_timeouts[0] > 0, read_timeouts
saved = json.loads(receipts_bytes())
assert json.loads(output) == saved and saved["complete"] and saved["failed"] == [], saved
assert "inline" in saved and saved["inline"] is None and saved.get("inline_error"), saved
`),
    ).toBe("verified");
  });

  it("snapshots only this account's approvals at this head from paginated history", () => {
    expect(
      verified(String.raw`
head = context["head_sha"]
live["reviews"] = [
    dict(state="APPROVED", commit_id=head, user=dict(login="reviewer"), html_url="https://github.com/mine"),
    dict(state="APPROVED", commit_id=head, user=dict(login="other"), html_url="https://github.com/other"),
    dict(state="COMMENTED", commit_id=head, user=dict(login="reviewer"), html_url="https://github.com/note"),
    dict(state="APPROVED", commit_id="c" * 40, user=dict(login="reviewer"), html_url="https://github.com/old")]
reads = []
snapshot = history_snapshot("cli/cli", 1, head, lambda args: reads.append(args) or github(args))
assert snapshot["posting_basis"]["approval_urls"] == ["https://github.com/mine"]
assert snapshot["evidence"]["reviews"] == live["reviews"]
assert all("--paginate" in args and "--slurp" in args
           for args in reads if args[-1].endswith(("/reviews", "/comments")))
`),
    ).toBe("verified");
  });
});
