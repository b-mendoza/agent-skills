// Proves the direct-entry guard still fires.
//
// `run.ts` wraps `main()` in `if (import.meta.main)` so the offline tests can
// import its helpers without spawning a paid run. The failure mode that guard
// introduces is silent: if it were ever false for a direct invocation, the
// suite would do nothing and exit 0 -- indistinguishable from "everything
// passed". Every other test here would still be green.
//
// `--case=` with an id no case defines reaches the "no cases matched" branch,
// which exits before an Agent SDK query is ever started, so this costs nothing.
//
//   pnpm test

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const RUN = fileURLToPath(new URL("./run.ts", import.meta.url));
const REPORT = fileURLToPath(new URL("../../report.md", import.meta.url));
const EXIT_NO_CASES_MATCHED = 2;
const EXIT_USAGE_ERROR = 4;

test("running run.ts directly reaches main() and exits 2 on no match", () => {
  const result = spawnSync(
    process.execPath,
    [RUN, "--case=no-such-case-exists"],
    { encoding: "utf8" },
  );

  // Exit 2 proves main() ran: the guard is true for a direct invocation.
  expect(result.status).toBe(EXIT_NO_CASES_MATCHED);
  expect(result.stderr).toContain("No cases matched.");
});

test("an invalid selector exits 4 before running or rewriting the report", () => {
  const reportBefore = readFileSync(REPORT, "utf8");
  const result = spawnSync(process.execPath, [RUN, "--tier=abc"], {
    encoding: "utf8",
  });

  expect(result.status).toBe(EXIT_USAGE_ERROR);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(
    "unrecognized or malformed argument: --tier=abc",
  );
  expect(result.stderr).toContain("Usage: node evals/src/orchestration/run.ts");
  expect(readFileSync(REPORT, "utf8")).toBe(reportBefore);
});

test("importing run.ts does not start a run", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(RUN)});`],
    { encoding: "utf8" },
  );

  // No case ran, so nothing was selected, queried, or reported.
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
});
