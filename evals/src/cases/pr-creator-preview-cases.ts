import assert from "node:assert/strict";

import {
  approvePreview,
  assertAssigneeLookup,
  assertAssigneeStatus,
  assertCreatorReadOnly,
} from "#/cases/pr-creator-behavior-checks.ts";
import { canonicalAction, githubCalls } from "#/cases/pr-creator-checks.ts";
import { digestToken } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { checkedValues, RUNS, scenario } from "#/cases/pr-creator-scenario.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";

const FIRST = 0;
const COMMAND_PAIR = 2;
const SECOND = 1;
const draft = "Open a draft PR for this branch. REVIEWERS=none.";
const issues = [
  { number: 42, title: "Remove empty-cart guard", state: "open" },
  { number: 43, title: "Cart cleanup", state: "open" },
] as const;
const ref = (number: number) => `${GITHUB_FACTS.repository}#${String(number)}`;
const changedTitle = "fix: handle cart division";
const issueLookup = (args: readonly string[]) =>
  args[FIRST] === "issue" ||
  args.some((arg) =>
    /\/issues(?:[/?]|$)|\bissue(?:s|OrPullRequest)?\s*[( {]/.test(arg),
  );
const issueView = (number: number) =>
  `repos/${GITHUB_FACTS.repository}/issues/${String(number)}`;
const keepKeywords = "Keep the closing keywords.";
function assertKeywordChoice(observation: Observation) {
  const turns = observation.turns ?? [];
  const first = turns[FIRST];
  assert.ok(first !== undefined);
  assert.equal(
    digestToken({ ...observation, turns: [first] }, "preview"),
    undefined,
  );
  assert.equal(turns[SECOND]?.prompt, keepKeywords);
}
const nonDefaultTurn = {
  followUps: [
    {
      name: "keep keywords",
      reply: (observation: Observation) =>
        /trunk/i.test(observation.finalText) &&
        /clos/i.test(observation.finalText)
          ? { reply: keepKeywords }
          : { gateNotReached: "no non-default closure decision" },
    },
  ],
};
function closureRequirements(nonDefault: boolean) {
  return nonDefault
    ? [
        "Explain that merging into main will not automatically close #42.",
        "Offer to move the closing reference to related.",
      ]
    : ["Explain which change delivers #42 or identify it as user-classified."];
}
const discoveryBranch = "feature/issue-42-cart";
const classification = "Classify #42 as closes and #43 as related.";
const discoveryOptions = {
  headHistory: {
    branch: discoveryBranch,
    commitMessages: ["Simplify unit price", "Track #43; compare PR #17"],
  },
  issues: [
    ...issues,
    { number: 17, title: "Prior refactor", state: "open", isPr: true },
  ],
} as const;
function candidateView(args: readonly string[], number: number) {
  const [family, verb, target] = args;
  const normalized = canonicalAction(args);
  const repo = normalized.indexOf("-R");
  if (repo < FIRST) return false;
  return (
    [family, verb, target].join(" ") === `issue view ${String(number)}` &&
    normalized[repo + SECOND] === GITHUB_FACTS.repository
  );
}
function checkClassification(observation: Observation) {
  assertCreatorReadOnly(observation);
  const turns = observation.turns ?? [];
  const first = turns[FIRST];
  assert.ok(first !== undefined);
  assert.equal(
    digestToken({ ...observation, turns: [first] }, "preview"),
    undefined,
  );
  assert.equal(turns[SECOND]?.prompt, classification);
  for (const issue of discoveryOptions.issues) {
    assert.ok(
      githubCalls(observation).some(
        (args) =>
          args.includes(issueView(issue.number)) ||
          candidateView(args, issue.number),
      ),
      "missing discovered candidate lookup",
    );
  }
  const values = checkedValues(observation);
  assert.equal(values["headBranch"], discoveryBranch);
  assert.deepEqual(values["closes"], [ref(issues[FIRST].number)]);
  assert.deepEqual(values["related"], [ref(issues[SECOND].number)]);
  assert.equal(values["autoClose"], "yes");
  return "Classified branch and commit mentions; PR excluded";
}
export const previewCases = [
  scenario({
    id: "issue-refs-discovery-classify",
    prompt: draft,
    facts:
      "The branch mentions issue 42. A commit mentions issue 43 and PR 17.",
    options: discoveryOptions,
    snapshots: [RUNS],
    requirements: [
      "Ask how to classify issues 42 and 43.",
      "Identify the branch as the source of 42.",
      "Identify the mentioning commit for 43.",
      "Report that 17 was dropped because it is a PR.",
    ],
    followUps: [
      {
        name: "classify issue mentions",
        reply: (observation) =>
          /#42\b/.test(observation.finalText) &&
          /#43\b/.test(observation.finalText)
            ? { reply: classification }
            : { gateNotReached: "missing candidate list" },
      },
    ],
    check: checkClassification,
  }),
  scenario({
    id: "issue-discovery-off",
    prompt: `${draft} ISSUE_DISCOVERY=off.`,
    facts:
      "The feature branch and commits contain mentions, but discovery was disabled.",
    options: discoveryOptions,
    snapshots: [RUNS],
    requirements: [
      "Proceed to the preview without asking a classification question.",
    ],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      const values = checkedValues(observation);
      assert.equal(values["headBranch"], discoveryBranch);
      assert.deepEqual(values["closes"], []);
      assert.deepEqual(values["related"], []);
      assert.ok(!githubCalls(observation).some(issueLookup));
      return "Mention-bearing head frozen without issue lookups";
    },
  }),
  scenario({
    id: "assignee-me-alias",
    prompt: `${draft} ASSIGNEE=@me.`,
    facts: "The authenticated login is cart-owner, not maintainer.",
    options: { me: "cart-owner" },
    requirements: ["Identify cart-owner as the proposed assignee."],
    snapshots: [RUNS],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assert.ok(
        githubCalls(observation).some(
          (args) =>
            args.includes("user") ||
            args.slice(FIRST, COMMAND_PAIR).join(" ") === "auth status",
        ),
        "missing identity lookup",
      );
      assertAssigneeLookup(observation, "cart-owner");
      assertAssigneeStatus(observation, "cart-owner", true);
      assert.deepEqual(checkedValues(observation)["assignees"], ["cart-owner"]);
      return "Resolved authenticated user validated and frozen without create";
    },
  }),
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
    id: "title-missing-ticket-asks",
    prompt: `${draft} TITLE_CONVENTION=type=feat; ticket=?@start; case=sentence.`,
    facts:
      "A ticket key is required but neither the request nor the branch supplies one.",
    requirements: ["Ask the user to provide the missing ticket key."],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      assert.equal(digestToken(observation, "preview"), undefined);
      assert.ok(
        observation.toolCalls.some(
          (call) =>
            call.result !== undefined &&
            !call.result.isError &&
            /Decision needed:\s*provide ticket key/i.test(call.result.content),
        ),
        "missing drafter choice evidence",
      );
      return "Drafter requests ticket before freezing";
    },
  }),
  scenario({
    id: "no-mentions-no-resolver",
    prompt: draft,
    facts: "Neither branch nor commit messages contain issue references.",
    requirements: ["Show a preview without asking for issue classification."],
    snapshots: [RUNS],
    check: (observation) => {
      assertCreatorReadOnly(observation);
      const values = checkedValues(observation);
      assert.deepEqual(values["closes"], []);
      assert.deepEqual(values["related"], []);
      assert.ok(
        !githubCalls(observation).some(issueLookup),
        "unexpected issue lookup",
      );
      return "Empty reference sets without an issue lookup";
    },
  }),
  ...[false, true].map((nonDefault) =>
    scenario({
      id: nonDefault ? "issue-refs-non-default-base" : "issue-refs-explicit",
      prompt: `${draft} CLOSES_ISSUES=#42, RELATED_ISSUES=#43.`,
      facts: "42 is closing; 43 is related only. The target is main.",
      options: { issues, defaultBranch: nonDefault ? "trunk" : "main" },
      snapshots: [RUNS],
      ...(nonDefault ? nonDefaultTurn : {}),
      requirements: closureRequirements(nonDefault),
      check: (observation) => {
        assertCreatorReadOnly(observation);
        if (nonDefault) assertKeywordChoice(observation);
        for (const issue of issues) {
          assert.ok(
            githubCalls(observation).some(
              (args) =>
                args.includes(issueView(issue.number)) ||
                candidateView(args, issue.number),
            ),
            "missing issue lookup",
          );
        }
        const values = checkedValues(observation);
        assert.deepEqual(values["closes"], [ref(issues[FIRST].number)]);
        assert.deepEqual(values["related"], [ref(issues[SECOND].number)]);
        assert.equal(values["autoClose"], nonDefault ? "no" : "yes");
        return "Validated references and closure expectation in frozen preview";
      },
    }),
  ),
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
