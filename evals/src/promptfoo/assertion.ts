import { Schema } from "effect";
import type { GradingResult } from "promptfoo";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { cases } from "#/cases/analyzing-recent-project-state.ts";
import { checkMutationScope } from "#/cases/analyzing-recent-project-state-checks.ts";
import { observationSchema } from "#/observation/agent-query.ts";

export const FIRST_REPEAT = 0;
const metadataSchema = Schema.Struct({
  observation: observationSchema,
  repeatIndex: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(FIRST_REPEAT),
  ),
});

export function getCase(caseId: unknown): EvalCase {
  const evalCase = cases.find((candidate) => candidate.id === caseId);
  if (evalCase === undefined) {
    throw new Error(`Unknown caseId: ${String(caseId)}`);
  }
  return evalCase;
}

const PASS_SCORE = 1;
const FAIL_SCORE = 0;
export const MAX_OBSERVED_CHARS = 160;
const FIRST_CHARACTER_INDEX = 0;
const UNKNOWN_ERROR_MESSAGE = "An unknown error occurred";
const decodeContext = Schema.decodeUnknownSync(
  Schema.Struct({
    vars: Schema.Struct({ caseId: Schema.String }),
    metadata: metadataSchema,
  }),
);

function describeNonErrorCheckFailure(cause: unknown): string {
  try {
    return String(cause);
  } catch (stringConversionError) {
    return UNKNOWN_ERROR_MESSAGE;
  }
}

function normalizeCheckFailure(cause: unknown): GradingResult {
  const failureMessage =
    cause instanceof Error
      ? cause.message
      : describeNonErrorCheckFailure(cause);
  const [firstLine = ""] = failureMessage.split("\n");
  return {
    pass: false,
    score: FAIL_SCORE,
    reason: firstLine.slice(FIRST_CHARACTER_INDEX, MAX_OBSERVED_CHARS),
  };
}

export function evaluate(check: () => string): GradingResult {
  try {
    return { pass: true, score: PASS_SCORE, reason: check() };
  } catch (cause) {
    return normalizeCheckFailure(cause);
  }
}

export async function grade(
  _output: unknown,
  context: unknown,
): Promise<GradingResult> {
  const parsed = decodeContext(context);
  const evalCase = getCase(parsed.vars.caseId);
  const { observation } = parsed.metadata;
  const mechanical = evaluate(() => evalCase.check(observation));
  if (!mechanical.pass || evalCase.judge === undefined) return mechanical;
  try {
    const judgeObserved = await evalCase.judge(observation);
    return {
      ...mechanical,
      reason: `${mechanical.reason}; ${judgeObserved}`,
    };
  } catch (cause) {
    const failure = normalizeCheckFailure(cause);
    failure.reason = failure.reason
      .replace(/^(?!judge\b)/i, "judge: ")
      .slice(FIRST_CHARACTER_INDEX, MAX_OBSERVED_CHARS);
    return failure;
  }
}

export function mutationScope(
  _output: unknown,
  context: unknown,
): GradingResult {
  const { observation } = decodeContext(context).metadata;
  return evaluate(() => checkMutationScope(observation));
}
