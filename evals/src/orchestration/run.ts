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
import { fileURLToPath } from "node:url";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import {
  cases,
  checkMutationScope,
  SKILL,
} from "#/cases/analyzing-recent-project-state.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/harness.ts";
import { runClaude } from "#/observation/harness.ts";

const REPORT_PATH = fileURLToPath(new URL("../../report.md", import.meta.url));

const DEFAULT_MODEL = "sonnet";

export function resolveModel(configuredModel: string | undefined): string {
  // An empty EVAL_MODEL is an unset EVAL_MODEL, not a request for a nameless model.
  return configuredModel === undefined || configuredModel === ""
    ? DEFAULT_MODEL
    : configuredModel;
}

const MODEL = resolveModel(process.env["EVAL_MODEL"]);

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
/** A report cell holds one line; a longer assertion message is truncated. */
const MAX_OBSERVED_CHARS = 160;
const ROUTING_TIER = 1;
/** Only tier-2 runs are behavioral, so only they feed the derived scope check. */
const BEHAVIORAL_TIER = 2;
/** `process.argv` starts with the node binary and this script. */
const ARGV_START = 2;
/** The derived row is computed from runs already paid for, so it books neither. */
const NO_COST = 0;
const NO_DURATION = 0;

type Status = "PASS" | "FAIL";
/** Case tiers as they appear in the report; `2*` is the derived row. */
type Tier = "1" | "2" | "2*";

const REPORT_TIER_BY_CASE_TIER = {
  [ROUTING_TIER]: "1",
  [BEHAVIORAL_TIER]: "2",
} as const satisfies Record<CaseTier, Tier>;

export interface Result {
  id: string;
  tier: Tier;
  status: Status;
  observed: string;
  costUsd: number;
  durationMs: number;
}

export interface ParsedArguments {
  tier?: number;
  caseId?: string;
  errors: string[];
}

export interface CaseExecutionResult {
  result: Result;
  observation: Observation;
}

export interface RunnerServices {
  evalCases: readonly EvalCase[];
  executeCase: (evalCase: EvalCase) => Promise<CaseExecutionResult>;
  writeReport: (report: string) => void;
}

export function parseArgs(argv: string[]): ParsedArguments {
  const parsedArguments: ParsedArguments = { errors: [] };
  for (const argument of argv) {
    const tierMatch = /^--tier=(?<tier>\d+)$/.exec(argument)?.groups?.["tier"];
    if (tierMatch != null) {
      parsedArguments.tier = Number(tierMatch);
      continue;
    }

    const caseIdMatch = /^--case=(?<caseId>.+)$/.exec(argument)?.groups?.[
      "caseId"
    ];
    if (caseIdMatch != null) {
      parsedArguments.caseId = caseIdMatch;
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

/** Runs a check, turning a thrown assertion into a FAIL row. */
export function evaluate(check: () => string): {
  status: Status;
  observed: string;
} {
  try {
    return { status: "PASS", observed: check() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [firstLine = ""] = message.split("\n");
    return { status: "FAIL", observed: firstLine.slice(0, MAX_OBSERVED_CHARS) };
  }
}

function toReportTier(caseTier: CaseTier): Tier {
  return REPORT_TIER_BY_CASE_TIER[caseTier];
}

async function runCase(evalCase: EvalCase): Promise<CaseExecutionResult> {
  const fixture = makeFixture(evalCase.fixture, SKILL);
  try {
    const observation = await runClaude({
      cwd: fixture.cwd,
      gitRepo: fixture.gitRepo ?? fixture.cwd,
      prompt: evalCase.prompt({
        missingPath: fixture.missingPath,
        notGitPath: fixture.notGitPath,
      }),
      budgetUsd: evalCase.budgetUsd,
      model: MODEL,
      wallClockMs: evalCase.wallClockMs,
    });

    const { status, observed } = evaluate(() => evalCase.check(observation));

    return {
      result: {
        id: evalCase.id,
        tier: toReportTier(evalCase.tier),
        status,
        observed,
        costUsd: observation.costUsd,
        durationMs: observation.durationMs,
      },
      observation,
    };
  } finally {
    fixture.cleanup();
  }
}

/** A `|` would split a table column and a newline would end the row. */
export function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderReport(results: Result[]): string {
  const passedCount = results.filter(
    (result) => result.status === "PASS",
  ).length;
  const failedCount = results.filter(
    (result) => result.status === "FAIL",
  ).length;
  const totalCostUsd = results.reduce(
    (total, result) => total + result.costUsd,
    0,
  );
  const totalDurationSeconds = Math.round(
    results.reduce((total, result) => total + result.durationMs, 0) /
      MS_PER_SECOND,
  );
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const reportRows = results
    .map(
      (result) =>
        `| ${result.id} | ${result.tier} | ${result.status} | ${escapeCell(result.observed)} |`,
    )
    .join("\n");

  return `# Eval Report — ${SKILL}

Generated by \`node evals/src/orchestration/run.ts\`. Rewritten every run and committed, so a
behavior change shows up as a diff.

Run: ${generatedAt} · ${results.length} cases · ${passedCount} pass · ${failedCount} fail · $${totalCostUsd.toFixed(COST_DECIMALS)} · ${totalDurationSeconds}s · model \`${MODEL}\`

| Case | Tier | Result | Observed |
| ---- | ---- | ------ | -------- |
${reportRows}

Tier 1 cases are budget-capped and assert only the routing decision. Tier 2
cases are full behavioral runs. Every case listed here was executed; this report
records only observed results.
`;
}

function writeReport(report: string): void {
  writeFileSync(REPORT_PATH, report);
}

const defaultRunnerServices: RunnerServices = {
  evalCases: cases,
  executeCase: runCase,
  writeReport,
};

function suiteErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function executeSelectedCases(
  selectedCases: readonly EvalCase[],
  services: RunnerServices,
): Promise<ExitCode> {
  const results: Result[] = [];
  const behavioralObservations: Observation[] = [];

  for (const evalCase of selectedCases) {
    process.stdout.write(`· ${evalCase.id} (tier ${evalCase.tier}) ... `);
    // Sequential execution is the documented design (see the header): each case
    // starts a real Agent SDK query that spends tokens, so `Promise.all` here would
    // burn budget in parallel and interleave the progress lines this loop prints.
    // oxlint-disable-next-line no-await-in-loop -- Cases must run one at a time; see above.
    const { result, observation } = await services.executeCase(evalCase);
    if (evalCase.tier === BEHAVIORAL_TIER) {
      behavioralObservations.push(observation);
    }
    results.push(result);
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
    results.push({
      id: "mutation-scope",
      tier: "2*",
      status,
      observed,
      costUsd: NO_COST,
      durationMs: NO_DURATION,
    });
    console.log(`· mutation-scope (derived) ... ${status}`);
  }

  services.writeReport(renderReport(results));
  console.log(`\nReport written to evals/report.md`);

  const hasFailure = results.some((result) => result.status === "FAIL");
  return hasFailure ? EXIT_CODES.CASE_FAILED : EXIT_CODES.ALL_PASSED;
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
    console.error(`eval suite error: ${suiteErrorMessage(error)}`);
    return EXIT_CODES.SUITE_ERROR;
  }
}

// Only a direct `node run.ts` spends money. Importing this module -- which the
// offline tests do, to reach the pure helpers above -- must never start a run.
if (import.meta.main) {
  process.exit(await runCli(process.argv.slice(ARGV_START)));
}
