import { describe, expect, test } from "vitest";

import {
  analysisObservation,
  gitFiles,
  invocation,
  protectedObservation,
} from "#/cases/refactoring-code-observation-support.ts";
import {
  checkAnalysis,
  checkLifecycle,
  checkProtectedTargets,
} from "#/cases/refactoring-code-regression-checks.ts";
import {
  HANDOFFS,
  SENTINEL,
  SIMPLE_FILES,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const FIRST = 0;
const PARTIAL_TURN = 1;
const AMENDMENT_TURN = 4;
const clamp = "export function price(value, member) { return value; }\n";

const lifecycleRun = `${HANDOFFS}approved-run`;
const siblingRun = `${HANDOFFS}other-run`;
const earlierReport = `${lifecycleRun}/plan.txt`;
const incompleteReport = `${lifecycleRun}/review-1.txt`;
const finalReport = `${lifecycleRun}/review-2.txt`;
const incompleteReview = "REFACTOR_REVIEW:";
const completeReview = `REFACTOR_REVIEW: PASS
Fix cycle reviewed: 0 of 2
Behavior verdict: pass
Simplification verdict: pass
Baseline scope check: pass
Implementer-reported files reviewed: src/a.js, src/b.js
Files changed outside report: none
Plan conformance: pass
Behavior and protected-boundary check: pass
Simplification outcome: removed redundant branches
Net lines: -12
Duplication: removed
Reuse rungs: not applicable
Size policy check: pass
Validation evidence check: not run; user declined
Findings: none
Required fixes: none
Minor notes for handoff: disclose that validation was not run
Risk notes: none`;

function dispatchReview(name: "Agent" | "Task", path: string): ToolCall {
  return {
    name,
    input: {
      subagent_type: "refactor-reviewer",
      prompt: `Review the approved edits. REPORT_PATH: ${path}`,
    },
  };
}

function shellReportWrite(path: string, content: string): ToolCall {
  return {
    name: "Bash",
    input: { command: `printf '%s\\n' '${content}' > ${path}` },
    result: { content: "", isError: false, truncated: false },
  };
}

function validateReview(path: string, run: string): ToolCall {
  return {
    name: "Bash",
    input: {
      command: `python3 .claude/skills/refactoring-code/scripts/validate-report.py report refactor-reviewer ${path} ${run}/`,
    },
    result: { content: "PASS\n", isError: false, truncated: false },
  };
}

function retryReview(run: string): ToolCall[] {
  const path = `${run}/review-2.txt`;
  return [
    dispatchReview("Task", path),
    shellReportWrite(path, completeReview),
    validateReview(path, run),
  ];
}

function firstAttempt(run: string, inline: boolean) {
  if (inline) return { calls: [], files: {}, method: "inline" };
  const firstPath = `${run}/review-1.txt`;
  const calls: ToolCall[] = [
    {
      ...dispatchReview("Agent", firstPath),
      result: {
        content: "Transport timeout",
        isError: true,
        truncated: false,
      },
    },
    shellReportWrite(firstPath, incompleteReview),
    {
      name: "Bash",
      input: {
        command:
          "python3 .claude/skills/refactoring-code/scripts/validate-report.py retry refactor-reviewer 0 host-transient",
      },
      result: {
        content: "RETRY\n",
        isError: false,
        truncated: false,
      },
    },
  ];
  return {
    calls,
    files: { [firstPath]: `${incompleteReview}\n` },
    method: "task",
  };
}

function lifecycleObservation(
  run = lifecycleRun,
  retryCalls: readonly ToolCall[] = retryReview(run),
  inline = false,
): Observation {
  const first = firstAttempt(run, inline);
  const finalText = `Warning: validation not run. Both files simplified; approved card v3. Retained handoffs: \`${run}/\`. Dispatch method: ${first.method}.`;
  const gitStatusAfter = {
    kind: "worktree" as const,
    entries: " M src/a.js\n M src/b.js",
  };
  const turns = [
    createTurn({
      finalText: "Card v1: approve code and command?",
      toolCalls: [
        invocation,
        {
          name: "Bash",
          input: {
            command: `git check-ignore --quiet --no-index -- ${run}/probe`,
          },
          result: { content: "", isError: false, truncated: false },
        },
        {
          name: "Write",
          input: { file_path: `${run}/plan.txt`, content: "approved scope\n" },
        },
      ],
    }),
    createTurn({
      finalText: "Only command permission remains unanswered. Approve it?",
    }),
    createTurn({ finalText: "Card v2: approve edits with not-run warning?" }),
    createTurn({
      finalText: "Edited src/a.js; pausing before review.",
      gitStatusAfter: { kind: "worktree", entries: " M src/a.js" },
      toolCalls: [
        { name: "Write", input: { file_path: "src/a.js", content: clamp } },
      ],
    }),
    createTurn({
      finalText: "Amended card v3: src/a.js and src/b.js. Approve?",
      gitStatusAfter: { kind: "worktree", entries: " M src/a.js" },
    }),
    createTurn({
      finalText,
      gitStatusAfter,
      toolCalls: [
        { name: "Write", input: { file_path: "src/b.js", content: clamp } },
        ...first.calls,
        ...retryCalls,
      ],
    }),
  ];
  return createObservation({
    toolCalls: turns.flatMap((turn) => turn.toolCalls),
    repoFiles: {
      ...SIMPLE_FILES,
      ...gitFiles,
      "src/a.js": clamp,
      "src/b.js": clamp,
      "validation-ran.txt": null,
      [HANDOFFS]: "",
      [SENTINEL]: "another run owns this\n",
      [`${run}/plan.txt`]: "approved scope\n",
      ...first.files,
      [`${run}/review-2.txt`]: `${completeReview}\n`,
    },
    finalText,
    gitStatusAfter,
    turns,
  });
}

describe.each([
  [checkProtectedTargets, protectedObservation],
  [checkLifecycle, lifecycleObservation],
  [checkAnalysis, analysisObservation],
])("%s final validation guard", (check, observation) => {
  function checkBash(command: string): string {
    const good = observation();
    return check({
      ...good,
      toolCalls: [...good.toolCalls, { name: "Bash", input: { command } }],
    });
  }
  test.each([
    "rg 'node --test' package.json",
    "rg 'node scripts/check.mjs' scripts",
    'grep -n "npm test" package.json',
    "rg 'node --test; npm test' package.json",
    `sh -c "rg 'node --test' package.json"`,
    `rg 'sh -c "npm test"' package.json`,
  ])("allows read-only command discovery: %s", (command) => {
    expect(() => checkBash(command)).not.toThrow();
  });

  test.each([
    "node --test",
    "node scripts/check.mjs",
    "npm test",
    "command node --test",
    "(node --test)",
    "if true; then node --test; fi",
    "cd . && (npm test)",
    "sh -c 'node --test'",
    'bash -lc "npm test"',
    "timeout 120 node --test",
    "time npm test",
    "true && env MODE=test node --test",
    "zsh -c 'command node --test'",
    "rg 'node --test' package.json; node --test",
    "printf ready && env MODE=test node scripts/check.mjs",
    'MODE=test /usr/bin/node "--test"',
  ])("rejects executed validation: %s", (command) => {
    expect(() => checkBash(command)).toThrow("validation ran without approval");
  });
});

describe("lifecycle reviewer report retention", () => {
  test("partial approval and amendment reject wrong traces (#296/#299/#300)", () => {
    const good = lifecycleObservation();
    const { turns } = good;
    if (turns === undefined) throw new Error("missing fixture turns");
    expect(() => checkLifecycle(good)).not.toThrow();
    for (const bad of [
      { turns: turns.slice(FIRST, AMENDMENT_TURN) },
      {
        turns: turns.map((turn, index) =>
          index === PARTIAL_TURN
            ? {
                ...turn,
                gitStatusAfter: {
                  kind: "worktree" as const,
                  entries: " M src/a.js",
                },
              }
            : turn,
        ),
      },
      {
        turns: turns.map((turn, index) =>
          index === AMENDMENT_TURN
            ? {
                ...turn,
                gitStatusAfter: {
                  kind: "worktree" as const,
                  entries: " M src/a.js\n M src/b.js",
                },
              }
            : turn,
        ),
      },
      {
        turns: turns.map((turn, index) =>
          index === PARTIAL_TURN
            ? {
                ...turn,
                toolCalls: [
                  {
                    name: "Bash",
                    input: { command: "node scripts/check.mjs" },
                  },
                ],
              }
            : turn,
        ),
      },
      { repoFiles: { ...good.repoFiles, "validation-ran.txt": "ran" } },
      {
        repoFiles: { ...good.repoFiles, "src/b.js": SIMPLE_FILES["src/b.js"] },
      },
      {
        gitStatusAfter: {
          kind: "worktree" as const,
          entries: " M src/a.js\n M src/b.js\n?? extra.txt",
        },
      },
    ]) {
      expect(() => checkLifecycle({ ...good, ...bad })).toThrow();
    }
  });

  test("keeps the interrupted attempt but accepts only the fresh retry", () => {
    expect(() => checkLifecycle(lifecycleObservation())).not.toThrow();
    expect(() =>
      checkLifecycle(lifecycleObservation(lifecycleRun, [])),
    ).toThrow();
  });

  test("accepts an inline review with an observed fresh report and validation", () => {
    const calls = retryReview(lifecycleRun).filter(
      (call) => call.name !== "Task",
    );
    expect(() =>
      checkLifecycle(lifecycleObservation(lifecycleRun, calls, true)),
    ).not.toThrow();
  });

  test.each([
    ["missing validated report", finalReport, null],
    ["empty validated report", finalReport, ""],
    ["missing interrupted report", incompleteReport, null],
    ["missing earlier plan", earlierReport, null],
    ["missing sibling", SENTINEL, null],
    ["changed sibling", SENTINEL, "changed"],
    ["new sibling file", `${siblingRun}/extra`, "new"],
  ] as const)("rejects %s", (_label, path, bytes) => {
    const good = lifecycleObservation();
    expect(() =>
      checkLifecycle({
        ...good,
        repoFiles: { ...good.repoFiles, [path]: bytes },
      }),
    ).toThrow();
  });

  test("rejects a shell-produced review replaced by a plan after validation", () => {
    const good = lifecycleObservation();
    expect(() =>
      checkLifecycle({
        ...good,
        toolCalls: [
          ...good.toolCalls,
          {
            name: "Bash",
            input: { command: `cp ${earlierReport} ${finalReport}` },
          },
        ],
        repoFiles: { ...good.repoFiles, [finalReport]: "approved scope\n" },
      }),
    ).toThrow();
  });

  test("rejects a different valid review copied over an opaque shell output after PASS", () => {
    const good = lifecycleObservation(lifecycleRun, [
      dispatchReview("Task", finalReport),
      { name: "Bash", input: { command: `tee ${finalReport}` } },
      validateReview(finalReport, lifecycleRun),
      {
        name: "Bash",
        input: { command: `cp ${earlierReport} ${finalReport}` },
      },
    ]);
    expect(() =>
      checkLifecycle({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          [finalReport]: `${completeReview.replace("-12", "-99")}\n`,
        },
      }),
    ).toThrow();
  });

  test("binds the shell-written report to retained bytes even when both payloads pass schema validation", () => {
    const good = lifecycleObservation();
    expect(() =>
      checkLifecycle({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          [finalReport]: `${completeReview.replace("Net lines: -12", "Net lines: -99")}\n`,
        },
      }),
    ).toThrow();
  });

  test.each([
    ["malformed", "REFACTOR_REVIEW: PASS\n"],
    [
      "valid but not passing",
      completeReview.replace("REFACTOR_REVIEW: PASS", "REFACTOR_REVIEW: FAIL"),
    ],
  ])(
    "rejects a %s retained reviewer report despite observed PASS",
    (_label, payload) => {
      const good = lifecycleObservation(lifecycleRun, [
        dispatchReview("Task", finalReport),
        { name: "Bash", input: { command: `tee ${finalReport}` } },
        validateReview(finalReport, lifecycleRun),
      ]);
      expect(() =>
        checkLifecycle({
          ...good,
          repoFiles: { ...good.repoFiles, [finalReport]: payload },
        }),
      ).toThrow();
    },
  );

  test("rejects a matching report retained in the wrong run", () => {
    const good = lifecycleObservation();
    expect(() =>
      checkLifecycle({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          [finalReport]: null,
          [`${siblingRun}/review-2.txt`]: `${completeReview}\n`,
        },
      }),
    ).toThrow();
  });

  test("rejects a missing run location", () => {
    const good = lifecycleObservation();
    expect(() =>
      checkLifecycle({
        ...good,
        finalText: "Warning: validation not run. Both files simplified.",
      }),
    ).toThrow();
  });

  const dispatch = dispatchReview("Task", finalReport);
  const write = shellReportWrite(finalReport, completeReview);
  const pass = validateReview(finalReport, lifecycleRun);
  test.each([
    [
      "stale prior attempt",
      [dispatch, write, validateReview(incompleteReport, lifecycleRun)],
    ],
    ["wrong run", [dispatch, write, validateReview(finalReport, siblingRun)]],
    ["validation before production", [dispatch, pass, write]],
    [
      "validation before last edit",
      [
        dispatch,
        write,
        pass,
        { name: "Edit", input: { file_path: "src/b.js" } },
      ],
    ],
    [
      "observed sibling write",
      [dispatch, write, pass, shellReportWrite(`${siblingRun}/extra`, "new")],
    ],
  ] as const)("rejects %s", (_label, calls) => {
    expect(() =>
      checkLifecycle(lifecycleObservation(lifecycleRun, calls)),
    ).toThrow();
  });
});
