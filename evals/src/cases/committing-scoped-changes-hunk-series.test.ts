import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  candidateScript,
  git,
  scriptOutput,
} from "#/cases/committing-scoped-changes-test-support.ts";
import { getCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const skill = "committing-scoped-changes";
const selected = () => getCase(`${skill}/hunk-series`);
const length = 40;
const base = "a".repeat(length);
const first = "b".repeat(length);
const second = "c".repeat(length);
const logPath = ".git/hunk-series";
const intermediate = "timeout=60\nseparator\ncolor=blue\n";
const edited = intermediate.replace("blue", "green");
const events = `${first}\na.txt\n${intermediate}${edited}${second}\na.txt\n${edited}${edited}`;
const preview =
  "a.txt#1 @@ -1 +1 @@ -timeout=30\na.txt#2 @@ -3 +3 @@ -color=blue\nReply approve, revise: changes, or stop.";
function agent(content: string) {
  return {
    name: "Agent",
    input: {},
    result: { content, isError: false, truncated: false },
  };
}
function group(number: string, token: string) {
  return `Group: ${number}\nMessage: update setting\nPaths: a.txt\nHunks: ${base} ${token}\nExpansions: none\nVerification: none\nDigest: ${base}`;
}
const plan = `COMMIT_PLAN: PASS\n${group("1", "a.txt#1")}\n${group("2", "a.txt#2+1")}\nChecks: worktree\nOmissions: none\nWarnings: no configured check`;
function receipt(tree: string) {
  return `COMMIT_EXECUTE: PASS\nCommit: abcdef0 update setting\nPaths: a.txt\nPreserved: ${base}=${base}\nTree: ${tree}=${tree}\nVerification: none\nVerification exit: not-run\nVerification evidence: not run\nVerification scope: shared worktree; not an isolated commit tree`;
}
function observation(
  envelope = plan,
  evidence = events,
  receipts = [receipt(first), receipt(second)],
) {
  const head = { kind: "head", oid: base } as const;
  const initial = createTurn({
    finalText: preview,
    gitHeadBefore: head,
    gitHeadAfter: head,
    toolCalls: [{ name: "Skill", input: { skill } }, agent(envelope)],
  });
  const approval = createTurn({
    prompt: "approve",
    toolCalls: receipts.map(agent),
  });
  return createObservation({
    turns: [initial, approval],
    toolCalls: [...initial.toolCalls, ...approval.toolCalls],
    repoFiles: { [logPath]: evidence },
  });
}

test("approves only the split plan and grades both hunk commits", () => {
  const [gate] = selected().followUps ?? [];
  expect(gate?.reply(observation())).toEqual({ reply: "approve" });
  expect(() => selected().check(observation())).not.toThrow();
  expect(
    gate?.reply(observation(plan.replace(`${base} a.txt#2+1`, "none"))),
  ).toHaveProperty("gateNotReached");
});

test.each([
  [events.replace(intermediate, edited), "whole-file first commit"],
  [
    events.replace(edited, intermediate),
    "remaining hunk missing from worktree",
  ],
])("rejects bad repository evidence: %s (%s)", (invalid) => {
  expect(() => selected().check(observation(plan, invalid))).toThrow(
    /commit evidence/,
  );
});

test.each([
  [receipt(first).replace(`=${first}`, `=${second}`), receipt(second)],
  [receipt(first), receipt(first)],
])("requires matching tree proof for each commit", (a, b) => {
  expect(() => selected().check(observation(plan, events, [a, b]))).toThrow();
});

test("the seeded hook samples the committed blob and the real worktree at each commit", () => {
  const scenario = selected();
  const fixture = makeFixture(scenario.fixture, [skill], scenario.seed);
  try {
    const parent = git(fixture.cwd, "rev-parse", "HEAD").trim();
    const trees = ["a.txt#1", "a.txt#2+1"].map((token) => {
      const args = ["a.txt", "--hunks", parent, token];
      const tree = scriptOutput(
        fixture.cwd,
        candidateScript,
        "build",
        "--no-export",
        ...args,
      ).trim();
      scriptOutput(
        fixture.cwd,
        candidateScript,
        "commit",
        tree,
        "change setting",
        ...args,
      );
      return tree;
    });
    const [a, b] = trees;
    expect(readFileSync(join(fixture.cwd, logPath), "utf8")).toBe(
      `${a}\na.txt\n${intermediate}${edited}${b}\na.txt\n${edited}${edited}`,
    );
  } finally {
    fixture.cleanup();
  }
});
