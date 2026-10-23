import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { UnifiedConfig } from "promptfoo";

import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import { cases } from "#/cases/registry.ts";

const configuredModel = process.env["EVAL_MODEL"];
// Capture once: later environment changes must not change an ongoing run.
export const evalModel =
  configuredModel === undefined || configuredModel === ""
    ? "sonnet"
    : configuredModel;

const MAX_CONCURRENCY = 5;
const runDirectory = join(
  fileURLToPath(new URL("outputs/runs/", import.meta.url)),
  `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`,
);

export default {
  description: `Agent skills evals (${evalModel})`,
  sharing: false,
  outputPath: [
    join(runDirectory, "results.json"),
    join(runDirectory, "results.html"),
  ],
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
        value: "file://src/promptfoo/assertion.ts:grade",
        metric: "case/{{caseId}}",
      },
    ],
  },
  tests: cases.map(({ id, tier }) => ({
    description: id,
    vars: { caseId: id },
    metadata: { tier },
    assert:
      tier === BEHAVIORAL_TIER
        ? [
            {
              type: "javascript" as const,
              value: "file://src/promptfoo/assertion.ts:mutationScope",
              metric: "mutation-scope",
            },
          ]
        : [],
  })),
} satisfies Partial<UnifiedConfig>;
