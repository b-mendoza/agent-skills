// A false import.meta.main on direct invocation silently exits 0 like a passing
// suite; every other test would stay green. These probes fail closed before
// filesystem writes or subprocess execution, so they cannot touch live artifacts.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const RUN_PATH = fileURLToPath(new URL("./run.ts", import.meta.url));
const INFRASTRUCTURE_ERROR = 3;
const ALL_PASSED = 0;
const SPAWN_TIMEOUT_MS = 30_000;
const BLOCK_SIDE_EFFECTS = `
  import fs from "node:fs";
  import childProcess from "node:child_process";
  import { syncBuiltinESMExports } from "node:module";
  const blocked = () => { throw new Error("offline entry probe"); };
  fs.mkdirSync = blocked;
  fs.mkdtempSync = blocked;
  childProcess.spawnSync = blocked;
  syncBuiltinESMExports();
`;

function probe(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(BLOCK_SIDE_EFFECTS)}`,
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
      env: {
        ...process.env,
        IS_TESTING: "true",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
      },
    },
  );
}

test("direct execution reaches the coordinator without creating artifacts or starting an eval", () => {
  const processResult = probe([RUN_PATH]);

  // Exit 3 and our sentinel prove the coordinator ran, not just module loading.
  expect(processResult.stderr).toContain(
    "eval suite error: offline entry probe",
  );
  expect(processResult.status).toBe(INFRASTRUCTURE_ERROR);
});

test("importing run.ts does not start a run or create artifacts", () => {
  const processResult = probe([
    "--input-type=module",
    "-e",
    `await import(${JSON.stringify(RUN_PATH)});`,
  ]);

  expect(processResult.status).toBe(ALL_PASSED);
  expect(processResult.stdout).toBe("");
  expect(processResult.stderr).toBe("");
});
