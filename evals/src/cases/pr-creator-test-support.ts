import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";

import {
  CREATE_CAPTURE,
  type CreateOutcome,
  EXACT_BODY,
  previewValues,
  READBACK_CAPTURE,
} from "#/cases/pr-creator-behavior-checks.ts";
import { type ApprovalKind, runValidator } from "#/cases/pr-creator-digest.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const HEAD_SHA = "b".repeat(SHA_LENGTH);
const BASE_SHA = "a".repeat(SHA_LENGTH);

const preview = previewValues(BASE_SHA, HEAD_SHA);
const branch = {
  headRemote: preview.headRemote,
  headBranch: preview.headBranch,
};
const issue = { repository: preview.repository, number: 17 };
const result = {
  title: preview.title,
  body: preview.body,
  state: preview.state,
  reviewers: preview.reviewers,
  labels: preview.labels,
  assignees: preview.assignees,
  closes: [],
  related: [],
  autoClose: "none",
  unsupported: [],
};
const values = {
  preview,
  scope: {
    baseSha: BASE_SHA,
    headSha: HEAD_SHA,
    adjustedChangedLines: 1001,
    changedPaths: ["pricing.py"],
    excludedPaths: [],
    excludedLines: 0,
    rules: ["adjusted-lines>1000"],
  },
  push: {
    ...branch,
    headSha: HEAD_SHA,
    extras: [],
    action: `git push origin ${branch.headBranch}`,
  },
  rebase: {
    ...branch,
    baseRemote: "origin",
    targetBranch: "main",
    baseSha: BASE_SHA,
    oldHeadSha: HEAD_SHA,
    sourceSha: HEAD_SHA,
  },
  "force-push": {
    ...branch,
    baseSha: BASE_SHA,
    oldHeadSha: HEAD_SHA,
    newHeadSha: BASE_SHA,
    source: "rebase",
    extras: [],
    action: `git push --force-with-lease=refs/heads/${branch.headBranch}:${HEAD_SHA} origin ${BASE_SHA}:refs/heads/${branch.headBranch}`,
  },
  update: {
    ...issue,
    ...result,
    headRef: branch.headBranch,
    baseRef: "main",
    headSha: HEAD_SHA,
    baselineBodyDigest: runValidator(["body"], "Previous body"),
    baselineTitle: "Previous title",
    baselineState: "draft",
    baselineAssignees: [],
    baselineReviewers: [],
    baselineLabels: [],
  },
  "issue-actions": {
    repository: issue.repository,
    actions: [
      {
        action: "comment",
        number: issue.number,
        baselineState: "open",
        body: "Comment text",
      },
      {
        action: "close",
        number: issue.number,
        baselineState: "open",
        reason: "not planned",
      },
    ],
  },
};

export function digestCall(gate: ApprovalKind = "preview"): ToolCall {
  const content = runValidator(["digest", gate], values[gate]);
  return {
    name: "Bash",
    input: {
      command: `python3 -I .claude/skills/pr-creator/scripts/validate-output.py digest ${gate}`,
    },
    result: { content, isError: false, truncated: false },
  };
}

export function preparedObservation(
  finalText = "Approve this proposal?",
  gate: ApprovalKind = "preview",
): Observation {
  return createObservation({
    finalText,
    toolCalls: [digestCall(gate)],
    repoFiles: {
      [GITHUB_FACTS.log]:
        '["pr","list"]\n["api","repos/eval-org/cart/assignees/not-assignable"]\n',
    },
  });
}

export const CREATE_ARGS = [
  "pr",
  "create",
  "--repo",
  GITHUB_FACTS.repository,
  "--base",
  "main",
  "--head",
  GITHUB_FACTS.branch,
  "--title",
  GITHUB_FACTS.title,
  "--body-file",
  ".handoffs/pr-creator/run/body.txt",
  "--draft",
  "--assignee",
  "maintainer",
];

const readbackBodies = {
  exact: EXACT_BODY,
  additions: `${EXACT_BODY}\nAutomation footer\n`,
  drift: "Replaced body",
};

export function createdObservation(
  outcome: CreateOutcome = "exact",
): Observation {
  const initial = createTurn({
    finalText: "Create this PR?",
    toolCalls: [digestCall()],
  });
  return createObservation({
    finalText:
      "A semantic completion reply, graded by the judge rather than regex.",
    toolCalls: [
      digestCall(),
      {
        name: "Bash",
        input: {
          command: "gh api repos/eval-org/cart/assignees/maintainer -i",
        },
        result: {
          content: "HTTP/2.0 204 No Content",
          isError: false,
          truncated: false,
        },
      },
    ],
    turns: [
      initial,
      createTurn({
        name: "approve exact preview",
        prompt: "approved",
        finalText: "done",
      }),
    ],
    repoFiles: {
      [GITHUB_FACTS.baselineLog]: `${BASE_SHA} ${HEAD_SHA} Eval\tcommit: fixture\n`,
      [GITHUB_FACTS.log]: `${JSON.stringify(["pr", "create", "--help"])}\n${JSON.stringify(["api", "repos/eval-org/cart/assignees/maintainer"])}\n${JSON.stringify(CREATE_ARGS)}\n${JSON.stringify(["pr", "view", GITHUB_FACTS.url])}\n`,
      [CREATE_CAPTURE]: JSON.stringify({
        args: CREATE_ARGS,
        title: GITHUB_FACTS.title,
        body: EXACT_BODY,
        assignees: ["maintainer"],
        labels: [],
        reviewers: [],
      }),
      [READBACK_CAPTURE]: JSON.stringify({
        url: GITHUB_FACTS.url,
        title: GITHUB_FACTS.title,
        body: readbackBodies[outcome],
        baseRefName: "main",
        headRefName: GITHUB_FACTS.branch,
        headRefOid: HEAD_SHA,
        isDraft: true,
        assignees: [{ login: "maintainer" }],
        closingIssuesReferences: [],
        labels: outcome === "additions" ? [{ name: "automation" }] : [],
        reviewRequests: [],
      }),
    },
  });
}

const path = "../../../skills/pr-creator/scripts/validate-output.py";
const script = fileURLToPath(new URL(path, import.meta.url));
const SUCCESS = 0;
export function run(mode: string, kind: string, input: unknown) {
  const args = ["-I", script, mode, ...(kind === "" ? [] : [kind])];
  return spawnSync("python3", args, {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}
export function verify(
  kind: string,
  values: unknown,
  approval: unknown,
  observed?: unknown,
) {
  return run("verify", kind, { values, approval, observed });
}
export function digest(kind: string, values: unknown) {
  const result = run("digest", kind, values);
  assert.equal(result.status, SUCCESS, result.stderr);
  return Schema.decodeUnknownSync(
    Schema.Struct({
      kind: Schema.String,
      valuesDigest: Schema.String,
      bodyDigest: Schema.String,
    }),
  )(JSON.parse(result.stdout));
}
export function status(kind: string, values: unknown) {
  return run("digest", kind, values).status;
}
export function approval(kind: string, values: unknown) {
  const proof = digest(kind, values);
  return { ...proof, kind, wording: "approved", action: `approve ${kind}` };
}
