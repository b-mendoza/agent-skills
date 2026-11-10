import assert from "node:assert/strict";

import { describe, expect, test } from "vitest";

import { ARGS_LOG } from "#/cases/reporting-skill-issues-fixtures.ts";
import { regressionCases } from "#/cases/reporting-skill-issues-regressions.ts";
import {
  approvedObservation,
  CREATE_ARGS,
  CREATE_PREFLIGHT,
  existingObservation,
  jsonLines,
  READ_PREFLIGHT,
  SEARCH,
  VIEW,
} from "#/cases/reporting-skill-issues-test-support.ts";
import { capturedText, parseGitHubLog } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const [batchCase, existingCase] = regressionCases;

function withCalls(
  observation: Observation,
  calls: readonly string[][],
): Observation {
  return {
    ...observation,
    repoFiles: { ...observation.repoFiles, [ARGS_LOG]: jsonLines(calls) },
  };
}

function withoutCall(
  calls: readonly string[][],
  omitted: readonly string[],
): string[][] {
  return calls.filter(
    (args) => JSON.stringify(args) !== JSON.stringify(omitted),
  );
}

describe.each([
  { label: "batch", evalCase: batchCase, observe: approvedObservation },
  { label: "existing", evalCase: existingCase, observe: existingObservation },
])("observed preflight for $label", ({ evalCase, observe }) => {
  test.each(READ_PREFLIGHT.map((args) => [args]))(
    "rejects omitted preflight %j",
    (omitted) => {
      const observation = observe();
      const calls = withoutCall(
        parseGitHubLog(capturedText(observation, ARGS_LOG)),
        omitted,
      );
      expect(() => evalCase.check(withCalls(observation, calls))).toThrow();
    },
  );
  test("rejects read preflight after the first search", () => {
    const calls =
      evalCase === batchCase
        ? [SEARCH, ...READ_PREFLIGHT, CREATE_PREFLIGHT, SEARCH, ...CREATE_ARGS]
        : [SEARCH, ...READ_PREFLIGHT, VIEW];
    expect(() => evalCase.check(withCalls(observe(), calls))).toThrow(
      /preflight/,
    );
  });
  test("rejects CLI discovery after the preview turn", () => {
    const observation = observe();
    const [initial, approved] = observation.turns ?? [];
    assert.ok(initial !== undefined && approved !== undefined);
    expect(() =>
      evalCase.check({
        ...observation,
        turns: [
          { ...initial, toolCalls: [] },
          {
            ...approved,
            toolCalls: [...initial.toolCalls, ...approved.toolCalls],
          },
        ],
      }),
    ).toThrow(/initial turn/);
  });
});

test("rejects missing create preflight", () => {
  const calls = [...READ_PREFLIGHT, SEARCH, SEARCH, ...CREATE_ARGS];
  expect(() =>
    batchCase.check(withCalls(approvedObservation(), calls)),
  ).toThrow(/create --help/);
});
test("rejects create preflight performed only after the preview", () => {
  const observation = approvedObservation();
  const [initial, approved] = observation.turns ?? [];
  assert.ok(initial !== undefined && approved !== undefined);
  expect(() =>
    batchCase.check({
      ...observation,
      turns: [
        {
          ...initial,
          toolCalls: initial.toolCalls.map((call) => ({
            ...call,
            input: {
              command: String(call.input["command"]).replace(
                "gh issue create --help",
                "",
              ),
            },
          })),
        },
        {
          ...approved,
          toolCalls: [
            { name: "Bash", input: { command: "gh issue create --help" } },
            ...approved.toolCalls,
          ],
        },
      ],
    }),
  ).toThrow(/before the preview/);
});
