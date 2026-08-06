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
  "Usage: node evals/src/orchestration/run.ts [--tier=<integer>] [--case=<id>] [--attempts=<count>]";

/** An attempt count below one would select cases and then measure nothing. */
const MIN_ATTEMPTS = 1;
/**
 * Attempts beyond this are runaway paid spend, and an unbounded count would
 * reach `Array.from({ length })` and crash with a suite error instead of a
 * usage error.
 */
const MAX_ATTEMPTS = 100;

export interface ParsedArguments {
  tier?: number;
  caseId?: string;
  attempts?: number;
  errors: string[];
}

function flagValue(argument: string, flagPattern: RegExp): string | undefined {
  return flagPattern.exec(argument)?.groups?.["value"];
}

function parseAttemptsArgument(
  argument: string,
): Partial<ParsedArguments> | undefined {
  const attemptsArgumentValue = flagValue(
    argument,
    /^--attempts=(?<value>\d+)$/,
  );
  if (attemptsArgumentValue == null) return undefined;

  const attempts = Number(attemptsArgumentValue);
  if (attempts < MIN_ATTEMPTS || attempts > MAX_ATTEMPTS) {
    return {
      errors: [
        `--attempts must be between ${MIN_ATTEMPTS} and ${MAX_ATTEMPTS}: ${argument}`,
      ],
    };
  }

  return { attempts };
}

function parseArgument(argument: string): Partial<ParsedArguments> {
  const tierArgumentValue = flagValue(argument, /^--tier=(?<value>\d+)$/);
  if (tierArgumentValue != null) return { tier: Number(tierArgumentValue) };

  const caseIdArgumentValue = flagValue(argument, /^--case=(?<value>.+)$/);
  if (caseIdArgumentValue != null) return { caseId: caseIdArgumentValue };

  return (
    parseAttemptsArgument(argument) ?? {
      errors: [`unrecognized or malformed argument: ${argument}`],
    }
  );
}

export function parseArgs(argv: string[]): ParsedArguments {
  const parsedArguments: ParsedArguments = { errors: [] };
  for (const argument of argv) {
    const { errors = [], ...update } = parseArgument(argument);
    Object.assign(parsedArguments, update);
    parsedArguments.errors.push(...errors);
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
