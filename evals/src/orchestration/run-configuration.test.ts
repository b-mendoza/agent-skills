// Pins the model-resolution contract behind `EVAL_MODEL` and the layer that
// serves the resolved model to every case.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { Effect } from "effect";
import { expect, test } from "vitest";

import {
  EvalConfiguration,
  EvalConfigurationLive,
  evalModel,
  resolveModel,
} from "#/orchestration/run-configuration.ts";

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

// The live layer is the only thing that puts a model in front of a paid run, so
// serving anything other than the resolved model would spend on the wrong one.
test("the live layer serves the resolved eval model", async () => {
  const liveConfiguration = await Effect.runPromise(
    Effect.provide(EvalConfiguration, EvalConfigurationLive),
  );

  expect(liveConfiguration).toStrictEqual({ model: evalModel });
});
