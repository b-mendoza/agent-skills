import { expect, test } from "vitest";

import generateTests from "./tests.ts";

test("generates the complete case registry with filterable IDs and tiers", () => {
  expect(generateTests()).toEqual([
    {
      description: "trigger-positive",
      vars: { caseId: "trigger-positive" },
      metadata: { tier: 1 },
    },
    {
      description: "trigger-negative-review",
      vars: { caseId: "trigger-negative-review" },
      metadata: { tier: 1 },
    },
    {
      description: "trigger-negative-mutate",
      vars: { caseId: "trigger-negative-mutate" },
      metadata: { tier: 1 },
    },
    {
      description: "trigger-negative-handoff",
      vars: { caseId: "trigger-negative-handoff" },
      metadata: { tier: 1 },
    },
    {
      description: "trigger-negative-pr-review",
      vars: { caseId: "trigger-negative-pr-review" },
      metadata: { tier: 1 },
    },
    {
      description: "path-error",
      vars: { caseId: "path-error" },
      metadata: { tier: 2 },
    },
    {
      description: "gate-envelope",
      vars: { caseId: "gate-envelope" },
      metadata: { tier: 2 },
    },
    {
      description: "quiet-state",
      vars: { caseId: "quiet-state" },
      metadata: { tier: 2 },
    },
    {
      description: "snapshot-dirty",
      vars: { caseId: "snapshot-dirty" },
      metadata: { tier: 2 },
    },
    {
      description: "injection-defense",
      vars: { caseId: "injection-defense" },
      metadata: { tier: 2 },
    },
  ]);
});
