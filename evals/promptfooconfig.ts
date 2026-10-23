import type { UnifiedConfig } from "promptfoo";

import { evalModel } from "#/orchestration/configuration.ts";

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
  tests: "file://src/promptfoo/tests.ts",
} satisfies Partial<UnifiedConfig>;
