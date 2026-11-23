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

describe("analyst finding exceptions", () => {
  const exportEvidence =
    "Private module; no published or extension entry. rg -n 'oldSum' .; rg -n 'lib/compat' .; rg -n 'export .* from' .; only lib/compat.ts to rewrite.";
  test.each([
    [
      "test-removal",
      "Remove the duplicate zero check",
      "sum.test.ts:12 (sum of empty input is zero) -> sum.test.ts:8",
      SUCCESS,
    ],
    ["internal-export-removal", "Remove oldSum", exportEvidence, SUCCESS],
    ["public-export-removal", "Remove oldSum", exportEvidence, FAILURE],
    [null, "Remove oldSum", exportEvidence, FAILURE],
  ])(
    "validates the exception value %j",
    (exception, transformation, evidence, status) => {
      const report = analysisReport();
      const [first, ...rest] = report.findings;
      const findings = [
        { ...first, exception, transformation, reuse_evidence: evidence },
        ...rest,
      ];
      const payload = JSON.stringify({ ...report, findings });
      expect(checkReport(payload).status).toBe(status);
    },
  );
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
const outside = "Files changed outside report: none";
const unreported = "Files changed outside report: src/b.js";
const size = "Size policy check:\n- pass";
const badSize = "Size policy check:\n- fail; exceeds limit";
const fix = `Required fixes:\n${inMap}`;

describe("reviewer report consistency", () => {
  test.each([
    ["required fix", reviewer.text.replace(noFixes, fix)],
    ["unreported file", reviewer.text.replace(outside, unreported)],
    ["size violation", reviewer.text.replace(size, badSize)],
    [
      "unreported file and size violation",
      reviewer.text.replace(outside, unreported).replace(size, badSize),
    ],
    [
      "failed validation",
      reviewer.text.replace("- pass; node --test", "- fail; node --test"),
    ],
  ])("PASS rejects %s", (_, payload) => {
    expect(checkReport(payload, reviewer.role).status).toBe(FAILURE);
  });

  test.each(["Plan conformance", "Behavior and protected-boundary check"])(
    "PASS requires a non-failing %s",
    (label) => {
      const passing = `${label}:\n- pass`;
      const failing = reviewer.text.replace(passing, `${label}:\n- fail`);
      expect(checkReport(failing, reviewer.role).status).toBe(FAILURE);
      expect(checkReport(reviewer.text, reviewer.role).status).toBe(SUCCESS);
    },
  );

  test.each(["Critical", "Important"])("PASS rejects a %s finding", (rank) => {
    const findings = "Findings:\n- Minor; a.js; style";
    const minor = reviewer.text.replace("Findings:\n- none", findings);
    const another = minor.replace(findings, `${findings}\n- ${rank}; b; drift`);
    expect(checkReport(another, reviewer.role).status).toBe(FAILURE);
    expect(checkReport(minor, reviewer.role).status).toBe(SUCCESS);
  });

  test("PASS accepts warning evidence and bulleted none", () => {
    const payload = reviewer.text
      .replace(outside, "Files changed outside report:\n- none")
      .replace("- pass; node --test; exit 0; 1 test", "- warning; not run");
    expect(checkReport(payload, reviewer.role)).toMatchObject(
      validated("PASS"),
    );
  });

  test.each([
    ["Plan conformance", FAILURE],
    ["Behavior and protected-boundary check", FAILURE],
    ["Size policy check", FAILURE],
    ["Validation evidence check", SUCCESS],
  ] as const)(
    "PASS checks every outcome under %s",
    (section, warningStatus) => {
      const checkBullet = (bullet: string) => {
        const payload = reviewer.text.replace(
          new RegExp(`(${section}:\\n- [^\\n]+)`),
          `$1\n- ${bullet}`,
        );
        return checkReport(payload, reviewer.role).status;
      };
      expect(checkBullet("pass; src/b.js:3 checked\n  against baseline")).toBe(
        SUCCESS,
      );
      expect(checkBullet("pass")).toBe(SUCCESS);
      expect(checkBullet("warning; not checked")).toBe(warningStatus);
      for (const bullet of [
        "fail; src/b.js:3",
        "unavailable",
        "bypass; src/b.js:3",
        "passenger",
      ]) {
        expect(checkBullet(bullet)).toBe(FAILURE);
      }
    },
  );

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

const unitReport = implementer.text
  .replace("Unit: all", "Unit: U2")
  .replace("Command: node --test", "Command: not run")
  .replace("Exit code: 0", "Exit code: not run")
  .replace("Coverage evidence: 1 test", "Coverage evidence: not run")
  .replace("Result: pass", "Result: not run");

describe("parallel implementer contract", () => {
  test.each(["U1", "U2", "U3", "U4"])("accepts %s without validation", (id) => {
    const payload = unitReport.replace("U2", id);
    expect(checkReport(payload, implementer.role)).toMatchObject(
      validated("PASS"),
    );
  });

  test.each([
    ["BLOCKED", "Blocked reason: caller needs a rename"],
    ["ERROR", "Error detail: write failed"],
  ])("accepts unit %s with stop evidence", (status, detail) => {
    const payload = `${unitReport.replace("PASS", status)}\n${detail}`;
    expect(checkReport(payload, implementer.role)).toMatchObject(
      validated(status),
    );
  });

  test.each([
    ["Command: not run", "Command: node --test"],
    ["Exit code: not run", "Exit code: 0"],
    ["Coverage evidence: not run", "Coverage evidence: 1 test"],
    ["Result: not run", "Result: pass"],
    ["IMPLEMENTATION: PASS", "IMPLEMENTATION: PASS_WITH_WARNINGS"],
    ["IMPLEMENTATION: PASS", "IMPLEMENTATION: FAIL"],
    ["Unit: U2", "Unit: U5"],
    ["Unit: U2\n", ""],
  ])("rejects replacing %s with %j", (before, after) => {
    const payload = unitReport.replace(before, after);
    expect(checkReport(payload, implementer.role).status).toBe(FAILURE);
  });

  test("a path named Unit stays distinct from the unit header", () => {
    const payload = unitReport
      .replace("Unit: U2", "- Unit: U2")
      .replaceAll("src/a.js", "./Unit");
    expect(checkReport(payload, implementer.role)).toMatchObject(
      validated("PASS"),
    );
  });

  test("a content bullet cannot supply the missing unit header", () => {
    const payload = unitReport
      .replace("Unit: U2\n", "")
      .replace("Risk notes: none", "Risk notes: one path\n- Unit: U2");
    expect(checkReport(payload, implementer.role).status).toBe(FAILURE);
  });

  test("integration PASS still requires a passing validation result", () => {
    const payload = implementer.text.replace("Unit: all", "Unit: integration");
    expect(checkReport(payload, implementer.role)).toMatchObject(
      validated("PASS"),
    );
    const invalid = payload.replace("Result: pass", "Result: not run");
    expect(checkReport(invalid, implementer.role).status).toBe(FAILURE);
  });
});

const regression = implementer.text
  .replace("IMPLEMENTATION: PASS", "IMPLEMENTATION: FAIL")
  .replace("Result: pass", "Result: fail")
  .replace("Exit code: 0", "Exit code: 1");
const warning = regression.replace(
  "IMPLEMENTATION: FAIL",
  "IMPLEMENTATION: PASS_WITH_WARNINGS",
);
const preExisting = warning.replace(
  "Result: fail",
  "Result: pre-existing failure",
);

describe.each(["all", "integration"])("%s validation evidence", (unit) => {
  const passing = implementer.text.replace("Unit: all", `Unit: ${unit}`);
  test.each([
    ["PASS", ""],
    ["PASS_WITH_WARNINGS", ""],
    ["BLOCKED", "\nBlocked reason: caller outside map"],
    ["ERROR", "\nError detail: write failed"],
  ])("%s checks exit and coverage for Result: pass", (status, stop) => {
    const good = passing.replace(": PASS", `: ${status}`) + stop;
    expect(checkReport(good, implementer.role).status).toBe(SUCCESS);
    for (const bad of [
      good.replace("Exit code: 0", "Exit code: 1"),
      good.replace("1 test", "0"),
      good.replace("1 test", "0 tests"),
      good.replace("1 test", "Tests run: 0"),
      good.replace(/^- Coverage evidence:.*$/m, "- Coverage evidence: not run"),
      good.replace(/^- Command:.*$/m, "- Command: not run"),
    ]) {
      expect(checkReport(bad, implementer.role).status).toBe(FAILURE);
    }
  });

  test("zero failures do not mean zero tests ran", () => {
    const good = passing.replace("1 test", "10 tests ran; 0 tests failed");
    expect(checkReport(good, implementer.role).status).toBe(SUCCESS);
  });

  test("FAIL requires a recorded exit code", () => {
    const good = regression.replace("Unit: all", `Unit: ${unit}`);
    const bad = good.replace("Exit code: 1", "Exit code: not run");
    expect(checkReport(bad, implementer.role).status).toBe(FAILURE);
    expect(checkReport(good, implementer.role).status).toBe(SUCCESS);
  });

  test.each([
    ["0/12 tests ran", FAILURE],
    ["0/12 executed", FAILURE],
    ["0 of 12 tests ran", FAILURE],
    ["Matched suites: 0", FAILURE],
    ["Matched 0 suites", FAILURE],
    ["Matched files: none", FAILURE],
    ["0 suites matched", FAILURE],
    ["0 files matched", FAILURE],
    ["0/12 files matched", FAILURE],
    ["10 tests ran; 0 failed", SUCCESS],
    ["10 tests ran; 0 test files failed", SUCCESS],
    ["10 tests ran; 0 files changed", SUCCESS],
  ] as const)("checks executed coverage: %s", (coverage, expected) => {
    expect(
      checkReport(passing.replace("1 test", coverage), implementer.role).status,
    ).toBe(expected);
  });

  test.each([
    ["PASS_WITH_WARNINGS", ""],
    ["BLOCKED", "\nBlocked reason: caller outside map"],
    ["ERROR", "\nError detail: write failed"],
  ])("%s rejects a validation pass on a warning path", (status, stop) => {
    const payload =
      passing
        .replace(": PASS", `: ${status}`)
        .replace("Safety class: safe", "Safety class: warning path") + stop;
    expect(checkReport(payload, implementer.role).status).toBe(FAILURE);
  });

  test("a warning caps a successful implementation", () => {
    const warned = passing.replace("Warnings:\n- none", "Warnings:\n- no docs");
    expect(checkReport(warned, implementer.role).status).toBe(FAILURE);
    const good = warned.replace(": PASS", ": PASS_WITH_WARNINGS");
    expect(checkReport(good, implementer.role).status).toBe(SUCCESS);
  });
});

describe("implementer post-edit validation", () => {
  test("FAIL reports a contract regression", () => {
    expect(checkReport(regression, implementer.role)).toMatchObject(
      validated("FAIL"),
    );
  });

  test.each([
    [
      "FAIL without failure",
      regression.replace("Result: fail", "Result: pass"),
    ],
    [
      "FAIL without execution",
      regression.replace("Command: node --test", "Command: not run"),
    ],
    ["warning on regression", warning],
    [
      "pre-existing failure after passing baseline",
      preExisting.replace("checkpoint: pass", "checkpoint: pass; 1 test"),
    ],
  ])("rejects %s", (_, payload) => {
    expect(checkReport(payload, implementer.role).status).toBe(FAILURE);
  });

  test.each([
    ["Command: node --test", "Command: not run"],
    ["Exit code: 1", "Exit code: not run"],
  ])(
    "pre-existing failure rejects %s replaced with %s",
    (oldField, newField) => {
      const payload = preExisting
        .replace("checkpoint: pass", "checkpoint: skipped (warning path)")
        .replace(oldField, newField);
      expect(checkReport(payload, implementer.role).status).toBe(FAILURE);
    },
  );

  test("accepts a failure already present at baseline", () => {
    const payload = preExisting.replace(
      "checkpoint: pass",
      "checkpoint: fail (pre-existing)",
    );
    expect(checkReport(payload, implementer.role)).toMatchObject(
      validated("PASS_WITH_WARNINGS"),
    );
  });
});
