import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Schema } from "effect";
import { afterEach, expect, test } from "vitest";

import { observationSchema } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const roots: string[] = [];
function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "repo-files-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

test("captures only requested text files and records missing paths", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "reports", "result.md"), "# Report\n");
  writeFileSync(join(root, "empty.txt"), "");
  writeFileSync(join(root, "ignored.txt"), "not requested");
  expect(
    snapshotRepoFiles(root, ["reports/result.md", "empty.txt", "missing/file"]),
  ).toEqual({
    "reports/result.md": "# Report\n",
    "empty.txt": "",
    "missing/file": null,
  });
});

test.each(["../outside", "/etc/passwd", "", ".", "a/../file"])(
  "rejects a noncanonical repo-relative path: %s",
  (path) => {
    expect(() => snapshotRepoFiles(makeRoot(), [path])).toThrow(
      /repo-relative/,
    );
  },
);

test("refuses symlink files, symlink ancestors, and directories instead of reading outside the repo", () => {
  const root = makeRoot();
  const outside = makeRoot();
  writeFileSync(join(outside, "secret"), "do not capture");
  symlinkSync(join(outside, "secret"), join(root, "link"));
  symlinkSync(outside, join(root, "dir-link"));
  mkdirSync(join(root, "directory"));
  for (const path of ["link", "dir-link/secret", "directory"]) {
    expect(() => snapshotRepoFiles(root, [path])).toThrow(
      /regular file|symlink/,
    );
  }
});

test("observation metadata validates snapshot contents", () => {
  const decode = Schema.decodeUnknownSync(observationSchema);
  expect(
    decode(createObservation({ repoFiles: { "report.md": "ok", gone: null } }))
      .repoFiles,
  ).toEqual({ "report.md": "ok", gone: null });
  expect(() =>
    decode({ ...createObservation(), repoFiles: { "report.md": 123 } }),
  ).toThrow();
});

const MAX_DIRECTORY_FILES = 200;
const MAX_DIRECTORY_FILE_BYTES = 1_048_576;
const DIRECTORY_MARKER_COUNT = 1;
const ONE_EXTRA_BYTE = 1;

test("captures a requested directory recursively, including hidden and empty files", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports", "run-123", "nested"), { recursive: true });
  writeFileSync(
    join(root, "reports", "run-123", "report.yaml"),
    "status: PASS\n",
  );
  writeFileSync(
    join(root, "reports", "run-123", "nested", ".hidden"),
    "evidence",
  );
  writeFileSync(join(root, "reports", "empty"), "");
  writeFileSync(join(root, "outside"), "unrequested");
  expect(snapshotRepoFiles(root, ["reports/"])).toEqual({
    "reports/": "",
    "reports/run-123/report.yaml": "status: PASS\n",
    "reports/run-123/nested/.hidden": "evidence",
    "reports/empty": "",
  });
});

test("distinguishes requested empty and absent directories", () => {
  const root = makeRoot();
  mkdirSync(join(root, "empty"));
  expect(snapshotRepoFiles(root, ["empty/", "missing/nested/"])).toEqual({
    "empty/": "",
    "missing/nested/": null,
  });
});

test("combines overlapping directory and exact requests without losing markers", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports", "nested"), { recursive: true });
  writeFileSync(join(root, "reports", "nested", "result"), "ok");
  expect(
    snapshotRepoFiles(root, [
      "reports/",
      "reports/nested/",
      "reports/nested/result",
    ]),
  ).toEqual({
    "reports/": "",
    "reports/nested/": "",
    "reports/nested/result": "ok",
  });
});

test.each(["/", "../", "reports/../", "./reports/", "reports//", "/reports/"])(
  "rejects unsafe directory requests: %s",
  (path) => {
    expect(() => snapshotRepoFiles(makeRoot(), [path])).toThrow(
      /repo-relative/,
    );
  },
);

test("refuses file paths used as directory requests", () => {
  const root = makeRoot();
  writeFileSync(join(root, "file"), "data");
  expect(() => snapshotRepoFiles(root, ["file/"])).toThrow(/directory/);
});

test("rejects symlink ancestors and symlinks anywhere in a requested tree", () => {
  const root = makeRoot();
  const outside = makeRoot();
  mkdirSync(join(root, "reports"));
  writeFileSync(join(outside, "secret"), "not evidence");
  symlinkSync(outside, join(root, "linked-root"));
  expect(() => snapshotRepoFiles(root, ["linked-root/"])).toThrow(/symlink/);
  expect(() => snapshotRepoFiles(root, ["linked-root/missing/"])).toThrow(
    /symlink/,
  );
  symlinkSync(join(outside, "secret"), join(root, "reports", "file-link"));
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/symlink/);
  rmSync(join(root, "reports", "file-link"));
  symlinkSync(outside, join(root, "reports", "directory-link"));
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/symlink/);
  rmSync(join(root, "reports", "directory-link"));
  symlinkSync(join(outside, "absent"), join(root, "reports", "dangling"));
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/symlink/);
});

test("refuses non-regular entries rather than blocking on a FIFO", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports"));
  execFileSync("mkfifo", [join(root, "reports", "pipe")]);
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/regular file/);
});

test("allows the directory file-count boundary and fails rather than truncating", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports"));
  for (const index of Array.from({ length: MAX_DIRECTORY_FILES }).keys()) {
    writeFileSync(join(root, "reports", String(index)), "");
  }
  expect(Object.keys(snapshotRepoFiles(root, ["reports/"]))).toHaveLength(
    MAX_DIRECTORY_FILES + DIRECTORY_MARKER_COUNT,
  );
  mkdirSync(join(root, "reports", "nested"));
  writeFileSync(join(root, "reports", "nested", "overflow"), "");
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/200 files/);
});

test("bounds each captured directory file in bytes and preserves exact-path behavior", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports"));
  writeFileSync(
    join(root, "reports", "large"),
    Buffer.alloc(MAX_DIRECTORY_FILE_BYTES, "a"),
  );
  expect(snapshotRepoFiles(root, ["reports/"])["reports/large"]).toHaveLength(
    MAX_DIRECTORY_FILE_BYTES,
  );
  writeFileSync(
    join(root, "reports", "large"),
    Buffer.alloc(MAX_DIRECTORY_FILE_BYTES + ONE_EXTRA_BYTE, "a"),
  );
  expect(() => snapshotRepoFiles(root, ["reports/"])).toThrow(/1048576 bytes/);
  expect(
    snapshotRepoFiles(root, ["reports/large"])["reports/large"],
  ).toHaveLength(MAX_DIRECTORY_FILE_BYTES + ONE_EXTRA_BYTE);
});

test("keeps special property names as captured data and validates directory metadata", () => {
  const root = makeRoot();
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "__proto__"), "plain text");
  writeFileSync(join(root, "reports", "__proto__"), "nested text");
  const captured = snapshotRepoFiles(root, [
    "__proto__",
    "reports/",
    "absent/",
  ]);
  expect(Object.hasOwn(captured, "__proto__")).toBe(true);
  expect(Object.entries(captured)).toContainEqual(["__proto__", "plain text"]);
  expect(captured["reports/__proto__"]).toBe("nested text");
  expect(
    Schema.decodeUnknownSync(observationSchema)(
      createObservation({ repoFiles: captured }),
    ).repoFiles,
  ).toEqual(captured);
});
