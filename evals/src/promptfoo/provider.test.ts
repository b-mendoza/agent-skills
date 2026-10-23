import { existsSync } from "node:fs";

import type { CallApiContextParams } from "promptfoo";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  FULL_REPORT_SNAPSHOT,
  observe,
  VALIDATOR_CALL,
} from "#/cases/case-test-support.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

import { evalModel } from "../../promptfooconfig.ts";
import { grade } from "./assertion.ts";
import EvalProvider from "./provider.ts";

vi.mock(import("#/observation/agent-query.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  observeClaude: vi.fn(),
}));
vi.mock(import("#/observation/judge.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  judgeLive: vi.fn(),
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
  vi.mocked(judgeLive)
    .mockReset()
    .mockResolvedValue({ citedViolations: [], uncitedComplaints: [] });
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

  test.each([
    { toolCalls: [skillCall], pass: true, reason: "Skill invoked" },
    { toolCalls: [], pass: false, reason: "skill never triggered" },
  ])("grades a budget stop with toolCalls=$toolCalls", async (scenario) => {
    observation.toolCalls = scenario.toolCalls;
    const result = await new EvalProvider().callApi("", context);
    expect(result.error).toBeUndefined();
    const graded = await grade(result.output, {
      vars: context.vars,
      metadata: result.metadata,
    });
    expect(graded.pass).toBe(scenario.pass);
    expect(graded.reason).toContain(scenario.reason);
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

describe("eval assertion", () => {
  test("fails closed on missing observation metadata", async () => {
    await expect(grade("", { vars: context.vars })).rejects.toThrow();
  });

  test("runs the real snapshot check before its judge through the provider", async () => {
    const snapshotContext = { ...context, vars: { caseId: "snapshot-dirty" } };
    observation = observe({
      finalText: "bad",
      toolCalls: [VALIDATOR_CALL],
    });
    const invalid = await new EvalProvider().callApi("", snapshotContext);
    expect(
      await grade(invalid.output, {
        vars: snapshotContext.vars,
        metadata: invalid.metadata,
      }),
    ).toMatchObject({ pass: false });
    expect(judgeLive).not.toHaveBeenCalled();

    observation.finalText = FULL_REPORT_SNAPSHOT;
    const result = await new EvalProvider().callApi("", snapshotContext);
    expect(result.error).toBeUndefined();
    expect(vi.mocked(observeClaude).mock.lastCall).toEqual([
      expect.objectContaining({
        budgetUsd: 2,
        wallClockMs: 600_000,
        prompt:
          "Use the analyzing-recent-project-state skill to report what changed recently and whether this repo is ready to hand off.",
      }),
    ]);
    expect(
      await grade(result.output, {
        vars: snapshotContext.vars,
        metadata: result.metadata,
      }),
    ).toMatchObject({ pass: true, score: 1 });
    expect(judgeLive).toHaveBeenCalledWith(
      expect.objectContaining({ artifact: FULL_REPORT_SNAPSHOT }),
    );
    expect(existsSync(fixturePath)).toBe(false);

    vi.mocked(judgeLive).mockRejectedValue(new Error("judge unavailable"));
    expect(
      await grade(result.output, {
        vars: snapshotContext.vars,
        metadata: result.metadata,
      }),
    ).toEqual({ pass: false, score: 0, reason: "judge unavailable" });
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
