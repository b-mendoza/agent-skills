import { expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";

import config from "./promptfooconfig.ts";

vi.mock(import("#/cases/registry.ts"), () => {
  const common = {
    fixture: "clean" as const,
    intent: "config test",
    prompt: () => "offline",
    budgetUsd: 0.05,
    wallClockMs: 1000,
    check: () => "ok",
  };
  return {
    cases: [
      { ...common, id: "a/routing", skill: "a", tier: 1 },
      {
        ...common,
        id: "a/read-only",
        skill: "a",
        tier: 2,
        mutationPolicy: "read-only",
      },
      {
        ...common,
        id: "b/writes",
        skill: "b",
        tier: 2,
        mutationPolicy: "allowed",
      },
    ] satisfies readonly EvalCase[],
  };
});

test("config exposes skill filters and grades mutation scope only for read-only behavioral cases", () => {
  expect(config.tests.map(({ metadata }) => metadata)).toEqual([
    { skill: "a", tier: 1 },
    { skill: "a", tier: 2 },
    { skill: "b", tier: 2 },
  ]);
  expect(
    config.tests.map(({ assert }) => assert.map(({ metric }) => metric)),
  ).toEqual([[], ["mutation-scope"], []]);
});
