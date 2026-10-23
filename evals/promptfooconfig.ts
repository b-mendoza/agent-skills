import type { UnifiedConfig } from "promptfoo";

import { cases } from "#/cases/analyzing-recent-project-state.ts";

const configuredModel = process.env["EVAL_MODEL"];
// Capture once: later environment changes must not change an ongoing run.
export const evalModel =
  configuredModel === undefined || configuredModel === ""
    ? "sonnet"
    : configuredModel;

const MAX_CONCURRENCY = 5;

export default {
  description: `Agent skills evals (${evalModel})`,
  sharing: false,
  prompts: ["{{caseId}}"],
  providers: ["file://src/promptfoo/provider.ts"],
  evaluateOptions: {
    cache: false,
    maxConcurrency: MAX_CONCURRENCY,
    repeat: 5,
  },
  defaultTest: {
    assert: [
      {
        type: "javascript",
        value: "file://src/promptfoo/assertion.ts",
        metric: "case/{{caseId}}",
      },
    ],
  },
  tests: cases.map(({ id, tier }) => ({
    description: id,
    vars: { caseId: id },
    metadata: { tier },
  })),
} satisfies Partial<UnifiedConfig>;
