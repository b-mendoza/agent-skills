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
const inMap = "- Important; in-map; src/a.js; reuse the helper";
const outOfMap = "- Critical; out-of-map; src/b.js; repair the caller";
const protectedFix = "- Critical; protected; src/api.js; would change the API";
const failedReview = reviewer.text
  .replace("REFACTOR_REVIEW: PASS", "REFACTOR_REVIEW: FAIL")
  .replace("Simplification verdict: pass", "Simplification verdict: fail");
const fix = `Required fixes:\n${inMap}`;

describe("reviewer report consistency", () => {
  test.each([
    ["Critical; src/a.js; changed return value", SUCCESS],
    ["Important; src/a.js; duplicated branch", SUCCESS],
    ["Minor; src/a.js; style", FAILURE],
    ["none", FAILURE],
  ] as const)(
    "FAIL with passing verdicts, a fix and finding %s",
    (finding, expected) => {
      const payload = reviewer.text
        .replace(": PASS", ": FAIL")
        .replace(noFixes, fix)
        .replace("Findings:\n- none", `Findings:\n- ${finding}`);
      expect(checkReport(payload, reviewer.role).status).toBe(expected);
    },
  );

  test("FAIL accepts multiple classified fixes", () => {
    const payload = failedReview.replace(
      noFixes,
      `${fix}\n${outOfMap}\n${protectedFix}`,
    );
    expect(checkReport(payload, reviewer.role)).toMatchObject(
      validated("FAIL"),
    );
  });

  test.each([
    "- none",
    "- Minor; in-map; src/a.js; reuse the helper",
    "- Important; elsewhere; src/a.js; reuse the helper",
    "- Important; in-map;  ; reuse the helper",
    "- Important; in-map; src/a.js;  ",
    `${inMap}\n- unclassified fix`,
    `${inMap}\n  keeping the call sites unchanged`,
    `${inMap}\n- none`,
  ])("FAIL rejects invalid required fixes: %s", (lines) => {
    const payload = failedReview.replace(noFixes, `Required fixes:\n${lines}`);
    expect(checkReport(payload, reviewer.role).status).toBe(FAILURE);
  });

  test.each(["Behavior verdict", "Simplification verdict"])(
    "rejects unavailable %s outside ERROR",
    (label) => {
      for (const text of [reviewer.text, failedReview.replace(noFixes, fix)]) {
        const invalid = text.replace(
          new RegExp(`${label}: (pass|fail)`),
          `${label}: unavailable`,
        );
        expect(checkReport(invalid, reviewer.role).status).toBe(FAILURE);
      }
    },
  );

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
