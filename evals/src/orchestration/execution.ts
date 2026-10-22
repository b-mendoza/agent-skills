import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import {
  BEHAVIORAL_TIER,
  ROUTING_TIER,
  SKILL,
} from "#/cases/analyzing-recent-project-state.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import type { Observation } from "#/observation/observation-types.ts";
import { evalModel } from "#/orchestration/configuration.ts";
import type { AttemptResult, ReportTier } from "#/orchestration/verdict.ts";
import { evaluate, evaluateWithJudge } from "#/orchestration/verdict.ts";

export const REPORT_TIER_BY_CASE_TIER = {
  [ROUTING_TIER]: "1",
  [BEHAVIORAL_TIER]: "2",
} as const satisfies Record<CaseTier, ReportTier>;

export const FAILURE_ARTIFACT_DIRECTORY = join(
  tmpdir(),
  "agent-skills-eval-failures",
);

export interface CaseExecutionResult {
  result: AttemptResult;
  observation: Observation;
}

function persistFailure(caseId: string, finalText: string): void {
  try {
    mkdirSync(FAILURE_ARTIFACT_DIRECTORY, { recursive: true });
    const existingCount = readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter(
      (fileName) => fileName.startsWith(`${caseId}-`),
    ).length;
    writeFileSync(
      join(FAILURE_ARTIFACT_DIRECTORY, `${caseId}-${existingCount}.txt`),
      finalText,
    );
  } catch (cause) {
    console.error(`failure-artifact persistence failed: ${String(cause)}`);
  }
}

async function checkObservation(evalCase: EvalCase, observation: Observation) {
  const mechanical = evaluate(() => evalCase.check(observation));
  return mechanical.status === "PASS" && evalCase.judge !== undefined
    ? evaluateWithJudge(evalCase.judge, observation, mechanical.observed)
    : mechanical;
}

export async function executeCase(
  evalCase: EvalCase,
): Promise<CaseExecutionResult> {
  const fixture = makeFixture(evalCase.fixture, SKILL);
  try {
    const observation = await observeClaude({
      cwd: fixture.cwd,
      gitRepo: fixture.gitRepo ?? fixture.cwd,
      prompt: evalCase.prompt({
        missingPath: fixture.missingPath,
        notGitPath: fixture.notGitPath,
      }),
      budgetUsd: evalCase.budgetUsd,
      model: evalModel,
      wallClockMs: evalCase.wallClockMs,
    });
    const outcome = await checkObservation(evalCase, observation);
    if (outcome.status === "FAIL") {
      persistFailure(evalCase.id, observation.finalText);
    }
    return {
      result: {
        id: evalCase.id,
        tier: REPORT_TIER_BY_CASE_TIER[evalCase.tier],
        ...outcome,
        costUsd: observation.costUsd,
        durationMs: observation.durationMs,
      },
      observation,
    };
  } finally {
    fixture.cleanup();
  }
}
