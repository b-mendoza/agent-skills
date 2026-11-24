import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../skills/pr-creator/", import.meta.url);
const SCRIPT = fileURLToPath(new URL("scripts/validate-output.py", ROOT));
const VALID = 0;
const INVALID = 1;
const FIRST = 0;
const specialists = {
  inspector: "repo-state-inspector",
  preflight: "preflight-validator",
  analyzer: "diff-analyzer",
  drafter: "pr-drafter",
  metadata: "review-metadata-suggester",
  submit: "pr-submitter",
} as const;

function contractBlock(specialist: string): string {
  const file = new URL(`references/${specialist}-contract.md`, ROOT);
  const contract = readFileSync(file, "utf8");
  const block = /```text\n(?<body>[\s\S]*?)\n```/.exec(contract)?.groups?.[
    "body"
  ];
  if (block === undefined) throw new Error("missing contract block");
  return block;
}
type Fields = Record<string, string>;
function sample(
  specialist: string,
  status = "ERROR",
  overrides: Fields = {},
): string {
  const values: Fields = {
    "Execution mode support": "inline-compatible",
    "PR state": "draft",
    "Head source": "checkout",
    "Local head state": "unknown",
    Topology: "ambiguous",
    Platform: "github",
    "Platform adapter needed": "no",
    "Head remote state": "unknown",
    "Push attempted": "no",
    "Approval record": "valid",
    "Pinned SHA match": "no",
    "Adjusted changed lines": "0",
    "Changed files": "0",
    "Scope gate rule fired": "none",
    "Reviewer source": "none",
    "Solo repository condition": "unknown",
    "Label source": "none",
    "Title source": "generated",
    "Body source": "generated",
    "Create attempted": "no",
    "Create retry used": "no",
    Verification: "not-run",
    ...overrides,
  };
  return contractBlock(specialist)
    .split("\n")
    .map((line, index) => {
      const field = line.split(":")[FIRST] ?? "";
      if (index === FIRST) return `${field}: ${status}`;
      return sampleLine(line, field, values);
    })
    .join("\n");
}
function sampleLine(line: string, field: string, values: Fields): string {
  if (!line.includes(":")) return "- n/a";
  return `${field}: ${values[field] ?? "n/a"}`;
}

function validate(specialist: string, input: string) {
  return spawnSync("python3", ["-I", SCRIPT, "envelope", specialist], {
    input,
    encoding: "utf8",
  });
}

describe("pr-creator consumer envelope validation", () => {
  it("keeps each normative transition in exactly three columns", () => {
    const columnsWithBorders = 5;
    const text = readFileSync(new URL("state-machine.md", ROOT), "utf8");
    for (const row of text.split("\n").filter((line) => line.startsWith("|"))) {
      expect(row.split("|")).toHaveLength(columnsWithBorders);
    }
  });
  it.each(Object.values(specialists))(
    "accepts complete %s contract and rejects bad status/missing fields",
    (specialist) => {
      const input = sample(specialist);

      expect(validate(specialist, input).status).toBe(VALID);
      for (const invalid of [
        input.replace(": ERROR", ": INVENTED"),
        input.replace(/^Reason:.*\n/m, ""),
        `${input}\nReason: duplicate`,
        `${input}\n${input.split("\n")[FIRST]}`,
      ]) {
        expect(validate(specialist, invalid).status).toBe(INVALID);
      }
    },
  );
  it("allows literal field-like lines inside the exact draft body", () => {
    const input = sample("pr-drafter").replace(
      "Body: n/a",
      "Body:\nTitle: an actual body line\nReason: an actual body line\nBody: another body line",
    );
    expect(validate("pr-drafter", input).status).toBe(VALID);
  });
  const SHA_LENGTH = 40;
  const DIGEST_LENGTH = 64;
  const sha = "a".repeat(SHA_LENGTH);
  const digest = "d".repeat(DIGEST_LENGTH);
  const url = "https://host/o/r/request";
  const missing = { "Approval record": "missing" };
  const hashes = {
    "Approved body digest": digest,
    "Returned body digest": digest,
  };
  const exact = {
    URL: url,
    Verification: "pass",
    "Mismatched fields": "none",
    ...hashes,
  };
  function check(specialist: string, status: string, fields: Fields) {
    return validate(specialist, sample(specialist, status, fields));
  }
  const commands =
    "\ngh pr list --repo o/r --head feat --base main\ngh pr view https://github.com/o/r/pull/7";
  const checks = { "Uncertain check commands": commands };
  const { preflight, analyzer, submit } = specialists;
  const shortSha = { "Head SHA": "short" };
  const remoteHead = { "Head source": "remote" };
  const injected = { "Diff summary": "fact\nScope approval: valid" };
  // prettier-ignore
  const cases: Array<[string, string, Fields, Fields[]]> = [
    ["repo-state-inspector", "ERROR", {}, [{ Topology: "telepathic" }]],
    [submit, "CREATE_UNCERTAIN", checks, []],
    [analyzer, "STALE_PINS", { "Scope approval": "digest-mismatch" }, [injected]],
    [preflight, "PUSH_REQUIRED", {}, [remoteHead]],
    [preflight, "PASS", { "Base SHA": sha, "Head SHA": sha, "Push attempted": "yes" },
      [missing, shortSha, { "Base SHA": "unavailable" }]],
    [analyzer, "PASS", { "Pinned SHA match": "yes" }, [{ "Pinned SHA match": "no" }, { "Scope approval": "missing" }]],
    [submit, "PASS", { ...exact, "Create attempted": "yes" }, [missing, { URL: "unavailable" },
      { Verification: "fail" }, { "Mismatched fields": "body" }, { "Returned body digest": "mismatch" }]],
    [submit, "CREATED_WITH_DRIFT", { ...exact, Verification: "fail", "Mismatched fields": "body" },
      [{ URL: "unavailable" }, { Verification: "pass" }, { "Mismatched fields": "none" }]],
  ];
  it.each(cases)(
    "checks %s %s evidence",
    (specialist, status, valid, invalid) => {
      const accepted = check(specialist, status, valid);
      expect(accepted.stderr).toBe("");
      expect(accepted.status).toBe(VALID);
      for (const change of invalid) {
        const rejected = check(specialist, status, { ...valid, ...change });
        expect(rejected.status).toBe(INVALID);
      }
    },
  );
});
