import { describe, expect, it } from "vitest";

import {
  python,
  VALIDATOR_CASES,
  VALIDATOR_MUTATIONS,
} from "#/cases/review-pull-request-fixtures.ts";

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

const PUBLIC_PROSE_FIELDS = {
  summary: ['data["summary"]', "summary"],
  title: ['data["findings"][0]["title"]', "findings[0].title"],
  "inline body": ['data["findings"][0]["body"]', "findings[0].body"],
  "reply body": ['data["findings"][1]["body"]', "findings[1].body"],
} as const;

const PUBLIC_LABELS: ReadonlyArray<
  readonly [string, keyof typeof PUBLIC_PROSE_FIELDS]
> = [
  ["**important:** Fix the guard.", "summary"],
  ["**nit:** Fix the guard.", "title"],
  ["**important**: Fix the guard.", "title"],
  ["_nit:_ Fix the guard.", "inline body"],
  ["critical: Fix the guard.", "summary"],
  ["blocked: Fix the guard.", "inline body"],
  ["minor: Fix the guard.", "reply body"],
  ["nit (non-blocking): Fix the guard.", "reply body"],
  ["[blocker] Fix the guard.", "title"],
  ["[major:] Fix the guard.", "summary"],
  ["__priority (high)__: Fix the guard.", "summary"],
  ["**nit** (non-blocking): Fix the guard.", "summary"],
  ["Severity: Fix the guard.", "summary"],
  ["[suggestion] Fix the guard.", "title"],
  ["- **P0:** Fix the guard.", "inline body"],
  ["The guard still fails.\n  1. [P2] Fix the guard.", "reply body"],
  ["## **[P3]** Fix the guard.", "inline body"],
  ["p1: Fix the guard.", "summary"],
  ["**Important: Fix the guard.**", "summary"],
  [
    "The log printed a bare `.\n- **Important: Fix the guard.** Use `safe`.",
    "summary",
  ],
  ["_nit (non-blocking): Fix the guard._", "inline body"],
  ["## **[P3] Fix the guard.**", "reply body"],
  [
    "Read `important: true` first.\n**Critical: Fix the guard.**",
    "inline body",
  ],
];

function publicProseErrors(
  field: keyof typeof PUBLIC_PROSE_FIELDS,
  text: string,
): string {
  const [target] = PUBLIC_PROSE_FIELDS[field];
  return python(String.raw`${VALIDATOR_CASES}
data = good["author"]
${target} = ${JSON.stringify(text)}
print("\n".join(validate("author", payload("author", data))), end="")
`);
}

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

  it.each(PUBLIC_LABELS)("rejects %j in the %s", (text, field) => {
    const [, path] = PUBLIC_PROSE_FIELDS[field];
    expect(publicProseErrors(field, text)).toBe(
      `author: line 2: ${path}: public severity labels are not allowed`,
    );
  });

  it("accepts a severity word inside a sentence", () => {
    expect(
      publicProseErrors(
        "summary",
        "The critical section is unlocked before the write.",
      ),
    ).toBe("");
  });

  it("accepts a severity label inside fenced code", () => {
    expect(
      publicProseErrors(
        "inline body",
        "The configuration uses this key:\n\n```yaml\nimportant: true\n```",
      ),
    ).toBe("");
  });

  it.each([
    "Use `footgun` for the test attribute.",
    "Use ``nice catch `great job` under the hood`` as the test input.",
    "`important: true` enables the check.",
    "`setting` important: true is a key-value pair in this example.",
    "The key is ``\nimportant: true\n`` in this example.",
  ])("accepts quoted inline code in %j", (text) => {
    expect(publicProseErrors("inline body", text)).toBe("");
  });

  it.each([
    "Use `guard`, not the one under the hood.",
    "Print \\`footgun` as plain text.",
  ])("rejects an idiom outside inline code: %j", (text) => {
    expect(publicProseErrors("reply body", text)).toBe(
      "author: line 2: findings[1].body: replace idiom or praise filler with literal language",
    );
  });

  it("counts inline code words toward the prose limit", () => {
    const code = "`two words`";
    const text =
      "word ".repeat(PROSE_WORD_LIMIT - code.split(" ").length) + code;
    expect(publicProseErrors("summary", text.replace("word ", ""))).toBe("");
    expect(publicProseErrors("summary", text)).toContain(
      `expected fewer than ${String(PROSE_WORD_LIMIT)} prose words`,
    );
  });

  it("accepts an internal severity value", () => {
    expect(
      python(String.raw`${VALIDATOR_CASES}
data = good["author"]
data["findings"][0]["severity"] = "important"
print("\n".join(validate("author", payload("author", data))), end="")
`),
    ).toBe("");
  });

  it("accepts conforming payloads, a verify FAIL and each failure status", () => {
    const output = python(String.raw`${VALIDATOR_CASES}
cases = [(mode + " good", mode, payload(mode, data), "") for mode, data in good.items()]
cases.append(("FAIL", "verify", payload("verify", dict(issues=["Fix"], observed_checks=["No checks were performed"]), "FAIL"), ""))
cases += [(mode + status, mode, payload(mode, dict(reason="R", next_step="N"), status), "")
          for mode, status in zip(MODES, FAILURES)]
report(cases)
`);
    expect(JSON.parse(output)).toMatchObject({ failed: [] });
  });

  it.each(["PASS", "FAIL"])(
    "requires at least one observed check on VERIFY: %s",
    (status) => {
      const output = python(String.raw`${VALIDATOR_CASES}
status = ${JSON.stringify(status)}
issues = ["Fix"] if status == "FAIL" else []
print("\n".join(validate("verify", payload("verify", dict(issues=issues, observed_checks=[]), status))))
`);
      expect(output.trim()).toBe(
        "verify: line 2: observed_checks: expected non-empty array",
      );
    },
  );

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
