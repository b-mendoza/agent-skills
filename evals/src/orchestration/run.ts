#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { toText } from "#/observation/git-status.ts";
import { renderReport, REPORT_PATH } from "#/orchestration/report.ts";
import { readResults, resultExitCode } from "#/promptfoo/results.ts";

const EVAL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROMPTFOO_ENTRY = fileURLToPath(
  new URL("./entrypoint.js", import.meta.resolve("promptfoo")),
);
const PROMPTFOO_FAILURE = 100;
const INFRASTRUCTURE_ERROR = 3;
const NO_CASES_MATCHED = 2;
const ALL_PASSED = 0;
const ARGV_START = 2;

function runPromptfoo(argv: string[], outputPath: string): unknown {
  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  const child = spawnSync(
    process.execPath,
    [
      PROMPTFOO_ENTRY,
      "eval",
      ...argv,
      "-c",
      join(EVAL_ROOT, "promptfooconfig.ts"),
      "--no-cache",
      "--no-write",
      "--no-share",
      "-o",
      outputPath,
    ],
    {
      cwd: EVAL_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        PROMPTFOO_FAILED_TEST_EXIT_CODE: String(PROMPTFOO_FAILURE),
      },
    },
  );
  if (child.error !== undefined) throw child.error;
  if (child.status !== ALL_PASSED && child.status !== PROMPTFOO_FAILURE) {
    throw new Error(
      `promptfoo exited: ${JSON.stringify({ status: child.status, signal: child.signal })}`,
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(outputPath, "utf8"));
  return parsed;
}

function writeReport(input: unknown, reportPath: string): number {
  const results = readResults(input);
  const exitCode = resultExitCode(results);
  if (exitCode === NO_CASES_MATCHED) {
    console.error("No cases matched.");
  } else {
    writeFileSync(reportPath, renderReport(results));
    console.log("\nReport written to evals/report.md");
  }
  return exitCode;
}

function reportFailure(cause: unknown): void {
  try {
    console.error(
      `eval suite error: ${cause instanceof Error ? cause.message : toText(cause)}`,
    );
  } catch (outputFailure) {
    // A broken diagnostic channel must not replace the infrastructure exit code.
  }
}

// The optional paths keep offline tests away from committed reports and live JSON.
export function runCli(
  argv: string[],
  reportPath = REPORT_PATH,
  outputPath?: string,
): number {
  try {
    const resultsPath =
      outputPath ??
      join(mkdtempSync(join(tmpdir(), "agent-skills-eval-")), "results.json");
    console.log(`Attempt evidence JSON: ${resultsPath}`);
    return writeReport(runPromptfoo(argv, resultsPath), reportPath);
  } catch (cause) {
    reportFailure(cause);
    return INFRASTRUCTURE_ERROR;
  }
}

// Importing this module must never start a paid run.
if (import.meta.main) {
  process.exit(runCli(process.argv.slice(ARGV_START)));
}
