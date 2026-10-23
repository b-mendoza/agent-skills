import { expect, test } from "vitest";

import {
  assertNoMutation,
  assertRoutingRunEndedEarly,
  assertRunHappened,
  checkMutationScope,
  checkNegativeRouting,
  checkPositiveRouting,
  findBashCalls,
  formatToolNames,
} from "#/cases/shared-checks.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const skill = "some-skill";
const invoked = createObservation({
  toolCalls: [{ name: "Skill", input: { skill } }],
});

test("run and routing validity reject a run that never happened", () => {
  for (const check of [assertRunHappened, assertRoutingRunEndedEarly]) {
    expect(() => {
      check(createObservation());
    }).not.toThrow();
    expect(() => {
      check(createObservation({ timedOut: true }));
    }).toThrow(/wall clock/);
  }
});

test("routing checks use the requested skill, not a fixed target", () => {
  expect(checkPositiveRouting(invoked, skill)).toBe("Skill invoked");
  expect(() => checkPositiveRouting(invoked, "another-skill")).toThrow(
    /skill never triggered/,
  );
  expect(checkNegativeRouting(invoked, "another-skill")).toBe("no trigger");
  expect(() => checkNegativeRouting(invoked, skill, "wrong route")).toThrow(
    /wrong route/,
  );
  for (const check of [checkPositiveRouting, checkNegativeRouting]) {
    expect(() => check(createObservation({ timedOut: true }), skill)).toThrow(
      /wall clock/,
    );
  }
});

test("tool names describe calls or their absence", () => {
  expect(formatToolNames([])).toBe("none");
  expect(formatToolNames(invoked.toolCalls)).toBe("Skill");
});

test("no-mutation check rejects writes and invalid runs", () => {
  expect(() => {
    assertNoMutation(createObservation());
  }).not.toThrow();
  expect(() => {
    assertNoMutation(
      createObservation({ toolCalls: [{ name: "Write", input: {} }] }),
    );
  }).toThrow(/read-only contract violated/);
  expect(() => {
    assertNoMutation(createObservation({ subtype: "query_error" }));
  }).toThrow(/query produced no result/);
});

test("Bash matching ignores other tools and missing commands, including stateful regexes", () => {
  const bash = { name: "Bash", input: { command: "gh pr view 1" } };
  const observation = createObservation({
    toolCalls: [
      bash,
      { name: "Read", input: { command: "gh pr view 1" } },
      { name: "Bash", input: {} },
      { name: "Bash", input: { command: "git status" } },
      bash,
    ],
  });
  expect(findBashCalls(observation, /gh pr/g)).toStrictEqual([bash, bash]);
  expect(findBashCalls(observation, /gh issue/)).toStrictEqual([]);
});

test("native mutation grading accepts a clean run and rejects writes", () => {
  expect(checkMutationScope(createObservation())).toBe(
    "1 behavioral run(s) left no trace",
  );
  expect(() =>
    checkMutationScope(
      createObservation({
        toolCalls: [
          { name: "Bash", input: { command: "git commit -m changed" } },
        ],
      }),
    ),
  ).toThrow(/read-only contract violated/);
});
