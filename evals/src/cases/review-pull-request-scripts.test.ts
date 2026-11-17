import { describe, expect, it } from "vitest";

import {
  python,
  VALIDATOR_CASES,
  VALIDATOR_MUTATIONS,
} from "#/cases/review-pull-request-fixtures.ts";

const SHA_LENGTH = 40;
const PROSE_WORD_LIMIT = 130;
const PATH_DIAGNOSTIC = "expected repository-relative path";

const PATH_CLASSES: ReadonlyArray<readonly [string, string, boolean]> = [
  ["an absolute path", "/outside/file.py", true],
  ["a UNC root", "\\\\host\\share", true],
  ["a drive root", "C:/file.py", true],
  ["a NUL byte", "src/\u0000file.py", true],
  ["a .. component", "src/../../file.py", true],
  ["a . component", "src/./file.py", true],
  ["an empty component", "src//file.py", true],
  ["a colon inside a name", "a:b.py", false],
  ["a backslash inside a name", "src/back\\slash.py", false],
];

const PATH_FIELDS: ReadonlyArray<readonly [string, string, string]> = [
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
];

const UNSUITABLE_PROSE: ReadonlyArray<
  readonly [string, "body" | "title", string, string]
> = [
  [
    "a severity label in a body",
    "body",
    "blocking: fix this",
    "public severity labels are not allowed",
  ],
  [
    "an idiom",
    "body",
    "This is a footgun.",
    "replace idiom or praise filler with literal language",
  ],
  [
    `${String(PROSE_WORD_LIMIT)} prose words`,
    "body",
    Array.from({ length: PROSE_WORD_LIMIT }, () => "word").join(" "),
    `expected fewer than ${String(PROSE_WORD_LIMIT)} prose words (fenced code excluded)`,
  ],
  [
    "a none suggestion",
    "body",
    "```suggestion\nnone\n```",
    "unsafe placeholder suggestion",
  ],
  [
    "a severity label in the title",
    "title",
    "[P1] Guard",
    "public severity labels are not allowed",
  ],
];

