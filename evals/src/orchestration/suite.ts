import { writeFileSync } from "node:fs";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { BEHAVIORAL_TIER } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import type { Observation } from "#/observation/observation-types.ts";
import {
  executeCase,
  REPORT_TIER_BY_CASE_TIER,
} from "#/orchestration/execution.ts";
import {
  formatCaseResultLine,
  formatResultLine,
  renderReport,
  REPORT_PATH,
} from "#/orchestration/report.ts";
import type { AttemptResult, Result } from "#/orchestration/verdict.ts";
import {
  aggregateAttempts,
  evaluate,
  notRunResult,
} from "#/orchestration/verdict.ts";

export const DEFAULT_ATTEMPTS_PER_CASE = 5;
const DERIVED_CASE_ID = "mutation-scope";
const DERIVED_TIER = "2*";
const FIRST_ATTEMPT = 1;
const EMPTY = 0;

function deriveMutationScope(
  observations: ReadonlyMap<number, Observation[]>,
): Result {
  if (observations.size === EMPTY) {
    return notRunResult(DERIVED_CASE_ID, DERIVED_TIER);
  }
  return aggregateAttempts(
    [...observations.values()].map((attempt) => ({
      id: DERIVED_CASE_ID,
      tier: DERIVED_TIER,
      ...evaluate(() => checkMutationScope(attempt)),
      costUsd: 0,
      durationMs: 0,
    })),
  );
}

function recordObservation(
  evalCase: EvalCase,
  number: number,
  observation: Observation,
  groups: Map<number, Observation[]>,
): void {
  if (evalCase.tier !== BEHAVIORAL_TIER) return;
  const group = groups.get(number) ?? [];
  group.push(observation);
  groups.set(number, group);
}

async function executeAttempts(
  evalCase: EvalCase,
  attemptsPerCase: number,
  behavioralObservations: Map<number, Observation[]>,
): Promise<Result> {
  const attempts: AttemptResult[] = [];
  const numbers = Array.from(
    { length: attemptsPerCase },
    (_, index) => index + FIRST_ATTEMPT,
  );
  await numbers.reduce(async (previous, number) => {
    await previous;
    process.stdout.write(
      `· ${evalCase.id} (tier ${evalCase.tier}) attempt ${number}/${attemptsPerCase} ... `,
    );
    const { result, observation } = await executeCase(evalCase);
    recordObservation(evalCase, number, observation, behavioralObservations);
    attempts.push(result);
    console.log(formatResultLine(result));
    if (result.status === "FAIL") console.log(`    ${result.observed}`);
  }, Promise.resolve());
  return aggregateAttempts(attempts);
}

export async function executeSuite(
  evalCases: readonly EvalCase[],
  selectedCases: readonly EvalCase[],
  attemptsPerCase = DEFAULT_ATTEMPTS_PER_CASE,
  reportPath = REPORT_PATH,
): Promise<Result[]> {
  const results = new Map<string, Result>();
  const observations = new Map<number, Observation[]>();
  await selectedCases.reduce(async (previous, evalCase) => {
    await previous;
    const result = await executeAttempts(
      evalCase,
      attemptsPerCase,
      observations,
    );
    results.set(evalCase.id, result);
    console.log(
      `· ${evalCase.id} (tier ${evalCase.tier}) ... ${formatCaseResultLine(result)}`,
    );
  }, Promise.resolve());
  const derived = deriveMutationScope(observations);
  console.log(
    `· ${DERIVED_CASE_ID} (derived) ... ${formatCaseResultLine(derived)}`,
  );
  const reportResults = evalCases.map(
    (evalCase) =>
      results.get(evalCase.id) ??
      notRunResult(evalCase.id, REPORT_TIER_BY_CASE_TIER[evalCase.tier]),
  );
  reportResults.push(derived);
  writeFileSync(reportPath, renderReport(reportResults));
  console.log("\nReport written to evals/report.md");
  return reportResults;
}
