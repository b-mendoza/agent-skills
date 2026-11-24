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
  rebaser: "branch-rebaser",
  update: "pr-updater",
  issue: "issue-updater",
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
const specialistDefaults: Record<string, Fields> = {
  "pr-updater": { "PR state": "open" },
  "branch-rebaser": { Action: "rebase" },
};
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
    "Issue mentions": "none",
    "Issue mentions omitted": "0",
    "Excluded generated/vendored/lock totals": "none",

    "Invalid labels": "none",
    "Invalid assignees": "none",
    "Auto-close": "none",
    URL: "unavailable",
    Action: "read",
    "Write attempted": "no",
    "Worktree removed": "yes",
    "Checkout unchanged": "yes",
    Topology: "ambiguous",
    Platform: "github",
    "Platform adapter needed": "no",
    "Head remote state": "unknown",
    "Push attempted": "no",
    "Push extras": "none",
    "Offer source": "published",
    "Source SHA": "unavailable",
    "Source behind base": "unavailable",
    "Differing pairs": "none",
    "Local-only commits": "none",
    "Published-only commits": "none",
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
    ...specialistDefaults[specialist],
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
  const FIRST_ISSUE = 1;
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
  const rebase = { "Base SHA": sha, "Old head SHA": sha, "New head SHA": next };
  const hashes = {
    "Approved body digest": digest,
    "Returned body digest": digest,
  };
  const comment = {
    Index: "1",
    Action: "comment",
    "Comment URL": url,
    ...hashes,
  };
  const exact = {
    URL: url,
    Outcome: "exact",
    "Added fields": "none",
    "Mismatched fields": "none",
    ...hashes,
  };
  const mentions = Array.from(
    { length: 20 },
    (_, i) => `o/r#${i + FIRST_ISSUE} (branch)`,
  ).join(", ");
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
  const {
    preflight,
    resolver,
    analyzer,
    metadata,
    update,
    issue,
    submit,
    rebaser,
  } = specialists;
  const badLabel = { "Invalid labels": "missing" };
  const badAssignee = { "Invalid assignees": "bob" };
  const shortSha = { "Head SHA": "short" };
  const remoteHead = { "Head source": "remote" };
  const source = { "Source SHA": sha, "Source behind base": "0" };
  const existing = { ...source, "Existing PR": url };
  const noPr = { "Existing PR": "none" };
  const injected = { "Diff summary": "fact\nScope approval: valid" };
  const unclassified = { Candidates: "o/r#1" };
  const invalidIssue = { Invalid: "o/r#1" };
  const resolved = { Candidates: "none", Invalid: "none" };
  const unavailable = [
    { "Source SHA": "unavailable" },
    { "Source behind base": "unavailable" },
  ];
  const pair = `- ${sha} ! ${next} "subject"`;
  const commit = `- ${sha} "subject"`;
  const rows = (row: string, length: number) =>
    Array.from({ length }, () => row).join("\n");
  const local = {
    "Head remote state": "diverged",
    "Offer source": "local",
    "Differing pairs": pair,
    "Local-only commits": commit,
  };
  const none = {
    ...local,
    "Offer source": "none",
    "Published-only commits": commit,
    Reason: "A published commit has no local counterpart.",
  };
  const extras = {
    "Push extras": "push.followTags=true; push.pushOption=notify",
  };
  const badExtras = [
    { "Push extras": "push.followTags=true; ; x" },
    { "Push extras": "https://host/r refs/tags/v1" },
    { "Push extras": "remote.r.pushurl=ssh://user@host" },
  ];
  const settle = { "Approval record": "n/a", "Backup ref": "n/a" };
  const kept = {
    ...settle,
    Action: "keep",
    "Local branch": "moved",
    "Kept ref": "refs/heads/feature/cart",
    "Uncommitted changes preserved": "yes",
  };
  const aside = {
    ...kept,
    "Local branch": "unchanged",
    "Kept ref": "refs/pr-creator/run/rebased",
  };
  const branchRef = { "Kept ref": "refs/heads/feature/cart" };
  const badSettle = [
    { "Approval record": "valid" },
    { "Backup ref": "refs/pr-creator/backup/run" },
  ];
  const listFields = [
    "Differing pairs",
    "Local-only commits",
    "Published-only commits",
  ];
  const listLimit = 20;
  const oversizedList = 21;
  // prettier-ignore
  const cases: Array<[string, string, Fields, Fields[]]> = [
    [preflight, "ERROR", { ...local, ...extras }, [{ "Head remote state": "unknown" },
      { "Published-only commits": commit }, { "Differing pairs": commit }, { "Local-only commits": pair },
      { "Offer source": "other" }, { "Source SHA": "short" }, { "Source behind base": "-1" },
      ...badExtras]],
    [preflight, "ERROR", none, [{ "Published-only commits": pair }]],
    [preflight, "PR_EXISTS", { ...existing, "Head remote state": "up-to-date", "Offer source": "none", Reason: "Mirror remote" },
      [{ Reason: "n/a" }, { Reason: "none" }]],
    [preflight, "ERROR", {}, [{ "Differing pairs": pair }, { "Local-only commits": commit },
      { "Published-only commits": commit }]],
    ...listFields.map((field): [string, string, Fields, Fields[]] => {
      const row = field === "Differing pairs" ? pair : commit;
      return [preflight, "ERROR", { ...none, [field]: rows(row, listLimit) }, [{ [field]: rows(row, oversizedList) }]];
    }),
    [rebaser, "KEPT", { ...kept, ...extras }, [...badSettle, ...badExtras, { Action: "discard" },
      { "Local branch": "n/a" }, { "Kept ref": "refs/heads/../x" }, { "Kept ref": aside["Kept ref"] },
      { "Uncommitted changes preserved": "no" }]],
    [rebaser, "KEPT", { ...kept, "Local branch": "created", "Uncommitted changes preserved": "n/a" },
      [{ "Uncommitted changes preserved": "unknown" }]],
    [rebaser, "KEPT", aside, [branchRef, { "Kept ref": "refs/pr-creator/run/other" },
      { "Local branch": "invalid" }]],
    [rebaser, "DISCARDED", { ...settle, Action: "discard", "Local branch": "unchanged" },
      [...badSettle, branchRef, { Action: "keep" }, { "Checkout unchanged": "no" },
      { "Local branch": "moved" }]],
    [issue, "ERROR", { Action: "close", Index: "1" }, [{ Index: "0" }, { Index: "n/a" }]],
    [issue, "ERROR", { Action: "comment", Index: "2" }, [{ Index: "-1" }, { Index: "n/a" }]],
    [issue, "ERROR", { Action: "read" }, [{ Index: "1" }]],
    ["repo-state-inspector", "ERROR", {}, [{ Topology: "telepathic" }]],
    [submit, "CREATE_UNCERTAIN", checks, []],
    [preflight, "ERROR", unavailableRepo, []],
    [preflight, "AUTH", unavailableRepo, []],
    [analyzer, "STALE_PINS", stale, [injected]],
    [preflight, "PUSH_REQUIRED", { "Head SHA": sha }, [remoteHead, shortSha]],
    [resolver, "PASS", resolved, [unclassified, invalidIssue]],
    [resolver, "INVALID_ISSUES", invalidIssue, [{ Invalid: "none" }]],
    [preflight, "PR_EXISTS", existing, [noPr, unavailableRepo, ...unavailable]],
    [preflight, "PASS", { ...source, "Base SHA": sha, "Head SHA": next, "Existing PR": "none", "Head behind base": "0", "Head ahead of base": "3", "Unsupported fields": "labels, closes, assignees", "Push attempted": "yes" },
      [missing, ...unavailable, unavailableRepo, shortSha, { "Base SHA": "unavailable" },
      existing, { "Head behind base": "one" }, { "Head ahead of base": "-1" },
      { "Unsupported fields": "reviewers" }]],
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
    [analyzer, "ERROR", { "Issue mentions": "#8 (commit abcdef1), org/lib#4 (branch)" },
      [{ "Issue mentions": "#8 (commit xyz)" }, { "Issue mentions": "#8 (branch), #8 (commit abcdef1)" },
      { "Issue mentions omitted": "1" }, { "Issue mentions omitted": "-1" }]],
    [analyzer, "ERROR", { "Issue mentions": mentions, "Issue mentions omitted": "4" },
      [{ "Issue mentions": `${mentions}, #99 (branch)` }]],
    ["pr-drafter", "NEEDS_CHOICE", { "Body source": "edited", "Decision needed": "provide ticket key" },
      [{ "Body source": "invented" }]],
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
    [rebaser, "PUSH_REJECTED", { Action: "push" }, [missing, { Action: "keep" }]],
    [rebaser, "LEASE_REJECTED", { Action: "push" }, [missing, { Action: "discard" }]],
    [rebaser, "REBASED", rebase, [missing, { Action: "push" }, { "Base SHA": "short" },
      { "New head SHA": sha }, { "Worktree removed": "no" }, { "Checkout unchanged": "no" }]],
    [rebaser, "CONFLICT", { "Conflict paths": "src/a" }, [{ "Conflict paths": "none" },
      { "Worktree removed": "no" }, { "Checkout unchanged": "no" }]],
    [rebaser, "PUSHED", { Action: "push", "New head SHA": next, "Remote head after": next, "Backup ref": "refs/pr-creator/backup/run" },
      [{ Action: "rebase" }, { "Remote head after": sha }, { "Backup ref": "refs/heads/run" }]],
    [update, "BASELINE", {}, [{ Action: "apply" }, { "PR state": "closed" }]],
    [update, "PR_CHANGED", { Action: "apply", "Applied fields": "none" },
      [missing, { "Applied fields": "body" }]],
    [issue, "PASS", { Index: "2", Action: "close", "State after": "closed", "State reason after": "not planned", "Write attempted": "yes" },
      [{ "State after": "open" }, { "State reason after": "completed" }, { "Write attempted": "no" }]],
    [issue, "PASS", { ...comment, "Write attempted": "yes" }, [missing, { "Comment URL": "n/a" },
      { "Returned body digest": "bad" }]],
    [issue, "PASS", { Action: "read" }, [{ "Write attempted": "yes" }]],
  ];
  it.each(["edited", "unchanged", "generated", "template", "override"])(
    "checks empty %s body",
    (source) => {
      const input = sample("pr-drafter", "PASS", {
        "Title source": "unchanged",
        "Body source": source,
      }).replace("Body: n/a\n- n/a", "Body:");
      expect(validate("pr-drafter", input).status).toBe(
        ["edited", "unchanged"].includes(source) ? VALID : INVALID,
      );
    },
  );
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
  it("accepts an already-posted identical comment without another write", () => {
    expect(check(issue, "PASS", comment).status).toBe(VALID);
  });
  it("requires numbered behavior facts", () => {
    const invalid = sample(analyzer).replace(
      "B1: observed fact",
      "unidentified fact",
    );
    expect(validate(analyzer, invalid).status).toBe(INVALID);
  });
});
