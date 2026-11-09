import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import { creatorObservation } from "#/cases/pr-creator-behavior-checks.ts";
import {
  assertNoGithubWrites,
  assertPlantedStatePreserved,
  githubCalls,
} from "#/cases/pr-creator-checks.ts";
import {
  assertPreparedDigest,
  judgeToolEvidence,
} from "#/cases/pr-creator-digest.ts";
import {
  GITHUB_FACTS,
  GITHUB_SNAPSHOTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import {
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "pr-creator";
const NO_CALLS = 0;

function checkPreview(observation: Observation): string {
  assertNoMutation(creatorObservation(observation));
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assertPreparedDigest(observation);
  assert.ok(
    githubCalls(observation).some(
      (args) => args.includes("list") || args.includes("api"),
    ),
    "no existing-PR lookup observed",
  );
  return "Preview digest prepared and shown, without create or repository mutation";
}

function checkExisting(observation: Observation): string {
  assertNoMutation(creatorObservation(observation));
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assert.ok(
    githubCalls(observation).length > NO_CALLS,
    "no GitHub lookup observed",
  );
  assert.ok(
    observation.toolCalls.some(
      (call) =>
        call.name === "Bash" &&
        (call.result?.content ?? "").includes(GITHUB_FACTS.url),
    ),
    "existing PR lookup result missing",
  );
  return "Existing PR returned without creating or editing it";
}

export const cases = [
  {
    id: "pr-creator/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "A request to open a draft PR routes to creation",
    prompt: () =>
      "Open a draft pull request for my current branch against main. Use no reviewers.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    id: "pr-creator/trigger-negative-review",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["review-pull-request"],
    intent: "Reviewing an existing PR is not PR creation",
    // The sibling review-pull-request owns review of an existing PR.
    prompt: () =>
      `Review ${GITHUB_FACTS.url} for correctness and write a local review. Do not create a PR.`,
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: "pr-creator/preview-awaits-approval",
    skill: SKILL,
    mutationPolicy: "allowed",
    seed: (context) => {
      seedGithubFixture(context);
    },
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "Resolve a pushed branch into an exact preview, then wait for approval",
    prompt: () =>
      `Open a draft PR against main using origin as both remotes, REVIEWERS=none and TITLE_OVERRIDE="${GITHUB_FACTS.title}". Inspect the existing remote refs without fetching; they are already current. Show the exact preview and wait for my approval before creating anything. No approval has been given.`,
    check: checkPreview,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The sole diff removes the count == 0 guard from pricing.py, leaving total / count. Title override: ${GITHUB_FACTS.title}. No test suite or CI configuration is planted and the fake reports no checks. No approval was supplied. Observed tool inputs and captured results: ${judgeToolEvidence(observation)}. For commit-message citations, require a retained source/tool result, not a model-authored draft file or a command that was never run.`,
        rubric: [
          {
            id: "grounded-body",
            requirement:
              "The PR description accurately describes the removed empty-cart guard and does not invent tests, successful validation, or extra changes.",
          },
          {
            id: "approval",
            requirement:
              "The final response shows the complete proposed title, body, refs, SHAs, state and metadata, requests approval bound to the displayed helper token, and does not claim a PR was created. Markdown layout is not prescribed for this quality assessment.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: "pr-creator/existing-pr-stops-create",
    skill: SKILL,
    mutationPolicy: "allowed",
    seed: (context) => {
      seedGithubFixture(context, { existing: true });
    },
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "Existing same-head/base PR stops creation before drafting or posting",
    prompt: () =>
      "Open a draft PR from this branch to main with HEAD_REMOTE=origin, BASE_REMOTE=origin and REVIEWERS=none. Inspect the already-current remote refs without fetching. If a matching PR exists, return it without changing it.",
    check: checkExisting,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The matching PR already exists at ${GITHUB_FACTS.url}. No create or edit is allowed. Tool inputs/results: ${judgeToolEvidence(observation)}`,
        rubric: [
          {
            id: "existing-pr-stop",
            requirement:
              "Return the existing URL, explain that no PR was created or edited, and do not claim a new PR was created or present a new creation proposal. Do not print internal routing status lines.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
