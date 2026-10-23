import { availableParallelism } from "node:os";

import type { UnifiedConfig } from "promptfoo";

export default {
  description: "Agent skills evals",
  sharing: false,
  prompts: ["{{caseId}}"],
  providers: ["file://src/promptfoo/provider.ts"],
  evaluateOptions: {
    cache: false,
    maxConcurrency: availableParallelism(),
    repeat: 5,
  },
  defaultTest: {
    assert: [
      { type: "javascript", value: "file://src/promptfoo/assertion.ts" },
    ],
  },
  tests: "file://src/promptfoo/tests.ts",
} satisfies Partial<UnifiedConfig>;
