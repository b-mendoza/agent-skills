import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, expect } from "vitest";

export const script = resolve(
  "../skills/committing-scoped-changes/scripts/collect-state.py",
);
export const SUCCESS_EXIT = 0;
export const COLLECTOR_ERROR_EXIT = 2;
const repos: string[] = [];
const START_INDEX = 0;

export function repo(): string {
  const path = mkdtempSync(join(tmpdir(), "scoped-state-"));
  repos.push(path);
  git(path, "init", "-q");
  git(path, "config", "user.name", "Fixture");
  git(path, "config", "user.email", "fixture@example.invalid");
  git(path, "config", "commit.gpgsign", "false");
  writeFileSync(join(path, "a"), "a\n");
  writeFileSync(join(path, "b"), "b\n");
  git(path, "add", ".");
  git(path, "commit", "-qm", "initial");
  return path;
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

export const candidateScript = resolve(script, "../candidate-tree.py");
export const original = "anchor\nremove\nmiddle\nold\nend\n";
export const edited = "start\nanchor\nmiddle\nnew\nend\nlast";

export function hunkRepo() {
  const cwd = repo();
  writeFileSync(join(cwd, "a"), original);
  git(cwd, "commit", "--only", "-qm", "base", "--", "a");
  writeFileSync(join(cwd, "a"), edited);
  return { cwd, base: git(cwd, "rev-parse", "HEAD").trim() };
}

export function scriptOutput(cwd: string, tool: string, ...args: string[]) {
  return execFileSync("python3", ["-I", tool, ...args], {
    cwd,
    encoding: "utf8",
  });
}

export function expectFailure(
  cwd: string,
  tool: string,
  code: number,
  ...args: string[]
) {
  const result = spawnSync("python3", ["-I", tool, ...args], {
    cwd,
    encoding: "utf8",
  });
  expect(result.stdout).toBe("");
  expect(result.status).toBe(code);
  expect(result.stderr).toMatch(/^[^\n]+\n$/);
  return result.stderr;
}

afterEach(() => {
  for (const path of repos.splice(START_INDEX)) {
    rmSync(path, { recursive: true, force: true });
  }
});
