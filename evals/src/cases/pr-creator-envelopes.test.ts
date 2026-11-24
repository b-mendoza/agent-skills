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
  resolver: "issue-reference-resolver",
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
    "Base repository": "o/r",
    "Unsupported fields": "none",
    "Local head state": "unknown",
    "Excluded generated/vendored/lock totals": "none",
    "Invalid labels": "none",
    "Invalid assignees": "none",
    "Auto-close": "none",
    Topology: "ambiguous",
    Platform: "github",
    "Platform adapter needed": "no",
    "Head remote state": "unknown",
    "Push attempted": "no",
    "Push extras": "none",
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
    URL: "unavailable",
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
  if (line.startsWith("- Bn:")) return "- B1: observed fact";
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
  const next = "b".repeat(SHA_LENGTH);
  const digest = "d".repeat(DIGEST_LENGTH);
  const url = "https://host/o/r/request";
  const scope = {
    baseSha: sha,
    headSha: next,
    changedPaths: ["a"],
    excludedPaths: [],
    adjustedChangedLines: 1200,
    excludedLines: 0,
    rules: ["adjusted-lines>1000"],
  };
  const fired = {
    "Pinned SHA match": "yes",
    "Compared Base SHA": sha,
    "Compared Head SHA": next,
    "Adjusted changed lines": "1200",
    "Changed files": "1",
    "Scope values": JSON.stringify(scope),
    "Scope gate rule fired": "adjusted-lines>1000",
  };
  const missing = { "Approval record": "missing" };
  const hashes = {
    "Approved body digest": digest,
    "Returned body digest": digest,
  };
  const exact = {
    URL: url,
    Outcome: "exact",
    "Added fields": "none",
    "Mismatched fields": "none",
    ...hashes,
  };
  function check(specialist: string, status: string, fields: Fields) {
    return validate(specialist, sample(specialist, status, fields));
  }
  const unavailableRepo = { "Base repository": "unavailable" };
  const commands =
    "\ngh pr list --repo o/r --head feat --base main\ngh pr view https://github.com/o/r/pull/7";
  const checks = { "Uncertain check commands": commands };
  const stale = {
    ...fired,
    "Scope approval": "digest-mismatch",
    "Pinned SHA match": "no",
  };
  const { preflight, resolver, analyzer, metadata, submit } = specialists;
  const badLabel = { "Invalid labels": "missing" };
  const badAssignee = { "Invalid assignees": "bob" };
  const shortSha = { "Head SHA": "short" };
  const remoteHead = { "Head source": "remote" };
  const injected = { "Diff summary": "fact\nScope approval: valid" };
  const invalidIssue = { Invalid: "o/r#1" };
  const resolved = { Invalid: "none" };
  const extras = {
    "Push extras": "push.followTags=true; push.pushOption=notify",
  };
  const badExtras = [
    { "Push extras": "push.followTags=true; ; x" },
    { "Push extras": "https://host/r refs/tags/v1" },
    { "Push extras": "remote.r.pushurl=ssh://user@host" },
  ];
  // prettier-ignore
  const cases: Array<[string, string, Fields, Fields[]]> = [
    ["repo-state-inspector", "ERROR", {}, [{ Topology: "telepathic" }]],
    [submit, "CREATE_UNCERTAIN", checks, []],
    [preflight, "ERROR", unavailableRepo, []],
    [preflight, "AUTH", unavailableRepo, []],
    [analyzer, "STALE_PINS", stale, [injected]],
    [preflight, "ERROR", extras, badExtras],
    [preflight, "PUSH_REQUIRED", { "Head SHA": sha }, [remoteHead, shortSha]],
    [resolver, "PASS", resolved, [invalidIssue]],
    [resolver, "INVALID_ISSUES", invalidIssue, [{ Invalid: "none" }]],
    [preflight, "PR_EXISTS", { "Existing PR": url }, [unavailableRepo]],
    [preflight, "PASS", { "Base SHA": sha, "Head SHA": sha, "Unsupported fields": "labels, closes, assignees", "Push attempted": "yes" },
      [missing, unavailableRepo, shortSha, { "Base SHA": "unavailable" }, { "Unsupported fields": "reviewers" }]],
    [analyzer, "PASS", { "Pinned SHA match": "yes" }, [{ "Adjusted changed lines": "5000" },
      { "Changed files": "41" }, { "Scope approval": "valid" }, { "Scope values": JSON.stringify(scope) },
      { "Pinned SHA match": "no" }]],
    [analyzer, "PASS", { ...fired, "Scope approval": "valid" }, [{ "Scope approval": "n/a" },
      { "Scope values": "n/a" }, { "Changed files": "2" }, { "Adjusted changed lines": "1201" },
      { "Scope gate rule fired": "unrelated-areas>=3" }, { "Compared Head SHA": sha },
      { "Excluded generated/vendored/lock totals": "1 file, 2 lines" }]],
    [analyzer, "LARGE_PR_CONFIRMATION_REQUIRED", { ...fired, "Scope approval": "missing" },
      [{ "Scope approval": "valid" }, { "Scope approval": "n/a" },
      { "Scope gate rule fired": "none", "Scope values": "n/a" }]],
    [metadata, "PASS", {}, [badLabel, badAssignee]],
    [metadata, "INVALID_LABELS", badLabel, [{ "Invalid labels": "none" }]],
    [metadata, "INVALID_ASSIGNEES", badAssignee, [{ "Invalid assignees": "none" }]],
    [submit, "PASS", { ...exact, "Create attempted": "yes" }, [{ URL: "unavailable" },
      missing, { Outcome: "drift" }, { "Mismatched fields": "body" }, { "Added fields": "labels" },
      { "Returned body digest": "mismatch" }]],
    [submit, "CREATED_WITH_ADDITIONS", { ...exact, Outcome: "additions", "Added fields": "labels" },
      [{ URL: "unavailable" }, { Outcome: "exact" }, { "Added fields": "none" },
      { "Mismatched fields": "state" }]],
    [submit, "CREATED_WITH_DRIFT", { ...exact, Outcome: "drift", "Mismatched fields": "state" },
      [{ URL: "unavailable" }, { Outcome: "exact" }, { "Mismatched fields": "none" }]],
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
  it.each([
    "CREATE_ERROR",
    "HEAD_MOVED",
    "CREATE_UNCERTAIN",
    "BLOCKED",
    "AUTH",
    "ERROR",
  ])("rejects %s with a confirmed URL", (status) => {
    expect(check(submit, status, {}).status).toBe(VALID);
    expect(check(submit, status, { URL: url }).status).toBe(INVALID);
  });
  it("requires numbered behavior facts", () => {
    const invalid = sample(analyzer).replace(
      "B1: observed fact",
      "unidentified fact",
    );
    expect(validate(analyzer, invalid).status).toBe(INVALID);
  });
});