describe("validate-output.py", () => {
  it("separates repository-relative Git paths from escaping paths in a finding anchor", () => {
    const paths = PATH_CLASSES.map(([label, path]) => [label, path]);
    const output = python(`
results = {}
for label, path in json.loads(${JSON.stringify(JSON.stringify(paths))}):
    author["findings"][0]["anchor"]["path"] = path
    results[label] = validate("author", ("AUTHOR: PASS\\n" + json.dumps(author)).encode())
print(json.dumps(results))
`);
    expect(JSON.parse(output)).toEqual(
      Object.fromEntries(
        PATH_CLASSES.map(([label, , rejected]) => [
          label,
          rejected
            ? [`author: line 2: findings[0].anchor.path: ${PATH_DIAGNOSTIC}`]
            : [],
        ]),
      ),
    );
  });

  it("rejects an escaping path in every repository path field", () => {
    const assignments = PATH_FIELDS.map(
      ([mode, target]) => String.raw`
data = payload(${JSON.stringify(mode)})
${target} = "../file.py"
errors += validate(${JSON.stringify(mode)}, (${JSON.stringify(mode.toUpperCase())} + ": PASS\n" + json.dumps(data)).encode())`,
    ).join("");
    const output = python(String.raw`
def payload(mode):
    name = "chunk-correctness" if mode == "chunk" else mode
    data = json.loads((run / (name + ".txt")).read_text().split("\n", 1)[1])
    if mode == "chunk":
        data["gaps"] = [dict(path="missing.py", kind="omitted", detail="Not inspected")]
    return data
errors = []${assignments}
print(json.dumps([error for error in errors if error.endswith("${PATH_DIAGNOSTIC}")]))
`);
    expect(JSON.parse(output)).toEqual(
      PATH_FIELDS.map(
        ([mode, , field]) => `${mode}: line 2: ${field}: ${PATH_DIAGNOSTIC}`,
      ),
    );
  });

  it.each(UNSUITABLE_PROSE)("rejects %s", (_label, field, text, diagnostic) => {
    expect(
      python(`
author["findings"][0][${JSON.stringify(field)}] = ${JSON.stringify(text)}
print("\\n".join(validate("author", ("AUTHOR: PASS\\n" + json.dumps(author)).encode())))
`),
    ).toContain(`author: line 2: findings[0].${field}: ${diagnostic}`);
  });

  it("accepts conforming payloads, a verify FAIL and each failure status", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
cases = [(mode + " good", mode, payload(mode, data), "") for mode, data in good.items()]
cases.append(("FAIL", "verify", payload("verify", dict(issues=["Fix"], observed_checks=[]), "FAIL"), ""))
cases += [(mode + status, mode, payload(mode, dict(reason="R", next_step="N"), status), "")
          for mode, status in zip(MODES, FAILURES)]
report(cases)
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
  });

  it("reports the expected diagnostic for every schema mutation", () => {
    const output = python(String.raw`${VALIDATOR_CASES}${VALIDATOR_MUTATIONS}
assert mutations, "no schema mutations"
cases = []
for mode, mutate, expected in mutations:
    data = copy.deepcopy(good[mode])
    mutate(data)
    cases.append((mode + expected, mode, payload(mode, data), expected))
cases.append(("findings None", "author", payload("author", dict(good["author"], findings=None)),
              "findings: expected array"))
report(cases)
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
  });

  it("rejects malformed envelopes and JSON with a located diagnostic", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
report([(expected, "verify", raw, expected) for raw, expected in [
    (b'WRONG: PASS\n{"issues":[],"observed_checks":[]}', "line 1: envelope"),
    (b'VERIFY: MAYBE\n{"issues":[],"observed_checks":[]}', "line 1: envelope"),
    (b'VERIFY: PASS\n{"issues":[],"issues":[],"observed_checks":[]}', "issues: duplicate key"),
    (b'VERIFY: FAIL\n{"issues":[],"observed_checks":[]}', "issues: must be empty on PASS"),
    (b'VERIFY: ERROR\n{"reason":"","next_step":"Ask"}', "reason: expected non-empty string"),
    (b'VERIFY: PASS\n{"issues":[],"observed_checks":[]} trailing', "line 2: $: Extra data"),
    (b'VERIFY: PASS\n\xff', "line 2: $: invalid UTF-8"),
    (b'VERIFY: PASS\n{"issues":NaN,"observed_checks":[]}', "invalid JSON constant NaN"),
    (b'VERIFY: PASS\n[]', "line 2: $: expected object")]])
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
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

// render-review.py helpers; data is any byte string for the write-path rows.
const RENDER_SETUP = String.raw`
from unittest.mock import patch
render, write_file, digest = render["render"], render["write_file"], render["digest"]
def refused(action, message=""):
    try:
        action()
    except (ValueError, OSError) as error:
        assert message in str(error), error
        return
    raise AssertionError("expected refusal")
data = b"review\n"
output = run / "review.md"
`;
const RECEIPTS = String.raw`
receipts = dict(review=dict(id=9, url="https://github.com/cli/cli/pull/1#pullrequestreview-9"),
                replies=[], failed=[], complete=True)
`;
const INCOMPLETE_WARNING = String.raw`
warning = (b"Posting is incomplete. An action without a receipt may still have taken effect on GitHub. "
           b"Check the PR before any manual follow-up; never re-run the poster.")
`;

function rendered(source: string): string {
  return python(`${RENDER_SETUP}${source}\nprint("verified")\n`).trim();
}

const RENDER_CONTRACT: ReadonlyArray<readonly [string, string]> = [
  [
    "renders the author package verbatim",
    String.raw`
chunk = json.loads((run / "chunk-correctness.txt").read_text().split("\n", 1)[1])
chunk["residual_risks"] = ["Raw risk"]
put("chunk-correctness", chunk)
author.update(decision="APPROVE", residual_risks=["Corrected risk"])
put("author", author)
report = render(run)
assert body.encode() in report and b"Anchor: file.py:1-2 RIGHT" in report
assert b"## Review decision\n\nAPPROVE\n" in report
assert report.split(b"## Residual risks\n\n")[1].split(b"\n\n## Verification notes")[0] == b"Corrected risk"
assert b"Raw risk" not in report
assert report.rsplit(b"## Posting\n", 1)[1] == b"\nNot posted.\n"
`,
  ],
  [
    "creates the output exclusively, then replaces it only at the matching digest",
    String.raw`
sha = write_file(run, output, data)
assert sha == digest(data) and output.read_bytes() == data
assert write_file(run, output, data + b"updated", sha) == digest(data + b"updated")
assert output.read_bytes() == data + b"updated" and not (run / "render.tmp").exists()
`,
  ],
  [
    "refuses replacement over a stale render.tmp and preserves it",
    String.raw`
sha = write_file(run, output, data)
temporary = run / "render.tmp"
temporary.write_bytes(b"keep")
refused(lambda: write_file(run, output, data + b"updated", sha), "File exists")
assert temporary.read_bytes() == b"keep" and output.read_bytes() == data
`,
  ],
  [
    "removes render.tmp and keeps the output when os.replace fails",
    String.raw`
sha = write_file(run, output, data)
with patch("os.replace", side_effect=OSError("cross-device replacement refused")):
    refused(lambda: write_file(run, output, data + b"updated", sha), "cross-device")
assert not (run / "render.tmp").exists() and output.read_bytes() == data
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
    "warns that posting is incomplete when complete is false",
    String.raw`${RECEIPTS}${INCOMPLETE_WARNING}
receipts["complete"] = False
(run / "receipts.json").write_text(json.dumps(receipts))
posting = render(run).rsplit(b"## Posting\n", 1)[1]
assert warning in posting.splitlines() and b"pullrequestreview-9" in posting
`,
  ],
  [
    "warns that posting is incomplete when complete is missing",
    String.raw`${RECEIPTS}${INCOMPLETE_WARNING}
del receipts["complete"]
(run / "receipts.json").write_text(json.dumps(receipts))
posting = render(run).rsplit(b"## Posting\n", 1)[1]
assert warning in posting.splitlines() and b"pullrequestreview-9" in posting
`,
  ],
  [
    "refuses to render without a chunk file",
    String.raw`
(run / "chunk-correctness.txt").unlink()
refused(lambda: render(run), "chunk-correctness.txt")
`,
  ],
  [
    "refuses to render a failed verification",
    String.raw`
(run / "verify.txt").write_text('VERIFY: FAIL\n{"issues":["Not verified"],"observed_checks":[]}')
refused(lambda: render(run), "verify.txt: expected VERIFY: PASS")
`,
  ],
  [
    "refuses to render when an unresolved thread is unassessed",
    String.raw`
author.update(decision="COMMENT", findings=[], thread_assessments=[])
put("author", author)
refused(lambda: render(run), "thread_assessments must cover exactly")
`,
  ],
];

const WRITE_REFUSALS: ReadonlyArray<readonly [string, string]> = [
  ["an existing output", "output, None"],
  ["a symlink in place of the output being replaced", "link, sha"],
  ["a path through a symlinked directory", 'linked_dir / "new.md", None'],
  ["a wrong digest", 'output, "0" * 64'],
  ["an absolute path", 'Path.cwd() / "absolute.md", None'],
  ["a .. path", 'Path("../new.md"), None'],
];

const ANCHOR_PINS: ReadonlyArray<readonly [string, string]> = [
  ["RIGHT", "b".repeat(SHA_LENGTH)],
  ["LEFT", "a".repeat(SHA_LENGTH)],
];

describe("render-review.py", () => {
  it.each(RENDER_CONTRACT)("%s", (_name, source) => {
    expect(rendered(source)).toBe("verified");
  });

  it.each(WRITE_REFUSALS)("refuses to write %s", (_label, target) => {
    expect(
      rendered(String.raw`
sha = write_file(run, output, data)
link = run / "link.md"
link.symlink_to(output)
linked_dir = run / "linked-dir"
linked_dir.symlink_to(Path.cwd(), target_is_directory=True)
target, expected = ${target}
refused(lambda: write_file(run, target, b"no", expected))
assert output.read_bytes() == data
`),
    ).toBe("verified");
  });

  it.each(ANCHOR_PINS)(
    "links a %s anchor at its side's pinned SHA with an encoded path",
    (side, pin) => {
      const output = python(`
author["findings"][0]["anchor"].update(path="dir with spaces/a#b.py", side=${JSON.stringify(side)})
put("author", author)
print(render["render"](run).decode())
`);
      expect(output).toContain(
        `https://github.com/cli/cli/blob/${pin}/dir%20with%20spaces/a%23b.py#L1-L2`,
      );
    },
  );

  it("renders an empty package with the not-proof disclaimer, drops and collection-time CI", () => {
    const output = python(`
author.update(decision="COMMENT", findings=[], dropped=[dict(candidate="tests-1", reason="No changed-code causality")], residual_risks=["Binary coverage unavailable"])
put("author", author)
print(render["render"](run).decode())
`);
    expect(output).toContain(
      "No findings in the inspected scope. This is not proof of correctness.",
    );
    expect(output).toContain("tests-1: No changed-code causality");
    expect(output).toContain(
      "CI as observed at collection:\n\nNot run; collected at fixture time",
    );
  });

  it("runs from a skill directory containing spaces and prints the output digest", () => {
    expect(
      python(`
import shutil
package = pathlib.Path("package with spaces")
shutil.copytree(scripts, package)
printed = subprocess.check_output([sys.executable, "-I", str(package / "render-review.py"), ".", "review.md"], text=True)
assert printed == "sha256: " + hashlib.sha256(pathlib.Path("review.md").read_bytes()).hexdigest() + "\\n", printed
print("verified")
`).trim(),
    ).toBe("verified");
  });
});
