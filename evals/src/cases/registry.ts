import type { EvalCase } from "#/cases/case-contract.ts";

// Add one import here for each suite. Registration is explicit, not filesystem discovery.
const suites = await Promise.all([
  import("#/cases/analyzing-recent-project-state.ts"),
  import("#/cases/clarifying-assumptions.ts"),
  import("#/cases/committing-scoped-changes.ts"),
  import("#/cases/council-of-advisors.ts"),
  import("#/cases/creating-work-item-children.ts"),
  import("#/cases/diagnosing-root-causes.ts"),
  import("#/cases/executing-work-item-task.ts"),
  import("#/cases/fetching-work-item.ts"),
  import("#/cases/generate-flow-diagram.ts"),
  import("#/cases/generate-handoff-document.ts"),
  import("#/cases/improving-skill-definition.ts"),
  import("#/cases/improving-test-suites.ts"),
  import("#/cases/orchestrating-workflow.ts"),
  import("#/cases/planning-codebase-restructuring.ts"),
  import("#/cases/planning-task-execution.ts"),
  import("#/cases/planning-work-item-tasks.ts"),
  import("#/cases/pr-creator.ts"),
  import("#/cases/prompt-structurer.ts"),
  import("#/cases/recency-guard.ts"),
  import("#/cases/refactoring-code.ts"),
  import("#/cases/refine-task.ts"),
  import("#/cases/reporting-skill-issues.ts"),
  import("#/cases/responding-to-pr-review-comments.ts"),
  import("#/cases/review-pull-request.ts"),
]);

export const cases: readonly EvalCase[] = suites.flatMap<EvalCase>(
  (suite) => suite.cases,
);
export type CaseId = (typeof suites)[number]["cases"][number]["id"];
