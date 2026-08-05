// Turns a residual Effect cause into the one-line `eval suite error:` text.
//
// This module reads `effect` 4.0.0-beta internals -- `Formatter.format` output
// and the `Cause.reasons` shape -- and five tests pin its exact strings
// (bigint, ISO Date, non-Error defect, throwing coercion). Treat the wording
// and the fallback order as the contract: change them only with those tests.

import { Cause, Formatter } from "effect";

const SINGLE_REASON_COUNT = 1;
const ERROR_NAME_PREFIX = /^[A-Za-z]*Error(?: \[[^\]]+\])?: /;
const UNKNOWN_CAUSE_DESCRIPTION = "An unknown error occurred";

function safelyDescribeCause(cause: Cause.Cause<unknown>): string {
  try {
    return String(cause);
  } catch (causeConversionError) {
    return new Error(UNKNOWN_CAUSE_DESCRIPTION, {
      cause: causeConversionError,
    }).message;
  }
}

function describeFormattedDefect(formattedDefect: string): string {
  const errorMessage = formattedDefect.replace(ERROR_NAME_PREFIX, "");
  if (errorMessage !== formattedDefect) return errorMessage;

  try {
    const defectValue: unknown = JSON.parse(formattedDefect);
    return String(defectValue);
  } catch (parseError) {
    return parseError instanceof SyntaxError
      ? formattedDefect
      : String(parseError);
  }
}

function describeDefect(cause: Cause.Cause<unknown>, defect: unknown): string {
  try {
    return describeFormattedDefect(Formatter.format(defect));
  } catch (defectFormattingError) {
    return new Error(safelyDescribeCause(cause), {
      cause: defectFormattingError,
    }).message;
  }
}

export function describeResidualCause(cause: Cause.Cause<unknown>): string {
  const [reason] = cause.reasons;
  if (cause.reasons.length !== SINGLE_REASON_COUNT || reason == null) {
    return safelyDescribeCause(cause);
  }

  return Cause.isDieReason(reason)
    ? describeDefect(cause, reason.defect)
    : safelyDescribeCause(cause);
}
