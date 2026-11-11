import { expect, test } from "vitest";

import { analysisObservation } from "#/cases/refactoring-code-observation-support.ts";
import { checkAnalysis } from "#/cases/refactoring-code-regression-checks.ts";

test.each([
  {
    name: "minimal malformed report",
    overrides: {
      version: undefined,
      from: undefined,
      chunk: undefined,
      status: undefined,
      omitted_high_priority: undefined,
      omitted_categories: undefined,
      findings: [{ problem: "criticalTail" }],
    },
  },
  { name: "missing status", overrides: { status: undefined } },
  { name: "unknown status", overrides: { status: "DONE" } },
  {
    name: "missing omission categories",
    overrides: { omitted_categories: undefined },
  },
  {
    name: "incomplete finding",
    overrides: { findings: [{ problem: "criticalTail" }] },
  },
])(
  "bounded analyst rejects $name through canonical validation",
  ({ overrides }) => {
    expect(() => checkAnalysis(analysisObservation(overrides))).toThrow(
      /invalid analyst report/,
    );
  },
);
