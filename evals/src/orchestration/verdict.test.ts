// Pins how a case check's outcome becomes report row data: a returned string
// passes, a thrown value fails and is trimmed to fit one report cell.
//
// These pure-helper tests spend no tokens and write no report file.
//
//   pnpm test

import { expect, test } from "vitest";

import { evaluate, MAX_OBSERVED_CHARS } from "#/orchestration/verdict.ts";

/** Comfortably longer than the cell width, so truncation must engage. */
const OVERLONG = 500;

test("a passing check becomes a PASS row carrying its observed string", () => {
  expect(evaluate(() => "Skill invoked")).toStrictEqual({
    status: "PASS",
    observed: "Skill invoked",
  });
});

test("a thrown assertion becomes a FAIL row with its first line only", () => {
  const { status, observed } = evaluate(() => {
    throw new Error("expected 3 lines, got 5\n  detail\n  more detail");
  });

  expect(status).toBe("FAIL");
  // A report cell holds one line; the rest would break the table.
  expect(observed).toBe("expected 3 lines, got 5");
});

test("a long failure message is truncated to the cell width", () => {
  const { observed } = evaluate(() => {
    throw new Error("x".repeat(OVERLONG));
  });

  expect(observed).toHaveLength(MAX_OBSERVED_CHARS);
});

test("a thrown non-Error still produces a FAIL row", () => {
  // A case check is arbitrary user code, so the runner cannot assume the thrown
  // value is an Error; a bare string must still become a row, not crash runCli().
  expect(
    evaluate(() => {
      throw "bare string";
    }),
  ).toStrictEqual({ status: "FAIL", observed: "bare string" });
});
