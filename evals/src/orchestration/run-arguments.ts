// Parses the runner's CLI flags and selects the cases they name. Pure decision
// logic: nothing here reads the environment, spends tokens, or writes output.

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import {
  BEHAVIORAL_TIER,
  ROUTING_TIER,
} from "#/cases/analyzing-recent-project-state.ts";

/** `process.argv` starts with the node binary and this script. */
export const ARGV_START = 2;
export const USAGE =
  "Usage: node evals/src/orchestration/run.ts [--tier=<integer>] [--case=<id>]";

export interface ParsedArguments {
  tier?: number;
  caseId?: string;
  errors: string[];
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

function isCaseTier(value: number): value is CaseTier {
  return value === ROUTING_TIER || value === BEHAVIORAL_TIER;
}

export function selectCases(
  evalCases: readonly EvalCase[],
  { tier, caseId }: ParsedArguments,
): EvalCase[] {
  if (tier != null && !isCaseTier(tier)) return [];

  return evalCases.filter(
    (evalCase) =>
      (tier == null || evalCase.tier === tier) &&
      (caseId == null || evalCase.id === caseId),
  );
}
