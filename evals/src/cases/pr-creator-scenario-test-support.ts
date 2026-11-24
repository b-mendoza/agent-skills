import { expect } from "vitest";

import { cases } from "#/cases/pr-creator.ts";
import { previewValues } from "#/cases/pr-creator-behavior-checks.ts";
import { type ApprovalKind, runValidator } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import { RUNS } from "#/cases/pr-creator-scenario.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

export const FIRST_RELATED = 43;
export const CLOSING = 42;
export const NEXT = 1;
const SHA_LENGTH = 40;
export const base = "a".repeat(SHA_LENGTH);
export const head = "b".repeat(SHA_LENGTH);
export const rebased = "c".repeat(SHA_LENGTH);
export const preview = previewValues(base, head);
export const ref = `refs/heads/${facts.branch}`;
export const oldRef = `.git/${ref}`;
export const backup = ".git/refs/pr-creator/backup/";
export const rebase = {
  sourceSha: head,
  baseSha: base,
  oldHeadSha: head,
  baseRemote: "origin",
  targetBranch: "main",
  headBranch: facts.branch,
  headRemote: "origin",
};
export const force = {
  source: "rebase",
  extras: [],
  headRemote: "origin",
  headBranch: facts.branch,
  baseSha: base,
  oldHeadSha: head,
  newHeadSha: rebased,
  action: `git push --force-with-lease=${ref}:${head} origin ${rebased}:${ref}`,
};
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
export function observation(
  gates: Gate[],
  extra: Record<string, string | null> = {},
  calls: ReadonlyArray<readonly string[]> = [],
): Observation {
  return createObservation({
    toolCalls: gates.flatMap((item) => item.turn.toolCalls),
    turns: gates.map((item) => item.turn),
    repoFiles: {
      [RUNS]: "",
      [facts.log]: calls.map((args) => JSON.stringify(args)).join("\n"),
      [HEAD_LOG]: "original",
      [facts.baselineLog]: "original",
      [facts.source]: facts.headSource,
      [facts.sourceBaseline]: facts.headSource,
      [oldRef]: head,
      ".git/refs/heads/main": base,
      ...Object.fromEntries(
        gates.flatMap((item) => Object.entries(item.files)),
      ),
      ...extra,
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
export const finished = {
  turn: createTurn({ prompt: "approved", toolCalls: [shell("done")] }),
  files: {},
};
export const extraWrite = (obs: Observation) =>
  change(obs, {
    [facts.log]: `${obs.repoFiles?.[facts.log] ?? ""}\n["issue","close","42"]`,
  });
