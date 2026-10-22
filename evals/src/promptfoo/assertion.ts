import { Schema } from "effect";
import type { GradingResult } from "promptfoo";

import { evaluate, evaluateWithJudge } from "#/orchestration/verdict.ts";

import { getCase, metadataSchema } from "./observation.ts";

const PASS_SCORE = 1;
const FAIL_SCORE = 0;
const decodeContext = Schema.decodeUnknownSync(
  Schema.Struct({
    vars: Schema.Struct({ caseId: Schema.String }),
    metadata: metadataSchema,
  }),
);

export default async function grade(
  _output: unknown,
  context: unknown,
): Promise<GradingResult> {
  const parsed = decodeContext(context);
  const evalCase = getCase(parsed.vars.caseId);
  const { observation } = parsed.metadata;
  const mechanical = evaluate(() => evalCase.check(observation));
  const outcome =
    mechanical.status === "PASS" && evalCase.judge !== undefined
      ? await evaluateWithJudge(
          evalCase.judge,
          observation,
          mechanical.observed,
        )
      : mechanical;
  const pass = outcome.status === "PASS";
  return {
    pass,
    score: pass ? PASS_SCORE : FAIL_SCORE,
    reason: outcome.observed,
  };
}
