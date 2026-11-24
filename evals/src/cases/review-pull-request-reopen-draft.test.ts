import { describe, expect, it } from "vitest";

import {
  python,
  VALIDATOR_CASES,
} from "#/cases/review-pull-request-fixtures.ts";

const RENDER_REFUSED = 1;
const RESOLVED_REPLY = String.raw`
thread = context["threads"][0]
thread.update(is_resolved=True, viewer_can_unresolve=True)
author["thread_assessments"] = []
reply = author["findings"][0]
reply.update(placement="reply", root_comment_id=thread["root_comment_id"])
def save_inputs():
    put("context", context)
    put("author", author)
`;

describe("reopens in the saved review", () => {
  it.each([
    ["an unresolved target", "is_resolved"],
    ["a target the viewer cannot reopen", "viewer_can_unresolve"],
  ])("refuses %s even if another thread can be reopened", (_label, field) => {
    const output = python(String.raw`${RESOLVED_REPLY}
context["threads"].insert(0, dict(thread, root_comment_id=8, thread_id="other"))
thread[${JSON.stringify(field)}] = False
if not thread["is_resolved"]:
    author["thread_assessments"] = [dict(root_comment_id=7, status="still-valid", evidence="Guard still missing")]
reply["reopen"] = True
save_inputs()
result = subprocess.run([sys.executable, "-I", scripts / "render-review.py", ".", "draft.md"], text=True, capture_output=True)
print(json.dumps([result.returncode, result.stderr, Path("draft.md").exists()]))
`);
    expect(JSON.parse(output)).toEqual([
      RENDER_REFUSED,
      expect.stringContaining("findings[0].reopen"),
      false,
    ]);
  });

  it("marks only the finding as a planned reopen until a receipt is available", () => {
    const output = python(String.raw`${RESOLVED_REPLY}
reply["reopen"] = True
save_inputs()
before, posting = render["render"](run).decode().split("## Posting\n")
finding = before.split("## Findings\n")[1].split("## Dropped candidates\n")[0]
print(json.dumps([finding, posting]))
`);
    expect(JSON.parse(output)).toEqual([
      expect.stringMatching(/planned[^\n]*reopen/i),
      "\nNot posted.\nSaved package: .\n",
    ]);
  });

  it("renders successful reopens under Posting without rewriting the finding", () => {
    const output = python(String.raw`${RESOLVED_REPLY}
reply["reopen"] = True
save_inputs()
draft = render["render"](run).split(b"## Posting\n")[0]
receipts = dict(review=dict(id=9, url="https://a.co/r9"), replies=[], failed=[], complete=True,
                reopened=[dict(finding="F1", thread_id="thread", url=thread["root_url"])])
(run / "receipts.json").write_text(json.dumps(receipts))
review, posting = render["render"](run).split(b"## Posting\n")
print(json.dumps([review == draft, posting.decode()]))
`);
    expect(JSON.parse(output)).toEqual([
      true,
      expect.stringMatching(/Reopened:[^\n]*F1[^\n]*discussion_r7/),
    ]);
  });

  it("preserves the previous draft bytes when the resolved reply does not request a reopen", () => {
    const sha = python(String.raw`${RESOLVED_REPLY}
thread["viewer_can_unresolve"] = False
save_inputs()
prior_bytes = render["render"](run).removesuffix(b"Saved package: .\n")
print(hashlib.sha256(prior_bytes).hexdigest())
`);
    // Captured by rendering this resolved reply with the pre-reopen scripts.
    expect(sha.trim()).toBe(
      "27be83fd572bd2d9b7b42c224290b40ecc1578cc9460a65cf3accf1d8d151835",
    );
  });
});

describe("thread reopen permissions", () => {
  it("requests the viewer permission and projects booleans without inventing a missing permission", () => {
    const output = python(String.raw`
import shlex
command = subprocess.check_output(["sh", scripts / "collect-pr-review-comments.sh", "--dry-run", "org", "repo", "1"], text=True)
args = shlex.split(command.replace("\\\n", ""))
query = next(arg for arg in args if arg.startswith("query="))
projection = args[args.index("--jq") + 1]
node = dict(id="T1", isResolved=True, path="a.py", line=1, comments=dict(totalCount=1, pageInfo=dict(hasNextPage=False),
            nodes=[dict(fullDatabaseId="7", url="https://a.co/r7", author=dict(login="reviewer"), body="Fix")]))
results = []
for permission in [{}, {"viewerCanUnresolve": "true"}, {"viewerCanUnresolve": False}, {"viewerCanUnresolve": True}]:
    response = dict(data=dict(repository=dict(pullRequest=dict(reviewThreads=dict(nodes=[dict(node, **permission)])))))
    result = subprocess.run(["jq", "-r", projection], input=json.dumps(response), text=True, capture_output=True)
    results.append("refused" if result.returncode else json.loads(result.stdout).get("viewer_can_unresolve"))
print(json.dumps(["viewerCanUnresolve" in query.split(), *results]))
`);
    expect(JSON.parse(output)).toEqual([
      true,
      "refused",
      "refused",
      false,
      true,
    ]);
  });

  it("requires each collected thread to carry a boolean viewer permission", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
thread = good["context"]["threads"][0]
thread.pop("viewer_can_unresolve", None)
cases = [("missing", "context", payload("context", good["context"]), "threads[0].viewer_can_unresolve: missing key")]
for value in [False, True, 1, None, "true"]:
    thread["viewer_can_unresolve"] = value
    cases.append((repr(value), "context", payload("context", good["context"]),
                  "" if type(value) is bool else "threads[0].viewer_can_unresolve: expected boolean"))
report(cases)
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
  });

  it("allows only literal true on an authored reply and locates every invalid reopen field", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
cases = []
for index, row in enumerate(good["author"]["findings"]):
    for value in [True, False, 1, "true", None]:
        row["reopen"] = value
        legal = row["placement"] == "reply" and value is True
        cases.append((row["placement"] + repr(value), "author", payload("author", good["author"]),
                      "" if legal else f"findings[{index}].reopen:"))
    del row["reopen"]
cases.append(("absent", "author", payload("author", good["author"]), ""))
good["chunk"]["findings"] = [dict(finding, id="tests-1", reopen=True)]
cases.append(("chunk", "chunk", payload("chunk", good["chunk"]), "findings[0].reopen: extra key"))
report(cases)
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
  });
});
