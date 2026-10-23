import { expect, test, vi } from "vitest";

import {
  FULL_REPORT_SNAPSHOT,
  observe,
  VALIDATOR_CALL,
} from "#/cases/case-test-support.ts";

import {
  evaluate,
  grade,
  MAX_OBSERVED_CHARS,
  mutationScope,
} from "./assertion.ts";
import { getCase } from "./observation.ts";

const OVERLONG = 500;

function injectThrownValue(value: unknown): never {
  const generator = (function* () {
    yield undefined;
  })();
  generator.next();
  while (true) generator.throw(value);
}

test("a passing check carries its observed string", () => {
  expect(evaluate(() => "Skill invoked")).toStrictEqual({
    pass: true,
    score: 1,
    reason: "Skill invoked",
  });
});

test("a thrown assertion fails with its first line only", () => {
  expect(
    evaluate(() => {
      throw new Error("expected 3 lines, got 5\n  detail\n  more detail");
    }),
  ).toStrictEqual({ pass: false, score: 0, reason: "expected 3 lines, got 5" });
});

test("a long failure message is truncated", () => {
  const { reason } = evaluate(() => {
    throw new Error("x".repeat(OVERLONG));
  });
  expect(reason).toHaveLength(MAX_OBSERVED_CHARS);
});

test.each([
  { value: "bare string", reason: "bare string" },
  {
    value: {
      toString: () => {
        throw new Error("cannot stringify");
      },
    },
    reason: "An unknown error occurred",
  },
])("a thrown non-Error fails with $reason", ({ value, reason }) => {
  expect(evaluate(() => injectThrownValue(value))).toStrictEqual({
    pass: false,
    score: 0,
    reason,
  });
});

test.each([
  { message: "ECONNRESET", reason: "judge: ECONNRESET" },
  {
    message: "judge: planted-facts violated -- missing fact",
    reason: "judge: planted-facts violated -- missing fact",
  },
  {
    message: "judge reply JSON had an invalid shape",
    reason: "judge reply JSON had an invalid shape",
  },
])(
  "judge failures name the judge without duplicate prefixes: $message",
  async ({ message, reason }) => {
    vi.spyOn(getCase("snapshot-dirty"), "judge").mockRejectedValue(
      new Error(message),
    );
    expect(
      await grade("", {
        vars: { caseId: "snapshot-dirty" },
        metadata: {
          observation: observe({
            finalText: FULL_REPORT_SNAPSHOT,
            toolCalls: [VALIDATOR_CALL],
          }),
          repeatIndex: 0,
        },
      }),
    ).toStrictEqual({ pass: false, score: 0, reason });
  },
);

test.each([
  {
    toolCalls: [],
    pass: true,
    score: 1,
    reason: "1 behavioral run(s) left no trace",
  },
  {
    toolCalls: [{ name: "Write", input: {} }],
    pass: false,
    score: 0,
    reason: "read-only contract violated:",
  },
])(
  "grades mutation evidence from a single attempt: $pass",
  ({ toolCalls, pass, score, reason }) => {
    expect(
      mutationScope("", {
        vars: { caseId: "path-error" },
        metadata: { observation: observe({ toolCalls }), repeatIndex: 0 },
      }),
    ).toMatchObject({ pass, score, reason });
  },
);

test("mutation grading fails closed on missing observation metadata", () => {
  expect(() => mutationScope("", { vars: { caseId: "path-error" } })).toThrow();
});
