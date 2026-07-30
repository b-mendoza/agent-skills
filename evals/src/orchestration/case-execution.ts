import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/harness.ts";
import { runClaude } from "#/observation/harness.ts";
import type { ReportTier, Result } from "#/orchestration/report.ts";
import { evalModel } from "#/orchestration/run-configuration.ts";

/** A report cell holds one line; a longer assertion message is truncated. */
const MAX_OBSERVED_CHARS = 160;
const ROUTING_TIER = 1;
const BEHAVIORAL_TIER = 2;

const REPORT_TIER_BY_CASE_TIER = {
  [ROUTING_TIER]: "1",
  [BEHAVIORAL_TIER]: "2",
} as const satisfies Record<CaseTier, ReportTier>;

export interface CaseExecutionResult {
  result: Result;
  observation: Observation;
}

/** Runs a check, turning a thrown assertion into a FAIL row. */
export function evaluate(check: () => string): {
  status: Result["status"];
  observed: string;
} {
  try {
    return { status: "PASS", observed: check() };
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error("An unknown error occurred", {
            cause: error,
          });

    const [firstLine = ""] = normalizedError.message.split("\n");
    return { status: "FAIL", observed: firstLine.slice(0, MAX_OBSERVED_CHARS) };
  }
}

export async function executeCase(
  evalCase: EvalCase,
): Promise<CaseExecutionResult> {
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
      model: evalModel,
      wallClockMs: evalCase.wallClockMs,
    });

    const { status, observed } = evaluate(() => evalCase.check(observation));

    return {
      result: {
        id: evalCase.id,
        tier: REPORT_TIER_BY_CASE_TIER[evalCase.tier],
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
