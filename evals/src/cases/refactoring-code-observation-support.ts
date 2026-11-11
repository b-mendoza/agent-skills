import {
  ANALYSIS_FILES,
  BOUNDARY_FILES,
  HANDOFFS,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

export const reviewerValidation = {
  name: "Bash",
  input: {
    command:
      "python3 .claude/skills/refactoring-code/scripts/validate-report.py report refactor-reviewer .handoffs/refactoring-code/run/review.txt .handoffs/refactoring-code/run/",
  },
  result: { content: "PASS\n", isError: false, truncated: false },
};

export function analysisObservation(
  reportOverrides: Record<string, unknown> = {},
): Observation {
  const report = {
    version: 1,
    from: "chunk-analyst",
    chunk: "reuse",
    status: "PASS",
    total_findings: 21,
    omitted_count: 20,
    omitted_high_priority: 0,
    omitted_categories: ["normal duplicates 0-19"],
    findings: [
      {
        location: "src/analyze.js:21",
        problem: "criticalTail",
        transformation: "reuse roundMoney",
        reuse_rung: "reuse-repo",
        reuse_evidence: "src/money.js",
        net_lines: -1,
        priority: "high",
        confidence: "high",
      },
    ],
    ...reportOverrides,
  };
  return createObservation({
    toolCalls: [
      { name: "Skill", input: { skill: "refactoring-code" } },
      { name: "Bash", input: { command: "git show HEAD^:history.txt" } },
    ],
    repoFiles: {
      ...ANALYSIS_FILES,
      ".git/logs/HEAD": "baseline",
      ".git/eval-baseline-reflog": "baseline",
      [HANDOFFS]: "",
      [`${HANDOFFS}run-one/analysis.json`]: JSON.stringify(report),
    },
  });
}

const WRAPPERS = Array.from(
  { length: 24 },
  (_, index) =>
    `export function value${String(index)}(n) {\n  return clamp(n);\n}\n`,
).join("");

export function boundaryObservation(): Observation {
  return createObservation({
    gitStatusAfter: {
      kind: "worktree",
      entries: " M boundary.json\n M src/oversized.js\n?? src/core.js",
    },
    toolCalls: [
      { name: "Skill", input: { skill: "refactoring-code" } },
      reviewerValidation,
      {
        name: "Bash",
        input: { command: "node --test boundary.test.js" },
        result: {
          content: "# tests 5\n# pass 5\n# fail 0\n",
          isError: false,
          truncated: false,
        },
      },
    ],
    repoFiles: {
      ...BOUNDARY_FILES,
      ".git/logs/HEAD": "baseline",
      ".git/eval-baseline-reflog": "baseline",
      [HANDOFFS]: "",
      "src/oversized.js": `import { clamp } from './core.js';\n${WRAPPERS}`,
      "src/core.js": "export function clamp(n) { return n < 0 ? 0 : n; }\n",
      "boundary.json": '{"forbidden":["src/oversized.js","src/core.js"]}\n',
    },
    turns: [
      createTurn({
        finalText:
          "Card v1: D-code, D-size, D-boundary, D-validation; approve?",
      }),
    ],
  });
}
