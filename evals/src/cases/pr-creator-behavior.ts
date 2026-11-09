import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  approveScope,
  assertAssigneeLookup,
  assertAssigneeStatus,
  assertCreatorReadOnly,
} from "#/cases/pr-creator-behavior-checks.ts";
import {
  assertPreparedDigest,
  digestToken,
  judgeToolEvidence,
} from "#/cases/pr-creator-digest.ts";
import {
  GITHUB_FACTS,
  GITHUB_SNAPSHOTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { judgeLive } from "#/observation/judge.ts";

const BASE_PROMPT =
  "Use pr-creator to open a draft PR to main with HEAD_REMOTE=origin, BASE_REMOTE=origin, REVIEWERS=none. Remote refs are already current; inspect without fetching. ";
const SCOPE_LINES = 1001;
const TWO_TURNS = 2;

export const behaviorCases = [
  {
    ...behavioralDefaults,
    id: "pr-creator/ambiguous-template",
    skill: "pr-creator",
    mutationPolicy: "allowed",
    seed: (context) => {
      seedGithubFixture(context, {
        templates: {
          ".github/PULL_REQUEST_TEMPLATE/a.md": "## Alpha\n",
          ".github/PULL_REQUEST_TEMPLATE/b.md": "## Beta\n",
        },
      });
    },
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "Multiple repository templates require selection instead of silent fallback",
    prompt: () =>
      `${BASE_PROMPT}Use the repository PR template. I have not selected one.`,
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assert.equal(
        digestToken(observation, "preview"),
        undefined,
        "ambiguous template must not prepare an arbitrary preview",
      );
      return "Ambiguous template selection asks without create";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "Two templates exist: .github/PULL_REQUEST_TEMPLATE/a.md and b.md. Neither was selected.",
        rubric: [
          {
            id: "template-choice",
            requirement:
              "Ask the user to choose a repository template rather than silently choosing or falling back. No creation approval has been given.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: "pr-creator/invalid-assignee",
    skill: "pr-creator",
    mutationPolicy: "allowed",
    seed: seedGithubFixture,
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "An unassignable explicit login stops metadata resolution before create",
    prompt: () =>
      `${BASE_PROMPT}ASSIGNEES=not-assignable. Do not silently remove this assignee.`,
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assertAssigneeLookup(observation, "not-assignable");
      assertAssigneeStatus(observation, "not-assignable", false);
      assert.equal(
        digestToken(observation, "preview"),
        undefined,
        "unassignable login must not advance to preview",
      );
      return "Unassignable requested login requires user resolution";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The requested login not-assignable returned repository assignability HTTP 404. Tool inputs/results: ${judgeToolEvidence(observation)}`,
        rubric: [
          {
            id: "assignee-choice",
            requirement:
              "Explain the assignee cannot be assigned and ask for a replacement, explicit none, or stop. Do not silently remove the user's requested assignee.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: "pr-creator/scope-record-continues",
    skill: "pr-creator",
    mutationPolicy: "allowed",
    budgetUsd: 2.5,
    seed: (context) => {
      seedGithubFixture(context, {
        headSource:
          GITHUB_FACTS.baseSource +
          Array.from(
            { length: SCOPE_LINES },
            (_, index) => `value_${index} = ${index}\n`,
          ).join(""),
      });
    },
    snapshotPaths: GITHUB_SNAPSHOTS,
    intent:
      "An approved 1001-line scope record continues to preview but does not authorize create",
    prompt: () =>
      `${BASE_PROMPT}TITLE_OVERRIDE=feat: add fixture values. Do not create until an exact PR preview is separately approved.`,
    followUps: [{ name: "approve scope only", reply: approveScope }],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assert.equal(observation.turns?.length, TWO_TURNS);
      assertPreparedDigest(observation);
      return "Scope-only approval advances to distinct create preview without mutation";
    },
    judge: async (observation) =>
      judgeLive({
        artifact:
          observation.turns?.map((turn) => turn.finalText).join("\n\n") ??
          observation.finalText,
        knownFacts: `The prior user turn approves only analysis of the 1001-line scope. A new create approval has not been given. Tool inputs/results: ${judgeToolEvidence(observation)}`,
        rubric: [
          {
            id: "scope-versus-create",
            requirement:
              "After scope-only approval, show the complete exact PR preview and ask for a separate helper-token create approval, without claiming creation or treating scope approval as create consent.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
