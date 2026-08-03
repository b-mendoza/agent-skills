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

import { EXIT_CODES } from "#/orchestration/run-coordination.ts";

const RUN_PATH = fileURLToPath(new URL("./run.ts", import.meta.url));
const REPORT_PATH = fileURLToPath(new URL("../../report.md", import.meta.url));
const SPAWN_TIMEOUT_MS = 30_000;

test("direct execution reaches the coordinator without rewriting the report when no case matches", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const processResult = spawnSync(
    process.execPath,
    [RUN_PATH, "--case=no-such-case-exists"],
    { encoding: "utf8", timeout: SPAWN_TIMEOUT_MS },
  );

  // Exit 2 proves the coordinator ran: the guard is true for a direct invocation.
  expect(processResult.status).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(processResult.stdout).toBe("");
  expect(processResult.stderr).toContain("No cases matched.");
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});

test("an invalid selector exits 4 before running or rewriting the report", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const processResult = spawnSync(process.execPath, [RUN_PATH, "--tier=abc"], {
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
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
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const importScript = `
    // Node's eval mode has no script-path argv entry. Add one so the malformed
    // selector lands after it: if the import guard breaks, the child fails closed
    // with a usage error before any paid case can start.
    process.argv.push("import-probe", "--tier=abc");
    await import(${JSON.stringify(RUN_PATH)});
  `;
  const processResult = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", importScript],
    { encoding: "utf8", timeout: SPAWN_TIMEOUT_MS },
  );

  expect(processResult.status).toBe(EXIT_CODES.ALL_PASSED);
  expect(processResult.stdout).toBe("");
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});
