import { expect, test } from "vitest";

import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import type { TurnObservation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const approved = createTurn({
  name: "approval",
  prompt: "APPROVED abc",
  finalText: "committed",
  toolCalls: [{ name: "Bash", input: { command: "git commit -m approved" } }],
  gitHeadAfter: { kind: "head", oid: "new-commit" },
});
const isApproval = (turn: TurnObservation) => turn.prompt === "APPROVED abc";

test("returns the approval turn and permits its mutation", () => {
  const observation = createObservation({ turns: [createTurn(), approved] });
  expect(assertNoMutationBeforeReply(observation, isApproval)).toBe(approved);
});

test.each([
  { toolCalls: [{ name: "Write", input: { file_path: "before.txt" } }] },
  { gitStatusAfter: { kind: "worktree", entries: "?? before.txt" } as const },
  { gitHeadAfter: { kind: "head", oid: "premature-commit" } as const },
  {
    gitHeadAfter: { kind: "unreadable", reason: "permission denied" } as const,
  },
])("rejects mutation or missing evidence before approval: %j", (mutation) => {
  const observation = createObservation({
    turns: [createTurn(mutation), approved],
  });
  expect(() => assertNoMutationBeforeReply(observation, isApproval)).toThrow(
    /read-only contract violated.*turn 1/s,
  );
});

test("rejects a missing approval rather than treating all turns as approved", () => {
  expect(() =>
    assertNoMutationBeforeReply(
      createObservation({ turns: [createTurn()] }),
      isApproval,
    ),
  ).toThrow(/approval reply not found/);
});

test("read-only policy checks intermediate git samples even when the final tree is clean", () => {
  expect(() => {
    assertNoMutation(
      createObservation({
        turns: [
          createTurn({
            gitStatusAfter: { kind: "worktree", entries: "?? temporary.txt" },
          }),
          createTurn(),
        ],
      }),
    );
  }).toThrow(/turn 1.*git status changed/s);
});

test("allowed-change filtering also masks turn-local writes but not other tools", () => {
  const observation = createObservation({
    turns: [
      createTurn({
        toolCalls: [{ name: "Write", input: { file_path: "report.md" } }],
        gitStatusAfter: { kind: "worktree", entries: "?? report.md" },
      }),
    ],
  });
  expect(() => {
    assertNoMutation(
      withoutAllowedChanges(observation, (call) => call.name === "Write"),
    );
  }).not.toThrow();
  expect(() => {
    assertNoMutation(withoutAllowedChanges(observation, () => false));
  }).toThrow(/Write called on report.md/);
});
