// Parse selectors, run the selected suite, and contain infrastructure failures.

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { executeSuite } from "#/orchestration/suite.ts";
import type { Result } from "#/orchestration/verdict.ts";

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

export function selectCases(
  evalCases: readonly EvalCase[],
  { tier, caseId }: ParsedArguments,
): EvalCase[] {
  return evalCases.filter(
    (evalCase) =>
      (tier == null || evalCase.tier === tier) &&
      (caseId == null || evalCase.id === caseId),
  );
}

const EMPTY = 0;

export const EXIT_CODES = {
  ALL_PASSED: 0,
  CASE_FAILED: 1,
  NO_CASES_MATCHED: 2,
  SUITE_ERROR: 3,
  USAGE_ERROR: 4,
} as const;

function describeFailure(cause: unknown): string {
  try {
    return cause instanceof Error ? cause.message : String(cause);
  } catch (cause) {
    return new Error("An unknown error occurred", { cause }).message;
  }
}

function reportFailure(cause: unknown): void {
  try {
    console.error(`eval suite error: ${describeFailure(cause)}`);
  } catch (outputFailure) {
    // A broken output channel must not replace the infrastructure exit code.
  }
}

function resultExitCode(results: Result[]): number {
  return results.some(
    (result) => result.status === "FAIL" || result.status === "DEGRADED",
  )
    ? EXIT_CODES.CASE_FAILED
    : EXIT_CODES.ALL_PASSED;
}

// The optional path is private test plumbing, never a CLI flag.
export async function runCli(
  argv: string[],
  reportPath?: string,
): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.errors.length !== EMPTY) {
      parsed.errors.forEach((message) => {
        console.error(message);
      });
      console.error(USAGE);
      return EXIT_CODES.USAGE_ERROR;
    }
    const selected = selectCases(cases, parsed);
    if (selected.length === EMPTY) {
      console.error("No cases matched.");
      return EXIT_CODES.NO_CASES_MATCHED;
    }
    const results = await executeSuite(
      cases,
      selected,
      parsed.attempts,
      reportPath,
    );
    return resultExitCode(results);
  } catch (cause) {
    reportFailure(cause);
    return EXIT_CODES.SUITE_ERROR;
  }
}
