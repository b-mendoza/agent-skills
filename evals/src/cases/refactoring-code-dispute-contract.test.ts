import { describe, expect, test } from "vitest";

import {
  analysisReport,
  checkReport,
  ROLE_REPORTS,
} from "#/cases/refactoring-code-contract-support.ts";

const SUCCESS = 0;
const FAILURE = 1;
const [, implementer] = ROLE_REPORTS;
const objection = { claim: "Edit the caller", evidence: "a.js:8" };
const first = "- P1: The caller also needs an edit; evidence: a.js:8";
const three = `${first}\n- P2: Keep the helper; evidence: rg helper\n- P3: Prefer a split; evidence: none`;
const adjudicator = "dispute-adjudicator";

function adjudication(verdict: string) {
  return `ADJUDICATION: PASS
Dispute: Which caller needs an edit?
Verdict: ${verdict}
Reasons: a.js:8 calls the helper
Unresolved: none
Pushback: none`;
}

describe("text pushback", () => {
  test.each(["Pushback: none", `Pushback:\n${first}`, `Pushback:\n${three}`])(
    "accepts %s",
    (field) => {
      const text = implementer.text.replace("Pushback: none", field);
      expect(checkReport(text, implementer.role).status).toBe(SUCCESS);
    },
  );

  test.each([
    ["missing field", ""],
    ["inline bullet", `Pushback: ${first}`],
    ["missing label", "Pushback:\n- Edit caller; evidence: none"],
    ["empty claim", "Pushback:\n- P1:  ; evidence: a.js:8"],
    ["empty evidence", "Pushback:\n- P1: Edit caller; evidence: "],
    ["over cap", `Pushback:\n${three}\n- P4: Trim more; evidence: none`],
  ])("rejects %s", (_, field) => {
    const text = implementer.text.replace("Pushback: none", field);
    expect(checkReport(text, implementer.role).status).toBe(FAILURE);
  });
});

describe("analyst pushback", () => {
  test.each([
    { pushback: [], exit: SUCCESS },
    { pushback: [objection, objection, objection], exit: SUCCESS },
    { pushback: undefined, exit: FAILURE },
    { pushback: "none", exit: FAILURE },
    { pushback: [null], exit: FAILURE },
    { pushback: [{ ...objection, claim: " " }], exit: FAILURE },
    { pushback: [{ ...objection, evidence: false }], exit: FAILURE },
    { pushback: [objection, objection, objection, objection], exit: FAILURE },
  ])("validates $pushback", ({ pushback, exit }) => {
    const payload = JSON.stringify({ ...analysisReport(), pushback });
    expect(checkReport(payload).status).toBe(exit);
  });
});

describe("adjudication", () => {
  test.each(["A", "B", "neither"])("accepts verdict %s", (verdict) => {
    expect(checkReport(adjudication(verdict), adjudicator)).toMatchObject({
      status: SUCCESS,
      stdout: "PASS\n",
    });
  });

  const pass = adjudication("A");
  const error = adjudication("unavailable").replace("PASS", "ERROR");
  const detail = "\nError detail: transient read failure";
  test.each([
    ["missing pushback", pass.replace("Pushback: none", "")],
    ["unknown status", pass.replace("PASS", "FAIL")],
    ["missing dispute", pass.replace(/Dispute:.*\n/, "")],
    ["missing verdict", pass.replace(/Verdict:.*\n/, "")],
    ["missing reasons", pass.replace(/Reasons:.*\n/, "")],
    ["missing unresolved field", pass.replace("Unresolved: none", "")],
    ["uncited reasons", pass.replace("a.js:8", "the caller")],
    ["unavailable verdict on PASS", adjudication("unavailable")],
    ["error detail on PASS", pass + detail],
    ["missing error detail", error],
  ])("rejects %s", (_, payload) => {
    expect(checkReport(payload, adjudicator).status).toBe(FAILURE);
  });

  test("accepts unavailable verdict and detail on ERROR", () => {
    expect(checkReport(error + detail, adjudicator)).toMatchObject({
      status: SUCCESS,
      stdout: "ERROR\n",
    });
  });
});
