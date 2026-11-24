import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const path = "../../../skills/pr-creator/scripts/validate-output.py";
const script = fileURLToPath(new URL(path, import.meta.url));
const SHA_LENGTH = 40;
const MAX_TITLE_LENGTH = 255;
const VALID = 0;
const INVALID = 1;
const USAGE_ERROR = 2;
const head = "a".repeat(SHA_LENGTH);
const base = "b".repeat(SHA_LENGTH);
const branch = { headBranch: "feature/cart", headRemote: "origin" };
const pins = { baseSha: base, headSha: head };
const body = "## Résumé\n\n雪\n";
const title = "feat: café";
const metadata = {
  reviewers: ["bob", "alice"],
  labels: ["enhancement"],
  assignees: ["maintainer"],
};
const result = {
  title,
  body,
  ...metadata,
  state: "draft",
};
const preview = {
  ...branch,
  ...pins,
  ...result,
  baseRemote: "origin",
  targetBranch: "main",
  effectiveState: "draft",
};
const scopeObserved = {
  ...pins,
  adjustedChangedLines: 1001,
  excludedLines: 0,
  excludedPaths: [],
  changedPaths: ["src/cart.py", "README"],
};
const scope = {
  ...scopeObserved,
  rules: ["adjusted-lines>1000", "unrelated-areas>=3"],
};
function hash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
function run(mode: string, kind: string, input: unknown) {
  const args = ["-I", script, mode, ...(kind === "" ? [] : [kind])];
  return spawnSync("python3", args, {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}
function verify(
  kind: string,
  values: unknown,
  approval: unknown,
  observed?: unknown,
) {
  return run("verify", kind, { values, approval, observed });
}
function digest(kind: string, values: unknown) {
  const result = run("digest", kind, values);
  expect(result.status).toBe(VALID);
  return Schema.decodeUnknownSync(
    Schema.Struct({
      kind: Schema.String,
      valuesDigest: Schema.String,
      bodyDigest: Schema.String,
    }),
  )(JSON.parse(result.stdout));
}
function status(kind: string, values: unknown) {
  return run("digest", kind, values).status;
}
function approval(kind: string, values: unknown) {
  const proof = digest(kind, values);
  return { ...proof, wording: "approved", action: `approve ${kind}` };
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
      kind: "preview",
      valuesDigest: hash(serialized),
      bodyDigest: hash(preview.body),
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
        verify("preview", changed, approval("preview", preview)).status,
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
    const bound = {
      observed: scopeObserved,
      approval: approval("scope", scope),
    };
    expect(run("verify", "scope", { ...bound, values: scope }).status).toBe(
      VALID,
    );
    for (const values of [
      { ...scope, headSha: "c".repeat(SHA_LENGTH) },
      { ...scope, baseSha: "d".repeat(SHA_LENGTH) },
      { ...scope, adjustedChangedLines: 1002 },
      { ...scope, rules: ["changed-files>40"] },
    ]) {
      expect(run("verify", "scope", { ...bound, values }).status).toBe(INVALID);
    }
    expect(verify("scope", scope, true).status).toBe(INVALID);
  });
  it("rejects missing fields, extra fields, duplicate sets and invalid states", () => {
    for (const values of [
      { ...preview, state: "published" },
      { ...preview, assignees: ["maintainer", "maintainer"] },
      { ...preview, surprise: true },
      { ...preview, body: null },
    ]) {
      expect(status("preview", values)).toBe(INVALID);
    }
    expect(status("scope", { ...scope, headSha: undefined })).toBe(INVALID);
  });
  it("requires recorded human wording and action", () => {
    for (const record of [
      { ...approval("preview", preview), wording: "" },
      { ...approval("preview", preview), action: "" },
    ]) {
      expect(verify("preview", preview, record).status).toBe(INVALID);
    }
  });
  it("binds scope evidence but not a second judgment", () => {
    const values = {
      ...scope,
      adjustedChangedLines: 10,
      rules: ["unrelated-areas>=3"],
    };
    const record = approval("scope", values);
    const observed = { ...scopeObserved, adjustedChangedLines: 10 };
    expect(verify("scope", values, record, observed).status).toBe(VALID);
    expect(
      verify("scope", values, record, { ...observed, excludedLines: 1 }).stderr,
    ).toContain("excludedLines");
    expect(
      digest("scope", {
        ...scope,
        changedPaths: [...scope.changedPaths].reverse(),
      }),
    ).toEqual(digest("scope", scope));
    for (const key of ["changedFiles", "areas", "excludedTotals"]) {
      expect(status("scope", { ...scope, [key]: "legacy" })).toBe(INVALID);
    }
  });
  it("rejects records issued for another kind or presented as approval tokens", () => {
    const record = approval("preview", preview);
    expect(verify("preview", preview, record).status).toBe(VALID);
    for (const invalid of [
      { ...record, kind: "scope" },
      { ...record, kind: undefined },
      { ...record, wording: record.valuesDigest },
      { ...record, wording: `APPROVED ${record.valuesDigest}` },
    ]) {
      expect(verify("preview", preview, invalid).status).toBe(INVALID);
    }
  });
  const pushCommand = "git push origin feature/cart";
  const push = { ...branch, headSha: head, action: pushCommand };
  it("verifies a plain reply for the proposed push", () => {
    const action = pushCommand;
    const values = { ...push, extras: [] };
    const receipt = digest("push", values);
    expect(receipt.kind).toBe("push");
    expect(receipt.bodyDigest).toBe("n/a");
    expect(
      verify("push", values, { ...receipt, action, wording: "yes" }).status,
    ).toBe(VALID);
  });
  it("binds push settings in sorted order without credentials", () => {
    const extras = [
      "remote.origin.pushurl=https://host/r",
      "push.followTags=true",
    ];
    const proof = digest("push", { ...push, extras });
    expect(digest("push", { ...push, extras: [...extras].reverse() })).toEqual(
      proof,
    );
    expect(digest("push", { ...push, extras: [] })).not.toEqual(proof);
    for (const bad of [
      undefined,
      "none",
      [false],
      ["https://host/r refs/tags/v1"],
      [""],
      ["remote.origin.pushurl=https://u@host/r"],
      ["ssh://u:secret@host/r"],
    ]) {
      expect(status("push", { ...push, extras: bad })).toBe(INVALID);
    }
  });
  it.each([
    ["case=title", "feat: Wire up_api to the Panel", VALID],
    ["case=title", "feat: Wire the", INVALID],
    ["ticket=?@start", "feat: Fix", INVALID],
    ["ticket=T-1@start", "T-1 feat(ui)!: Fix", VALID],
    ["ticket=T-1@start", "[T-1] feat: Fix", INVALID],
    ["ticket=T-1@after-colon", "feat: T-1 Fix", VALID],
    ["ticket=T-1@after-colon", "feat:  T-1 Fix", INVALID],
    ["ticket=T-1@end", "feat: Fix (T-1)", VALID],
    ["ticket=T-1@end", "feat: T-1 Fix", INVALID],
    ["max=10", "feat: longer", INVALID],
    ["override", `${"x".repeat(MAX_TITLE_LENGTH)}!`, INVALID],
  ] as const)("checks %s against %s", (convention, title, status) => {
    expect(run("title", "", { convention, title }).status).toBe(status);
  });
  it("rejects a push approval naming a different command", () => {
    const values = { ...push, extras: [] };
    const record = { ...approval("push", values), action: "git push --force" };
    expect(verify("push", values, record).status).toBe(INVALID);
    expect(status("push", { ...values, action: "git push" })).toBe(INVALID);
  });
  it("requires fresh observations rather than verifying only the digest", () => {
    expect(verify("scope", scope, approval("scope", scope)).status).toBe(
      INVALID,
    );
  });
  it.each([
    [
      "type=feat; ticket=TASK-42@end; case=lower",
      "feat: TASK-42 simplify unit price",
    ],
    ["ticket=TASK-42@start", "[TASK-42] feat: simplify unit price"],
  ])("reports only the misplaced key for %s", (convention, title) => {
    expect(run("title", "", { convention, title }).stderr.trim()).toBe(
      "invalid: incorrect ticket placement",
    );
  });
  it("declares usage and rejects unsupported modes", () => {
    const help = run("-h", "", {});
    expect(help.status).toBe(VALID);
    expect(help.stdout).toContain("Kinds: push, scope, preview.");
    expect(run("unknown", "preview", preview).status).toBe(USAGE_ERROR);
  });
});
