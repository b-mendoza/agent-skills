import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  approval,
  digest,
  run,
  status,
  verify,
} from "#/cases/pr-creator-test-support.ts";

const SHA_LENGTH = 40;
const MAX_TITLE_LENGTH = 255;
const VALID = 0;
const INVALID = 1;
const USAGE_ERROR = 2;
const head = "a".repeat(SHA_LENGTH);
const base = "b".repeat(SHA_LENGTH);
const branch = { headBranch: "feature/cart", headRemote: "origin" };
const pins = { baseSha: base, headSha: head };
const repository = "o/r";
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
  closes: [],
  related: [],
  autoClose: "none",
  unsupported: [],
};
const preview = {
  ...branch,
  ...pins,
  ...result,
  repository,
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
const refs = { baseRef: "main", headRef: branch.headBranch, headSha: head };
const returned = {
  ...refs,
  title,
  body,
  state: "draft",
  ...metadata,
  closes: [],
};
const updateObserved = {
  repository,
  number: 12,
  ...refs,
  baselineTitle: "old title",
  baselineBodyDigest: hash(body),
  baselineState: "draft",
  baselineReviewers: metadata.reviewers,
  baselineLabels: metadata.labels,
  baselineAssignees: metadata.assignees,
};
const update = { ...updateObserved, ...result };
function hash(text: string) {
  return createHash("sha256").update(text).digest("hex");
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
      { ...record, kind: "update" },
      { ...record, wording: `APPROVED ${record.valuesDigest}` },
    ]) {
      expect(verify("preview", preview, invalid).status).toBe(INVALID);
    }
  });
  const pushCommand = "git push origin feature/cart";
  const plainPush = {
    ...branch,
    headSha: head,
    extras: [],
    action: pushCommand,
  };
  it("verifies a plain reply for the proposed push", () => {
    const receipt = digest("push", plainPush);
    expect(receipt.kind).toBe("push");
    expect(receipt.bodyDigest).toBe("n/a");
    const record = { ...receipt, action: pushCommand, wording: "yes" };
    expect(verify("push", plainPush, record).status).toBe(VALID);
  });
  const force = {
    ...branch,
    baseSha: base,
    oldHeadSha: head,
    newHeadSha: base,
    source: "rebase",
    extras: [],
    action: `git push --force-with-lease=refs/heads/feature/cart:${head} origin ${base}:refs/heads/feature/cart`,
  };
  // prettier-ignore
  it.each([
    ["push", { ...branch, headSha: head, extras: [], action: pushCommand }, { action: "git push" }],
    ["force-push", force, { action: "git push --force" }],
    ["rebase", { ...branch, baseRemote: "upstream", targetBranch: "main", baseSha: base, oldHeadSha: base, sourceSha: head }, { sourceSha: base }],
  ] as const)("binds the %s values", (kind, values, invalid) => {
    digest(kind, values);
    expect(status(kind, { ...values, ...invalid })).toBe(INVALID);
  });
  it("binds push settings in sorted order without credentials", () => {
    const extras = [
      "remote.origin.pushurl=https://host/r",
      "push.followTags=true",
    ];
    const push = { ...branch, headSha: head, action: pushCommand };
    for (const [kind, values] of [
      ["push", push],
      ["force-push", force],
    ] as const) {
      const proof = digest(kind, { ...values, extras });
      expect(
        digest(kind, { ...values, extras: [...extras].reverse() }),
      ).toEqual(proof);
      expect(digest(kind, { ...values, extras: [] })).not.toEqual(proof);
      for (const bad of [
        undefined,
        "none",
        [false],
        ["https://host/r refs/tags/v1"],
        [""],
        ["remote.origin.pushurl=https://u@host/r"],
        ["ssh://u:secret@host/r"],
      ]) {
        expect(status(kind, { ...values, extras: bad })).toBe(INVALID);
      }
    }
    digest("force-push", { ...force, source: "local-branch" });
    for (const change of [{ source: "other" }, { source: undefined }]) {
      expect(status("force-push", { ...force, ...change })).toBe(INVALID);
    }
  });
  const open = { number: 2, baselineState: "open" };
  const comment = { ...open, action: "comment", body: "雪\r\n" };
  const close = { ...open, action: "close", reason: "not planned" };
  const batch = {
    repository: "o/r",
    actions: [{ ...comment, number: 3, baselineState: "closed" }, close],
  };
  it("binds the ordered batch, not an observed snapshot or a list of digests in the record", () => {
    const proof = approval("issue-actions", batch);
    expect(JSON.parse(run("digest", "issue-actions", batch).stdout)).toEqual({
      kind: "issue-actions",
      valuesDigest: proof.valuesDigest,
      bodyDigest: "n/a",
      bodyDigests: [hash(comment.body), "n/a"],
    });
    const payload = { approval: proof, values: batch };
    expect(run("verify", "issue-actions", payload).status).toBe(VALID);
    for (const change of [
      { observed: {} },
      { values: { ...batch, actions: [...batch.actions].reverse() } },
      { approval: { ...proof, bodyDigests: [] } },
    ]) {
      expect(
        run("verify", "issue-actions", { ...payload, ...change }).status,
      ).toBe(INVALID);
    }
  });
  it("accepts one through ten ordered actions with exact issue baselines and bodies", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      ...comment,
      body: String(i),
    }));
    for (const actions of [
      [comment],
      ten,
      [{ ...comment, baselineState: "open", number: close.number }, close],
    ]) {
      digest("issue-actions", { ...batch, actions });
    }
    for (const actions of [
      [],
      [...ten, comment],
      [comment, comment],
      [close, close],
      [close, { ...comment, number: close.number }],
      [{ ...comment, body: "  " }],
      [{ ...comment, baselineState: "draft" }],
      [{ ...comment, body: undefined }],
      [{ ...comment, number: true }],
      [{ ...close, number: 0 }],
      [{ ...close, baselineState: "closed" }],
      [{ ...close, reason: "completed" }],
      [{ ...close, body: "extra" }],
      [{ ...close, action: "label" }],
    ]) {
      expect(status("issue-actions", { ...batch, actions })).toBe(INVALID);
    }
  });
  it("requires an add-only update against an unchanged baseline", () => {
    const record = approval("update", update);
    expect(verify("update", update, record, updateObserved).status).toBe(VALID);
    expect(
      verify("update", update, record, {
        ...updateObserved,
        baselineTitle: "moved",
      }).stderr,
    ).toContain("baselineTitle");
    for (const change of [{ labels: [] }, { title: update.baselineTitle }]) {
      expect(status("update", { ...update, ...change })).toBe(INVALID);
    }
  });
  it("binds closing references and platform capability", () => {
    const values = {
      ...preview,
      body: "Closes #12",
      closes: ["o/r#12"],
      autoClose: "yes",
    };
    digest("preview", values);
    digest("preview", {
      ...values,
      body: "Implementing: #12, o/r#13 and https://gitlab.test/group/lib/-/issues/14. See #15",
      closes: ["o/r#12", "o/r#13", "group/lib#14"],
      related: ["o/r#15"],
    });
    for (const change of [
      { closes: [], autoClose: "none", related: values.closes },
      { unsupported: ["assignees"] },
      { autoClose: "unverifiable" },
    ]) {
      expect(status("preview", { ...values, ...change })).toBe(INVALID);
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
  // prettier-ignore
  it.each([
    ["exact", {}, {}, { fields: { title: "exact" }, notCompared: [] }],
    ["additions", {}, { body: `${preview.body}footer` }, { fields: { body: "appended" }, extras: { body: "footer" } }],
    ["additions", {}, { labels: [...preview.labels, "bot"] }, { extras: { labels: ["bot"] } }],
    ["drift", {}, { title: "changed" }, { fields: { title: "changed" } }],
    ["drift", {}, { labels: null }, { fields: { labels: "unreadable" } }],
    ["exact", { labels: [], unsupported: ["labels"] }, { labels: null }, { fields: { labels: "unsupported" }, notCompared: ["labels"] }],
    ["drift", { labels: [], unsupported: ["labels"] }, { labels: [] }, { fields: { labels: "changed" } }],
    ["exact", { body: "Fixes #12", closes: ["o/r#12"], autoClose: "yes" }, { body: "Fixes #12", closes: ["o/r#12"] }, { fields: { closes: "exact" } }],
    ["exact", { body: "Fixes #12", closes: ["o/r#12"], autoClose: "no" }, { body: "Fixes #12" }, { fields: { closes: "exact" } }],
    ["exact", { body: "Fixes #12", closes: ["o/r#12"], autoClose: "unverifiable", unsupported: ["closes"] }, { body: "Fixes #12", closes: null }, { fields: { closes: "unsupported" } }],
  ] as const)(
    "classifies readback as %s",
    (outcome, changes, readback, details) => {
      const result = run("compare", "preview", {
        values: { ...preview, ...changes },
        returned: { ...returned, ...readback },
      });
      expect(result.status).toBe(VALID);
      expect(JSON.parse(result.stdout)).toMatchObject({ outcome, ...details });
    },
  );
  it("rejects a push approval naming a different command", () => {
    const plainRecord = {
      ...approval("push", plainPush),
      action: "git push --force",
    };
    expect(verify("push", plainPush, plainRecord).status).toBe(INVALID);
    const record = {
      ...approval("force-push", force),
      action: "git push --force",
    };
    expect(verify("force-push", force, record).status).toBe(INVALID);
  });
  it("compares the resulting update, not its baseline", () => {
    const result = run("compare", "update", { values: update, returned });
    expect(result.status).toBe(VALID);
    const fields = { title: "exact", state: "exact" };
    expect(JSON.parse(result.stdout)).toMatchObject({
      outcome: "exact",
      fields,
    });
  });
  it("requires fresh observations rather than verifying only the digest", () => {
    for (const [kind, values] of [
      ["scope", scope],
      ["update", update],
    ] as const) {
      expect(verify(kind, values, approval(kind, values)).status).toBe(INVALID);
    }
  });
  it("recognizes a closing keyword followed by the GitLab issue noun", () => {
    expect(
      status("preview", { ...preview, body: "Fixing issues #3 and #4" }),
    ).toBe(INVALID);
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
    expect(help.stdout).toContain(
      "Kinds: push, scope, rebase, force-push, preview, update, issue-actions.",
    );
    for (const kind of ["issue-comment", "issue-close"]) {
      for (const mode of ["digest", "verify"]) {
        expect(run(mode, kind, {}).status).toBe(USAGE_ERROR);
      }
    }
    expect(run("unknown", "preview", preview).status).toBe(USAGE_ERROR);
  });
});
