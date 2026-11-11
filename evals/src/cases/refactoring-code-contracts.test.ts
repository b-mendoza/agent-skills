import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const SUCCESS = 0;
const FAILURE = 1;
const FIRST = 0;
const ONE = 1;
const MAX_BYTES = 12_288;
const TRUNCATE_TAIL = -4;
const TOO_MANY_LINES = 61;
const REVIEWER_REPORT_INDEX = 2;
const IMPLEMENTER_REPORT_INDEX = 1;

const SCRIPT = fileURLToPath(
  new URL(
    "../../../skills/refactoring-code/scripts/validate-report.py",
    import.meta.url,
  ),
);

export function analysisReport() {
  return {
    version: 1,
    from: "chunk-analyst",
    chunk: "duplication-reuse",
    status: "PASS",
    total_findings: 21,
    omitted_count: 9,
    omitted_high_priority: 0,
    omitted_categories: ["normal duplicate helpers 11 through 19 deferred"],
    findings: Array.from({ length: 12 }, (_, index) => ({
      location: `src/analyze.js:${String(index + ONE)}`,
      problem:
        index === FIRST
          ? "criticalTail duplicates rounding"
          : "duplicate helper",
      transformation: "reuse existing helper",
      reuse_rung: "reuse-repo",
      reuse_evidence: "src/money.js:roundMoney",
      net_lines: -1,
      priority: index === FIRST ? "high" : "normal",
      confidence: "high",
    })),
  };
}

