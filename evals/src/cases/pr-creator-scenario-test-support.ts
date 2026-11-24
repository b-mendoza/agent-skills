import { expect } from "vitest";

import { cases } from "#/cases/pr-creator.ts";
import { previewValues } from "#/cases/pr-creator-behavior-checks.ts";
import { type ApprovalKind, runValidator } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import { RUNS } from "#/cases/pr-creator-scenario.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
export const base = "a".repeat(SHA_LENGTH);
export const head = "b".repeat(SHA_LENGTH);
export const preview = previewValues(base, head);
export function shell(content: string): ToolCall {
  return {
    name: "Bash",
    input: { command: "git status" },
    result: { content, isError: false, truncated: false },
  };
}
export function gate(kind: ApprovalKind, values: unknown, prompt = "approved") {
  const call = {
    ...shell(runValidator(["digest", kind], values)),
    input: { command: `python3 -I validate-output.py digest ${kind}` },
  };
  return {
    turn: createTurn({ prompt, toolCalls: [call] }),
    files: { [`${RUNS}test/${kind}-values.json`]: JSON.stringify(values) },
  };
}
type Gate = ReturnType<typeof gate>;
export function observation(gates: Gate[]): Observation {
  return createObservation({
    toolCalls: gates.flatMap((item) => item.turn.toolCalls),
    turns: gates.map((item) => item.turn),
    repoFiles: {
      [RUNS]: "",
      [facts.log]: "",
      ...Object.fromEntries(
        gates.flatMap((item) => Object.entries(item.files)),
      ),
    },
  });
}
export function acceptsOnly(id: string, good: Observation, bad: Observation) {
  const evaluated = cases.find((item) => item.id === `pr-creator/${id}`);
  expect(evaluated).toBeDefined();
  if (evaluated === undefined) throw new Error(id);
  expect(() => evaluated.check(bad)).toThrow();
  return () => evaluated.check(good);
}
export const change = (
  obs: Observation,
  files: Record<string, string | null>,
) => ({
  ...obs,
  repoFiles: { ...obs.repoFiles, ...files },
});
export const extraWrite = (obs: Observation) =>
  change(obs, {
    [facts.log]: `${obs.repoFiles?.[facts.log] ?? ""}\n["issue","close","42"]`,
  });
