import { describe, expect, test } from "vitest";

import {
  REFACTOR_FILES,
  REFACTOR_PLAN_PATH,
} from "#/cases/refactoring-code.ts";
import { assertOwnedReports } from "#/cases/refactoring-code-regression-checks.ts";
import { HANDOFFS } from "#/cases/refactoring-code-regression-fixtures.ts";
import { getCase } from "#/cases/registry.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
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

describe("ignore-check exit-status evidence", () => {
  const runPath = `${HANDOFFS}run-a`;
  function observationFor(command: string, content = "ignored"): Observation {
    return createObservation({
      repoFiles: { [HANDOFFS]: "", [`${runPath}/report.txt`]: "report" },
      toolCalls: [
        {
          name: "Bash",
          input: { command },
          result: { content, isError: false, truncated: false },
        },
        { name: "Write", input: { file_path: `${runPath}/report.txt` } },
      ],
    });
  }

  test.each([
    `git check-ignore -q -- ${runPath}/probe`,
    `git check-ignore -q -- ./${runPath}/probe`,
    `git check-ignore -q -- ././${runPath}/probe`,
    `git check-ignore -q -- "./\\\n${runPath}/probe"`,
    `git check-ignore -q -- ${runPath}/probe &&\n  printf done`,
    `git check-ignore -q -- ${runPath}/probe && \t\n  printf done`,
    `git check-ignore -q -- ${runPath}/probe && \\\n  printf done`,
    `git check-ignore -q -- ${runPath}/probe 2>"/dev/null" && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe 2>'/dev/null' && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe >>/dev/null && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe >>"/dev/null" && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe >>'/dev/null' && echo ignored`,
    `printf ready >>"/dev/null" && git check-ignore -q -- ${runPath}/probe`,
    `git check-ignore -q -- ${runPath}/probe && echo ignored >>'/dev/null'`,
    `git check-ignore -q -- ${runPath}/probe && printf done`,
    `git check-ignore -q -- ${runPath}/probe && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe 2>/dev/null && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe >/dev/null 2>&1 && echo ignored`,
    `git check-ignore -v -- ${runPath}/probe 2>&1`,
    `printf ready >/dev/null 2>&1 && git check-ignore -q -- ${runPath}/probe`,
    `git check-ignore -q -- ${runPath}/probe && echo ignored >/dev/null 2>&1`,
    `printf ready; git check-ignore -q -- ${runPath}/probe && printf done`,
    `git check-ignore -q -- ${runPath}/probe;`,
    `git check-ignore -q -- '${runPath}/probe;literal' && printf 'done; still safe'`,
  ])("credits a successful status-preserving check: %s", (command) => {
    expect(() => {
      assertOwnedReports(observationFor(command));
    }).not.toThrow();
  });

  test.each([
    `git check-ignore --bad-option ${runPath}/probe; printf done`,
    `git check-ignore -q -- './\\\n${runPath}/probe'`,
    `git check-ignore --bad-option ${runPath}/probe\nprintf done`,
    `git check-ignore -q -- ${runPath}/probe &`,
    `git check-ignore -q -- ${runPath}/probe 2>"proof.log" && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe >>'/dev/null.log' && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe <"/dev/null" && echo ignored`,
    `git check-ignore -q -- ${runPath}/probe &&\n  printf done; printf masked`,
    `echo 'git check-ignore -q -- ${runPath}/probe 2>"/dev/null" && ignored'`,
    `git check-ignore -q -- ${runPath}/probe; echo "exit=$?"`,
    `git check-ignore -q -- ${runPath}/probe >proof.log`,
    `git check-ignore -q -- ${runPath}/probe </dev/null`,
    `printf ready >proof.log && git check-ignore -q -- ${runPath}/probe`,
    `printf ready </dev/null && git check-ignore -q -- ${runPath}/probe`,
    `git check-ignore -q -- ${runPath}/probe && echo ignored >proof.log`,
    `git check-ignore -q -- ${runPath}/probe && echo ignored </dev/null`,
    `git check-ignore -q -- ${runPath}/probe 2>&1 & printf done`,
    `git check-ignore -q -- ${runPath}/probe 2>&1 | cat`,
    `git check-ignore -q -- ${runPath}2>/dev/null`,
    `git check-ignore -q -- "${runPath}"2>/dev/null`,
    `git check-ignore -q -- '${runPath}'2>/dev/null`,
    `printf 'git check-ignore -q -- ${runPath}/probe 2>&1'`,
    `git check-ignore -q -- ${runPath}/probe\nprintf done`,
    `git check-ignore -q -- ${runPath}/probe && printf done; printf masked`,
    `git check-ignore -q -- ${runPath}/probe || printf done`,
    `git check-ignore -q -- ${runPath}/probe | cat`,
    `git check-ignore -q -- ${runPath}/probe & printf done`,
    `! git check-ignore -q -- ${runPath}/probe`,
    `true || git check-ignore -q -- ${runPath}/probe`,
    `true || git check-ignore -q -- ${runPath}/probe && printf done`,
    `printf 'RD=${runPath}'; git check-ignore -q -- "$RD/probe"`,
    `RD=${runPath} printf done; git check-ignore -q -- "$RD/probe"`,
    `printf 'git check-ignore -q -- ${runPath}/probe'`,
    `printf '${runPath}'; git check-ignore -q -- ${runPath}-old/probe`,
    `git check-ignore -q -- ${runPath}-old/probe && printf '${runPath}'`,
    `git check-ignore -q -- ${runPath}/../other/probe`,
    `git check-ignore -q -- ${runPath}/probe ${HANDOFFS}other/probe`,
    `RD=${runPath}-old; git check-ignore -q -- "$RD/probe" && printf '${runPath}'`,
  ])("rejects masked or unrelated check evidence: %s", (command) => {
    expect(() => {
      assertOwnedReports(observationFor(command));
    }).toThrow("missing successful ignore proof before report write");
  });
});

