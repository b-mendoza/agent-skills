// Turns the outcome of a case check -- a returned string or a thrown assertion
// -- into the row data the report expects.

import type { Result } from "#/orchestration/report.ts";

/** A report cell holds one line; a longer assertion message is truncated. */
export const MAX_OBSERVED_CHARS = 160;
const FIRST_CHARACTER_INDEX = 0;
const UNKNOWN_ERROR_MESSAGE = "An unknown error occurred";

function describeNonErrorCheckFailure(cause: unknown): string {
  try {
    return String(cause);
  } catch (stringConversionError) {
    return new Error(UNKNOWN_ERROR_MESSAGE, {
      cause: stringConversionError,
    }).message;
  }
}

function normalizeCheckFailure(cause: unknown): {
  status: Result["status"];
  observed: string;
} {
  const failureMessage =
    cause instanceof Error
      ? cause.message
      : describeNonErrorCheckFailure(cause);
  const [firstLine = ""] = failureMessage.split("\n");

  return {
    status: "FAIL",
    observed: firstLine.slice(FIRST_CHARACTER_INDEX, MAX_OBSERVED_CHARS),
  };
}

/** Runs a check, turning a thrown assertion into a FAIL row. */
export function evaluate(check: () => string): {
  status: Result["status"];
  observed: string;
} {
  try {
    return { status: "PASS", observed: check() };
  } catch (cause) {
    return normalizeCheckFailure(cause);
  }
}
