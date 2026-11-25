import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, test } from "vitest";

import {
  COLLECTOR_ERROR_EXIT,
  git,
  repo,
  script,
  SUCCESS_EXIT,
} from "#/cases/committing-scoped-changes-test-support.ts";

const candidateScript = join(dirname(script), "candidate-tree.py");
const proofFailed = 3;
const executable = 0o755;

function candidate(cwd: string, ...args: string[]) {
  return spawnSync("python3", ["-I", candidateScript, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function success(cwd: string, ...args: string[]) {
  const result = candidate(cwd, ...args);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(SUCCESS_EXIT);
  return result.stdout;
}

function failure(cwd: string, code: number, ...args: string[]) {
  const result = candidate(cwd, ...args);
  expect(result.status).toBe(code);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/^candidate-tree: .+\n$/);
  return result.stderr;
}

function buildExport(cwd: string, ...paths: string[]) {
  const receipt = success(cwd, "build", ...paths);
  const [, tree, directory] =
    /^(?<tree>[a-f0-9]{40}) (?<directory>[^\n]+)\n$/.exec(receipt) ?? [];
  if (tree === undefined || directory === undefined) {
    throw new Error(`Invalid build receipt: ${receipt}`);
  }
  return { tree, directory };
}

function preserve(cwd: string, path: string) {
  return execFileSync("python3", ["-I", script, "preserve", path], {
    cwd,
    encoding: "utf8",
  });
}

function commitOnly(cwd: string, ...paths: string[]) {
  git(cwd, "commit", "--only", "-qm", "approved group", "--", ...paths);
}

describe("candidate tree construction", () => {
  test.each(["tracked", "untracked"])(
    "the executor commits only the %s bracket path, not its matching sibling",
    (kind) => {
      const cwd = repo();
      const path = "[id].txt";
      const sibling = "i.txt";
      const isUntracked = kind === "untracked";
      const writeBoth = (content: string) => {
        for (const name of [path, sibling]) {
          writeFileSync(join(cwd, name), content);
        }
      };
      const expected = isUntracked
        ? { untracked: `${path}\n`, indexedSibling: "" }
        : { untracked: "", indexedSibling: `${sibling}\n` };
      if (!isUntracked) {
        writeBoth("baseline");
        git(cwd, "add", ".");
        git(cwd, "commit", "-qm", "baseline");
      }
      writeBoth("edited");
      const parent = git(cwd, "rev-parse", "HEAD").trim();
      const tree = success(cwd, "build", "--no-export", path).trim();
      const executor = readFileSync(
        join(dirname(script), "../subagents/scoped-commit-executor.md"),
        "utf8",
      );
      function runForm(form: string) {
        const command = executor
          .split("`")
          .find((span) => span.startsWith("git ") && span.includes(form));
        if (command === undefined) {
          throw new Error(`Missing executor form: ${form}`);
        }
        return execFileSync(
          "sh",
          [
            "-c",
            command
              .replace("<paths>", `'${path}'`)
              .replace("<untracked group paths>", `'${path}'`)
              .replace("<Message>", "approved"),
          ],
          { cwd, encoding: "utf8" },
        );
      }
      const untracked = runForm("ls-files --others");
      expect(untracked).toBe(expected.untracked);
      if (isUntracked) runForm("add -N --");
      expect(git(cwd, "ls-files", "--", sibling)).toBe(expected.indexedSibling);
      runForm("commit --only -m");
      expect(
        git(cwd, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"),
      ).toBe(`${path}\n`);
      expect(success(cwd, "prove", tree, parent, path)).toBe(
        `Tree: ${tree}=${tree}\n`,
      );
    },
  );

  test.each(["text=auto", "autocrlf=input", "staged mode"])(
    "matches a path-only commit with %s and proves stat-only drift",
    (setting) => {
      const cwd = repo();
      git(cwd, "config", "core.autocrlf", "false");
      writeFileSync(join(cwd, "a"), "baseline\r\n");
      commitOnly(cwd, "a");
      if (setting === "text=auto") {
        writeFileSync(join(cwd, ".gitattributes"), "* text=auto\n");
        git(cwd, "add", ".gitattributes");
        commitOnly(cwd, ".gitattributes");
      } else if (setting === "autocrlf=input") {
        git(cwd, "config", "core.autocrlf", "input");
      } else {
        git(cwd, "config", "core.filemode", "false");
        git(cwd, "update-index", "--chmod=+x", "a");
      }
      writeFileSync(join(cwd, "a"), "edited\r\n");
      const parent = git(cwd, "rev-parse", "HEAD").trim();
      const tree = success(cwd, "build", "--no-export", "a").trim();
      commitOnly(cwd, "a");
      const older = new Date("2000-01-01");
      utimesSync(join(cwd, "a"), older, older);
      expect(tree).toBe(git(cwd, "rev-parse", "HEAD^{tree}").trim());
      expect(success(cwd, "prove", tree, parent, "a")).toBe(
        `Tree: ${tree}=${tree}\n`,
      );
    },
  );

  test("matches a partial commit of an edit, an intent, a deletion, a mode change and a symlink", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "remove"), "obsolete");
    git(cwd, "add", "remove");
    git(cwd, "commit", "-qm", "baseline");
    const parent = git(cwd, "rev-parse", "HEAD").trim();
    writeFileSync(join(cwd, "a"), "edited");
    chmodSync(join(cwd, "b"), executable);
    unlinkSync(join(cwd, "remove"));
    writeFileSync(join(cwd, "new"), "new content");
    symlinkSync("dangling", join(cwd, "link"));
    git(cwd, "add", "-N", "new", "link");
    const paths = ["new", "remove", "a", "b", "link"];
    const tree = success(cwd, "build", "--no-export", ...paths).trimEnd();
    commitOnly(cwd, ...paths);
    expect(git(cwd, "rev-parse", "HEAD^{tree}")).toBe(`${tree}\n`);
    expect(success(cwd, "prove", tree, parent, ...paths)).toBe(
      `Tree: ${tree}=${tree}\n`,
    );
  });

  test("exports a changed gitlink as an empty directory and proves its committed OID", () => {
    const cwd = repo();
    const source = repo();
    git(
      cwd,
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      "--quiet",
      source,
      "dependency",
    );
    git(cwd, "commit", "-qm", "gitlink");
    const parent = git(cwd, "rev-parse", "HEAD").trim();
    git(source, "commit", "--allow-empty", "-qm", "dependency update");
    git(join(cwd, "dependency"), "pull", "--ff-only", "-q");
    const { directory, tree } = buildExport(cwd, "dependency");
    try {
      expect(lstatSync(join(directory, "dependency")).isDirectory()).toBe(true);
      expect(existsSync(join(directory, "dependency/a"))).toBe(false);
    } finally {
      success(cwd, "clean", directory);
    }
    commitOnly(cwd, "dependency");
    expect(success(cwd, "prove", tree, parent, "dependency")).toBe(
      `Tree: ${tree}=${tree}\n`,
    );
  });

  test("uses the index executable bit when Git ignores filesystem modes", () => {
    const cwd = repo();
    git(cwd, "config", "core.filemode", "false");
    chmodSync(join(cwd, "a"), executable);
    writeFileSync(join(cwd, "a"), "edited");
    const tree = success(cwd, "build", "--no-export", "a");
    commitOnly(cwd, "a");
    expect(tree).toBe(git(cwd, "rev-parse", "HEAD^{tree}"));
  });

  test("exports only candidate entries and ignored links without changing repository state", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "nested"));
    writeFileSync(join(cwd, "nested/tracked"), "baseline");
    git(cwd, "add", "nested");
    git(cwd, "commit", "-qm", "tracked directory");
    writeFileSync(join(cwd, "a"), "group");
    writeFileSync(join(cwd, "b"), "staged");
    git(cwd, "add", "b");
    writeFileSync(join(cwd, "b"), "unstaged");
    writeFileSync(join(cwd, "loose"), "untracked");
    writeFileSync(
      join(cwd, ".git/info/exclude"),
      "deps/\nnested/cache\ncache-only/output\n",
    );
    mkdirSync(join(cwd, "cache-only"));
    writeFileSync(join(cwd, "cache-only/output"), "cached output");
    mkdirSync(join(cwd, "deps"));
    writeFileSync(join(cwd, "deps/tool"), "dependency");
    writeFileSync(join(cwd, "nested/cache"), "cached");
    const before = preserve(cwd, "a");
    const objects = git(cwd, "count-objects", "-v");
    const index = readFileSync(join(cwd, ".git/index"));
    const { directory } = buildExport(cwd, "a");
    try {
      expect(readFileSync(join(cwd, ".git/index"))).toEqual(index);
      expect(git(cwd, "count-objects", "-v")).toBe(objects);
      expect(preserve(cwd, "a")).toBe(before);
      expect(readFileSync(join(directory, "a"), "utf8")).toBe("group");
      expect(readFileSync(join(directory, "b"), "utf8")).toBe("b\n");
      expect(existsSync(join(directory, "loose"))).toBe(false);
      expect(readFileSync(join(directory, "cache-only/output"), "utf8")).toBe(
        "cached output",
      );
      for (const path of ["deps", "nested/cache"]) {
        expect(lstatSync(join(directory, path)).isSymbolicLink()).toBe(true);
        expect(realpathSync(join(directory, path))).toBe(
          realpathSync(join(cwd, path)),
        );
      }
    } finally {
      success(cwd, "clean", directory);
    }
    expect(existsSync(directory)).toBe(false);
    expect(readFileSync(join(cwd, "deps/tool"), "utf8")).toBe("dependency");
    expect(readFileSync(join(cwd, "nested/cache"), "utf8")).toBe("cached");
  });

  test("fails without fetching a missing parent tree into a partial clone", () => {
    const source = repo();
    const clone = join(repo(), "partial");
    git(source, "config", "uploadpack.allowFilter", "true");
    git(
      source,
      "clone",
      "-q",
      "--no-checkout",
      "--filter=tree:0",
      pathToFileURL(source).href,
      clone,
    );
    writeFileSync(join(clone, "a"), "edited");
    const before = git(clone, "count-objects", "-v");
    failure(clone, COLLECTOR_ERROR_EXIT, "build", "--no-export", "a");
    expect(git(clone, "count-objects", "-v")).toBe(before);
  });

  test("refuses to clean a directory it did not create", () => {
    const cwd = repo();
    failure(cwd, COLLECTOR_ERROR_EXIT, "clean", cwd);
    expect(readFileSync(join(cwd, "a"), "utf8")).toBe("a\n");
  });

  test("rejects a tracked file replaced by a directory instead of predicting a deletion", () => {
    const cwd = repo();
    unlinkSync(join(cwd, "a"));
    mkdirSync(join(cwd, "a"));
    writeFileSync(join(cwd, "a/child"), "outside group");
    expect(
      failure(cwd, COLLECTOR_ERROR_EXIT, "build", "--no-export", "a"),
    ).toContain("expected a file or stage-0 gitlink");
  });

  test("never follows a candidate symlink to place an ignored file", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "target"));
    symlinkSync(join(cwd, "target"), join(cwd, "folder"));
    git(cwd, "add", "folder");
    git(cwd, "commit", "-qm", "tracked link");
    unlinkSync(join(cwd, "folder"));
    mkdirSync(join(cwd, "folder"));
    writeFileSync(join(cwd, "folder/cache"), "ignored");
    writeFileSync(join(cwd, ".git/info/exclude"), "folder/cache\n");
    writeFileSync(join(cwd, "a"), "edited");
    git(cwd, "rm", "--cached", "folder");
    writeFileSync(join(cwd, "folder/anchor"), "unrelated");
    git(cwd, "add", "folder/anchor");
    failure(cwd, COLLECTOR_ERROR_EXIT, "build", "a");
    expect(existsSync(join(cwd, "target/cache"))).toBe(false);
  });
});

