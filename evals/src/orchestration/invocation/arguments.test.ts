// Pins the runner's flag-parsing contract.
//
// These injected tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import { parseArgs } from "#/orchestration/invocation/arguments.ts";

const BELOW_FIRST_TIER = 0;
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
  // Any non-negative integer parses: rejecting a tier no case uses is
  // selection's job, so a numeric tier must never become a usage error.
  {
    label: "a tier below the defined tiers",
    args: [`--tier=${BELOW_FIRST_TIER}`],
    expected: { tier: BELOW_FIRST_TIER, errors: [] },
  },
  {
    label: "a tier above the defined tiers",
    args: [`--tier=${FIRST_UNDEFINED_TIER}`],
    expected: { tier: FIRST_UNDEFINED_TIER, errors: [] },
  },
  {
    label: "a large numeric tier",
    args: [`--tier=${LARGE_NUMERIC_TIER}`],
    expected: { tier: LARGE_NUMERIC_TIER, errors: [] },
  },
  {
    label: "an attempts count",
    args: ["--attempts=3"],
    expected: { attempts: 3, errors: [] },
  },
  {
    label: "attempts alongside selectors",
    args: ["--tier=2", "--attempts=1"],
    expected: { tier: 2, attempts: 1, errors: [] },
  },
])("parses $label into selector fields", ({ args, expected }) => {
  expect(parseArgs(args)).toStrictEqual(expected);
});

// Zero attempts would select cases and then measure nothing; an unbounded
// count would crash the attempt loop with a suite error (or allocate a huge
// array) instead of failing as invalid usage. Both must refuse up front.
test.each([
  { label: "--attempts=0", args: ["--attempts=0"] },
  { label: "--attempts=101", args: ["--attempts=101"] },
  {
    label: "an attempts count too large for an array length",
    args: ["--attempts=999999999999999999999"],
  },
])("`$label` produces a bounds error", ({ args }) => {
  expect(parseArgs(args).errors).toStrictEqual(
    args.map((argument) => `--attempts must be between 1 and 100: ${argument}`),
  );
});

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
  { label: "--attempts=", args: ["--attempts="] },
  { label: "--attempts=abc", args: ["--attempts=abc"] },
  { label: "--attempts=1.5", args: ["--attempts=1.5"] },
  { label: "--attempts=-1", args: ["--attempts=-1"] },
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
