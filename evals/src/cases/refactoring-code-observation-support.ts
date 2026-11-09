import {
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
