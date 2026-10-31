import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertNoGithubWrites,
  assertPlantedStatePreserved,
  githubCalls,
  plantedPins,
} from "#/cases/pr-creator-checks.ts";
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
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assert.ok(
    githubCalls(observation).some(
      (args) => args.includes("list") || args.includes("api"),
    ),
    "no existing-PR lookup observed",
  );
  assert.match(observation.finalText, /^PR Preview\r?$/m);
  for (const field of [
    "Title",
    "Target",
    "Source",
    "Head commit",
    "Reviewers",
    "Labels",
    "State",
    "Description",
  ]) {
    assert.match(
      observation.finalText,
      new RegExp(`^${field}:`, "m"),
      `missing preview field ${field}`,
    );
  }
  assert.match(
    observation.finalText,
    /^Title:\s+refactor: simplify unit price\r?$/m,
  );
  assert.match(observation.finalText, /^Labels:\s+none\r?$/m);
  assert.match(observation.finalText, /^Target:\s+origin\/main\r?$/m);
  assert.match(
    observation.finalText,
    /^Source:\s+origin\/feature\/unit-price\r?$/m,
  );
  assert.match(
    observation.finalText,
    new RegExp(`^Head commit:\\s+${plantedPins(observation).head}\\r?$`, "m"),
  );
  assert.match(
    observation.finalText,
    /^Reviewers:\s+none \(user-confirmed\)\r?$/m,
  );
  assert.match(
    observation.finalText,
    /^State:\s+draft \(effective: draft\)\r?$/m,
  );
  assert.match(
    observation.finalText,
    /(?:approv|confirm)[^\n?]*\?/i,
    "preview never asks for approval",
  );
  assert.match(observation.finalText, /^PR_CREATE: AWAITING_USER\r?$/m);
  for (const field of ["Stopped at", "Evidence", "Reason", "Next step"]) {
    assert.match(observation.finalText, new RegExp(`^${field}: .+`, "m"));
  }
  assert.doesNotMatch(observation.finalText, /^PR created:/m);
  return "Exact preview and suspended approval envelope; no create or repository mutation";
}

function checkExisting(observation: Observation): string {
  assertNoMutation(observation);
  assertPlantedStatePreserved(observation);
  assertNoGithubWrites(observation);
  assert.ok(
    githubCalls(observation).length > NO_CALLS,
    "no GitHub lookup observed",
  );
  assert.match(observation.finalText, /^PR_CREATE: PR_EXISTS\r?$/m);
  assert.ok(
    observation.finalText.includes(GITHUB_FACTS.url),
    "existing PR URL missing",
  );
  for (const field of ["Stopped at", "Evidence", "Reason", "Next step"]) {
    assert.match(observation.finalText, new RegExp(`^${field}: .+`, "m"));
  }
  assert.doesNotMatch(observation.finalText, /^PR Preview|^PR created:/m);
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
    id: "pr-creator/preview-awaits-approval",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "read-only",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
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
        knownFacts: `The sole diff removes the count == 0 guard from pricing.py, leaving total / count. Title override: ${GITHUB_FACTS.title}. No test suite or CI configuration is planted and the fake reports no checks. No approval was supplied. Observed tool calls, not their results: ${JSON.stringify(observation.toolCalls)}.`,
        rubric: [
          {
            id: "grounded-body",
            requirement:
              "The PR description accurately describes the removed empty-cart guard and does not invent tests, successful validation, or extra changes.",
          },
          {
            id: "approval",
            requirement:
              "The final response requests approval for the displayed draft instead of claiming a PR was created.",
          },
        ],
      }),
  },
  {
    id: "pr-creator/existing-pr-stops-create",
    skill: SKILL,
    tier: BEHAVIORAL_TIER,
    mutationPolicy: "read-only",
    fixture: "clean",
    budgetUsd: 2.0,
    wallClockMs: 600_000,
    seed: (context) => {
      seedGithubFixture(context, { existing: true });
    },
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "Existing same-head/base PR stops creation before drafting or posting",
    prompt: () =>
      "Open a draft PR from this branch to main with HEAD_REMOTE=origin, BASE_REMOTE=origin and REVIEWERS=none. Inspect the already-current remote refs without fetching. If a matching PR exists, return it without changing it.",
    check: checkExisting,
  },
] as const satisfies readonly EvalCase[];
