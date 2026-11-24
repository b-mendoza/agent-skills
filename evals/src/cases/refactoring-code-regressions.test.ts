import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  analysisObservation,
  boundaryObservation,
  invocation,
  protectedObservation,
} from "#/cases/refactoring-code-observation-support.ts";
import {
  assertOwnedReports,
  checkAnalysis,
  checkBoundaryReduction,
  checkProtectedTargets,
} from "#/cases/refactoring-code-regression-checks.ts";
import {
  HANDOFFS,
  OVERSIZED_SOURCE,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import { regressionCases } from "#/cases/refactoring-code-regressions.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const SUCCESS = 0;
const FAILURE = 1;
const BOUNDARY_CASE_INDEX = 2;
const OVER_BUDGET_BYTES = 13_312;

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
