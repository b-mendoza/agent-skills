import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL(
    "../../../skills/pr-creator/scripts/validate-output.py",
    import.meta.url,
  ),
);
const SHA_LENGTH = 40;
const VALID = 0;
const INVALID = 1;
const USAGE_ERROR = 2;
const head = "a".repeat(SHA_LENGTH);
const base = "b".repeat(SHA_LENGTH);
const preview = {
  baseRemote: "origin",
  targetBranch: "main",
  headRemote: "origin",
  currentBranch: "feature/cart",
  baseSha: base,
  headSha: head,
  title: "feat: café",
  body: "## Résumé\n\n雪\n",
  reviewers: ["bob", "alice"],
  labels: ["enhancement"],
  assignees: ["maintainer"],
  state: "draft",
  effectiveState: "draft",
};
const scope = {
  baseSha: base,
  headSha: head,
  adjustedChangedLines: 1001,
  changedFiles: 1,
  excludedTotals: "none",
  areas: ["src"],
  rules: ["adjusted-lines>1000"],
  changedPaths: ["src/cart.py"],
};
function run(mode: string, kind: string, input: unknown) {
  return spawnSync("python3", ["-I", script, mode, kind], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}
function digest(
  kind: string,
  values: unknown,
): { valuesDigest: string; bodyDigest: string } {
  const result = run("digest", kind, values);
  expect(result.status).toBe(VALID);
  return Schema.decodeUnknownSync(
    Schema.Struct({ valuesDigest: Schema.String, bodyDigest: Schema.String }),
  )(JSON.parse(result.stdout));
}
function approval(kind: string, values: unknown) {
  return {
    ...digest(kind, values),
    wording: "APPROVED",
    action: `approve ${kind}`,
  };
}

describe("pr-creator shipped approval validator", () => {
  it("hashes exact UTF-8 bytes and canonical ordered metadata", () => {
    const actual = digest("preview", preview);
    const canonical = { ...preview, reviewers: ["alice", "bob"] };
    const serialized = JSON.stringify(
      Object.fromEntries(
        Object.entries(canonical).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    expect(actual).toEqual({
      valuesDigest: createHash("sha256").update(serialized).digest("hex"),
      bodyDigest: createHash("sha256").update(preview.body).digest("hex"),
    });
    expect(
      digest("preview", { ...preview, reviewers: ["alice", "bob"] }),
    ).toEqual(actual);
  });
  it.each(["body", "assignees", "headSha", "baseSha"] as const)(
    "rejects stale preview %s",
    (field) => {
      const changed = {
        ...preview,
        [field]: field === "assignees" ? ["alice"] : `${preview[field]}x`,
      };
      expect(
        run("verify", "preview", {
          values: changed,
          approval: approval("preview", preview),
        }).status,
      ).toBe(INVALID);
    },
  );
  it("does not normalize meaningful newlines or Unicode", () => {
    const original = digest("preview", preview);
    for (const body of [
      preview.body.trimEnd(),
      preview.body.replaceAll("\n", "\r\n"),
      preview.body.normalize("NFD"),
    ]) {
      expect(digest("preview", { ...preview, body }).bodyDigest).not.toBe(
        original.bodyDigest,
      );
    }
  });
  it("accepts current scope but rejects stale SHA, changed evidence and booleans", () => {
    const approved = approval("scope", scope);
    expect(
      run("verify", "scope", { values: scope, approval: approved }).status,
    ).toBe(VALID);
    for (const values of [
      { ...scope, headSha: "c".repeat(SHA_LENGTH) },
      { ...scope, baseSha: "d".repeat(SHA_LENGTH) },
      { ...scope, adjustedChangedLines: 1002 },
      { ...scope, rules: ["changed-files>40"] },
    ]) {
      expect(
        run("verify", "scope", { values, approval: approved }).status,
      ).toBe(INVALID);
    }
    expect(
      run("verify", "scope", { values: scope, approval: true }).status,
    ).toBe(INVALID);
  });
  it("rejects missing fields, extra fields, duplicate sets and invalid states", () => {
    for (const values of [
      { ...preview, state: "published" },
      { ...preview, assignees: ["maintainer", "maintainer"] },
      { ...preview, surprise: true },
      { ...preview, body: null },
    ]) {
      expect(run("digest", "preview", values).status).toBe(INVALID);
    }
    expect(
      run("digest", "scope", { ...scope, headSha: undefined }).status,
    ).toBe(INVALID);
  });
  it("requires recorded human wording and action", () => {
    for (const record of [
      { ...approval("preview", preview), wording: "" },
      { ...approval("preview", preview), action: "" },
    ]) {
      expect(
        run("verify", "preview", { values: preview, approval: record }).status,
      ).toBe(INVALID);
    }
  });
  it("declares usage and rejects unsupported modes", () => {
    const help = spawnSync("python3", ["-I", script, "-h"], {
      encoding: "utf8",
    });
    expect(help.status).toBe(VALID);
    expect(help.stdout).toContain("Usage:");
    expect(run("unknown", "preview", preview).status).toBe(USAGE_ERROR);
  });
});
