import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  python,
  VALIDATOR_CASES,
  VALIDATOR_MUTATIONS,
} from "#/cases/review-pull-request-fixtures.ts";

const SHA_LENGTH = 40;
const ONE_FINDING = 1;
const scripts = fileURLToPath(
  new URL("../../../skills/review-pull-request/scripts/", import.meta.url),
);

const ACCEPTED_CASES = 17;
const MALFORMED_CASES = 10;
const MUTATION_CASES = { context: 11, chunk: 2, author: 9, verify: 1 };

// render-review.py setup shared by the cases ported from its former --self-test.
const RENDER_SETUP = String.raw`
from unittest.mock import patch
renderer = render
render, write_file, digest = renderer["render"], renderer["write_file"], renderer["digest"]
def refused(action):
    try:
        action()
    except (ValueError, OSError):
        return
    raise AssertionError("expected refusal")
data = render(run)
output = run / "review.md"
`;
const RECEIPTS = String.raw`
receipts = dict(review=dict(id=9, url="https://github.com/cli/cli/pull/1#pullrequestreview-9"),
                replies=[], failed=[], complete=True)
`;

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

describe("validate-output.py contract", () => {
  it("accepts conforming payloads, a verify FAIL and every failure-status envelope", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
cases = [(mode + " good", mode, payload(mode, data), "") for mode, data in good.items()]
cases.append(("FAIL", "verify", payload("verify", dict(issues=["Fix"], observed_checks=[]), "FAIL"), ""))
cases += [(mode + status, mode, payload(mode, dict(reason="R", next_step="N"), status), "")
          for mode in MODES for status in FAILURES]
report(cases)
`);
    expect(JSON.parse(output)).toEqual({ count: ACCEPTED_CASES, failed: [] });
  });

  it.each(Object.entries(MUTATION_CASES))(
    "reports the expected diagnostic for each %s mutation",
    (mode, count) => {
      const output = python(String.raw`${VALIDATOR_CASES}${VALIDATOR_MUTATIONS}
cases = []
for mode, mutate, expected in mutations:
    if mode != ${JSON.stringify(mode)}: continue
    data = copy.deepcopy(good[mode])
    mutate(data)
    cases.append((mode + expected, mode, payload(mode, data), expected))
report(cases)
`);
      expect(JSON.parse(output)).toEqual({ count, failed: [] });
    },
  );

  it("rejects malformed envelopes and JSON with a located diagnostic", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
cases = [(expected, "verify", raw, expected) for raw, expected in [
    (b'WRONG: PASS\n{"issues":[],"observed_checks":[]}', "line 1: envelope"),
    (b'VERIFY: MAYBE\n{"issues":[],"observed_checks":[]}', "line 1: envelope"),
    (b'VERIFY: PASS\n{"issues":[],"issues":[],"observed_checks":[]}', "issues: duplicate key"),
    (b'VERIFY: FAIL\n{"issues":[],"observed_checks":[]}', "issues: must be empty on PASS"),
    (b'VERIFY: ERROR\n{"reason":"","next_step":"Ask"}', "reason: expected non-empty string"),
    (b'VERIFY: PASS\n{"issues":[],"observed_checks":[]} trailing', "line 2: $: Extra data"),
    (b'VERIFY: PASS\n\xff', "line 2: $: invalid UTF-8"),
    (b'VERIFY: PASS\n{"issues":NaN,"observed_checks":[]}', "invalid JSON constant NaN"),
    (b'VERIFY: PASS\n{"issues":Infinity,"observed_checks":[]}', "invalid JSON constant Infinity"),
    (b'VERIFY: PASS\n[]', "line 2: $: expected object")]]
report(cases)
`);
    expect(JSON.parse(output)).toEqual({ count: MALFORMED_CASES, failed: [] });
  });

  it("exits 0 when conforming, 1 on defects and 2 on a missing mode", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
failed = []
for arguments, raw, expected in [(["verify"], payload("verify", good["verify"]), 0),
                                 (["verify"], b"VERIFY: PASS\n{}", 1), ([], b"", 2)]:
    result = subprocess.run([sys.executable, "-I", str(scripts / "validate-output.py"), *arguments], input=raw, capture_output=True)
    if result.returncode != expected:
        failed.append("CLI exit " + str(expected))
print(json.dumps(failed))
`);
    expect(JSON.parse(output)).toEqual([]);
  });
});

function rendered(source: string): string {
  return python(`${RENDER_SETUP}${source}\nprint("verified")\n`).trim();
}

describe("render-review.py contract", () => {
  it.each([
    [
      "renders exact bodies, the anchor and an unposted marker",
      String.raw`
assert body.encode() in data and b"file.py:1-2 RIGHT" in data
assert data.rsplit(b"## Posting\n", 1)[1] == b"\nNot posted.\n"
`,
    ],
    [
      "creates the output exclusively and returns its digest",
      String.raw`
sha = write_file(run, output, data)
assert sha == digest(data) and output.read_bytes() == data
`,
    ],
    [
      "refuses replacement over a stale render.tmp and preserves it",
      String.raw`
sha = write_file(run, output, data)
temporary = run / "render.tmp"
temporary.write_bytes(b"keep")
refused(lambda: write_file(run, output, data, sha))
assert temporary.read_bytes() == b"keep" and output.read_bytes() == data
`,
    ],
    [
      "removes render.tmp and keeps the output when os.replace fails",
      String.raw`
sha = write_file(run, output, data)
temporary = run / "render.tmp"
with patch("os.replace", side_effect=OSError("cross-device replacement refused")):
    refused(lambda: write_file(run, output, data + b"updated", sha))
assert not temporary.exists() and output.read_bytes() == data
`,
    ],
    [
      "replaces the output when the expected sha matches",
      String.raw`
sha = write_file(run, output, data)
temporary = run / "render.tmp"
assert write_file(run, output, data + b"updated", sha) == digest(data + b"updated")
assert not temporary.exists()
`,
    ],
    [
      "renders complete receipts without the incomplete-posting warning",
      String.raw`${RECEIPTS}
(run / "receipts.json").write_text(json.dumps(receipts))
posting = render(run).rsplit(b"## Posting\n", 1)[1]
assert b"pullrequestreview-9" in posting and b"Posting is incomplete." not in posting
`,
    ],
    [
      "refuses to render without a chunk file",
      String.raw`
(run / "chunk-correctness.txt").unlink()
refused(lambda: render(run))
`,
    ],
    [
      "refuses to render a failed verification",
      String.raw`
fixture(run)
(run / "verify.txt").write_text('VERIFY: FAIL\n{"issues":["Not verified"],"observed_checks":[]}')
refused(lambda: render(run))
`,
    ],
  ])("%s", (_name, source) => {
    expect(rendered(source)).toBe("verified");
  });

  // Labels follow the order of the Python targets list below.
  it.each(
    [
      "an existing output",
      "a symlink",
      "a symlink with its sha",
      "a path through a symlinked directory",
      "a wrong sha",
      "an absolute path",
      "a .. path",
    ].map((label, index) => [label, index] as const),
  )("refuses to write %s", (_label, index) => {
    expect(
      rendered(String.raw`
sha = write_file(run, output, data)
link = run / "link.md"
link.symlink_to(output)
linked_dir = run / "linked-dir"
linked_dir.symlink_to(Path.cwd(), target_is_directory=True)
targets = [(output, None), (link, None), (link, sha),
           (linked_dir / "new.md", None), (output, "0" * 64),
           (Path.cwd() / "absolute.md", None), (Path("../new.md"), None)]
target, expected = targets[${String(index)}]
refused(lambda: write_file(run, target, b"no", expected))
`),
    ).toBe("verified");
  });

  it.each(["False", "None"])(
    "warns that posting is incomplete when complete is %s or missing",
    (complete) => {
      expect(
        rendered(String.raw`${RECEIPTS}
warning = (b"Posting is incomplete. An action without a receipt may still have taken effect on GitHub. "
           b"Check the PR before any manual follow-up; never re-run the poster.")
complete = ${complete}
receipts["complete"] = complete
if complete is None:
    del receipts["complete"]
(run / "receipts.json").write_text(json.dumps(receipts))
posting = render(run).rsplit(b"## Posting\n", 1)[1]
assert warning in posting.splitlines() and b"pullrequestreview-9" in posting
`),
      ).toBe("verified");
    },
  );
});
