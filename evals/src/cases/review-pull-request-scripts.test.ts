import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SHA_LENGTH = 40;
const ONE_FINDING = 1;
const scripts = fileURLToPath(
  new URL("../../../skills/review-pull-request/scripts/", import.meta.url),
);

function python(source: string): string {
  return execFileSync(
    "python3",
    [
      "-I",
      "-c",
      `
import contextlib, io, json, os, pathlib, runpy, tempfile, subprocess, sys
scripts = pathlib.Path(${JSON.stringify(scripts)})
render = runpy.run_path(str(scripts / "render-review.py"))
validate = runpy.run_path(str(scripts / "validate-output.py"))["validate"]
with tempfile.TemporaryDirectory() as directory:
 os.chdir(directory)
 run = pathlib.Path(".")
 context, author, body = render["fixture"](run)
 def put(mode, value):
  (run / (mode + ".txt")).write_text(mode.split("-")[0].upper() + ": PASS\\n" + json.dumps(value))
${source
  .split("\n")
  .map((line) => ` ${line}`)
  .join("\n")}
`,
    ],
    { encoding: "utf8" },
  );
}

describe("shipped review boundaries", () => {
  it.each(["identical", "superseded"])(
    "renders only canonical residual risks: %s",
    (variant) => {
      const output = python(`
chunk = json.loads((run / "chunk-correctness.txt").read_text().split("\\n", 1)[1])
chunk["residual_risks"] = ["Raw risk"]
author["residual_risks"] = [${JSON.stringify(variant === "identical" ? "Raw risk" : "Corrected risk")}]
put("chunk-correctness", chunk)
put("author", author)
print(render["render"](run).decode().split("## Residual risks\\n\\n")[1].split("\\n\\n## Verification notes")[0])
`);
      expect(output.trim()).toBe(
        variant === "identical" ? "Raw risk" : "Corrected risk",
      );
    },
  );

  const pathFields = [
    ["context", 'data["changed_files"][0]', "changed_files[0]"],
    ["context", 'data["dimensions"][0]["files"][0]', "dimensions[0].files[0]"],
    ["context", 'data["threads"][0]["path"]', "threads[0].path"],
    ["chunk", 'data["inspected"][0]["path"]', "inspected[0].path"],
    ["chunk", 'data["gaps"][0]["path"]', "gaps[0].path"],
    [
      "author",
      'data["findings"][0]["anchor"]["path"]',
      "findings[0].anchor.path",
    ],
  ] as const;
  it.each(pathFields)(
    "rejects escaping %s %s with a field diagnostic",
    (mode, target, diagnostic) => {
      for (const path of [
        "/outside/file.py",
        "../file.py",
        "src/../../file.py",
        "C:/file.py",
        "C:\\file.py",
        "\\\\host\\share",
        "src//file.py",
        "src/./file.py",
        "src/\u0000file.py",
      ]) {
        const output = python(`
mode = ${JSON.stringify(mode)}
name = "chunk-correctness" if mode == "chunk" else mode
data = json.loads((run / (name + ".txt")).read_text().split("\\n", 1)[1])
if mode == "chunk": data["gaps"] = [dict(path="missing.py", kind="omitted", detail="Not inspected")]
${target} = ${JSON.stringify(path)}
result = subprocess.run([sys.executable, "-I", str(scripts / "validate-output.py"), mode], input=mode.upper() + ": PASS\\n" + json.dumps(data), capture_output=True, text=True)
assert result.returncode == 1, (result.returncode, result.stdout, result.stderr)
print(result.stdout)
`);
        expect(output).toContain(
          `${diagnostic}: expected repository-relative path`,
        );
      }
    },
  );

  it.each([
    " ",
    "dir with spaces/é.py",
    "src/odd#name?.py",
    "a:b.py",
    "-leading.py",
    "src/back\\slash.py",
  ])("preserves legitimate Git path %s", (path) => {
    expect(
      python(`
author["findings"][0]["anchor"]["path"] = ${JSON.stringify(path)}
print(json.dumps(validate("author", ("AUTHOR: PASS\\n" + json.dumps(author)).encode())))
`).trim(),
    ).toBe("[]");
  });

  it("renders a pinned encoded anchor without a public severity heading", () => {
    const output = python(`
author["findings"][0]["anchor"]["path"] = "dir with spaces/a#b.py"
put("author", author)
print(render["render"](run).decode())
`);
    expect(output).toContain(
      `https://github.com/cli/cli/blob/${"b".repeat(SHA_LENGTH)}/dir%20with%20spaces/a%23b.py#L1-L2`,
    );
    expect(output).not.toContain("### [important]");
  });

  it.each([
    "blocking: fix this",
    "This is a footgun.",
    Array.from({ length: 130 }, () => "word").join(" "),
    "```suggestion\nnone\n```",
  ])("rejects unsuitable exact prose %s", (body) => {
    expect(
      python(`
author["findings"][0]["body"] = ${JSON.stringify(body)}
print("\\n".join(validate("author", ("AUTHOR: PASS\\n" + json.dumps(author)).encode())))
`),
    ).toContain("findings[0].body:");
  });

  it("rejects a public title label and malformed findings without crashing", () => {
    expect(
      python(`
author["findings"][0]["title"] = "[P1] Guard"
print("\\n".join(validate("author", ("AUTHOR: PASS\\n" + json.dumps(author)).encode())))
`),
    ).toContain("findings[0].title: public severity");
    expect(
      python(`
author["findings"] = None
result = subprocess.run([sys.executable, "-I", str(scripts / "validate-output.py"), "author"], input="AUTHOR: PASS\\n"+json.dumps(author), text=True, capture_output=True)
assert result.returncode == 1, result.stderr
print(result.stdout)
`),
    ).toContain("findings: expected array");
  });

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
if "history_basis" in post:
 context["posting_basis"] = post["history_basis"]("cli/cli", 1, context["head_sha"], runner)
 put("context", context)
with contextlib.redirect_stdout(io.StringIO()) as preview:
 assert post["execute"](["--dry-run", "."], runner, lambda: True) == 0
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
 code = post["execute"](["--approved", sha, "."], runner, lambda: True)
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

  it("renders no-findings, populated drops, separate pins and qualified CI without inventing approval", () => {
    const output = python(`
author.update(decision="COMMENT", findings=[], dropped=[dict(candidate="tests-1", reason="No changed-code causality")], residual_risks=["Binary coverage unavailable"])
put("author", author)
print(render["render"](run).decode())
`);
    expect(output).toContain(
      "No findings in the inspected scope. This is not proof of correctness.",
    );
    expect(output).toContain("tests-1: No changed-code causality");
    expect(output).toContain("## Review decision\n\nCOMMENT");
    expect(output).toContain(
      "Dimensions reviewed: correctness\n\nReviewed base:",
    );
    expect(output).toContain(
      "CI as observed at collection:\n\nNot run; collected at fixture time",
    );
  });

  it.each(["APPROVE", "COMMENT", "REQUEST_CHANGES"])(
    "preserves authored merge-readiness decision %s, not a severity lookup",
    (decision) => {
      expect(
        python(`
author["decision"] = ${JSON.stringify(decision)}
author["summary"] = "Within the inspected scope, this decision follows merge readiness, not the important severity label."
put("author", author)
print(render["render"](run).decode())
`),
      ).toContain(`## Review decision\n\n${decision}`);
    },
  );

  it("requires assessments even with no rediscovered candidates", () => {
    expect(
      python(`
author.update(decision="COMMENT", findings=[], thread_assessments=[])
put("author", author)
try: render["render"](run)
except ValueError as error: print(str(error))
`),
    ).toContain("thread_assessments must cover exactly");
  });

  it("renders base-only citations at the base SHA and keeps one cross-file causal finding", () => {
    const output = python(`
author["findings"][0]["anchor"]["side"] = "LEFT"
author["findings"][0]["evidence"] = "file.py:1 calls cart.py:3 from checkout.py:4; one connected defect"
put("author", author)
print(render["render"](run).decode())
`);
    expect(output).toContain(`/blob/${"a".repeat(SHA_LENGTH)}/file.py#L1-L2`);
    expect(output).toContain("file.py:1 calls cart.py:3 from checkout.py:4");
    expect(output.match(/^ID:/gm)).toHaveLength(ONE_FINDING);
  });

  it("resolves shipped helpers outside the workspace through a root containing spaces", () => {
    expect(
      python(`
import shutil, subprocess
package = pathlib.Path("package with spaces")
shutil.copytree(scripts, package)
print(subprocess.check_output([${JSON.stringify("python3")}, "-I", str(package / "render-review.py"), ".", "review.md"], text=True))
print(pathlib.Path("review.md").is_file())
`),
    ).toContain("True");
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

  it.each(["validate-output.py", "render-review.py", "post-review.py"])(
    "runs shipped %s self-tests",
    (script) => {
      expect(
        execFileSync("python3", ["-I", `${scripts}${script}`, "--self-test"], {
          encoding: "utf8",
        }),
      ).toContain("passed");
    },
  );
});
