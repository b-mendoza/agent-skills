#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toText } from "#/observation/git-status.ts";
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

function runPromptfoo(
  argv: string[],
  runDirectory: string,
  stateDirectory: string,
): unknown {
  const outputPath = join(runDirectory, "results.json");
  const child = spawnSync(
    process.execPath,
    [
      PROMPTFOO_ENTRY,
      "eval",
      ...argv,
      "-c",
      join(EVAL_ROOT, "promptfooconfig.ts"),
      "--no-cache",
      "--no-share",
      "-o",
      outputPath,
      "-o",
      join(runDirectory, "results.html"),
    ],
    {
      cwd: EVAL_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        PROMPTFOO_CONFIG_DIR: stateDirectory,
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

function summarizeResults(input: unknown): number {
  const results = readResults(input);
  const exitCode = resultExitCode(results);
  if (exitCode === NO_CASES_MATCHED) {
    console.error("No cases matched.");
  } else {
    for (const result of results.filter((result) => result.status !== "PASS")) {
      console.log(
        `${result.id} ${result.status} ${result.attemptsPassed}/${result.attemptsRun} ${result.observed}`,
      );
    }
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

// The optional outputs root keeps offline tests away from production artifacts.
export function runCli(
  argv: string[],
  outputsRoot = join(EVAL_ROOT, "outputs"),
): number {
  try {
    const runsDirectory = resolve(outputsRoot, "runs");
    mkdirSync(runsDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const runDirectory = mkdtempSync(join(runsDirectory, `${timestamp}-`));
    const stateDirectory = resolve(outputsRoot, "promptfoo-state");
    console.log(`Run directory: ${runDirectory}`);
    console.log(`Attempt evidence JSON: ${join(runDirectory, "results.json")}`);
    console.log(`HTML report: ${join(runDirectory, "results.html")}`);
    console.log("History viewer: pnpm eval:view (from evals/)");
    return summarizeResults(runPromptfoo(argv, runDirectory, stateDirectory));
  } catch (cause) {
    reportFailure(cause);
    return INFRASTRUCTURE_ERROR;
  }
}

// Importing this module must never start a paid run.
if (import.meta.main) {
  process.exit(runCli(process.argv.slice(ARGV_START)));
}
