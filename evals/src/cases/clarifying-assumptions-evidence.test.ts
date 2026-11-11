import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const LAST = -1;
const SUCCESS = 0;
const FAILURE = 1;

const script = fileURLToPath(
  new URL(
    "../../../skills/clarifying-assumptions/scripts/validate-local-revision.py",
    import.meta.url,
  ),
);
const key = "acme-app-42";
const old = "recieve the audit download";
const replacement = "receive the audit download";
const before = `# Plan\n\n## Implementation notes\nUsers ${old}.\n`;

const SUFFIXES = {
  upfront: ["tasks", "stage-1-detailed", "stage-2-prioritized"],
  critique: [
    "tasks",
    "task-1-brief",
    "task-1-execution-plan",
    "task-1-test-spec",
    "task-1-refactoring-plan",
  ],
};
function extraChange(text: string, applies: boolean): string {
  return applies ? `${text}\n## Task 2: Delete data\n` : text;
}
function seedAfter(
  path: string,
  wrong: string,
  beforeText: string,
  [first, last]: readonly [string | undefined, string | undefined],
): string {
  if (wrong === "stale" && path === last) return beforeText;
  const text = beforeText.replace(old, replacement);
  return extraChange(text, wrong === "extra" && path === first);
}
function runRevision(
  mode: "upfront" | "critique",
  wrong: string,
  endings = { before: "\n", after: "\n" },
) {
  const root = mkdtempSync(join(tmpdir(), "local-revision-"));
  mkdirSync(join(root, "docs"));
  const beforeText = before.replaceAll("\n", endings.before);
  const paths = SUFFIXES[mode].map((suffix) => `docs/${key}-${suffix}.md`);
  for (const path of paths) writeFileSync(join(root, path), beforeText);
  const files = Object.fromEntries(
    paths.map((path) => [path, readFileSync(join(root, path), "utf8")]),
  );
  const [first] = paths;
  const last = paths.at(LAST);
  for (const path of paths) {
    const afterText = seedAfter(path, wrong, beforeText, [first, last]);
    writeFileSync(
      join(root, path),
      afterText.replaceAll(/\r?\n/g, endings.after),
    );
  }
  const evidence = Object.fromEntries(
    Object.entries(files).filter(
      ([path]) => wrong !== "missing" || path !== last,
    ),
  );
  try {
    return spawnSync("python3", ["-I", script, root, key, mode, "1"], {
      input: JSON.stringify({
        files: evidence,
        replacements: [{ old, new: replacement }],
      }),
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("localized revision evidence", () => {
  it.each(["upfront", "critique"] as const)(
    "validates all %s artifacts after an exact copy edit",
    (mode) => {
      const result = runRevision(mode, "");
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout).toMatch(/^LOCAL_REVISION: PASS files=\d+\n$/);
    },
  );
  it("preserves CRLF bytes while applying the approved edit", () => {
    const result = runRevision("upfront", "", {
      before: "\r\n",
      after: "\r\n",
    });
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toBe("LOCAL_REVISION: PASS files=3\n");
  });
  it.each([
    { name: "LF to CRLF", before: "\n", after: "\r\n" },
    { name: "CRLF to LF", before: "\r\n", after: "\n" },
  ])("rejects an unapproved $name conversion", (endings) => {
    const result = runRevision("upfront", "", endings);
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toContain("stale artifact or unexpected edit");
  });
  it.each(["stale", "extra", "missing"])(
    "rejects %s artifact evidence",
    (wrong) => {
      expect(runRevision("critique", wrong).status).toBe(FAILURE);
    },
  );
});
