import type { EvalCase } from "#/cases/case-contract.ts";

// Add one import here for each suite. Registration is explicit, not filesystem discovery.
const suites = await Promise.all([
  import("#/cases/analyzing-recent-project-state.ts"),
  import("#/cases/clarifying-assumptions.ts"),
]);

export const cases: readonly EvalCase[] = suites.flatMap<EvalCase>(
  (suite) => suite.cases,
);
export type CaseId = (typeof suites)[number]["cases"][number]["id"];