function absoluteIgnoreObservation(root: string): Observation {
  const path = `${HANDOFFS}run-one/report.txt`;
  return createObservation({
    repoFiles: {
      [FIXTURE_ROOT_PATH]: "/fixture/repo\n/canonical/fixture/repo",
      [HANDOFFS]: "",
      [path]: "report",
    },
    toolCalls: [
      {
        name: "Bash",
        input: {
          command: `git check-ignore --quiet --no-index -- ${root}/${HANDOFFS}run-one/probe`,
        },
        result: { content: "", isError: false, truncated: false },
      },
      { name: "Write", input: { file_path: `/fixture/repo/${path}` } },
    ],
  });
}

test.each(["/fixture/repo", "/canonical/fixture/repo"])(
  "accepts absolute ignore proof inside recorded root %s",
  (root) => {
    expect(() => {
      assertOwnedReports(absoluteIgnoreObservation(root));
    }).not.toThrow();
  },
);

test.each(["/outside/repo", "/fixture/repo/../repo", "/fixture/repo/$UNKNOWN"])(
  "rejects absolute ignore proof outside literal fixture bounds: %s",
  (root) => {
    expect(() => {
      assertOwnedReports(absoluteIgnoreObservation(root));
    }).toThrow("missing successful ignore proof before report write");
  },
);

describe.each(["command", "result"] as const)(
  "ignore proof run-path boundaries in the %s",
  (source) => {
    const run = "2326BCA4-3C37-448B-BAB6-50E68D7A4E97";
    const runPath = `${HANDOFFS}${run}`;
    const write = {
      name: "Write",
      input: { file_path: `${runPath}/report.txt` },
    };
    function observationFor(
      text: string,
      command = source === "command" ? text : "git check-ignore -q $RD/probe",
    ): Observation {
      return createObservation({
        repoFiles: { [HANDOFFS]: "", [`${runPath}/report.txt`]: "report" },
        toolCalls: [
          {
            name: "Bash",
            input: { command },
            result: {
              content: source === "result" ? text : "ignored",
              isError: false,
              truncated: false,
            },
          },
          write,
        ],
      });
    }

    test.each([
      {
        label: "the recorded variable assignment",
        text: `RD=${runPath}; mkdir -p $RD && git check-ignore --quiet --no-index -- $RD/probe && echo ignored`,
      },
      { label: "the end of the text", text: `git check-ignore -q ${runPath}` },
      {
        label: "double quotes",
        text: `git check-ignore -q "${runPath}"`,
      },
      {
        label: "single quotes",
        text: `git check-ignore -q '${runPath}'`,
      },
      {
        label: "a descendant path",
        text: `git check-ignore -q -- ${runPath}/probe`,
      },
      {
        label: "a quote-concatenated descendant",
        text: `git check-ignore -q -- '${HANDOFFS}'"${run}"/probe`,
      },
    ])("accepts $label", ({ text }) => {
      expect(() => {
        assertOwnedReports(observationFor(text));
      }).not.toThrow();
    });

    test.each([
      {
        label: "another run",
        text: `git check-ignore -q -- ${HANDOFFS}another-run/probe`,
      },
      {
        label: "a hyphenated longer ID",
        text: `git check-ignore -q -- ${runPath}-old/probe`,
      },
      {
        label: "a longer ID ending in a digit",
        text: `git check-ignore -q -- ${runPath}2/probe`,
      },
      {
        label: "a double-quoted prefix concatenated with another run suffix",
        text: `git check-ignore -q -- "${runPath}"-old/probe`,
      },
      {
        label: "a single-quoted prefix concatenated with another run suffix",
        text: `git check-ignore -q -- '${runPath}'-old/probe`,
      },
    ])("rejects $label", ({ text }) => {
      expect(() => {
        assertOwnedReports(observationFor(text));
      }).toThrow("missing successful ignore proof before report write");
    });

    test("rejects a visible run path without git check-ignore", () => {
      const text = `printf '%s' '${runPath}'`;
      expect(() => {
        assertOwnedReports(observationFor(text, text));
      }).toThrow("missing successful ignore proof before report write");
    });

    test("rejects proof after the first report write", () => {
      const observation = observationFor(`git check-ignore -q ${runPath}`);
      expect(() => {
        assertOwnedReports({
          ...observation,
          toolCalls: [write, ...observation.toolCalls],
        });
      }).toThrow("missing successful ignore proof before report write");
    });

    test("rejects an errored proof result", () => {
      const observation = observationFor(`git check-ignore -q ${runPath}`);
      const toolCalls = observation.toolCalls.map((call) =>
        call.result === undefined
          ? call
          : { ...call, result: { ...call.result, isError: true } },
      );
      expect(() => {
        assertOwnedReports({ ...observation, toolCalls });
      }).toThrow();
    });
  },
);
