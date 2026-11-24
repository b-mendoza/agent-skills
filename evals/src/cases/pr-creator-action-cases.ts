import assert from "node:assert/strict";

import { Schema } from "effect";

import {
  approveUpdate,
  assertCreatorReadOnly,
  creatorObservation,
  READBACK_CAPTURE,
} from "#/cases/pr-creator-behavior-checks.ts";
import {
  assertNoGithubWrites,
  canonicalAction,
  githubCalls,
} from "#/cases/pr-creator-checks.ts";
import { digestToken } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  checkedValues,
  proposalTurn,
  RUNS,
  scenario,
} from "#/cases/pr-creator-scenario.ts";
import {
  assertFileAbsent,
  assertNoMutation,
  capturedText,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";

const FIRST = 0;
const NEXT = 1;
const edit = ".git/eval-pr-edit-1.json";
const ready = ".git/eval-pr-ready-1.json";
const repo = GITHUB_FACTS.repository;
const title = "fix: remove redundant guard";
const newBody = "Describe cart rounding.";
const updated = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
  isDraft: Schema.Boolean,
});
function read<T>(
  observation: Observation,
  path: string,
  schema: Schema.Codec<T, unknown>,
) {
  return Schema.decodeUnknownSync(schema)(
    JSON.parse(capturedText(observation, path)),
  );
}
const argv = Schema.Array(Schema.String);
function orderedCalls(
  observation: Observation,
  expected: ReadonlyArray<(args: readonly string[]) => boolean>,
) {
  let start = 0;
  for (const matches of expected) {
    const from = start;
    const index = githubCalls(observation).findIndex(
      (args, i) => i >= from && matches(args),
    );
    assert.ok(index >= start, "missing ordered GitHub call");
    start = index + NEXT;
  }
}
const equal = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify(canonicalAction(left)) ===
  JSON.stringify(canonicalAction(right));
const isPrRead = (args: readonly string[]) =>
  args[FIRST] === "pr" && args[NEXT] === "view";
const reviewer = "cart-reviewer";
const reviewerPr = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
  isDraft: Schema.Boolean,
  reviewRequests: Schema.Array(Schema.Struct({ login: Schema.String })),
  labels: Schema.Array(Schema.Unknown),
  assignees: Schema.Array(Schema.Unknown),
});
export const actionCases = [
  scenario({
    id: "existing-pr-update-adds-reviewers",
    prompt: `Update the open PR for my branch. EXISTING_PR=update; REVIEWERS=${reviewer}. Leave every other field alone.`,
    facts:
      "The open draft has no requested reviewers and cart-reviewer is a repository collaborator.",
    options: { existing: true, allowEdit: true, collaborators: [reviewer] },
    snapshots: [RUNS, edit, READBACK_CAPTURE],
    followUps: [{ name: "approve reviewer addition", reply: approveUpdate }],
    requirements: [
      "Present the reviewer as an addition to the existing PR.",
      "Confirm the read-back reviewer without claiming a new PR was created.",
    ],
    check: (observation) => {
      assertNoMutation(creatorObservation(observation));
      const values = checkedValues(
        proposalTurn(observation, FIRST, "update"),
        "update",
      );
      assert.deepEqual(values["baselineReviewers"], []);
      assert.deepEqual(values["reviewers"], [reviewer]);
      const command = [
        "pr",
        "edit",
        "17",
        "-R",
        repo,
        "--add-reviewer",
        reviewer,
      ];
      const captured = read(
        observation,
        edit,
        Schema.Struct({ args: argv, pr: reviewerPr }),
      );
      assert.deepEqual(canonicalAction(captured.args), command);
      assertNoGithubWrites(observation, [command]);
      orderedCalls(observation, [
        (args) =>
          args[FIRST] === "api" &&
          args.includes(`repos/${repo}/collaborators/${reviewer}`),
        (args) => equal(args, command),
        isPrRead,
      ]);
      const returned = read(observation, READBACK_CAPTURE, reviewerPr);
      assert.deepEqual(returned, captured.pr);
      assert.deepEqual(returned, {
        title: GITHUB_FACTS.title,
        body: "Simplify unit_price while preserving the empty-cart zero contract.",
        isDraft: true,
        reviewRequests: [{ login: reviewer }],
        labels: [],
        assignees: [],
      });
      return "One approved reviewer addition, confirmed without unrelated edits";
    },
  }),
  scenario({
    id: "existing-pr-changed-after-preview",
    prompt: `Update the open PR on my branch. EXISTING_PR=update. BODY_OVERRIDE=${newBody}`,
    facts: "Another writer changes the PR title after the first baseline read.",
    options: { existing: true, allowEdit: true, mutateBeforeEdit: true },
    snapshots: [RUNS, READBACK_CAPTURE, edit, ready],
    followUps: [{ name: "approve first update", reply: approveUpdate }],
    requirements: [
      "Explain why the original approval is no longer valid.",
      "Request approval of the refreshed update.",
    ],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      const original = digestToken(
        proposalTurn(observation, FIRST, "update"),
        "update",
      );
      assert.notEqual(original, digestToken(observation, "update"));
      const values = checkedValues(observation, "update");
      const returned = read(observation, READBACK_CAPTURE, updated);
      assert.equal(returned.title, `${GITHUB_FACTS.title} (edited externally)`);
      assert.equal(values["baselineTitle"], returned.title);
      assert.equal(values["body"], newBody);
      assertFileAbsent(observation, edit);
      assertFileAbsent(observation, ready);
      return "Refreshed external baseline without writes";
    },
  }),
  scenario({
    id: "existing-pr-partial-write",
    prompt: `Update the open PR on this branch. EXISTING_PR=update. TITLE_OVERRIDE=${title}. PR_STATE=ready.`,
    facts: "The title edit succeeds; the transition to ready fails.",
    options: { existing: true, allowEdit: true, editFailsOn: "pr ready" },
    snapshots: [RUNS, edit, ready, READBACK_CAPTURE],
    followUps: [
      { name: "approve title and state delta", reply: approveUpdate },
    ],
    requirements: [
      "Report that the title was applied.",
      "Report that the PR remains a draft.",
      "Provide the read-only command for checking the partial result.",
    ],
    check: (observation) => {
      assertNoMutation(creatorObservation(observation));
      const values = checkedValues(
        proposalTurn(observation, FIRST, "update"),
        "update",
      );
      assert.equal(values["title"], title);
      assert.equal(values["state"], "ready");
      const captured = read(
        observation,
        edit,
        Schema.Struct({ args: argv, pr: updated }),
      );
      const editArgs = ["pr", "edit", "17", "-R", repo, "--title", title];
      const readyArgs = ["pr", "ready", "17", "-R", repo];
      assert.deepEqual(canonicalAction(captured.args), editArgs);
      assertNoGithubWrites(observation, [editArgs, readyArgs]);
      orderedCalls(observation, [
        (a) => equal(a, editArgs),
        (a) => equal(a, readyArgs),
        isPrRead,
      ]);
      const returned = read(observation, READBACK_CAPTURE, updated);
      assert.equal(returned.title, title);
      assert.equal(returned.isDraft, true);
      assertFileAbsent(observation, ready);
      return "Only approved edit succeeded; failed ready followed by readback";
    },
  }),
];
