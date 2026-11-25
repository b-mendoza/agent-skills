import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { expect, test } from "vitest";

import { git, script } from "#/cases/committing-scoped-changes-test-support.ts";
import { getCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const skill = "committing-scoped-changes";
const id = `${skill}/candidate-series`;
const hashLength = 40;
const first = "a".repeat(hashLength);
const second = "b".repeat(hashLength);
const plan =
  "Message: fix: update greeting\nPaths: a.txt\nVerification: sh check.sh\nMessage: docs: update guide\nPaths: guide.txt\nVerification: sh check.sh\nEach group runs on its own candidate tree. Reply approve, revise: changes, or stop.";
const events = `check goodbye old\ncommit ${first} fix: update greeting a.txt\ncheck goodbye new\ncommit ${second} docs: update guide guide.txt\n`;
function receipt(tree: string, path: string, message: string) {
  return `COMMIT_EXECUTE: PASS\nCommit: abcdef1 ${message}\nPaths: ${path}\nPreserved: ${first}=${first}\nTree: ${tree}=${tree}\nVerification: sh check.sh\nVerification exit: 0\nVerification evidence: greeting and guide passed\nVerification scope: candidate tree ${tree}; ignored files linked from the worktree`;
}
const secondReceipt = receipt(second, "guide.txt", "docs: update guide");
function observation(last = secondReceipt, log = events, checks = "candidate") {
  const initial = createTurn({
    finalText: plan,
    toolCalls: [
      { name: "Skill", input: { skill } },
      {
        name: "Agent",
        input: {},
        result: {
          content: `COMMIT_PLAN: PASS\nGroup: 1\nMessage: fix: update greeting\nPaths: a.txt\nHunks: none\nExpansions: none\nVerification: sh check.sh\nDigest: ${first}\nGroup: 2\nMessage: docs: update guide\nPaths: guide.txt\nHunks: none\nExpansions: none\nVerification: sh check.sh\nDigest: ${second}\nChecks: ${checks}\nOmissions: none\nWarnings: none`,
          truncated: false,
          isError: false,
        },
      },
    ],
  });
  const approved = createTurn({
    prompt: "approve",
    toolCalls: [receipt(first, "a.txt", "fix: update greeting"), last].map(
      (content) => ({
        name: "Agent",
        input: {},
        result: { content, isError: false, truncated: false },
      }),
    ),
  });
  return createObservation({
    turns: [initial, approved],
    toolCalls: [...initial.toolCalls, ...approved.toolCalls],
    repoFiles: { ".candidate-evidence/events": log },
  });
}

test("grades two separately checked candidate trees against the committed trees", () => {
  const selected = getCase(id);
  expect(() => selected.check(observation())).not.toThrow();
});

test.each([
  secondReceipt.replace(
    `candidate tree ${second}; ignored files linked from the worktree`,
    "shared worktree; not an isolated commit tree",
  ),
  secondReceipt
    .replace("sh check.sh", "same as group 1")
    .replace("exit: 0", "exit: reused"),
  secondReceipt.replace(`=${second}`, `=${first}`),
])(
  "rejects a receipt without a fresh matching candidate check: %s",
  (invalid) => {
    expect(() => getCase(id).check(observation(invalid))).toThrow(/receipt/i);
  },
);

test("rejects reuse even when both receipts claim a fresh check", () => {
  expect(() =>
    getCase(id).check(
      observation(secondReceipt, events.replace("check goodbye new\n", "")),
    ),
  ).toThrow(/check/i);
});

test("withholds approval for a shared-worktree plan", () => {
  const [gate] = getCase(id).followUps ?? [];
  expect(
    gate?.reply(observation(undefined, undefined, "worktree")),
  ).toHaveProperty("gateNotReached");
});

test("the fixture records each real candidate check before its matching commit", () => {
  const selected = getCase(id);
  const fixture = makeFixture(selected.fixture, [skill], selected.seed);
  const { cwd } = fixture;
  const candidate = (...args: string[]) =>
    execFileSync(
      "python3",
      ["-I", join(dirname(script), "candidate-tree.py"), ...args],
      { cwd, encoding: "utf8" },
    ).trimEnd();
  const trees: string[] = [];
  try {
    for (const [path, message] of [
      ["a.txt", "fix: update greeting"],
      ["guide.txt", "docs: update guide"],
    ] as const) {
      const result = candidate("build", path);
      const separator = result.indexOf(" ");
      const dir = result.slice(separator).trimStart();
      try {
        execFileSync("sh", ["check.sh"], { cwd: dir });
      } finally {
        candidate("clean", dir);
      }
      git(
        cwd,
        "--literal-pathspecs",
        "commit",
        "--only",
        "-qm",
        message,
        "--",
        path,
      );
      trees.push(git(cwd, "rev-parse", "HEAD^{tree}").trim());
    }
    const [firstTree, secondTree] = trees;
    expect(readFileSync(join(cwd, ".candidate-evidence/events"), "utf8")).toBe(
      `check goodbye old\ncommit ${firstTree} fix: update greeting a.txt\ncheck goodbye new\ncommit ${secondTree} docs: update guide guide.txt\n`,
    );
  } finally {
    fixture.cleanup();
  }
});
