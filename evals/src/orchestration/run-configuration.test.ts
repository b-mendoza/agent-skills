// Pins the model-resolution contract behind `EVAL_MODEL`.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import { resolveModel } from "#/orchestration/run-configuration.ts";

test.each([
  { configuredModel: undefined, expectedModel: "sonnet" },
  { configuredModel: "", expectedModel: "sonnet" },
  { configuredModel: "custom-model", expectedModel: "custom-model" },
])(
  "resolves configured model $configuredModel to $expectedModel",
  ({ configuredModel, expectedModel }) => {
    expect(resolveModel(configuredModel)).toBe(expectedModel);
  },
);
