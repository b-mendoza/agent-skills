// Proves the direct-entry guard still fires.
//
// `run.ts` wraps the coordinator in `if (import.meta.main)` so the offline tests
// can import its helpers without spawning a paid run. The failure mode that guard
// introduces is silent: if it were ever false for a direct invocation, the suite
// would do nothing and exit 0 -- indistinguishable from "everything passed".
// Every other test here would still be green.
//
// Unmatched selectors exit before an Agent SDK query is ever started, so these
// direct-entry checks cost nothing.
//
//   pnpm test

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { EXIT_CODES } from "#/orchestration/run.ts";

const RUN_PATH = fileURLToPath(new URL("./run.ts", import.meta.url));
const REPORT_PATH = fileURLToPath(new URL("../../report.md", import.meta.url));

test("running run.ts directly reaches the coordinator and exits 2 on no match", () => {
  const processResult = spawnSync(
    process.execPath,
    [RUN_PATH, "--case=no-such-case-exists"],
    { encoding: "utf8" },
  );

  // Exit 2 proves the coordinator ran: the guard is true for a direct invocation.
  expect(processResult.status).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(processResult.stderr).toContain("No cases matched.");
});

test("numeric tier 0 exits 2 without rewriting the report", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const processResult = spawnSync(process.execPath, [RUN_PATH, "--tier=0"], {
    encoding: "utf8",
  });

  expect(processResult.status).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(processResult.stdout).toBe("");
  expect(processResult.stderr).toContain("No cases matched.");
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});

test("an invalid selector exits 4 before running or rewriting the report", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const processResult = spawnSync(process.execPath, [RUN_PATH, "--tier=abc"], {
    encoding: "utf8",
  });

  expect(processResult.status).toBe(EXIT_CODES.USAGE_ERROR);
  expect(processResult.stdout).toBe("");
  expect(processResult.stderr).toContain(
    "unrecognized or malformed argument: --tier=abc",
  );
  expect(processResult.stderr).toContain(
    "Usage: node evals/src/orchestration/run.ts",
  );
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});

test("importing run.ts does not start a run", () => {
  const processResult = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(RUN_PATH)});`],
    { encoding: "utf8" },
  );

  // No case ran, so nothing was selected, queried, or reported.
  expect(processResult.status).toBe(EXIT_CODES.ALL_PASSED);
  expect(processResult.stdout).toBe("");
});
