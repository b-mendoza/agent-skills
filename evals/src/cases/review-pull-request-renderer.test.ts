import { describe, expect, it } from "vitest";

import { python } from "#/cases/review-pull-request-fixtures.ts";

const SHA_LENGTH = 40;

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
assert report.rsplit(b"## Posting\n", 1)[1] == b"\nNot posted.\nSaved package: .\n"
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
    "saves a partial inline read-back only under Posting, without implying incomplete posting",
    String.raw`${RECEIPTS}
posting_heading = b"\n## Posting\n"
sha = write_file(run, output, render(run))
before, not_posted = output.read_bytes().rsplit(posting_heading, 1)
assert not_posted == b"\nNot posted.\nSaved package: .\n"
receipts.update(inline=[dict(finding="F1", id=101, url="https://github.com/cli/cli/pull/1#discussion_r101")],
                inline_error="1 of 2 not matched")
(run / "receipts.json").write_text(json.dumps(receipts))
write_file(run, output, render(run), sha)
after, posting = output.read_bytes().rsplit(posting_heading, 1)
assert before == after
assert b"[F1](<https://github.com/cli/cli/pull/1#discussion_r101>)" in posting, posting
assert b"Inline comment URLs unavailable: 1 of 2 not matched; open the review URL" in posting, posting
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
(run / "verify.txt").write_text('VERIFY: FAIL\n{"issues":["Not verified"],"observed_checks":["No checks were performed"]}')
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

  it.each([
    ["report.txt", "expected .md file"],
    [".git/report.md", ".git components refused"],
    ["nested/.Git/report.md", ".git components refused"],
  ])("refuses draft path %s on create and replacement", (target, reason) => {
    const results = python(String.raw`
path = Path(${JSON.stringify(target)})
path.parent.mkdir(parents=True, exist_ok=True)
command = [sys.executable, "-I", str(scripts / "render-review.py"), ".", str(path)]
create = subprocess.run(command, capture_output=True, text=True)
created = path.exists()
path.write_bytes(b"keep")
replace = subprocess.run([*command, "--replace", hashlib.sha256(b"keep").hexdigest()],
                         capture_output=True, text=True)
print(json.dumps(dict(create=create.returncode, created=created, create_error=create.stderr,
                      replace=replace.returncode, replace_error=replace.stderr,
                      contents=path.read_text(), staged=Path("render.tmp").exists())))
`);
    expect(JSON.parse(results)).toEqual({
      create: 1,
      created: false,
      create_error: `${target}: ${reason}\n`,
      replace: 1,
      replace_error: `${target}: ${reason}\n`,
      contents: "keep",
      staged: false,
    });
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
