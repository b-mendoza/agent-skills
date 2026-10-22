import { existsSync } from "node:fs";

import type { CallApiContextParams } from "promptfoo";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { observe } from "#/cases/case-test-support.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { evalModel } from "#/orchestration/configuration.ts";

import EvalProvider from "./provider.ts";

vi.mock(import("#/observation/agent-query.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  observeClaude: vi.fn(),
}));
const FIRST_REPEAT = 0;
const SECOND_REPEAT = 1;
const REPEATS = [FIRST_REPEAT, SECOND_REPEAT];
const TWO_FIXTURES = 2;
const BUDGET_COST = 0.06;
const skillCall = {
  name: "Skill",
  input: { skill: "analyzing-recent-project-state" },
};
const context: CallApiContextParams = {
  vars: { caseId: "trigger-positive" },
  prompt: { raw: "{{caseId}}", label: "pilot" },
};

let observation = observe();
let fixturePath = "";

beforeEach(() => {
  observation = observe({
    subtype: "error_max_budget_usd",
    isError: true,
    finalText: "budget reached",
    costUsd: BUDGET_COST,
    toolCalls: [skillCall],
  });
  fixturePath = "";
  vi.mocked(observeClaude)
    .mockReset()
    .mockImplementation(async (options) => {
      fixturePath = options.cwd;
      return Promise.resolve(observation);
    });
});

describe("eval provider", () => {
  test("runs the canonical prompt with the harness limits and cleans up", async () => {
    const result = await new EvalProvider().callApi("ignored", context);
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("budget reached");
    expect(result.cost).toBeCloseTo(BUDGET_COST);
    expect(vi.mocked(observeClaude).mock.lastCall).toEqual([
      expect.objectContaining({
        cwd: fixturePath,
        gitRepo: fixturePath,
        prompt:
          "What changed recently in this repo and is it ready to hand off?",
        budgetUsd: 0.05,
        model: evalModel,
        wallClockMs: 180_000,
      }),
    ]);
    expect(fixturePath).not.toBe("");
    expect(existsSync(fixturePath)).toBe(false);
  });

  test("cleans up after the runner throws", async () => {
    vi.mocked(observeClaude).mockImplementationOnce(async (options) => {
      fixturePath = options.cwd;
      return Promise.reject(new Error("SDK failed"));
    });
    expect(await new EvalProvider().callApi("", context)).toMatchObject({
      error: "SDK failed",
    });
    expect(fixturePath).not.toBe("");
    expect(existsSync(fixturePath)).toBe(false);
  });

  test("rejects an unknown case before starting the runner", async () => {
    const result = await new EvalProvider().callApi("", {
      ...context,
      vars: { caseId: "unknown" },
    });
    expect(result.error).toContain("Unknown caseId");
    expect(observeClaude).not.toHaveBeenCalled();
  });
});

test("records repeat indexes and isolates concurrent fixtures", async () => {
  const paths: string[] = [];
  vi.mocked(observeClaude).mockImplementation(async (options) => {
    paths.push(options.cwd);
    return Promise.resolve(observation);
  });
  const results = await Promise.all(
    REPEATS.map(async (repeatIndex) =>
      new EvalProvider().callApi("", { ...context, repeatIndex }),
    ),
  );
  expect(new Set(paths).size).toBe(TWO_FIXTURES);
  expect(paths.every((path) => !existsSync(path))).toBe(true);
  expect(
    results.map((result) => Number(result.metadata?.["repeatIndex"])),
  ).toEqual(REPEATS);
});
