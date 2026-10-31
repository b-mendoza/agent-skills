import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import {
  cases,
  REFACTOR_FILES,
  REFACTOR_PLAN_PATH,
} from "#/cases/refactoring-code.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const PLAN = `Diagnosis: duplicated rounding in src/quote.js.
S1: Reuse src/money.js:roundMoney (reuse-repo), preserving member threshold.
Change: src/quote.js. Create: none. Non-goals: no behavior or API change.
Expected net lines: -4; remove duplicate rounding; introduce none.
Validation: node --test quote.test.js; safe. Decisions: no waivers.
Approve, adjust, or decline.`;
const REFLOG = "seeded reflog\n";

function correctObservation(evalCase: EvalCase): Observation {
  return createObservation({
    finalText: evalCase.id.endsWith("/plan-approval")
      ? PLAN
      : "NEEDS_CLARIFICATION\nWhich target file should I simplify?",
    toolCalls: [{ name: "Skill", input: { skill: evalCase.skill } }],
    repoFiles: {
      ...REFACTOR_FILES,
      ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
      [REFACTOR_PLAN_PATH]: PLAN,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
    },
  });
}

const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);
const planCase = cases.find(
  (evalCase) => evalCase.id === "refactoring-code/plan-approval",
);
if (planCase === undefined) throw new Error("missing plan case");

describe("refactoring-code checks", () => {
  test.each(cases)(
    "$id accepts correct output and rejects a non-run",
    (evalCase) => {
      const observation =
        evalCase.tier === BEHAVIORAL_TIER
          ? correctObservation(evalCase)
          : createObservation({
              toolCalls: evalCase.id.endsWith("/trigger-positive")
                ? [{ name: "Skill", input: { skill: evalCase.skill } }]
                : [],
            });
      expect(() => evalCase.check(observation)).not.toThrow();
      expect(() =>
        evalCase.check({ ...observation, timedOut: true }),
      ).toThrow();
      expect(() =>
        evalCase.check({
          ...observation,
          toolCalls: evalCase.id.endsWith("/trigger-negative-strict-rewrite")
            ? [{ name: "Skill", input: { skill: evalCase.skill } }]
            : [],
        }),
      ).toThrow();
    },
  );

  test.each(behavioralCases)(
    "$id rejects missing gate output and mutations",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      for (const wrong of [
        { finalText: "PASS: completed the refactor." },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Edit", input: { file_path: "src/quote.js" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Bash", input: { command: "git commit -am refactor" } },
          ],
        },
        {
          gitStatusAfter: {
            kind: "unreadable" as const,
            reason: "permission denied",
          },
        },
        {
          gitStatusAfter: {
            kind: "worktree" as const,
            entries: "?? leaked.txt",
          },
        },
      ]) {
        expect(() => evalCase.check({ ...observation, ...wrong })).toThrow();
      }
    },
  );

  test.each([
    "node --test quote.test.js",
    "node --trace-warnings --test ./quote.test.js",
    "cd /fixture && node --test quote.test.js",
    "/usr/bin/node --test quote.test.js",
    '"/usr/bin/node" --test quote.test.js',
    "env CI=1 node --require node:assert --test quote.test.js",
    "cat package.json | node --test quote.test.js",
    "cat package.json; node --test quote.test.js",
    "cat package.json\nnode --test quote.test.js",
    'rg "node --test quote.test.js" package.json && node --test quote.test.js',
  ])("plan rejects validation before approval: %s", (command) => {
    const observation = correctObservation(planCase);
    expect(() =>
      planCase.check({
        ...observation,
        toolCalls: [
          ...observation.toolCalls,
          { name: "Bash", input: { command } },
        ],
      }),
    ).toThrow(/validation.*approval/);
  });

  test.each([
    "cat quote.test.js",
    "cat src/quote.js package.json",
    "rg 'node --test quote.test.js' package.json",
    'grep "node --test quote.test.js" package.json',
    "rg 'example; node --test quote.test.js' package.json",
    "node scripts/inspect.js --test",
    "node -- quote.test.js --test",
    "node --require '--test' scripts/inspect.js",
  ])("plan allows read-only inspection: %s", (command) => {
    const observation = correctObservation(planCase);
    expect(() =>
      planCase.check({
        ...observation,
        toolCalls: [
          ...observation.toolCalls,
          { name: "Bash", input: { command } },
        ],
      }),
    ).not.toThrow();
  });

  test("plan allows report writes but rejects unobserved or incorrect artifacts", () => {
    const observation = correctObservation(planCase);
    const allowed = {
      ...observation,
      gitStatusAfter: { kind: "worktree" as const, entries: "?? .handoffs/" },
      toolCalls: [
        ...observation.toolCalls,
        {
          name: "Write",
          input: { file_path: `/fixture/${REFACTOR_PLAN_PATH}` },
        },
      ],
    };
    expect(() => planCase.check(allowed)).not.toThrow();
    for (const repoFiles of [
      {},
      { ...observation.repoFiles, [REFACTOR_PLAN_PATH]: null },
      { ...observation.repoFiles, [REFACTOR_PLAN_PATH]: "Plan: ask approval." },
      { ...observation.repoFiles, ".git/logs/HEAD": "new commit\n" },
      ...Object.keys(REFACTOR_FILES).map((path) => ({
        ...observation.repoFiles,
        [path]: "mutated\n",
      })),
    ]) {
      expect(() => planCase.check({ ...observation, repoFiles })).toThrow();
    }
    for (const filePath of [
      ".handoffs/other/plan.md",
      ".handoffs/refactoring-code/../../escaped.md",
    ]) {
      expect(() =>
        planCase.check({
          ...observation,
          toolCalls: [
            ...observation.toolCalls,
            { name: "Write", input: { file_path: filePath } },
          ],
        }),
      ).toThrow();
    }
  });

  test("missing-target needs both the stop status and question", () => {
    const evalCase = behavioralCases.find((candidate) =>
      candidate.id.endsWith("/missing-target"),
    );
    expect(evalCase).toBeDefined();
    if (evalCase === undefined) throw new Error("missing target guard");
    for (const finalText of ["NEEDS_CLARIFICATION", "Which file?"]) {
      expect(() =>
        evalCase.check({ ...correctObservation(evalCase), finalText }),
      ).toThrow();
    }
  });

  test("seed creates executable behavior coverage and unchanged baseline snapshots", () => {
    const fixture = makeFixture(
      planCase.fixture,
      [planCase.skill],
      planCase.seed,
    );
    try {
      const files = snapshotRepoFiles(fixture.cwd, planCase.snapshotPaths);
      for (const [path, content] of Object.entries(REFACTOR_FILES)) {
        expect(files[path]).toBe(content);
      }
      expect(files[REFACTOR_PLAN_PATH]).toBeNull();
      expect(files[".git/logs/HEAD"]).toBe(files[".git/eval-baseline-reflog"]);
      expect(
        execFileSync("node", ["--test", "quote.test.js"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toMatch(/pass 1/);
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("A  unrelated.txt\n");
    } finally {
      fixture.cleanup();
    }
  });
});

test.each(["/outside", "../outside", "/fixture-other"])(
  "refactor plan rejects foreign-root same-suffix write from %s",
  (root) => {
    const good = correctObservation(planCase);
    expect(() =>
      planCase.check({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
        },
        gitStatusAfter: { kind: "worktree", entries: "?? .handoffs/" },
        toolCalls: [
          ...good.toolCalls,
          {
            name: "Write",
            input: { file_path: `/fixture/${REFACTOR_PLAN_PATH}` },
          },
          {
            name: "Edit",
            input: { file_path: `${root}/${REFACTOR_PLAN_PATH}` },
          },
        ],
      }),
    ).toThrow();
  },
);

test.each(["", "/fixture/", "/canonical/fixture/"])(
  "accepts artifact writes relative to or within fixture root %s",
  (prefix) => {
    const good = correctObservation(planCase);
    expect(() =>
      planCase.check({
        ...good,
        toolCalls: [
          ...good.toolCalls.filter(
            (call) => !["Write", "Edit"].includes(call.name),
          ),
          {
            name: "Write",
            input: { file_path: `${prefix}${REFACTOR_PLAN_PATH}` },
          },
        ],
      }),
    ).not.toThrow();
  },
);
