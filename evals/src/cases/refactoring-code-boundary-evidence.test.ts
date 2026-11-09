import { expect, test } from "vitest";

import {
  boundaryObservation,
  reviewerValidation,
} from "#/cases/refactoring-code-observation-support.ts";
import { checkBoundaryReduction } from "#/cases/refactoring-code-regression-checks.ts";

const invocation = { name: "Skill", input: { skill: "refactoring-code" } };

test("run-2 boundary repeat 3 Node human summary is valid evidence, but omitted review still fails", () => {
  const good = boundaryObservation();
  const output =
    "✔ restricted caller cannot import src/oversized.js (0.063792ms)\n✔ trusted caller can import src/oversized.js (0.038584ms)\n✔ restricted caller cannot import src/core.js (0.032709ms)\n✔ trusted caller can import src/core.js (0.031667ms)\nℹ tests 5\nℹ suites 0\nℹ pass 5\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 40.358708\nexit=0";
  const tests = {
    name: "Bash",
    input: {
      command: `node --test boundary.test.js 2>&1 | tail -12; echo exit=\${pipestatus[1]}; git diff --stat`,
    },
    result: { content: output, isError: false, truncated: false },
  };
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [invocation, tests, reviewerValidation],
    }),
  ).not.toThrow();
  expect(() =>
    checkBoundaryReduction({ ...good, toolCalls: [invocation, tests] }),
  ).toThrow(/reviewer validation/);
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [
        invocation,
        { ...tests, result: { ...tests.result, truncated: true } },
        reviewerValidation,
      ],
    }),
  ).not.toThrow();
  for (const content of [
    output.replace("pass 5", "pass 0"),
    output.replace("fail 0", "fail 1"),
    output.replace("tests 5", "tests 0"),
    output.replace("exit=0", "exit=1"),
    `${output}\nℹ tests 5\nℹ pass 4\nℹ fail 1\nexit=1`,
  ]) {
    expect(() =>
      checkBoundaryReduction({
        ...good,
        toolCalls: [
          invocation,
          { ...tests, result: { ...tests.result, content } },
          reviewerValidation,
        ],
      }),
    ).toThrow(/test evidence/);
  }
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [
        invocation,
        tests,
        {
          ...reviewerValidation,
          result: { ...reviewerValidation.result, isError: true },
        },
      ],
    }),
  ).toThrow(/reviewer validation/);
});
