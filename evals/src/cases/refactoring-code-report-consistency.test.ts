import { describe, expect, test } from "vitest";

import {
  analysisReport,
  checkReport,
  ROLE_REPORTS,
} from "#/cases/refactoring-code-contract-support.ts";

const SUCCESS = 0;
const FAILURE = 1;
const [mapper, implementer, reviewer] = ROLE_REPORTS;

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

test("mapper distinguishes ./Target from its Target field", () => {
  const report = mapper.text
    .replaceAll("src/a.js", "./Target")
    .replace("7/250 OK", "300/250 OVERSIZED");
  expect(checkReport(report, mapper.role)).toMatchObject(validated("PASS"));
});

test.each([
  ["ERROR", mapper, "Error detail: read failed"],
  ["NEEDS_CLARIFICATION", mapper, "Question if blocked: Which target?"],
  ["BLOCKED", implementer, "Blocked reason: caller outside map"],
] as const)("allows stop detail only on %s", (status, fixture, detail) => {
  const report = `${fixture.text}\n${detail}`;
  expect(checkReport(report, fixture.role).status).toBe(FAILURE);
  const stopped = report.replace(": PASS", `: ${status}`);
  expect(checkReport(stopped, fixture.role)).toMatchObject(validated(status));
});

const noFixes = "Required fixes:\n- none";

describe("reviewer report consistency", () => {
  test.each(["none", "unavailable"])(
    "ERROR accepts a transient stop with required fixes marked %s",
    (fixes) => {
      const stopped = reviewer.text
        .replace("REFACTOR_REVIEW: PASS", "REFACTOR_REVIEW: ERROR")
        .replaceAll("verdict: pass", "verdict: unavailable")
        .replace(noFixes, `Required fixes:\n- ${fixes}`);
      const payload = `${stopped}\nError detail: transient; diff read timed out`;
      expect(checkReport(payload, reviewer.role)).toMatchObject(
        validated("ERROR"),
      );
    },
  );
});
