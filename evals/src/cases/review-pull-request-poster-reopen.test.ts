import { describe, expect, it } from "vitest";

import { python } from "#/cases/review-pull-request-fixtures.ts";

// Exercise the shipped plan, preview, preflight and on-disk receipt writes. Only
// the GitHub reads/writes are substituted; live roots use the collector's strings.
const SETUP = String.raw`
post = runpy.run_path(str(scripts / "post-review.py"))
execute = post["execute"]
root = context["threads"][0]
root.update(is_resolved=True, viewer_can_unresolve=True)
second = dict(root, thread_id="thread2", root_comment_id=8, root_url=root["root_url"][:-1]+"8")
context["threads"].append(second)
inline = author["findings"][0]
replies = [dict(inline, id="R"+str(i), placement="reply", root_comment_id=t["root_comment_id"],
                body="Still applies " + str(i), reopen=True) for i,t in enumerate(context["threads"],1)]
author["findings"].extend(replies)
author["thread_assessments"] = []
live = [dict(t, root_comment_id=str(t["root_comment_id"])) for t in context["threads"]]
execute.__globals__["collect_threads"] = lambda repo, number: live
operations, prior_receipts, sent = [], [], []
inline_pages = [[]]
receipt_path = run / "receipts.json"
mutation = "mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}"
responses = {}
endpoint = "repos/cli/cli/pulls/1"
def github(args, data=None, *, timeout=None):
    if data is not None:
        assert args[-2:] == ["--input", "-"] and "github.com" in args
        payload = json.loads(data)
        target = args[-3]
        sent.append((target, data.encode("utf-8")))
        prior_receipts.append(json.loads(receipt_path.read_bytes()))
        if target == "graphql":
            identifier = payload["variables"]["id"]
            assert payload == dict(query=mutation, variables=dict(id=identifier)), payload
            operations.append("reopen " + identifier)
            result = responses.get(identifier, dict(data=dict(unresolveReviewThread=dict(thread=dict(id=identifier, isResolved=False)))))
            if isinstance(result, Exception): raise result
            return result
        operations.append(target.removeprefix(endpoint))
        return responses.get(target, dict(id=len(operations), html_url="https://github.com/post/"+str(len(operations))))
    target = args[-1]
    if target == "user": return dict(login="reviewer")
    if target == endpoint: return dict(state="open", head=dict(sha=context["head_sha"]), base=dict(ref="main"), user=dict(login="someone"))
    if "/compare/" in target: return dict(merge_base_commit=dict(sha=context["base_sha"]))
    if target == endpoint+"/reviews/1/comments":
        operations.append("read inlines")
        prior_receipts.append(json.loads(receipt_path.read_bytes()))
        return inline_pages
    else: assert target in (endpoint+"/reviews", "repos/cli/cli/issues/1/comments"), target
    return [[]]
def save():
    put("context", context)
    put("author", author)
def pin_live():
    context["posting_basis"] = post["history_snapshot"]("cli/cli", 1, context["head_sha"], github)["posting_basis"]
    save()
def invoke(args):
    with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
        code = execute([*args, "."], github)
    return code, out.getvalue(), err.getvalue()
def preview():
    code, output, error = invoke(["--dry-run"])
    assert code == 0, error
    return output, output.rsplit("approval-sha256: ",1)[1].strip()
pin_live()
`;

function verify(source: string): string {
  return python(`${SETUP}${source}\nprint("verified")`).trim();
}

describe("ordinary reply target approval", () => {
  it.each([
    ["URL", 'second["root_url"] = root["root_url"]'],
    ["thread ID", 'second["thread_id"] = "other-thread"'],
  ])("binds an ordinary reply's %s and checks it live", (_field, change) => {
    expect(
      verify(String.raw`
for reply in replies: del reply["reopen"]
save()
old_preview, old = preview()
${change}
save()
new_preview, new = preview()
if ${JSON.stringify(_field)} == "URL":
    assert "Reply to root 8: " + live[1]["root_url"] in old_preview
    assert "Reply to root 8: " + root["root_url"] in new_preview
assert new != old, "ordinary reply target not bound to approval"
for sha, diagnostic in [(old, "sha256 mismatch"), (new, "live reply target")]:
    code, _, error = invoke(["--approved", sha])
    assert code == 3 and diagnostic in error, (code, error)
    assert operations == [] and not receipt_path.exists()
`),
    ).toBe("verified");
  });

  it("refuses a missing ordinary live reply root even when the history digest matches", () => {
    expect(
      verify(String.raw`
for reply in replies: del reply["reopen"]
live.pop()
pin_live()
code, _, error = invoke(["--approved", preview()[1]])
assert code == 3 and "live reply target" in error, (code, error)
assert operations == [] and not receipt_path.exists()
`),
    ).toBe("verified");
  });
});

