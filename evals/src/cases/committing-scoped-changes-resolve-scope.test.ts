import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  COLLECTOR_ERROR_EXIT,
  git,
  repo,
  script,
  SUCCESS_EXIT,
} from "#/cases/committing-scoped-changes-test-support.ts";

describe("resolve-scope", () => {
  const selectionError = 3;
  function resolveScope(cwd: string, ...args: string[]) {
    const { status, stdout, stderr } = spawnSync(
      "python3",
      ["-I", script, "resolve-scope", ...args],
      { cwd },
    );
    return { status, stdout, stderr };
  }
  function success(paths: string) {
    return {
      status: SUCCESS_EXIT,
      stdout: Buffer.from(paths),
      stderr: Buffer.from(""),
    };
  }
  function expectFailure(
    result: ReturnType<typeof resolveScope>,
    code: number,
  ) {
    expect(result.status).toBe(code);
    expect(result.stdout).toEqual(Buffer.from(""));
    expect(result.stderr.toString()).toMatch(/^collect-state: .+\n$/);
  }

  test("lists staged, unstaged, deleted and nested untracked paths outside excluded directories", () => {
    const cwd = repo();
    git(cwd, "rm", "a");
    writeFileSync(join(cwd, "b"), "unstaged");
    writeFileSync(join(cwd, "staged"), "new");
    git(cwd, "add", "staged");
    for (const dir of ["docs", "nested/deep"]) {
      mkdirSync(join(cwd, dir), { recursive: true });
      writeFileSync(join(cwd, dir, "loose"), "new");
    }
    writeFileSync(join(cwd, ".git/info/exclude"), "ignored\n");
    writeFileSync(join(cwd, "ignored"), "new");
    expect(resolveScope(cwd, "--all", "--exclude=docs/")).toEqual(
      success("a\nb\nnested/deep/loose\nstaged\n"),
    );
    expect(
      resolveScope(cwd, "--include=a", "--include=staged", "--exclude=b"),
    ).toEqual(success("a\nstaged\n"));
  });

  test("matches directory boundaries and emits overlapping includes only once", () => {
    const cwd = repo();
    for (const dir of ["src/gen", "src/generated", "src-other"]) {
      mkdirSync(join(cwd, dir), { recursive: true });
      writeFileSync(join(cwd, dir, "file"), "new");
    }
    expect(
      resolveScope(
        cwd,
        "--include=src/",
        "--include=src/generated/file",
        "--exclude=src/gen/",
        "--exclude=a",
      ),
    ).toEqual(success("src/generated/file\n"));
  });

  test.each([
    { args: ["--all", "--exclude=b"], paths: "a\nrenamed\n" },
    { args: ["--include=b", "--exclude=a"], paths: "" },
  ])(
    "keeps both ends of a staged rename or neither with $args",
    ({ args, paths }) => {
      const cwd = repo();
      git(cwd, "mv", "a", "renamed");
      expect(resolveScope(cwd, ...args)).toEqual(success(paths));
    },
  );

  test.each(["a", "renamed"])(
    "rejects a staged rename with only %s excluded",
    (excluded) => {
      const cwd = repo();
      git(cwd, "mv", "a", "renamed");
      const result = resolveScope(cwd, "--all", `--exclude=${excluded}`);
      expectFailure(result, selectionError);
      expect(result.stderr.toString()).toMatch(/\ba\b/);
      expect(result.stderr.toString()).toContain("renamed");
    },
  );

  test("consumes the copy source without treating a copy as a rename", () => {
    const cwd = repo();
    git(cwd, "config", "status.renames", "copies");
    writeFileSync(join(cwd, "copy"), readFileSync(join(cwd, "a")));
    writeFileSync(join(cwd, "a"), "changed");
    git(cwd, "add", "a", "copy");
    expect(resolveScope(cwd, "--all", "--exclude=a")).toEqual(
      success("copy\n"),
    );
  });

  test("succeeds with empty output when an exclusion removes every change", () => {
    const cwd = repo();
    unlinkSync(join(cwd, "a"));
    expect(resolveScope(cwd, "--all", "--exclude=a")).toEqual(success(""));
  });

  test.each(["--include=A", "--exclude=A"])(
    "rejects the wrong-case selector %s",
    (selector) => {
      const cwd = repo();
      const args = selector.startsWith("--include=")
        ? [selector, "--include=a", "--exclude=b"]
        : ["--all", "--exclude=b", selector];
      const result = resolveScope(cwd, ...args);
      expectFailure(result, selectionError);
      expect(result.stderr.toString()).toContain("A");
    },
  );

  test("rejects selected whitespace without leaking an earlier match", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "a"), "changed");
    mkdirSync(join(cwd, "notes"));
    writeFileSync(join(cwd, "notes/two words"), "new");
    const result = resolveScope(cwd, "--all", "--exclude=b");
    expectFailure(result, selectionError);
    expect(result.stderr.toString()).toContain("notes/two words");
    expect(resolveScope(cwd, "--all", "--exclude=notes/")).toEqual(
      success("a\n"),
    );
  });

  test("prints selected names containing Git pathspec characters literally", () => {
    const cwd = repo();
    const names = [":special", "a*b", "a?b", "a[b", "a\\b", "a]b"];
    for (const name of names) writeFileSync(join(cwd, name), "new");
    expect(resolveScope(cwd, "--all", "--exclude=b")).toEqual(
      success(`${names.join("\n")}\n`),
    );
  });

  test.each(
    [
      ["--all"],
      ["--all", "--include=a", "--exclude=b"],
      ["--exclude=a"],
      ["--include=src/*", "--exclude=b"],
      ["--all", "--exclude=../a"],
      ["--all", "--exclude=a//"],
      ["--all", "--exclude=/a"],
      ["--all", "--exclude=./a"],
      ["--all", "--exclude=a b"],
      ["--all", "--exclude="],
      ["--all", "--all", "--exclude=b"],
    ].map((args) => ({ args })),
  )("reports a usage error for $args", ({ args }) => {
    const result = resolveScope(repo(), ...args);
    expectFailure(result, COLLECTOR_ERROR_EXIT);
    expect(result.stderr.toString()).toContain("resolve-scope");
  });

  test("reports a Git read failure without any output paths", () => {
    const cwd = repo();
    writeFileSync(join(cwd, ".git/index"), "corrupt index");
    const result = resolveScope(cwd, "--all", "--exclude=b");
    expectFailure(result, COLLECTOR_ERROR_EXIT);
    expect(result.stderr.toString()).toContain("index");
  });

  test("leaves a stat-dirty index and porcelain status unchanged", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "b"), "unstaged");
    const older = new Date("2000-01-01");
    utimesSync(join(cwd, "a"), older, older);
    const status = () =>
      git(cwd, "--no-optional-locks", "status", "--porcelain=v1", "-z");
    const before = status();
    const index = readFileSync(join(cwd, ".git/index"));
    expect(resolveScope(cwd, "--all", "--exclude=a")).toEqual(success("b\n"));
    expect(readFileSync(join(cwd, ".git/index"))).toEqual(index);
    expect(status()).toBe(before);
  });
});
