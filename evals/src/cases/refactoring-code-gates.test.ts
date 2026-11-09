import { describe, expect, test } from "vitest";

import type { FollowUpTurn } from "#/cases/case-contract.ts";
import {
  boundaryFollowUps,
  lifecycleFollowUps,
} from "#/cases/refactoring-code-gates.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const initial =
  "Plan card v1. D-code / D-command / D-deferred. Approve or decline.";
const revised = "Card version | v2\nDecisions | D-code | D-validation";
const amendment = "Amended card v3\n| D-code | D-validation |";
const boundary = "Version: v1\nD-code, D-size, D-boundary, D-validation";

function gate(name: string): FollowUpTurn {
  const found = [...lifecycleFollowUps, ...boundaryFollowUps].find(
    (entry) => entry.name === name,
  );
  if (found === undefined) throw new Error(`missing ${name}`);
  return found;
}

const scenarios = [
  { name: "partial-code-approval", text: initial, editedA: false },
  {
    name: "decline-command",
    text: "D-command is unanswered. Approve or decline. Editing remains blocked.",
    editedA: false,
  },
  { name: "approve-revised-card", text: revised, editedA: false },
  {
    name: "request-amendment",
    text: "A is complete. Waiting for your next instruction before review.",
    editedA: true,
  },
  { name: "approve-amendment", text: amendment, editedA: true },
  { name: "approve-waiver-and-boundary", text: boundary, editedA: false },
] as const;

function observed(
  text: string,
  editedA = false,
  toolCalls: ToolCall[] = [],
): Observation {
  const status = {
    kind: "worktree",
    entries: editedA ? " M src/a.js" : "",
  } as const;
  return createObservation({
    finalText: text,
    gitStatusAfter: status,
    toolCalls,
    turns: [
      createTurn({ finalText: initial }),
      createTurn({ finalText: revised }),
      createTurn({ finalText: text, toolCalls, gitStatusAfter: status }),
    ],
  });
}

function withCalls(
  observation: Observation,
  toolCalls: ToolCall[],
): Observation {
  return {
    ...observation,
    toolCalls,
    turns: observation.turns?.map((turn) => ({ ...turn, toolCalls })),
  };
}

describe("minimal card facts plus observed gate stops", () => {
  test.each(scenarios)(
    "$name accepts a settled scoped stop without a file-map prose layout",
    ({ name, text, editedA }) => {
      expect(gate(name).reply(observed(text, editedA))).toHaveProperty("reply");
    },
  );

  test.each(scenarios)(
    "$name rejects wrong machine evidence even when prose looks valid",
    ({ name, text, editedA }) => {
      const good = observed(text, editedA);
      for (const bad of [
        { ...good, isError: true },
        { ...good, timedOut: true },
        { ...good, subtype: "error_max_turns" },
        { ...good, finalText: "" },
        {
          ...good,
          gitStatusBefore: {
            kind: "unreadable" as const,
            reason: "missing baseline",
          },
        },
        {
          ...good,
          turns: good.turns?.map((turn) => ({
            ...turn,
            gitHeadAfter: { kind: "head" as const, oid: "moved" },
          })),
        },
        {
          ...good,
          gitStatusAfter: { kind: "worktree" as const, entries: " M src/b.js" },
        },
        {
          ...good,
          gitStatusAfter: { kind: "unreadable" as const, reason: "denied" },
        },
        withCalls(good, [
          {
            name: "Write",
            input: { file_path: "src/b.js", content: "premature edit" },
          },
        ]),
        withCalls(good, [
          { name: "Edit", input: { file_path: "package.json" } },
        ]),
        withCalls(good, [
          { name: "Bash", input: { command: "echo premature > src/b.js" } },
        ]),
        withCalls(good, [
          {
            name: "Bash",
            input: {
              command:
                'node -e \'require("fs").writeFileSync("src/b.js", "wrong")\'',
            },
          },
        ]),
        withCalls(good, [
          { name: "Bash", input: { command: "git commit -am premature" } },
        ]),
        withCalls(good, [
          { name: "Bash", input: { command: "node scripts/check.mjs" } },
        ]),
      ]) {
        expect(gate(name).reply(bad)).toHaveProperty("gateNotReached");
      }
    },
  );

  test.each([
    "Plan card v1: D-code, D-command",
    "## Plan card\nVersion: v1\n| D-code | D-validation |",
    "**Card version:** `v1`\n- D-code\n- D-command\n- D-deferred",
    "| VERSION | V1 |\n| D-CODE | D-VALIDATION |",
    "## v1\nD-code, D-command",
  ])(
    "initial reply addresses minimal version/ids across layouts: %s",
    (text) => {
      const reply = gate("partial-code-approval").reply(observed(text));
      expect(reply).toHaveProperty("reply");
      if (!("reply" in reply)) throw new Error("missing approval reply");
      expect(reply.reply).toContain("Approve D-code only");
    },
  );

  test.each([
    "D-code D-command but no card version",
    "Plan card v1: D-code only",
    "Plan card v1: D-command only",
    "I cannot prepare the plan; please approve a different request",
  ])("initial gate rejects absent minimal routing facts: %s", (text) => {
    expect(gate("partial-code-approval").reply(observed(text))).toHaveProperty(
      "gateNotReached",
    );
  });

  test("decline callback needs prior version/decision facts, but not a question mark or literal pause string", () => {
    expect(
      gate("decline-command").reply(
        observed("D-command remains unanswered. Editing stays inactive."),
      ),
    ).toHaveProperty("reply");
    const missing = createObservation({ finalText: "Editing stays inactive." });
    expect(gate("decline-command").reply(missing)).toHaveProperty(
      "gateNotReached",
    );
  });

  test.each([
    "cat scripts/check.mjs",
    "rg 'node --test' package.json",
    "rg 'node scripts/check.mjs' scripts",
    "git diff HEAD^ HEAD",
    "mkdir -p .handoffs/refactoring-code/run-one",
  ])("gate permits read-only inspection and owned setup: %s", (command) => {
    expect(
      gate("partial-code-approval").reply(
        observed(initial, false, [{ name: "Bash", input: { command } }]),
      ),
    ).toHaveProperty("reply");
  });

  test("gate allows only run-local report writes before approval", () => {
    const good = observed(initial, false, [
      {
        name: "Write",
        input: { file_path: ".handoffs/refactoring-code/run-one/map.txt" },
      },
    ]);
    expect(gate("partial-code-approval").reply(good)).toHaveProperty("reply");
    expect(
      gate("partial-code-approval").reply(
        withCalls(good, [
          {
            name: "Write",
            input: {
              file_path: ".handoffs/refactoring-code/run-one/../../src/a.js",
            },
          },
        ]),
      ),
    ).toHaveProperty("gateNotReached");
  });
});
