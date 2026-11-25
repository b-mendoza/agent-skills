import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  candidateScript,
  edited,
  expectFailure,
  git,
  hunkRepo,
  script,
  scriptOutput,
} from "#/cases/committing-scoped-changes-test-support.ts";

const diverged = 5;

test("lists zero-context insertions, deletions and replacements independently of Git settings", () => {
  const { cwd } = hunkRepo();
  for (const algorithm of ["patience", "minimal"]) {
    git(cwd, "config", "diff.algorithm", algorithm);
    git(cwd, "config", "diff.context", "8");
    git(cwd, "config", "diff.interHunkContext", "9");
    expect(scriptOutput(cwd, script, "hunks", "a")).toBe(
      "a#1 @@ -0,0 +1 @@ +start\na#2 @@ -2 +2,0 @@ -remove\na#3 @@ -4 +4 @@ -old\na#4 @@ -5,0 +6 @@ +last\n",
    );
  }
});

test.each([
  ["1,2,3,4", edited],
  ["2,4", "anchor\nmiddle\nold\nend\nlast"],
])("exports the exact bytes of hunks %s", (numbers, expected) => {
  const { cwd, base } = hunkRepo();
  git(cwd, "config", "core.autocrlf", "true");
  const output = scriptOutput(
    cwd,
    candidateScript,
    "build",
    "a",
    "--hunks",
    base,
    `a#${numbers}`,
  );
  const directory = output.trimEnd().replace(/^[0-9a-f]{40} /, "");
  try {
    expect(readFileSync(join(directory, "a"), "utf8")).toBe(expected);
  } finally {
    scriptOutput(cwd, candidateScript, "clean", directory);
  }
});

test("binds the base blob, token, selected bytes and unselected worktree bytes", () => {
  const { cwd, base } = hunkRepo();
  function digest(token: string, commit = base) {
    return scriptOutput(cwd, script, "group", "a", "--hunks", commit, token);
  }
  const before = digest("a#1,3");
  expect(digest("a#3+1")).not.toBe(before);
  writeFileSync(join(cwd, "a"), edited.replace("start", "changed"));
  expect(digest("a#1,3")).not.toBe(before);
  writeFileSync(join(cwd, "a"), edited.replace("last", "outside"));
  expect(digest("a#1,3")).not.toBe(before);
  writeFileSync(
    join(cwd, "a"),
    git(cwd, "show", "HEAD:a").replace("old", "older"),
  );
  git(cwd, "commit", "-qam", "different base");
  writeFileSync(join(cwd, "a"), edited);
  expect(digest("a#1,3", git(cwd, "rev-parse", "HEAD").trim())).not.toBe(
    before,
  );
});

test("build refuses when HEAD lacks PRIOR without writing repository objects", () => {
  const { cwd, base } = hunkRepo();
  const objects = git(cwd, "count-objects", "-v");
  expectFailure(
    cwd,
    candidateScript,
    diverged,
    "build",
    "a",
    "--hunks",
    base,
    "a#2+1",
  );
  expect(git(cwd, "count-objects", "-v")).toBe(objects);
});