function checkReport(
  payload: string,
  role = "chunk-analyst",
  outsideRun = false,
) {
  const root = mkdtempSync(join(tmpdir(), "refactor-contract-"));
  const run = join(root, ".handoffs/refactoring-code/run-one");
  mkdirSync(run, { recursive: true });
  const report = join(outsideRun ? root : run, "report.json");
  writeFileSync(report, payload);
  try {
    return spawnSync("python3", ["-I", SCRIPT, "report", role, report, run], {
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("bounded planning report executable contract (#295)", () => {
  test("accepts bounded overflow with the high-priority tail finding selected", () => {
    const result = checkReport(JSON.stringify(analysisReport()));
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("PASS");
  });

  test.each([
    [
      "unbounded bytes",
      () =>
        JSON.stringify({ ...analysisReport(), padding: "x".repeat(MAX_BYTES) }),
    ],
    [
      "too many findings",
      () => {
        const report = analysisReport();
        const first = report.findings[FIRST];
        if (first === undefined) throw new Error("missing fixture finding");
        report.findings.push(first);
        report.omitted_count -= ONE;
        return JSON.stringify(report);
      },
    ],
    [
      "lost overflow counts",
      () => JSON.stringify({ ...analysisReport(), omitted_count: 0 }),
    ],
    [
      "silent overflow",
      () => JSON.stringify({ ...analysisReport(), omitted_categories: [] }),
    ],
    [
      "high-priority tail dropped for normal findings",
      () => JSON.stringify({ ...analysisReport(), omitted_high_priority: 1 }),
    ],
    [
      "unknown status",
      () => JSON.stringify({ ...analysisReport(), status: "PROBABLY_FINE" }),
    ],
    [
      "missing evidence",
      () =>
        JSON.stringify({
          ...analysisReport(),
          findings: analysisReport().findings.map((finding) => ({
            ...finding,
            reuse_evidence: "",
          })),
        }),
    ],
    [
      "truncated read",
      () => JSON.stringify(analysisReport()).slice(FIRST, TRUNCATE_TAIL),
    ],
  ] as const)("rejects %s", (_, payload) => {
    const result = checkReport(payload());
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/invalid refactor contract/);
  });

  test("accepts a fully disclosed high-priority overflow only when all slots prioritize it", () => {
    const report = analysisReport();
    report.omitted_high_priority = 2;
    report.findings = report.findings.map((finding) => ({
      ...finding,
      priority: "high",
    }));
    expect(checkReport(JSON.stringify(report)).status).toBe(SUCCESS);
  });

  test("rejects reports outside the owned run", () => {
    expect(
      checkReport(JSON.stringify(analysisReport()), "chunk-analyst", true)
        .status,
    ).toBe(FAILURE);
  });
});

const ROLE_REPORTS = [
  {
    role: "behavior-mapper",
    prefix: "BEHAVIOR_MAP",
    required: "Proposed chunks",
    text: `BEHAVIOR_MAP: PASS
Target: src/a.js
Files inspected: src/a.js
Worktree baseline:
- Commit: abc123
- Porcelain summary: clean
- Pre-existing dirty files: none
Current behavior facts:
- returns input
Validation candidates:
- User command: node --test
- Discovered candidates: none
File sizes:
- src/a.js: 7/250 OK
Proposed chunks:
- duplication: repeated branches
- complexity: nested paths
Risk notes: none`,
  },
  {
    role: "refactor-implementer",
    prefix: "IMPLEMENTATION",
    required: "Validation evidence",
    text: `IMPLEMENTATION: PASS
Fix cycle: none
Changes made:
- src/a.js: simplify branches
Per-file disposition:
- src/a.js: edited-from-clean
File sizes after change:
- src/a.js: 3/250 compliant
Net lines: -4
Baseline checkpoint: pass
Validation evidence:
- Command: node --test
- Safety class: safe
- Exit code: 0
- Coverage evidence: 1 test
- Result: pass
Warnings:
- none
Deviations:
- none
Reviewer focus:
- src/a.js
Risk notes: none`,
  },
  {
    role: "refactor-reviewer",
    prefix: "REFACTOR_REVIEW",
    required: "Behavior verdict",
    text: `REFACTOR_REVIEW: PASS
Fix cycle reviewed: 0 of 2
Behavior verdict: pass
Simplification verdict: pass
Baseline scope check:
- Implementer-reported files reviewed: src/a.js
- Files changed outside report: none
Plan conformance:
- pass
Behavior and protected-boundary check:
- pass
Simplification outcome:
- Net lines: -4
- Duplication: removed
- Reuse rungs: honored
Size policy check:
- pass
Validation evidence check:
- pass; node --test; exit 0; 1 test
Findings:
- none
Required fixes:
- none
Minor notes for handoff:
- none
Risk notes:
- none`,
  },
] as const;

describe("every routed role validates required fields and status consistency", () => {
  test.each(ROLE_REPORTS)(
    "$role accepts a complete report",
    ({ role, text }) => {
      expect(checkReport(text, role).status).toBe(SUCCESS);
    },
  );

  test.each(ROLE_REPORTS)(
    "$role rejects status-only, missing, duplicate and oversized fields",
    ({ role, prefix, required, text }) => {
      for (const bad of [
        `${prefix}: PASS`,
        text.replace(`${required}:`, "Omitted field:"),
        `${text}\n${required}: duplicate`,
        `${text}\n${prefix}: PASS`,
        `${text}\n${"extra\n".repeat(TOO_MANY_LINES)}`,
        text.replace(`${prefix}: PASS`, `${prefix}: MAYBE`),
      ]) {
        expect(checkReport(bad, role).status).toBe(FAILURE);
      }
    },
  );

  test.each(ROLE_REPORTS)(
    "$role rejects omission or duplication of every required field",
    ({ role, text }) => {
      const labels = [
        ...text.matchAll(/^(?:- )?(?<label>[A-Z][A-Za-z -]+):/gm),
      ].map((match) => match.groups?.["label"]);
      for (const label of labels) {
        if (label === undefined) throw new Error("missing fixture label");
        expect(
          checkReport(text.replace(`${label}:`, "Omitted field:"), role).status,
        ).toBe(FAILURE);
        expect(checkReport(`${text}\n${label}: duplicate`, role).status).toBe(
          FAILURE,
        );
      }
    },
  );

  test("reviewer PASS rejects either contradictory verdict and missing or duplicate verdicts", () => {
    const report = ROLE_REPORTS[REVIEWER_REPORT_INDEX];
    for (const bad of [
      report.text.replace("Behavior verdict: pass", "Behavior verdict: fail"),
      report.text.replace(
        "Simplification verdict: pass",
        "Simplification verdict: fail",
      ),
      report.text.replace(
        "Simplification verdict: pass",
        "Simplification verdict: unknown",
      ),
      report.text.replace("Behavior verdict: pass\n", ""),
      `${report.text}\nBehavior verdict: pass`,
      "REFACTOR_REVIEW: PASS\nBehavior verdict: fail\nSimplification verdict: fail",
    ]) {
      expect(checkReport(bad, report.role).status).toBe(FAILURE);
    }
  });

  test.each([
    ["safe", "1", "fail", /PASS.*Result/],
    ["safe", "0", "fail", /PASS.*Result/],
    ["safe", "1", "pass", /PASS.*Exit code/],
    ["safe", "1", "pre-existing failure", /PASS.*Result/],
    ["safe", "0", "pre-existing failure", /PASS.*Result/],
    ["warning path", "0", "pass", /PASS.*warning path/],
  ] as const)(
    "implementer PASS rejects safety %s, exit %s and result %s",
    (safety, exitCode, validationResult, diagnostic) => {
      const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
      const payload = report.text
        .replace("Safety class: safe", `Safety class: ${safety}`)
        .replace("Exit code: 0", `Exit code: ${exitCode}`)
        .replace("Result: pass", `Result: ${validationResult}`);
      const result = checkReport(payload, report.role);
      expect(result.status).toBe(FAILURE);
      expect(result.stderr).toMatch(diagnostic);
    },
  );

  test.each([
    ["Command"],
    ["Coverage evidence"],
    ["Command", "Coverage evidence"],
  ])("implementer PASS rejects blank scalar evidence: %j", (...labels) => {
    const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
    const payload = labels.reduce<string>(
      (text, label) =>
        text.replace(new RegExp(`^- ${label}:.*$`, "m"), `- ${label}:   `),
      report.text,
    );
    const result = checkReport(payload, report.role);
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/empty field: (?:Command|Coverage evidence)/);
  });

  test.each([
    ["indented sub-bullets", "  - tests/a.test.ts\n  - tests/b.test.ts"],
    ["an indented line", "  12 tests in tests/a.test.ts"],
  ])("implementer PASS accepts coverage evidence on %s", (_, evidence) => {
    const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
    const result = checkReport(
      report.text.replace(
        "- Coverage evidence: 1 test",
        `- Coverage evidence:\n${evidence}`,
      ),
      report.role,
    );
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("PASS");
  });

  test.each(["Command", "Coverage evidence"])(
    "implementer PASS rejects not-run evidence in %s",
    (label) => {
      const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
      const result = checkReport(
        report.text.replace(
          new RegExp(`^- ${label}:.*$`, "m"),
          `- ${label}: not run`,
        ),
        report.role,
      );
      expect(result.status).toBe(FAILURE);
      expect(result.stderr).toMatch(/PASS needs command and coverage/);
    },
  );

  test("implementer warning path accepts explicit not-run evidence", () => {
    const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
    const payload = report.text
      .replace("IMPLEMENTATION: PASS", "IMPLEMENTATION: PASS_WITH_WARNINGS")
      .replace(
        "Baseline checkpoint: pass",
        "Baseline checkpoint: skipped (warning path)",
      )
      .replace("Command: node --test", "Command: not run")
      .replace("Safety class: safe", "Safety class: warning path")
      .replace("Exit code: 0", "Exit code: not run")
      .replace("Coverage evidence: 1 test", "Coverage evidence: not run")
      .replace("Result: pass", "Result: not run");
    expect(checkReport(payload, report.role).status).toBe(SUCCESS);
  });

  test.each(["safe", "state-mutating", "destructive"])(
    "implementer PASS accepts passing validation classed %s",
    (safety) => {
      const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
      const result = checkReport(
        report.text.replace("Safety class: safe", `Safety class: ${safety}`),
        report.role,
      );
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout.trim()).toBe("PASS");
    },
  );

  test("implementer PASS_WITH_WARNINGS accepts a known failure on a warning path", () => {
    const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
    const payload = report.text
      .replace("IMPLEMENTATION: PASS", "IMPLEMENTATION: PASS_WITH_WARNINGS")
      .replace(
        "Baseline checkpoint: pass",
        "Baseline checkpoint: fail (pre-existing)",
      )
      .replace("Safety class: safe", "Safety class: warning path")
      .replace("Exit code: 0", "Exit code: 1")
      .replace("Result: pass", "Result: pre-existing failure")
      .replace(
        "Warnings:\n- none",
        "Warnings:\n- Pre-existing validation failure",
      );
    const result = checkReport(payload, report.role);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout.trim()).toBe("PASS_WITH_WARNINGS");
  });

  test("implementer rejects missing and duplicate nested validation fields", () => {
    const report = ROLE_REPORTS[IMPLEMENTER_REPORT_INDEX];
    for (const bad of [
      report.text.replace("- Exit code: 0\n", ""),
      report.text.replace(
        "- Command: node --test",
        "- Command: node --test\n- Command: rm -rf target",
      ),
      report.text.replace("- Result: pass", "- Result: not run"),
    ]) {
      expect(checkReport(bad, report.role).status).toBe(FAILURE);
    }
  });
});

