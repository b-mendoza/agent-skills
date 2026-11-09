import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../skills/pr-creator/", import.meta.url);
const SCRIPT = fileURLToPath(new URL("scripts/validate-output.py", ROOT));
const VALID = 0;
const INVALID = 1;
const FIRST = 0;
const SPECIALISTS = [
  "repo-state-inspector",
  "preflight-validator",
  "diff-analyzer",
  "pr-drafter",
  "review-metadata-suggester",
  "pr-submitter",
] as const;

function sample(specialist: string): string {
  const contract = readFileSync(
    new URL(`references/${specialist}-contract.md`, ROOT),
    "utf8",
  );
  const block = /```text\n(?<body>[\s\S]*?)\n```/.exec(contract)?.groups?.[
    "body"
  ];
  if (block === undefined) throw new Error("missing contract block");
  const values: Record<string, string> = {
    "Execution mode support": "inline-compatible",
    "PR state": "draft",
    Topology: "ambiguous",
    Platform: "github",
    "Platform adapter needed": "no",
    "Head remote state": "unknown",
    "Push attempted": "no",
    "Push rejection reason": "n/a",
    "Approval record": "missing",
    "Pinned SHA match": "no",
    "Adjusted changed lines": "0",
    "Changed files": "0",
    "Scope approval": "n/a",
    "Scope gate rule fired": "none",
    "Reviewer source": "none",
    "Solo repository condition": "unknown",
    "Label source": "none",
    "Title source": "generated",
    "Body source": "generated",
    "Create attempted": "no",
    "Create retry used": "no",
    Verification: "not-run",
  };
  return block
    .split("\n")
    .map((line, index) => {
      const field = line.split(":")[FIRST] ?? "";
      if (index === FIRST) return `${field}: ERROR`;
      return sampleLine(line, field, values);
    })
    .join("\n");
}
function sampleLine(
  line: string,
  field: string,
  values: Record<string, string>,
): string {
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
  it.each(SPECIALISTS)(
    "accepts complete %s contract and rejects bad status/missing fields",
    (specialist) => {
      const input = sample(specialist);
      expect(validate(specialist, input).status).toBe(VALID);
      expect(
        validate(specialist, input.replace(": ERROR", ": INVENTED")).status,
      ).toBe(INVALID);
      expect(
        validate(specialist, input.replace(/^Reason:.*\n/m, "")).status,
      ).toBe(INVALID);
      expect(validate(specialist, `${input}\nReason: duplicate`).status).toBe(
        INVALID,
      );
    },
  );
  it("allows literal field-like lines inside the exact draft body", () => {
    const input = sample("pr-drafter").replace(
      "Body: n/a",
      "Body:\nTitle: an actual body line\nReason: an actual body line\nBody: another body line",
    );
    expect(validate("pr-drafter", input).status).toBe(VALID);
  });
  it("rejects unknown topology instead of routing on it", () => {
    const input = sample("repo-state-inspector").replace(
      "Topology: ambiguous",
      "Topology: telepathic",
    );
    expect(validate("repo-state-inspector", input).status).toBe(INVALID);
  });
  it("rejects status repetition in a payload", () => {
    expect(
      validate(
        "repo-state-inspector",
        `${sample("repo-state-inspector")}\nREPO_STATE: PASS`,
      ).status,
    ).toBe(INVALID);
  });
  it("rejects false verified-success and accepts explicit confirmed drift", () => {
    const input = sample("pr-submitter").replace(
      "PR_SUBMIT: ERROR",
      "PR_SUBMIT: PASS",
    );
    expect(validate("pr-submitter", input).status).toBe(INVALID);
    const drift = input
      .replace("PR_SUBMIT: PASS", "PR_SUBMIT: CREATED_WITH_DRIFT")
      .replace("URL: n/a", "URL: https://github.com/eval-org/cart/pull/17")
      .replace("Mismatched fields: n/a", "Mismatched fields: body, labels")
      .replace("Verification: not-run", "Verification: fail");
    expect(validate("pr-submitter", drift).status).toBe(VALID);
  });
});
