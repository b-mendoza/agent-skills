import {
  chmodSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  COLLECTOR_ERROR_EXIT,
  expectFailure,
  git,
  hunkRepo,
  script,
} from "#/cases/committing-scoped-changes-test-support.ts";

const executable = 0o755;

test.each([
  "a#",
  "a#+1",
  "a#0",
  "a#01",
  "a#1,1",
  "a#2,1",
  "a#2+1,2",
  "a#1+",
  "a#1+2+3",
  "a#5",
  "a#1+5",
  "b#1",
])("rejects invalid token %s", (token) => {
  const { cwd, base } = hunkRepo();
  expect(
    expectFailure(
      cwd,
      script,
      COLLECTOR_ERROR_EXIT,
      "group",
      "a",
      "--hunks",
      base,
      token,
    ),
  ).toMatch(/token|hunk number/i);
});

test("refuses a staged rename even when the destination existed in the original base", () => {
  const { cwd, base } = hunkRepo();
  git(cwd, "rm", "-f", "a");
  git(cwd, "commit", "-qm", "remove a");
  git(cwd, "mv", "b", "a");
  expect(
    expectFailure(
      cwd,
      script,
      COLLECTOR_ERROR_EXIT,
      "group",
      "a",
      "--hunks",
      base,
      "a#1",
    ),
  ).toMatch(/rename/);
});

test("rejects repeated paths, duplicate tokens and a symbolic base", () => {
  const { cwd, base } = hunkRepo();
  for (const args of [
    ["a", "a", "--hunks", base, "a#1"],
    ["a", "--hunks", base, "a#1", "a#2"],
    ["a", "--hunks", "HEAD", "a#1"],
  ]) {
    expect(
      expectFailure(cwd, script, COLLECTOR_ERROR_EXIT, "group", ...args),
    ).toMatch(/duplicate|BASE/);
  }
});

test.each([
  "mode change",
  "binary",
  "binary driver",
  "symlink",
  "directory",
  "deleted",
  "gitlink",
  "untracked",
  "renamed",
  "clean filter",
  "line endings",
])("does not list or digest a %s split file", (kind) => {
  const { cwd } = hunkRepo();
  let path = "a";
  const file = join(cwd, path);
  switch (kind) {
    case "mode change":
      chmodSync(file, executable);
      break;
    case "binary driver":
      writeFileSync(join(cwd, ".gitattributes"), "a diff=custom\n");
      git(cwd, "config", "diff.custom.binary", "true");
      break;
    case "binary":
      writeFileSync(file, "with\0nul");
      break;
    case "symlink":
      unlinkSync(file);
      symlinkSync("b", file);
      break;
    case "directory":
      unlinkSync(file);
      mkdirSync(file);
      break;
    case "deleted":
      unlinkSync(file);
      break;
    case "gitlink":
      path = "module";
      mkdirSync(join(cwd, path));
      git(
        cwd,
        "update-index",
        "--add",
        "--cacheinfo",
        `160000,${git(cwd, "rev-parse", "HEAD").trim()},${path}`,
      );
      git(cwd, "commit", "-qm", "module");
      break;
    case "untracked":
      git(cwd, "rm", "--cached", "a");
      break;
    case "renamed":
      path = "destination";
      git(cwd, "mv", "a", path);
      break;
    case "clean filter":
      writeFileSync(join(cwd, ".gitattributes"), "a filter=upper\n");
      git(cwd, "config", "filter.upper.clean", "tr a-z A-Z");
      break;
    case "line endings":
      git(cwd, "config", "core.autocrlf", "input");
      writeFileSync(file, "with\r\n");
      break;
    default:
      throw new Error(kind);
  }
  const base = git(cwd, "rev-parse", "HEAD").trim();
  for (const args of [
    ["hunks", path],
    ["group", path, "--hunks", base, `${path}#1`],
  ]) {
    expect(expectFailure(cwd, script, COLLECTOR_ERROR_EXIT, ...args)).toContain(
      `: ${path}\n`,
    );
  }
});