describe("host failure routing executable contract (#301)", () => {
  test.each([
    ["chunk-analyst", "0", "host-transient", "RETRY"],
    ["chunk-analyst", "1", "host-transient", "STOP"],
    ["behavior-mapper", "0", "report-transient", "RETRY"],
    ["refactor-reviewer", "0", "host-transient", "RETRY"],
    ["refactor-reviewer", "1", "host-transient", "STOP"],
    ["refactor-reviewer", "0", "permanent", "STOP"],
    ["refactor-implementer", "0", "host-transient", "RECONCILE"],
    ["refactor-implementer", "1", "permanent", "RECONCILE"],
  ])(
    "%s attempt %s with %s routes to %s without requiring a dead child's report",
    (role, count, cause, route) => {
      const result = spawnSync(
        "python3",
        ["-I", SCRIPT, "retry", role, count, cause],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(SUCCESS);
      expect(result.stdout.trim()).toBe(route);
      expect(result.stdout.trim()).not.toBe(
        route === "RETRY" ? "STOP" : "RETRY",
      );
    },
  );

  test.each([
    [],
    ["retry", "chunk-analyst", "2", "host-transient"],
    ["retry", "unknown", "0", "host-transient"],
    ["retry", "chunk-analyst", "0", "just-retry"],
  ])("rejects malformed invocation %j", (...args) => {
    const result = spawnSync("python3", ["-I", SCRIPT, ...args], {
      encoding: "utf8",
    });
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toMatch(/invalid refactor contract/);
  });
});