describe("resolved-thread posting approval", () => {
  it("shows every reply before the first reopen and explains a reply without permission", () => {
    expect(
      verify(String.raw`
second["viewer_can_unresolve"] = False
del replies[1]["reopen"]
save()
output, _ = preview()
assert "\nInline comments: 1; thread replies: 2\n\nThreads reopened after their replies: 1\n" in output, output
expected = "\n\n".join([
    "Reply to root 7: " + root["root_url"], "Still applies 1",
    "Reply to root 8: " + second["root_url"] + " (resolved thread; this account cannot unresolve it)", "Still applies 2",
    "Then unresolve review thread thread: " + root["root_url"],
])
assert expected + "\napproval-sha256: " in output, output
assert "Then unresolve review thread thread2:" not in output
assert operations == [] and not receipt_path.exists()
`),
    ).toBe("verified");
  });

  it("binds an optional reopen independently of its reply body and history basis", () => {
    expect(
      verify(String.raw`
_, approved = preview()
del replies[0]["reopen"]
save()
output, changed = preview()
assert approved != changed and "Then unresolve review thread thread: " not in output
assert invoke(["--approved", approved])[0] == 3 and not receipt_path.exists()
`),
    ).toBe("verified");
  });

  it("invalidates approval when the reopen target changes with identical REST payloads and basis", () => {
    expect(
      verify(String.raw`
_, sha = preview()
root["thread_id"] = "different-thread"
save()
assert preview()[1] != sha
assert invoke(["--approved", sha])[0] == 3
assert operations == [] and not receipt_path.exists()
`),
    ).toBe("verified");
  });

  it.each([
    ["an unresolved root", 'root["is_resolved"] = False'],
    ["a root without permission", 'root["viewer_can_unresolve"] = False'],
    ["a duplicate thread ID", 'second["thread_id"] = root["thread_id"]'],
  ])("refuses to preview a reopen for %s", (_label, change) => {
    expect(
      verify(String.raw`
${change}
save()
code, output, error = invoke(["--dry-run"])
assert (code, output, operations, receipt_path.exists()) == (3, "", [], False), (code, error)
`),
    ).toBe("verified");
  });

  it.each([
    ["thread ID changed", 'live[1]["thread_id"] = "replacement"'],
    [
      "preview shows the adjacent root's URL",
      'second["root_url"] = root["root_url"]',
    ],
    ["already unresolved", 'live[1]["is_resolved"] = False'],
    ["permission revoked", 'live[1]["viewer_can_unresolve"] = False'],
  ])(
    "refuses before the review when a live reopen is stale: %s",
    (_label, change) => {
      expect(
        verify(String.raw`
${change}
pin_live()  # The digest matches; only a target-by-target check can stop this run.
_, sha = preview()
code, _, error = invoke(["--approved", sha])
assert (code, operations, receipt_path.exists()) == (3, [], False), (code, error, operations)
`),
      ).toBe("verified");
    },
  );
});

const REPLY_OPERATIONS =
  '["/reviews", "/comments/7/replies", "/comments/8/replies"]';

const MIXED_POST = String.raw`
left = dict(path="file.py", line=8, side="LEFT")
right = dict(path="file.py", line=2, side="RIGHT", start_line=1)
right_body, left_body = "One inline.  \n\nKeep the range.\n", "Deuxième inline.\n"
reply_7, reply_8 = "First follow-up.  \n", "Second follow-up.\n\nDifferent root.  \n"
inline["body"] = right_body
replies[0]["body"], replies[1]["body"] = reply_7, reply_8
del replies[1]["reopen"]
author["findings"] = [inline, replies[0], dict(inline, id="F2", anchor=left, body=left_body), replies[1]]
f1_url, f2_url = ("https://github.com/inline/" + str(i) for i in [101, 102])
inline_pages = [[dict(left, id=102, html_url=f2_url)], [dict(right, id=101, html_url=f1_url)]]
save()
shown, sha = preview()
approved_replies = ["Reply to root 7: " + root["root_url"], reply_7,
                    "Reply to root 8: " + second["root_url"], reply_8,
                    "Then unresolve review thread thread: " + root["root_url"]]
assert "\n\n".join(approved_replies) + "\napproval-sha256: " in shown, shown
code, output, error = invoke(["--approved", sha])
assert (code, error) == (0, ""), (code, error)
review = dict(commit_id="b"*40, event="REQUEST_CHANGES", body=body,
              comments=[dict(right, start_side="RIGHT", body=right_body), dict(left, body=left_body)])
expected = [(endpoint+"/reviews", review), (endpoint+"/comments/7/replies", {"body":reply_7}),
            (endpoint+"/comments/8/replies", {"body":reply_8}), ("graphql", dict(query=mutation, variables=dict(id="thread")))]
assert sent == [(target, json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
                for target, payload in expected], sent
assert operations == ["/reviews", "/comments/7/replies", "/comments/8/replies", "reopen thread", "read inlines"], operations
saved = json.loads(receipt_path.read_bytes())
assert json.loads(output) == saved == dict(
    review=dict(id=1, url="https://github.com/post/1"),
    replies=[dict(finding="R1", id=2, url="https://github.com/post/2"), dict(finding="R2", id=3, url="https://github.com/post/3")],
    reopened=[dict(finding="R1", thread_id="thread", url="https://github.com/cli/cli/pull/1#discussion_r7")],
    inline=[dict(finding="F1", id=101, url=f1_url), dict(finding="F2", id=102, url=f2_url)],
    complete=True, failed=[], inline_error=None), saved
`;

