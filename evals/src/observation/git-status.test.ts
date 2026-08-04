// Pins how a `git status` sample is classified.
//
// The mutation-scope guarantee rests entirely on this: "the worktree is clean"
// and "the sample failed" were once the same empty string, so two failed
// samples compared equal and the read-only assertion passed on evidence that
// was never collected. These run offline against local `git`.
//
//   pnpm test

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { afterEach, expect, test, vi } from "vitest";

import type { GitStatus } from "#/observation/git-status.ts";
import {
  describeGitStatus,
  GitSampler,
  GitSamplerLive,
} from "#/observation/git-status.ts";

const forcedGitStatusFailures = vi.hoisted((): unknown[] => []);

vi.mock(import("node:child_process"), async (importOriginal) => {
  const real = await importOriginal();
  // Gated on the intercepted argv so a forced failure can only stand in for the
  // `git status` sample under test. Without the gate the repository fixtures'
  // own `git init`/`git add` calls would consume the queued failure instead.
  const isGitStatusSample = (argumentList: readonly unknown[]): boolean => {
    const [executable, commandArguments] = argumentList;
    if (executable !== "git" || !Array.isArray(commandArguments)) return false;
    const [subcommand] = commandArguments as readonly unknown[];
    return subcommand === "status";
  };
  const passthroughExecFileSync = new Proxy(real.execFileSync, {
    apply: (
      target,
      thisArgument: unknown,
      argumentList: readonly unknown[],
    ) => {
      if (isGitStatusSample(argumentList)) {
        const forcedFailure = forcedGitStatusFailures.shift();
        if (forcedFailure !== undefined) {
          throw forcedFailure;
        }
      }
      const output: unknown = Reflect.apply(target, thisArgument, argumentList);
      return output;
    },
  });
  return { ...real, execFileSync: passthroughExecFileSync };
});

/** Makes the next `git status` sample fail with `failure`. */
function forceNextStatusFailure(failure: unknown): void {
  forcedGitStatusFailures.push(failure);
}

const tempDirectories: string[] = [];
const realPath = process.env["PATH"];

afterEach(() => {
  if (realPath === undefined) {
    delete process.env["PATH"];
  } else {
    process.env["PATH"] = realPath;
  }
  forcedGitStatusFailures.length = 0;
  for (const tempDirectory of tempDirectories.splice(0)) {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

async function sampleGitStatus(repo: string): Promise<GitStatus> {
  const status = await Effect.runPromise(
    Effect.gen(function* () {
      const gitSampler = yield* GitSampler;
      return yield* gitSampler.sample(repo);
    }).pipe(Effect.provide(GitSamplerLive)),
  );
  return status;
}

function createTempDirectory(): string {
  const tempDirectory = mkdtempSync(join(tmpdir(), "git-status-"));
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

function createRepository(): string {
  const repositoryDirectory = createTempDirectory();
  execFileSync("git", ["init", "-q"], {
    cwd: repositoryDirectory,
    stdio: "ignore",
  });
  return repositoryDirectory;
}

test("a clean worktree reports its empty entry list", async () => {
  await expect(sampleGitStatus(createRepository())).resolves.toStrictEqual({
    kind: "worktree",
    entries: "",
  });
});

test("a dirty worktree reports its entries", async () => {
  const repositoryDirectory = createRepository();
  writeFileSync(join(repositoryDirectory, "a.txt"), "hello\n");

  await expect(sampleGitStatus(repositoryDirectory)).resolves.toStrictEqual({
    kind: "worktree",
    entries: "?? a.txt",
  });
});

test("a directory that is not a repo is a known state, not a failure", async () => {
  // This is the `not-git` fixture. It must stay distinct from a failed sample
  // or that fixture's cases would start failing.
  await expect(sampleGitStatus(createTempDirectory())).resolves.toStrictEqual({
    kind: "no-worktree",
  });
});

test("a corrupt index is unreadable rather than clean", async () => {
  // Exit 128 is git's generic fatal code, so this returns the same status as
  // "not a repository". Only the message separates them -- classifying by
  // exit code alone would file a corrupt repo as an expected empty state.
  const repositoryDirectory = createRepository();
  writeFileSync(join(repositoryDirectory, "f.txt"), "x");
  execFileSync("git", ["add", "f.txt"], {
    cwd: repositoryDirectory,
    stdio: "ignore",
  });
  writeFileSync(join(repositoryDirectory, ".git", "index"), "garbage");

  const status = await sampleGitStatus(repositoryDirectory);

  expect(status.kind).toBe("unreadable");
  if (status.kind !== "unreadable") {
    throw new Error("expected an unreadable git status");
  }
  expect(status.reason).not.toBe("");
});

// Both origins surface as the same ENOENT: the directory git was pointed at is
// gone, or git itself is not on PATH. Neither may read as a clean worktree.
test.each([
  {
    name: "a missing directory",
    locateRepository: (): string =>
      join(tmpdir(), "definitely-does-not-exist-xyz"),
  },
  {
    name: "a missing git binary",
    locateRepository: (): string => {
      const repositoryDirectory = createRepository();
      process.env["PATH"] = createTempDirectory();
      return repositoryDirectory;
    },
  },
])("$name is unreadable, not clean", async ({ locateRepository }) => {
  await expect(sampleGitStatus(locateRepository())).resolves.toStrictEqual({
    kind: "unreadable",
    reason: "ENOENT",
  });
});

test("a fatal message merely containing the phrase stays unreadable", async () => {
  // `no-worktree` is a known repository state, claimed only by git's own fatal
  // line. A corrupt-object failure whose path happens to carry the phrase must
  // not be promoted into that expected state and read as clean.
  const stderr = "fatal: bad object HEAD in /tmp/not a git repository/x";
  forceNextStatusFailure({ status: 128, stderr });

  await expect(sampleGitStatus(tmpdir())).resolves.toStrictEqual({
    kind: "unreadable",
    reason: stderr,
  });
});

test.each(["not a number", NaN])(
  "a malformed subprocess status preserves sibling diagnostics: %s",
  async (status) => {
    forceNextStatusFailure({
      status,
      stderr: "projected stderr survives\nsecondary detail",
      code: "IGNORED",
      message: "ignored message",
    });

    await expect(sampleGitStatus(tmpdir())).resolves.toStrictEqual({
      kind: "unreadable",
      reason: "projected stderr survives",
    });
  },
);

test("a non-object subprocess error falls back to its rendered value", async () => {
  forceNextStatusFailure(["foreign", "error"]);

  await expect(sampleGitStatus(tmpdir())).resolves.toStrictEqual({
    kind: "unreadable",
    reason: '["foreign","error"]',
  });
});

// A failure message that cannot tell these apart sends the reader hunting for
// a mutation that never happened.
test.each([
  [
    "a clean worktree renders as quoted empty entries",
    { kind: "worktree", entries: "" },
    '""',
  ],
  [
    "a non-worktree renders as an expected repository state",
    { kind: "no-worktree" },
    "(not a worktree)",
  ],
  [
    "an unreadable sample renders its diagnostic",
    { kind: "unreadable", reason: "ENOENT" },
    "(unreadable: ENOENT)",
  ],
] satisfies ReadonlyArray<readonly [string, GitStatus, string]>)(
  "%s",
  (_caseName, status, expectedText) => {
    expect(describeGitStatus(status)).toBe(expectedText);
  },
);
