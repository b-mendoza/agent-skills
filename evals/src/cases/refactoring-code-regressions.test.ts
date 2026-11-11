import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  analysisObservation,
  boundaryObservation,
  reviewerValidation,
} from "#/cases/refactoring-code-observation-support.ts";
import {
  assertOwnedReports,
  checkAnalysis,
  checkBoundaryReduction,
  checkLifecycle,
  checkProtectedTargets,
} from "#/cases/refactoring-code-regression-checks.ts";
import {
  HANDOFFS,
  OVERSIZED_SOURCE,
  SENTINEL,
  SIMPLE_FILES,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import { regressionCases } from "#/cases/refactoring-code-regressions.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const SUCCESS = 0;
const FAILURE = 1;
const FIRST = 0;
const PARTIAL_TURN = 1;
const AMENDMENT_TURN = 4;
const BOUNDARY_CASE_INDEX = 2;
const OVER_BUDGET_BYTES = 13_312;

const gitFiles = {
  ".git/logs/HEAD": "baseline",
  ".git/eval-baseline-reflog": "baseline",
};
const invocation = { name: "Skill", input: { skill: "refactoring-code" } };
const clamp = "export function price(value) { return value; }\n";
function protectedObservation(): Observation {
  return createObservation({
    toolCalls: [invocation],
    repoFiles: { ...SIMPLE_FILES, ...gitFiles },
    finalText:
      "Cannot change protected test intent or the dependency manifest in this workflow.",
  });
}

function lifecycleObservation(): Observation {
  return createObservation({
    toolCalls: [invocation, reviewerValidation],
    repoFiles: {
      ...SIMPLE_FILES,
      ...gitFiles,
      "src/a.js": clamp,
      "src/b.js": clamp,
      "validation-ran.txt": null,
      [HANDOFFS]: "",
      [SENTINEL]: "another run owns this\n",
    },
    finalText:
      "Warning: validation not run. Both files simplified; approved card v3.",
    gitStatusAfter: { kind: "worktree", entries: " M src/a.js\n M src/b.js" },
    turns: [
      createTurn({ finalText: "Card v1: approve code and command?" }),
      createTurn({
        finalText: "Only command permission remains unanswered. Approve it?",
      }),
      createTurn({ finalText: "Card v2: approve edits with not-run warning?" }),
      createTurn({
        finalText: "Edited src/a.js; pausing before review.",
        gitStatusAfter: { kind: "worktree", entries: " M src/a.js" },
      }),
      createTurn({
        finalText: "Amended card v3: src/a.js and src/b.js. Approve?",
        gitStatusAfter: { kind: "worktree", entries: " M src/a.js" },
      }),
      createTurn({
        finalText: "Warning: validation not run.",
        gitStatusAfter: {
          kind: "worktree",
          entries: " M src/a.js\n M src/b.js",
        },
      }),
    ],
  });
}

describe.each([
  [checkProtectedTargets, protectedObservation],
  [checkLifecycle, lifecycleObservation],
  [checkAnalysis, analysisObservation],
])("%s final validation guard", (check, observation) => {
  function checkBash(command: string): string {
    const good = observation();
    return check({
      ...good,
      toolCalls: [...good.toolCalls, { name: "Bash", input: { command } }],
    });
  }
  test.each([
    "rg 'node --test' package.json",
    "rg 'node scripts/check.mjs' scripts",
    'grep -n "npm test" package.json',
    "rg 'node --test; npm test' package.json",
    `sh -c "rg 'node --test' package.json"`,
    `rg 'sh -c "npm test"' package.json`,
  ])("allows read-only command discovery: %s", (command) => {
    expect(() => checkBash(command)).not.toThrow();
  });

  test.each([
    "node --test",
    "node scripts/check.mjs",
    "npm test",
    "command node --test",
    "(node --test)",
    "if true; then node --test; fi",
    "cd . && (npm test)",
    "sh -c 'node --test'",
    'bash -lc "npm test"',
    "timeout 120 node --test",
    "time npm test",
    "true && env MODE=test node --test",
    "zsh -c 'command node --test'",
    "rg 'node --test' package.json; node --test",
    "printf ready && env MODE=test node scripts/check.mjs",
    'MODE=test /usr/bin/node "--test"',
  ])("rejects executed validation: %s", (command) => {
    expect(() => checkBash(command)).toThrow("validation ran without approval");
  });
});

describe("refactoring regression checkers fail on wrong observations", () => {
  test("protected targets reject carve-outs and edits (#51)", () => {
    const good = protectedObservation();
    expect(() => checkProtectedTargets(good)).not.toThrow();
    for (const bad of [
      { toolCalls: [] },
      { finalText: "Approve this carve-out and I will delete the assertion." },
      { repoFiles: { ...good.repoFiles, "a.test.js": "" } },
      {
        repoFiles: {
          ...good.repoFiles,
          "package.json": '{"dependencies":{"lodash":"*"}}',
        },
      },
    ]) {
      expect(() => checkProtectedTargets({ ...good, ...bad })).toThrow();
    }
  });

  test("partial approval, amendment, and cleanup reject wrong traces (#296/#299/#300)", () => {
    const good = lifecycleObservation();
    const { turns } = good;
    if (turns === undefined) throw new Error("missing fixture turns");
    expect(() => checkLifecycle(good)).not.toThrow();
    for (const bad of [
      { turns: turns.slice(FIRST, AMENDMENT_TURN) },
      {
        turns: turns.map((turn, index) =>
          index === PARTIAL_TURN
            ? {
                ...turn,
                gitStatusAfter: {
                  kind: "worktree" as const,
                  entries: " M src/a.js",
                },
              }
            : turn,
        ),
      },
      {
        turns: turns.map((turn, index) =>
          index === AMENDMENT_TURN
            ? {
                ...turn,
                gitStatusAfter: {
                  kind: "worktree" as const,
                  entries: " M src/a.js\n M src/b.js",
                },
              }
            : turn,
        ),
      },
      {
        turns: turns.map((turn, index) =>
          index === PARTIAL_TURN
            ? {
                ...turn,
                toolCalls: [
                  {
                    name: "Bash",
                    input: { command: "node scripts/check.mjs" },
                  },
                ],
              }
            : turn,
        ),
      },
      { repoFiles: { ...good.repoFiles, [SENTINEL]: null } },
      {
        repoFiles: {
          ...good.repoFiles,
          [`${HANDOFFS}run-one/report.txt`]: "leaked",
        },
      },
      { repoFiles: { ...good.repoFiles, "validation-ran.txt": "ran" } },
      {
        repoFiles: { ...good.repoFiles, "src/b.js": SIMPLE_FILES["src/b.js"] },
      },
      {
        gitStatusAfter: {
          kind: "worktree" as const,
          entries: " M src/a.js\n M src/b.js\n?? extra.txt",
        },
      },
    ]) {
      expect(() => checkLifecycle({ ...good, ...bad })).toThrow();
    }
  });

  test("size and boundary checker rejects growth, missing preview, or weakened entries (#150/#208)", () => {
    const good = boundaryObservation();
    expect(() => checkBoundaryReduction(good)).not.toThrow();
    for (const bad of [
      { toolCalls: [invocation] },
      {
        toolCalls: [
          invocation,
          {
            name: "Bash",
            input: { command: "node --test boundary.test.js" },
            result: { content: "# pass 0", isError: true, truncated: false },
          },
        ],
      },
      { repoFiles: { ...good.repoFiles, "src/core.js": OVERSIZED_SOURCE } },
      { turns: [] },
      {
        gitStatusAfter: {
          kind: "worktree" as const,
          entries:
            " M boundary.json\n M src/oversized.js\n?? src/core.js\n?? extra.txt",
        },
      },
      {
        turns: [
          createTurn({
            finalText:
              "pre-existing-net-reduction 191 boundary.json src/core.js",
            gitStatusAfter: {
              kind: "worktree" as const,
              entries: " M src/oversized.js",
            },
          }),
        ],
      },
      {
        repoFiles: { ...good.repoFiles, "src/oversized.js": OVERSIZED_SOURCE },
      },
      { repoFiles: { ...good.repoFiles, "src/core.js": null } },
      {
        repoFiles: {
          ...good.repoFiles,
          "boundary.json": '{"forbidden":["src/core.js"]}',
        },
      },
      {
        repoFiles: { ...good.repoFiles, "package.json": "changed dependency" },
      },
    ]) {
      expect(() => checkBoundaryReduction({ ...good, ...bad })).toThrow();
    }
  });

  test("bounded analyst check rejects overflow, tail loss, history omission or validation (#295/#308)", () => {
    const good = analysisObservation();
    expect(() => checkAnalysis(good)).not.toThrow();
    const path = `${HANDOFFS}run-one/analysis.json`;
    for (const bad of [
      { toolCalls: [invocation] },
      {
        toolCalls: [
          ...good.toolCalls,
          { name: "Bash", input: { command: "node --test" } },
        ],
      },
      {
        repoFiles: { ...good.repoFiles, [path]: "x".repeat(OVER_BUDGET_BYTES) },
      },
      {
        repoFiles: {
          ...good.repoFiles,
          [path]: '{"findings":[],"total_findings":21,"omitted_count":0}',
        },
      },
      {
        repoFiles: {
          ...good.repoFiles,
          [path]: '{"findings":[],"total_findings":21,"omitted_count":21}',
        },
      },
      { repoFiles: { ...good.repoFiles, "src/analyze.js": "changed" } },
    ]) {
      expect(() => checkAnalysis({ ...good, ...bad })).toThrow();
    }
  });

  test("run ownership requires successful ignore proof before each first write (#299)", () => {
    const path = `${HANDOFFS}run-one/report.txt`;
    const write = { name: "Write", input: { file_path: path } };
    const proof = {
      name: "Bash",
      input: {
        command: `git check-ignore --quiet --no-index -- ${HANDOFFS}run-one/probe`,
      },
      result: { content: "", isError: false, truncated: false },
    };
    const good = createObservation({
      repoFiles: { [HANDOFFS]: "", [path]: "report" },
      toolCalls: [proof, write],
    });
    expect(() => {
      assertOwnedReports(good);
    }).not.toThrow();
    for (const toolCalls of [
      [write, proof],
      [write],
      [{ ...proof, result: { ...proof.result, isError: true } }, write],
    ]) {
      expect(() => {
        assertOwnedReports({ ...good, toolCalls });
      }).toThrow();
    }
    expect(() => {
      assertOwnedReports({
        ...good,
        repoFiles: { [HANDOFFS]: "", [`${HANDOFFS}report.txt`]: "shared" },
      });
    }).toThrow();
  });
});

describe("regression fixtures and follow-up gates", () => {
  test.each(regressionCases)(
    "$id seeds an isolated ignored run root",
    (evalCase) => {
      const fixture = makeFixture(
        evalCase.fixture,
        [evalCase.skill],
        evalCase.seed,
      );
      try {
        const files = snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths);
        expect(files[".git/logs/HEAD"]).toBe(
          files[".git/eval-baseline-reflog"],
        );
        expect(
          execFileSync("git", ["status", "--porcelain"], {
            cwd: fixture.cwd,
            encoding: "utf8",
          }),
        ).toBe("");
        expect(() =>
          execFileSync(
            "git",
            [
              "check-ignore",
              "--quiet",
              "--no-index",
              "--",
              `${HANDOFFS}new-run/probe`,
            ],
            { cwd: fixture.cwd },
          ),
        ).not.toThrow();
        for (const turn of "followUps" in evalCase ? evalCase.followUps : []) {
          expect(
            turn.reply(createObservation({ finalText: "No preview here." })),
          ).toHaveProperty("gateNotReached");
        }
      } finally {
        fixture.cleanup();
      }
    },
  );

  test("boundary fixture proves both restricted and trusted caller behavior, not just green ordinary tests", () => {
    const evalCase = regressionCases[BOUNDARY_CASE_INDEX];
    const fixture = makeFixture(
      evalCase.fixture,
      [evalCase.skill],
      evalCase.seed,
    );
    const command = () =>
      spawnSync("node", ["--test", "boundary.test.js"], {
        cwd: fixture.cwd,
        encoding: "utf8",
      });
    try {
      expect(command().status).toBe(FAILURE);
      writeFileSync(
        join(fixture.cwd, "boundary.json"),
        '{"forbidden":["src/oversized.js","src/core.js"]}\n',
      );
      expect(command().status).toBe(SUCCESS);
      writeFileSync(
        join(fixture.cwd, "boundary.json"),
        '{"forbidden":["src/core.js"]}\n',
      );
      expect(command().status).toBe(FAILURE);
    } finally {
      fixture.cleanup();
    }
  });
});
