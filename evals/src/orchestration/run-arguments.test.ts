// Pins the runner's flag-parsing and model-resolution contracts.
//
// These injected tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import { parseArgs } from "#/orchestration/run.ts";
import { resolveModel } from "#/orchestration/run-configuration.ts";

const FIRST_UNDEFINED_TIER = 3;
const LARGE_NUMERIC_TIER = 99;

test.each([
  { label: "no selectors", args: [], expected: { errors: [] } },
  {
    label: "a tier selector",
    args: ["--tier=1"],
    expected: { tier: 1, errors: [] },
  },
  {
    label: "a case selector",
    args: ["--case=path-error"],
    expected: { caseId: "path-error", errors: [] },
  },
  {
    label: "tier and case selectors",
    args: ["--tier=2", "--case=quiet-state"],
    expected: { tier: 2, caseId: "quiet-state", errors: [] },
  },
])("parses $label into selector fields", ({ args, expected }) => {
  expect(parseArgs(args)).toStrictEqual(expected);
});

test.each([0, FIRST_UNDEFINED_TIER, LARGE_NUMERIC_TIER])(
  "numeric tier %i parses without a usage error",
  (tier) => {
    expect(parseArgs([`--tier=${tier}`])).toStrictEqual({ tier, errors: [] });
  },
);

// Malformed selectors must stay visible to the caller. Silently dropping one
// would remove the filter and turn a typo into an unconstrained paid run.
test.each([
  { label: "--tier=", args: ["--tier="] },
  { label: "--tier=abc", args: ["--tier=abc"] },
  { label: "--tier=1.5", args: ["--tier=1.5"] },
  { label: "--tier=-1", args: ["--tier=-1"] },
  { label: "--tier 1", args: ["--tier", "1"] },
  { label: "-tier=1", args: ["-tier=1"] },
  { label: "--case=", args: ["--case="] },
])("`$label` produces named parse errors", ({ args }) => {
  expect(parseArgs(args).errors).toStrictEqual(
    args.map((argument) => `unrecognized or malformed argument: ${argument}`),
  );
});

test("every unknown argument is reported while valid flags still parse", () => {
  expect(parseArgs(["--verbose", "extra", "--tier=1"])).toStrictEqual({
    tier: 1,
    errors: [
      "unrecognized or malformed argument: --verbose",
      "unrecognized or malformed argument: extra",
    ],
  });
});

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
