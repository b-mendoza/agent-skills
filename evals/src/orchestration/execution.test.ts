import fs, { existsSync, readdirSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import * as fixtures from "#/fixtures/fixtures.ts";
import * as observation from "#/observation/agent-query.ts";
import { scripted, success } from "#/observation/observation-test-support.ts";
import { evalModel } from "#/orchestration/configuration.ts";
import {
  executeCase,
  FAILURE_ARTIFACT_DIRECTORY,
} from "#/orchestration/execution.ts";

const sdk = vi.hoisted(() => ({
  query:
    vi.fn<(request: Parameters<typeof query>[0]) => AsyncIterable<unknown>>(),
}));
vi.mock(
  import("@anthropic-ai/claude-agent-sdk"),
  async (original): Promise<Record<string, unknown>> => ({
    ...(await original()),
    query: sdk.query,
  }),
);
const CASE_ID = `execution-${process.pid}`;
const BUDGET = 1.25;
const WALL_CLOCK = 42_000;
const COST = 0.2;
let cwd = "";

function selectedCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: CASE_ID,
    tier: 2,
    fixture: "dirty",
    intent: "execution test",
    prompt: ({ missingPath, notGitPath }) =>
      `missing=${missingPath}; not-git=${notGitPath}`,
    budgetUsd: BUDGET,
    wallClockMs: WALL_CLOCK,
    check: () => "check passed",
    ...overrides,
  };
}

beforeEach(() => {
  cwd = "";
  sdk.query.mockReset().mockImplementation((request) => {
    cwd = request.options?.cwd ?? "";
    return scripted(success("observed", COST));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  if (existsSync(FAILURE_ARTIFACT_DIRECTORY)) {
    for (const name of readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter((file) =>
      file.startsWith(CASE_ID),
    )) {
      rmSync(join(FAILURE_ARTIFACT_DIRECTORY, name));
    }
  }
});

test("real fixture context, skill, model and limits reach the SDK before cleanup", async () => {
  const timer = vi.spyOn(globalThis, "setTimeout");
  sdk.query.mockImplementation((request) => {
    cwd = request.options?.cwd ?? "";
    expect(
      existsSync(
        join(cwd, ".claude/skills/analyzing-recent-project-state/SKILL.md"),
      ),
    ).toBe(true);
    expect(request).toMatchObject({
      options: { model: evalModel, maxBudgetUsd: BUDGET },
    });
    expect(request.prompt).toBe(
      `missing=${join(dirname(cwd), "definitely-does-not-exist")}; not-git=${join(dirname(cwd), "not-a-repo")}`,
    );
    return scripted(success("observed", COST));
  });
  const run = await executeCase(selectedCase());
  expect(run.result).toMatchObject({
    tier: "2",
    status: "PASS",
    costUsd: COST,
  });
  expect(timer).toHaveBeenCalledWith(expect.any(Function), WALL_CLOCK);
  expect(basename(cwd)).toBe("repo");
  expect(run.observation.timedOut).toBe(false);
  expect(existsSync(cwd)).toBe(false);
});

test("a non-git fixture samples cwd when no git repository is declared", async () => {
  const run = await executeCase(selectedCase({ fixture: "not-git" }));
  expect(run.observation.gitStatusBefore).toStrictEqual({
    kind: "no-worktree",
  });
  expect(run.observation.gitStatusAfter).toStrictEqual({ kind: "no-worktree" });
  expect(existsSync(cwd)).toBe(false);
});

test("acquisition failure skips both SDK and cleanup", async () => {
  const error = new Error("fixture root creation broke");
  vi.spyOn(fixtures, "makeFixture").mockImplementationOnce(() => {
    throw error;
  });
  const release = vi.spyOn(fs, "rmSync");
  syncBuiltinESMExports();
  await expect(executeCase(selectedCase())).rejects.toBe(error);
  expect(sdk.query).not.toHaveBeenCalled();
  expect(release).not.toHaveBeenCalled();
});

test("cleanup preserves an unexpected observation defect", async () => {
  const error = new Error("observation defect");
  const fixture = fixtures.makeFixture(
    "clean",
    "analyzing-recent-project-state",
  );
  vi.spyOn(fixtures, "makeFixture").mockReturnValueOnce(fixture);
  vi.spyOn(observation, "observeClaude").mockRejectedValueOnce(error);
  await expect(executeCase(selectedCase())).rejects.toBe(error);
  expect(existsSync(fixture.cwd)).toBe(false);
});

test("prompt failure cleans the acquired fixture without querying", async () => {
  let missing = "";
  const error = new Error("prompt broke");
  await expect(
    executeCase(
      selectedCase({
        prompt: (context) => {
          missing = context.missingPath;
          throw error;
        },
      }),
    ),
  ).rejects.toBe(error);
  expect(existsSync(join(missing, ".."))).toBe(false);
  expect(sdk.query).not.toHaveBeenCalled();
});

test("a failed check becomes row data, keeps measurements, and cleans up", async () => {
  const run = await executeCase(
    selectedCase({
      check: () => {
        throw new Error("check failed\nextra detail");
      },
    }),
  );
  expect(run.result).toMatchObject({
    id: CASE_ID,
    tier: "2",
    status: "FAIL",
    observed: "check failed",
    costUsd: COST,
  });
  expect(run.result.durationMs).toBe(run.observation.durationMs);
  expect(existsSync(cwd)).toBe(false);
});

test.each([false, true])(
  "cleanup failure replaces the earlier result or defect: %s",
  async (defect) => {
    const fixture = fixtures.makeFixture(
      "clean",
      "analyzing-recent-project-state",
    );
    const error = new Error("cleanup broke");
    vi.spyOn(fixtures, "makeFixture").mockReturnValueOnce({
      ...fixture,
      cleanup: () => {
        fixture.cleanup();
        throw error;
      },
    });
    if (defect) {
      vi.spyOn(observation, "observeClaude").mockRejectedValueOnce(
        new Error("observation defect"),
      );
    }
    await expect(executeCase(selectedCase())).rejects.toBe(error);
    expect(existsSync(fixture.cwd)).toBe(false);
  },
);
