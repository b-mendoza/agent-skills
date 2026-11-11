import { expect, test } from "vitest";

import {
  boundaryObservation,
  reviewerValidation,
} from "#/cases/refactoring-code-observation-support.ts";
import { checkBoundaryReduction } from "#/cases/refactoring-code-regression-checks.ts";
import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import type { ToolCall } from "#/observation/agent-query.ts";

const invocation = { name: "Skill", input: { skill: "refactoring-code" } };

const mutations: ToolCall[] = [
  {
    name: "Write",
    input: {
      file_path: "src/core.js",
      content: "export function clamp() { return 99; }\n",
    },
  },
  { name: "Edit", input: { file_path: "src/core.js" } },
  { name: "Write", input: { file_path: "boundary.json" } },
  { name: "NotebookEdit", input: { notebook_path: "src/core.js" } },
  ...[
    "printf broken > src/core.js",
    "sed -i 's/return n/return 99/' src/core.js",
    "printf broken | tee src/core.js",
    `node -e 'require("fs").writeFileSync("src/core.js", "broken")'`,
    `python3 -c 'from pathlib import Path; Path("src/core.js").write_text("broken")'`,
    "git restore src/core.js",
  ].map((command) => ({ name: "Bash", input: { command } })),
];

function orderedEvidence(): ToolCall[] {
  return [
    ...boundaryObservation().toolCalls.filter(
      (call) => call !== reviewerValidation,
    ),
    reviewerValidation,
  ];
}

test.each(mutations)(
  "rejects stale boundary tests after $name $input",
  (mutation) => {
    const good = boundaryObservation();
    expect(() =>
      checkBoundaryReduction({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          "src/core.js": "export function clamp() { return 99; }\n",
        },
        toolCalls: [...orderedEvidence(), mutation],
      }),
    ).toThrow(/test evidence/);
  },
);

test.each(mutations)(
  "accepts boundary tests and review after $name $input",
  (mutation) => {
    expect(() =>
      checkBoundaryReduction({
        ...boundaryObservation(),
        toolCalls: [mutation, ...orderedEvidence()],
      }),
    ).not.toThrow();
  },
);

test.each([
  "sed -i '' 's/return n/return 99/' src/core.js",
  "sed -E -i 's/return n/return 99/' src/core.js",
  "sed -i -e 's/return n/return 99/' src/core.js",
  "sed --in-place 's/return n/return 99/' src/core.js",
  "perl -pi -e 's/return n/return 99/' src/core.js",
  "perl -i -pe 's/return n/return 99/' src/core.js",
  "printf x | tee -a src/core.js",
  "sed -i.bak 's/return n/return 99/' src/core.js",
  "sed -Ei 's/return n/return 99/' src/core.js",
  "sed -n -i 's/return n/return 99/p' src/core.js",
  "sed -i -f changes.sed src/core.js",
  "perl -i -p -f changes.pl src/core.js",
  "sed -i '' '' src/core.js",
  "printf x | tee -- --",
  `sed -n 's/a/b/p' .handoffs/refactoring-code/run/review.txt > "src/core.js"`,
])(
  "rejects stale boundary evidence after shell file operands: %s",
  (command) => {
    expect(() =>
      checkBoundaryReduction({
        ...boundaryObservation(),
        toolCalls: [...orderedEvidence(), { name: "Bash", input: { command } }],
      }),
    ).toThrow(/test evidence/);
  },
);

test.each([
  "sed -i '' 's/foo/bar/' .handoffs/refactoring-code/run/review.txt",
  "sed -i -e 's/foo/bar/' .handoffs/refactoring-code/run/review.txt",
  "perl -pi -e 's/foo/bar/' .handoffs/refactoring-code/run/review.txt",
  "sed -n 's/return n/return 99/p' src/core.js",
  "printf x | tee .handoffs/refactoring-code/run/notes.txt",
  "printf x | tee /dev/null",
  "sed -i -f changes.sed .handoffs/refactoring-code/run/review.txt",
  "perl -i -p -f changes.pl .handoffs/refactoring-code/run/review.txt",
  "sed -i -e 's/foo/bar/' -e 's/bar/baz/' .handoffs/refactoring-code/run/review.txt",
  "sed -i -es/foo/bar/ .handoffs/refactoring-code/run/review.txt",
  "perl -i -pes/foo/bar/ .handoffs/refactoring-code/run/review.txt",
  "perl -pe 's/return n/return 99/' src/core.js",
  `sed -i 's/foo/writeFileSync("src/core.js", "x")/' .handoffs/refactoring-code/run/review.txt`,
  `perl -pi -e 's/foo/writeFileSync("src/core.js", "x")/' .handoffs/refactoring-code/run/review.txt`,
  "sed -n 's/foo/> src/core.js/' .handoffs/refactoring-code/run/review.txt",
])(
  "preserves boundary evidence for non-source shell operands: %s",
  (command) => {
    expect(() =>
      checkBoundaryReduction({
        ...boundaryObservation(),
        toolCalls: [...orderedEvidence(), { name: "Bash", input: { command } }],
      }),
    ).not.toThrow();
  },
);

const operandPrograms = [
  "sed -i -e 's/foo/bar/'",
  "perl -pi -e 's/foo/bar/'",
  "tee -a",
];

