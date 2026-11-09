import { expect, test } from "vitest";

import {
  REFACTOR_FILES,
  REFACTOR_PLAN_PATH,
} from "#/cases/refactoring-code.ts";
import { assertOwnedReports } from "#/cases/refactoring-code-regression-checks.ts";
import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { getCase } from "#/cases/registry.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const skill = { name: "Skill", input: { skill: "refactoring-code" } };

// Verbatim shortened missing-target replies from eval-run-1, repeats 0/1/2.
test.each([
  {
    repeat: 0,
    text: `The refactoring-code skill needs a \`TARGET_PATH\` before it can start, and you haven't picked one.
Please give me:
- **Target (required):** a file path, for example \`src/billing/invoice.ts\`.
- **Goal (optional):** for example "simplify without changing behavior", or something narrower like "deduplicate" or "split up".`,
  },
  {
    repeat: 1,
    text: `The skill needs a \`TARGET_PATH\`, and you haven't picked one. I haven't read or changed any code.
Please give me:
1. **Target file or path** (required), for example \`src/billing/invoice.ts\`.
2. **Goal** (optional). The default is to simplify without changing behavior.
3. **Test command** (optional), for example \`npm test -- invoice\`.`,
  },
  {
    repeat: 2,
    text: `I need a target before I can start.
**Required**
- \`TARGET_PATH\`: the file to simplify, for example \`src/billing/invoice.ts\`.
**Optional**
- \`USER_GOAL\`: what you want, for example "simplify without changing behavior", "deduplicate", or "split a long function".`,
  },
])(
  "missing-target repeat $repeat still rejects the recorded optional-input menu",
  ({ text }) => {
    expect(() =>
      getCase("refactoring-code/missing-target").check(
        createObservation({
          finalText: text,
          toolCalls: [skill],
        }),
      ),
    ).toThrow(/optional inputs/);
  },
);

test("missing-target accepts one target question with an example, not an input form", () => {
  expect(() =>
    getCase("refactoring-code/missing-target").check(
      createObservation({
        finalText:
          "Which file should I refactor (for example src/billing/invoice.ts)?",
        toolCalls: [skill],
      }),
    ),
  ).not.toThrow();
});

test("plan-approval repeat 0 still rejects the actually executed pre-approval validation", () => {
  const command =
    'grep -rnE "money|round" src quote.test.js a.txt unrelated.txt; git log --oneline -- src/money.js; node --test quote.test.js 2>&1 | tail -12; echo exit=$?';
  expect(() =>
    getCase("refactoring-code/plan-approval").check(
      createObservation({
        finalText:
          "Please approve, adjust, or decline this plan for src/quote.js.",
        toolCalls: [skill, { name: "Bash", input: { command } }],
        repoFiles: {
          ...REFACTOR_FILES,
          [REFACTOR_PLAN_PATH]: "src/quote.js plan",
          ".git/logs/HEAD": "baseline",
          ".git/eval-baseline-reflog": "baseline",
        },
      }),
    ),
  ).toThrow(/validation command before approval/);
});

test("analyst repeat 1 variable-bound ignore proof requires captured success, allowing truncated output", () => {
  // The actual command and run id from repeat 1. Tool results were absent from
  // the supplied export; the result below models the repaired shared capture.
  const run = `${HANDOFFS}5455be71-c17e-492a-a8aa-7acf2e6e3015/`;
  const command = `R=.handoffs/refactoring-code/$(uuidgen | tr A-Z a-z)/ && git check-ignore --quiet --no-index -- "\${R}probe" && ! test -e "$R" && mkdir -p "$R" && echo "$R"`;
  const write = {
    name: "Write",
    input: { file_path: `${run}analysis-duplication-reuse.json` },
  };
  const good = createObservation({
    repoFiles: {
      [HANDOFFS]: "",
      [`${run}analysis-duplication-reuse.json`]: "report",
    },
    toolCalls: [
      {
        name: "Bash",
        input: { command },
        result: { content: run, isError: false, truncated: true },
      },
      write,
    ],
  });
  expect(() => {
    assertOwnedReports(good);
  }).not.toThrow();
  for (const result of [
    undefined,
    { content: run, isError: true, truncated: false },
    { content: `${HANDOFFS}wrong-run/`, isError: false, truncated: true },
  ]) {
    expect(() => {
      assertOwnedReports({
        ...good,
        toolCalls: [
          {
            name: "Bash",
            input: { command },
            ...(result === undefined ? {} : { result }),
          },
          write,
        ],
      });
    }).toThrow();
  }
});
