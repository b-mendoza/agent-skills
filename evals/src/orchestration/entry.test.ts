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
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, expect, test } from "vitest";

import { REPORT_PATH } from "#/orchestration/report.ts";

const RUN_PATH = fileURLToPath(new URL("./run.ts", import.meta.url));
const NO_CASES_MATCHED = 2;
const ALL_PASSED = 0;
const SPAWN_TIMEOUT_MS = 30_000;
let root = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "entry-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("direct execution reaches the coordinator without rewriting the report when no case matches", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const processResult = spawnSync(
    process.execPath,
    [RUN_PATH, "--filter-pattern", "^no-such-case-exists$"],
    {
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
      env: {
        ...process.env,
        IS_TESTING: "true",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        TMPDIR: root,
      },
    },
  );

  // Exit 2 proves the coordinator ran: the guard is true for a direct invocation.
  expect(processResult.stderr).toContain("No cases matched.");
  expect(processResult.status).toBe(NO_CASES_MATCHED);
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});

test("importing run.ts does not start a run", () => {
  const reportBefore = readFileSync(REPORT_PATH, "utf8");
  const importScript = `
    // Node's eval mode has no script-path argv entry. Add one so the selectors
    // land after it. The unmatched pattern keeps this probe offline: if the import guard breaks, the child
    // fails closed with "no cases matched" instead of exiting 0, and no paid
    // case can start.
    process.argv.push("import-probe", "--filter-pattern", "^no-such-case-exists$");
    await import(${JSON.stringify(RUN_PATH)});
  `;
  const processResult = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", importScript],
    {
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
      env: {
        ...process.env,
        IS_TESTING: "true",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        TMPDIR: root,
      },
    },
  );

  expect(processResult.status).toBe(ALL_PASSED);
  expect(readFileSync(REPORT_PATH, "utf8")).toBe(reportBefore);
});