function checkFileOperand(program: string, path: string): string {
  const good = boundaryObservation();
  return checkBoundaryReduction({
    ...good,
    repoFiles: {
      ...good.repoFiles,
      [FIXTURE_ROOT_PATH]: "/fixture/repo\n/canonical/repo",
    },
    toolCalls: [
      ...orderedEvidence(),
      { name: "Bash", input: { command: `${program} -- '${path}'` } },
    ],
  });
}

test.each([
  "src/core.js",
  "/fixture/repo/src/core.js",
  "/canonical/repo/src/core.js",
  ".handoffs-source.js",
  "-source.js",
])("rejects stale evidence for literal source operand %s", (path) => {
  for (const program of operandPrograms) {
    expect(() => checkFileOperand(program, path)).toThrow(/test evidence/);
  }
});

test.each([
  "/outside/repo/src/core.js",
  "/fixture/repo/.handoffs/refactoring-code/run/review.txt",
  ".handoffs/other-run/review.txt",
  ".handoffs",
  "/dev/null",
])("preserves evidence for literal non-source operand %s", (path) => {
  for (const program of operandPrograms) {
    expect(() => checkFileOperand(program, path)).not.toThrow();
  }
});

test("rejects reviewer validation before the boundary test it relies on", () => {
  const [skill, tests] = orderedEvidence();
  if (skill === undefined || tests === undefined) {
    throw new Error("missing evidence");
  }
  expect(() =>
    checkBoundaryReduction({
      ...boundaryObservation(),
      toolCalls: [skill, reviewerValidation, tests],
    }),
  ).toThrow(/reviewer validation/);
});

test("rerunning tests after a source edit also requires fresh reviewer validation", () => {
  const [, tests] = orderedEvidence();
  if (tests === undefined) throw new Error("missing tests");
  expect(() =>
    checkBoundaryReduction({
      ...boundaryObservation(),
      toolCalls: [
        ...orderedEvidence(),
        { name: "Edit", input: { file_path: "src/core.js" } },
        tests,
      ],
    }),
  ).toThrow(/reviewer validation/);
});

test("owned report writes after validation do not invalidate source evidence", () => {
  expect(() =>
    checkBoundaryReduction({
      ...boundaryObservation(),
      toolCalls: [
        ...orderedEvidence(),
        {
          name: "Bash",
          input: { command: `git check-ignore -q -- ${HANDOFFS}run/probe` },
          result: { content: "", isError: false, truncated: false },
        },
        { name: "Write", input: { file_path: `${HANDOFFS}run/review.txt` } },
        {
          name: "Bash",
          input: { command: `printf reviewed > ${HANDOFFS}run/review.txt` },
        },
      ],
    }),
  ).not.toThrow();
});

function checkCompoundTests(command: string): string {
  const [, tests] = orderedEvidence();
  if (tests === undefined) throw new Error("missing tests");
  return checkBoundaryReduction({
    ...boundaryObservation(),
    toolCalls: [
      invocation,
      { ...tests, input: { command } },
      reviewerValidation,
    ],
  });
}

test("accepts source mutation followed by tests in one Bash call", () => {
  expect(() =>
    checkCompoundTests(
      "printf broken > src/core.js && node --test boundary.test.js",
    ),
  ).not.toThrow();
});

test("rejects tests followed by source mutation in one Bash call", () => {
  expect(() =>
    checkCompoundTests(
      "node --test boundary.test.js && printf broken > src/core.js",
    ),
  ).toThrow(/test evidence/);
});

test("run-2 boundary repeat 3 Node human summary is valid evidence, but omitted review still fails", () => {
  const good = boundaryObservation();
  const output =
    "✔ restricted caller cannot import src/oversized.js (0.063792ms)\n✔ trusted caller can import src/oversized.js (0.038584ms)\n✔ restricted caller cannot import src/core.js (0.032709ms)\n✔ trusted caller can import src/core.js (0.031667ms)\nℹ tests 5\nℹ suites 0\nℹ pass 5\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 40.358708\nexit=0";
  const tests = {
    name: "Bash",
    input: {
      command: `node --test boundary.test.js 2>&1 | tail -12; echo exit=\${pipestatus[1]}; git diff --stat`,
    },
    result: { content: output, isError: false, truncated: false },
  };
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [invocation, tests, reviewerValidation],
    }),
  ).not.toThrow();
  expect(() =>
    checkBoundaryReduction({ ...good, toolCalls: [invocation, tests] }),
  ).toThrow(/reviewer validation/);
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [
        invocation,
        { ...tests, result: { ...tests.result, truncated: true } },
        reviewerValidation,
      ],
    }),
  ).not.toThrow();
  for (const content of [
    output.replace("pass 5", "pass 0"),
    output.replace("fail 0", "fail 1"),
    output.replace("tests 5", "tests 0"),
    output.replace("exit=0", "exit=1"),
    `${output}\nℹ tests 5\nℹ pass 4\nℹ fail 1\nexit=1`,
  ]) {
    expect(() =>
      checkBoundaryReduction({
        ...good,
        toolCalls: [
          invocation,
          { ...tests, result: { ...tests.result, content } },
          reviewerValidation,
        ],
      }),
    ).toThrow(/test evidence/);
  }
  expect(() =>
    checkBoundaryReduction({
      ...good,
      toolCalls: [
        invocation,
        tests,
        {
          ...reviewerValidation,
          result: { ...reviewerValidation.result, isError: true },
        },
      ],
    }),
  ).toThrow(/reviewer validation/);
});