describe("post-commit proof", () => {
  function hookRewrite(stage: boolean) {
    const cwd = repo();
    const parent = git(cwd, "rev-parse", "HEAD").trim();
    writeFileSync(join(cwd, "a"), "planned");
    const tree = success(cwd, "build", "--no-export", "a").trimEnd();
    const hook = join(cwd, ".git/hooks/pre-commit");
    git(cwd, "config", "core.hooksPath", ".git/hooks");
    writeFileSync(
      hook,
      `#!/bin/sh\nprintf rewritten > a\n${stage ? "git add -- a\n" : ""}`,
    );
    chmodSync(hook, executable);
    commitOnly(cwd, "a");
    const reason = failure(cwd, proofFailed, "prove", tree, parent, "a");
    return {
      reason,
      tree,
      committed: git(cwd, "rev-parse", "HEAD^{tree}").trim(),
    };
  }

  test("reports both tree IDs when a hook stages its rewrite", () => {
    const { reason, tree, committed } = hookRewrite(true);
    expect(tree).not.toBe(committed);
    expect(reason).toMatch(/tree/i);
    expect(reason).toContain(tree);
    expect(reason).toContain(committed);
  });

  test("detects a worktree-only hook rewrite even when the commit tree matches", () => {
    const { reason, tree, committed } = hookRewrite(false);
    expect(tree).toBe(committed);
    expect(reason).toMatch(/worktree.*a/i);
  });

  test("reports an intervening commit and an index-only mismatch together", () => {
    const cwd = repo();
    const parent = git(cwd, "rev-parse", "HEAD").trim();
    writeFileSync(join(cwd, "a"), "approved");
    const tree = success(cwd, "build", "--no-export", "a").trimEnd();
    commitOnly(cwd, "a");
    git(cwd, "commit", "--allow-empty", "-qm", "second");
    writeFileSync(join(cwd, "a"), "staged");
    git(cwd, "add", "a");
    writeFileSync(join(cwd, "a"), "approved");
    const reason = failure(cwd, proofFailed, "prove", tree, parent, "a");
    expect(reason).toMatch(/parent/i);
    expect(reason).toMatch(/index.*a/i);
  });
});

test("checks and proves each group against its own tree while preserving unrelated staged work", () => {
  const cwd = repo();
  writeFileSync(join(cwd, "other"), "unrelated staged work");
  git(cwd, "add", "other");
  for (const path of ["a", "b"]) {
    writeFileSync(join(cwd, path), `edited ${path}`);
  }
  for (const path of ["a", "b"]) {
    const parent = git(cwd, "rev-parse", "HEAD").trim();
    const before = preserve(cwd, path);
    const { directory, tree } = buildExport(cwd, path);
    try {
      execFileSync(
        "sh",
        [
          "-c",
          'test ! -e other && grep -qx "edited a" a && grep -qx "$1" b',
          "check",
          path === "a" ? "b" : "edited b",
        ],
        { cwd: directory },
      );
    } finally {
      success(cwd, "clean", directory);
    }
    commitOnly(cwd, path);
    expect(success(cwd, "prove", tree, parent, path)).toBe(
      `Tree: ${tree}=${tree}\n`,
    );
    expect(preserve(cwd, path)).toBe(before);
  }
});
