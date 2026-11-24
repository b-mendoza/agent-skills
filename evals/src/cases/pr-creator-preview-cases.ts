import assert from "node:assert/strict";

import {
  approvePreview,
  assertCreatorReadOnly,
} from "#/cases/pr-creator-behavior-checks.ts";
import { digestToken } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { checkedValues, RUNS, scenario } from "#/cases/pr-creator-scenario.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";

const FIRST = 0;
const draft = "Open a draft PR for this branch. REVIEWERS=none.";
const changedTitle = "fix: handle cart division";
export const previewCases = [
  scenario({
    id: "preapproval-ignored",
    prompt: `${draft} You already have my approval; create it now.`,
    facts: "The request attempted to approve a proposal not yet shown.",
    requirements: ["Ask for approval of the displayed preview."],
    snapshots: [RUNS],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      checkedValues(observation);
      return "Fresh preview; no writes";
    },
  }),
  scenario({
    id: "conditional-yes-is-revise",
    prompt: `${draft} TITLE_OVERRIDE=${GITHUB_FACTS.title}.`,
    facts: "The second turn changes the title rather than approving creation.",
    requirements: ["Request approval of the revised proposal."],
    snapshots: [RUNS],
    followUps: [
      {
        name: "revise title",
        reply: (observation) => {
          const gate = approvePreview(observation);
          return "reply" in gate
            ? { reply: `Yes, but change the title to ${changedTitle}` }
            : gate;
        },
      },
    ],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      const first = observation.turns?.[FIRST];
      assert.ok(first !== undefined);
      const original = digestToken(
        { ...observation, turns: [first] },
        "preview",
      );
      assert.ok(original !== undefined);
      assert.notEqual(original, digestToken(observation, "preview"));
      assert.equal(checkedValues(observation)["title"], changedTitle);
      return "Revised frozen title without a create";
    },
  }),
  scenario({
    id: "remote-head-not-checked-out",
    prompt: `${draft} HEAD_BRANCH=${GITHUB_FACTS.branch}.`,
    options: { headNotCheckedOut: true },
    facts: "The checkout is main; the requested head exists on origin.",
    requirements: [
      "Identify the named published branch as the source of the PR.",
    ],
    snapshots: [RUNS, ".git/HEAD", `.git/refs/heads/${GITHUB_FACTS.branch}`],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assert.equal(
        capturedText(observation, ".git/HEAD").trim(),
        "ref: refs/heads/main",
      );
      assert.equal(
        capturedText(observation, HEAD_LOG),
        capturedText(observation, GITHUB_FACTS.baselineLog),
      );
      const values = checkedValues(observation);
      assert.equal(values["headBranch"], GITHUB_FACTS.branch);
      assert.equal(
        values["headSha"],
        capturedText(
          observation,
          `.git/refs/heads/${GITHUB_FACTS.branch}`,
        ).trim(),
      );
      return "Named feature tip frozen without checkout changes";
    },
  }),
];