describe("resolved-thread mutation receipts", () => {
  it("does not rewrite the completed receipt if the final result cannot be printed", () => {
    expect(
      verify(String.raw`
_, sha = preview()
class LostResult(io.StringIO):
    def write(self, text):
        self.saved = receipt_path.read_bytes()
        raise BrokenPipeError("reader closed")
with contextlib.redirect_stdout(LostResult()) as output, contextlib.redirect_stderr(io.StringIO()):
    code = execute(["--approved", sha, "."], github)
assert code == 1 and receipt_path.read_bytes() == output.saved
assert json.loads(output.saved)["complete"] and not json.loads(output.saved)["failed"]
`),
    ).toBe("verified");
  });

  it("posts two distinct inlines and two exact replies to their roots, then reopens only the approved thread", () => {
    expect(verify(MIXED_POST)).toBe("verified");
  });

  it("saves every reply, then each confirmed reopen, before reading inline comments", () => {
    expect(
      verify(String.raw`
shown, sha = preview()
expected = ["Reply to root 7: " + root["root_url"], "Still applies 1",
            "Reply to root 8: " + second["root_url"], "Still applies 2",
            "Then unresolve review thread thread: " + root["root_url"],
            "Then unresolve review thread thread2: " + second["root_url"]]
assert "\n\n".join(expected) + "\napproval-sha256: " in shown, shown
code, output, error = invoke(["--approved", sha])
assert code == 0 and error == "", (code, error)
assert operations == ${REPLY_OPERATIONS} + ["reopen thread", "reopen thread2", "read inlines"], operations
first = dict(finding="R1", thread_id="thread", url=root["root_url"])
second_receipt = dict(finding="R2", thread_id="thread2", url=second["root_url"])
assert [r["finding"] for r in prior_receipts[3]["replies"]] == ["R1", "R2"]
assert prior_receipts[3]["reopened"] == [] and prior_receipts[4]["reopened"] == [first]
assert prior_receipts[5]["reopened"] == [first, second_receipt] and not prior_receipts[5]["complete"]
saved = json.loads(receipt_path.read_bytes())
assert json.loads(output) == saved and saved["complete"] and saved["failed"] == []
assert saved["reopened"] == [first, second_receipt], saved
`),
    ).toBe("verified");
  });

  it("does not attempt any reopen if a reply has no valid receipt", () => {
    expect(
      verify(String.raw`
responses[endpoint+"/comments/8/replies"] = {}
_, sha = preview()
assert invoke(["--approved", sha])[0] == 1
assert operations == ${REPLY_OPERATIONS} + ["read inlines"], operations
saved = json.loads(receipt_path.read_bytes())
assert not saved["complete"] and [r["finding"] for r in saved["replies"]] == ["R1"]
assert saved["reopened"] == [] and saved["failed"][0]["finding"] == "R2"
`),
    ).toBe("verified");
  });

  it.each([
    ["wrong thread ID", 'dict(id="other", isResolved=False)'],
    ["still resolved", 'dict(id="thread", isResolved=True)'],
    ["missing resolution state", 'dict(id="thread")'],
    ["nonboolean state", 'dict(id="thread", isResolved=0)'],
  ])(
    "marks a %s response uncertain and never attempts the second reopen",
    (_label, thread) => {
      expect(
        verify(String.raw`
responses["thread"] = dict(data=dict(unresolveReviewThread=dict(thread=${thread})))
_, sha = preview()
code, _, error = invoke(["--approved", sha])
assert code == 1 and "uncertain" in error, (code, error)
assert operations == ${REPLY_OPERATIONS} + ["reopen thread", "read inlines"], operations
saved = json.loads(receipt_path.read_bytes())
assert not saved["complete"] and saved["reopened"] == [] and len(saved["replies"]) == 2
failure, = saved["failed"]
assert failure["reopen"] == "R1" and "never retry" in failure["detail"], failure
assert invoke(["--approved", sha])[0] == 3 and operations.count("reopen thread") == 1
`),
      ).toBe("verified");
    },
  );

  it("retains the first reopen receipt if the second response is not JSON", () => {
    expect(
      verify(String.raw`
responses["thread2"] = json.JSONDecodeError("Expecting value", "", 0)
_, sha = preview()
assert invoke(["--approved", sha])[0] == 1
assert operations == ${REPLY_OPERATIONS} + ["reopen thread", "reopen thread2", "read inlines"], operations
saved = json.loads(receipt_path.read_bytes())
assert not saved["complete"] and [r["finding"] for r in saved["replies"]] == ["R1", "R2"]
assert saved["reopened"] == [dict(finding="R1", thread_id="thread", url=root["root_url"])], saved
failure, = saved["failed"]
assert failure["reopen"] == "R2" and "uncertain" in failure["detail"] and "never retry" in failure["detail"], failure
`),
    ).toBe("verified");
  });
});
