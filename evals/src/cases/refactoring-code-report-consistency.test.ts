import { describe, expect, test } from "vitest";

import {
  analysisReport,
  checkReport,
} from "#/cases/refactoring-code-contract-support.ts";

const SUCCESS = 0;
const FAILURE = 1;

function validated(status: string) {
  return { status: SUCCESS, stdout: `${status}\n` };
}

describe.each([
  ["NEEDS_CLARIFICATION", "question", "Which path is in scope?"],
  ["ERROR", "error", "Transient: inspection timed out"],
])("analyst %s", (status, field, evidence) => {
  test.each([null, "  ", undefined, true])("rejects %j", (value) => {
    const report = { ...analysisReport(), status, [field]: value };
    expect(checkReport(JSON.stringify(report)).status).toBe(FAILURE);
  });

  test("accepts stop evidence", () => {
    const report = { ...analysisReport(), status, [field]: evidence };
    expect(checkReport(JSON.stringify(report))).toMatchObject(
      validated(status),
    );
  });
});
