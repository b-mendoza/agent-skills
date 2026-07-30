#!/usr/bin/env node
// Entry point for the local eval suite.
//
//   node evals/src/orchestration/run.ts                    every case
//   node evals/src/orchestration/run.ts --tier=1           routing cases only (fast, cents)
//   node evals/src/orchestration/run.ts --case=path-error  one case
//
// Cases run sequentially: they spend real tokens and the wall-clock cost of
// parallelism is not worth the token burn on a suite this small.
//
// Exit codes: 0 all pass · 1 a case failed · 2 no cases matched · 3 suite error · 4 usage error

import { writeFileSync } from "node:fs";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/harness.ts";
import type { CaseExecutionResult } from "#/orchestration/case-execution.ts";
import { evaluate, executeCase } from "#/orchestration/case-execution.ts";
import type { Result } from "#/orchestration/report.ts";
import { renderReport, REPORT_PATH } from "#/orchestration/report.ts";

/** Exit codes are the machine-readable contract; see the header comment. */
export const EXIT_CODES = {
  ALL_PASSED: 0,
  CASE_FAILED: 1,
  NO_CASES_MATCHED: 2,
  SUITE_ERROR: 3,
  USAGE_ERROR: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

const MS_PER_SECOND = 1000;
const COST_DECIMALS = 2;
const WHOLE_SECONDS = 0;
/** Only tier-2 runs are behavioral, so only they feed the derived scope check. */
const BEHAVIORAL_TIER = 2;
/** `process.argv` starts with the node binary and this script. */
const ARGV_START = 2;
/** The derived row is computed from runs already paid for, so it books neither. */
const NO_COST = 0;
const NO_DURATION = 0;

export interface ParsedArguments {
  tier?: number;
  caseId?: string;
  errors: string[];
}

export interface RunnerServices {
  evalCases: readonly EvalCase[];
  executeCase: (evalCase: EvalCase) => Promise<CaseExecutionResult>;
  writeReport: (report: string) => void;
}

export function parseArgs(argv: string[]): ParsedArguments {
  const parsedArguments: ParsedArguments = { errors: [] };
  for (const argument of argv) {
    const tierArgumentValue = /^--tier=(?<tier>\d+)$/.exec(argument)?.groups?.[
      "tier"
    ];
    if (tierArgumentValue != null) {
      parsedArguments.tier = Number(tierArgumentValue);
      continue;
    }

    const caseIdArgumentValue = /^--case=(?<caseId>.+)$/.exec(argument)
      ?.groups?.["caseId"];
    if (caseIdArgumentValue != null) {
      parsedArguments.caseId = caseIdArgumentValue;
      continue;
    }

    parsedArguments.errors.push(
      `unrecognized or malformed argument: ${argument}`,
    );
  }
  return parsedArguments;
}

function selectCases(
  evalCases: readonly EvalCase[],
  { tier, caseId }: ParsedArguments,
): EvalCase[] {
  return evalCases.filter(
    (evalCase) =>
      (tier == null || evalCase.tier === tier) &&
      (caseId == null || evalCase.id === caseId),
  );
}

const defaultRunnerServices: RunnerServices = {
  evalCases: cases,
  executeCase,
  writeReport: (report) => {
    writeFileSync(REPORT_PATH, report);
  },
};

async function executeSelectedCases(
  selectedCases: readonly EvalCase[],
  services: RunnerServices,
): Promise<ExitCode> {
  const reportResults: Result[] = [];
  const behavioralObservations: Observation[] = [];

  for (const evalCase of selectedCases) {
    process.stdout.write(`· ${evalCase.id} (tier ${evalCase.tier}) ... `);
    // Sequential execution is the documented design (see the header): each case
    // starts a real Agent SDK query that spends tokens, so `Promise.all` here would
    // burn budget in parallel and interleave the progress lines this loop prints.
    const { result, observation } = await services.executeCase(evalCase);
    if (evalCase.tier === BEHAVIORAL_TIER) {
      behavioralObservations.push(observation);
    }
    reportResults.push(result);
    console.log(
      `${result.status} ${(result.durationMs / MS_PER_SECOND).toFixed(WHOLE_SECONDS)}s $${result.costUsd.toFixed(COST_DECIMALS)}`,
    );
    if (result.status === "FAIL") console.log(`    ${result.observed}`);
  }

  // Derived from the tier-2 runs; costs no extra invocation.
  if (behavioralObservations.length > 0) {
    const { status, observed } = evaluate(() =>
      checkMutationScope(behavioralObservations),
    );
    reportResults.push({
      id: "mutation-scope",
      tier: "2*",
      status,
      observed,
      costUsd: NO_COST,
      durationMs: NO_DURATION,
    });
    console.log(`· mutation-scope (derived) ... ${status}`);
  }

  services.writeReport(renderReport(reportResults));
  console.log(`\nReport written to evals/report.md`);

  const hasFailedResult = reportResults.some(
    (result) => result.status === "FAIL",
  );
  return hasFailedResult ? EXIT_CODES.CASE_FAILED : EXIT_CODES.ALL_PASSED;
}

export async function runCli(
  argv: string[],
  services: RunnerServices = defaultRunnerServices,
): Promise<ExitCode> {
  try {
    const parsedArguments = parseArgs(argv);
    const { errors } = parsedArguments;
    if (errors.length > 0) {
      for (const error of errors) console.error(error);
      console.error(
        "Usage: node evals/src/orchestration/run.ts [--tier=<integer>] [--case=<id>]",
      );
      return EXIT_CODES.USAGE_ERROR;
    }

    const selectedCases = selectCases(services.evalCases, parsedArguments);

    if (selectedCases.length === 0) {
      console.error("No cases matched.");
      return EXIT_CODES.NO_CASES_MATCHED;
    }

    return await executeSelectedCases(selectedCases, services);
  } catch (error) {
    console.error(
      `eval suite error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return EXIT_CODES.SUITE_ERROR;
  }
}

// Only a direct `node run.ts` spends money. Importing this module -- which the
// offline tests do, to reach the pure helpers above -- must never start a run.
if (import.meta.main) {
  process.exit(await runCli(process.argv.slice(ARGV_START)));
}
