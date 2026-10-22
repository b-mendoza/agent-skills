import type { TestCase } from "promptfoo";

import { cases } from "#/cases/analyzing-recent-project-state.ts";

export default function generateTests(): TestCase[] {
  return cases.map(({ id, tier }) => ({
    description: id,
    vars: { caseId: id },
    metadata: { tier },
  }));
}
