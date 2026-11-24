import assert from "node:assert/strict";

import { Schema } from "effect";

import type { EvalCase, FollowUpTurn } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  type ApprovalKind,
  assertPreparedDigest,
  digestToken,
  judgeToolEvidence,
  runValidator,
} from "#/cases/pr-creator-digest.ts";
import {
  GITHUB_SNAPSHOTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { recoveredValues } from "#/cases/pr-creator-recovered-values.ts";
import { capturedFilesUnder } from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const MULTI_TURN_BUDGET = 2.5;
interface Scenario {
  id: string;
  prompt: string;
  facts: string;
  requirements: readonly string[];
  check: EvalCase["check"];
  options?: Parameters<typeof seedGithubFixture>[1];
  snapshots?: readonly string[];
  followUps?: readonly FollowUpTurn[];
}
export function scenario(spec: Scenario): EvalCase {
  return {
    ...behavioralDefaults,
    id: `pr-creator/${spec.id}`,
    skill: "pr-creator",
    mutationPolicy: "allowed",
    intent: spec.facts,
    budgetUsd:
      spec.followUps === undefined
        ? behavioralDefaults.budgetUsd
        : MULTI_TURN_BUDGET,
    seed: (context) => {
      seedGithubFixture(context, spec.options);
    },
    snapshotPaths: [FROZEN, ...GITHUB_SNAPSHOTS, ...(spec.snapshots ?? [])],
    prompt: () =>
      `${spec.prompt} Target main, using origin for both remotes. The remote refs are current; inspect without fetching.`,
    ...(spec.followUps === undefined ? {} : { followUps: spec.followUps }),
    check: spec.check,
    judge: async (observation) =>
      judgeLive({
        artifact:
          observation.turns?.map((turn) => turn.finalText).join("\n\n") ??
          observation.finalText,
        knownFacts: `${spec.facts} Tool inputs/results: ${judgeToolEvidence(observation)}`,
        rubric: spec.requirements.map((requirement, index) => ({
          id: `${spec.id}-${String(index)}`,
          requirement,
        })),
      }),
  };
}

export const RUNS = ".handoffs/pr-creator/";
const NEXT = 1;
const FROZEN = ".git/eval-frozen/";
const EMPTY = 0;
export function checkedValues(
  observation: Observation,
  gate: ApprovalKind = "preview",
) {
  const token = digestToken(observation, gate);
  assert.ok(token !== undefined, `missing ${gate} receipt`);
  const candidates = proposalCandidates(observation, gate);
  for (const text of candidates) {
    const values = Schema.decodeUnknownSync(
      Schema.Record(Schema.String, Schema.Unknown),
    )(JSON.parse(text));
    const receipt = Schema.decodeUnknownSync(
      Schema.Struct({ valuesDigest: Schema.String }),
    )(JSON.parse(runValidator(["digest", gate], values)));
    if (receipt.valuesDigest === token) return values;
  }
  throw new Error(`No frozen ${gate} values match the receipt`);
}
function proposalCandidates(observation: Observation, gate: ApprovalKind) {
  const files = {
    ...observation.repoFiles,
    ...capturedFilesUnder(observation, RUNS),
  };
  const candidates = Object.entries(files)
    .filter(
      ([path]) =>
        (path.startsWith(FROZEN) || path.startsWith(RUNS)) &&
        path.endsWith(`/${gate}-values.json`),
    )
    .flatMap(([, text]) => (text === null ? [] : [text]));
  return candidates.length === EMPTY
    ? recoveredValues(observation, gate)
    : candidates;
}
export function proposalTurn(
  observation: Observation,
  index: number,
  kind: ApprovalKind,
  reply = "approved",
) {
  const turns = observation.turns ?? [];
  const turn = turns[index];
  assert.ok(turn !== undefined, `missing ${kind} proposal`);
  const atGate = { ...observation, ...turn, turns: [turn] };
  assertPreparedDigest(atGate, kind);
  assert.equal(
    turns[index + NEXT]?.prompt,
    reply,
    `missing immediate ${kind} reply`,
  );
  return atGate;
}
