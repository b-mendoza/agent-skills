import { createHash } from "node:crypto";

import {
  CREATE_CAPTURE,
  EXACT_BODY,
  READBACK_CAPTURE,
  TOKEN,
} from "#/cases/pr-creator-behavior-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

export function digestCall(
  gate: "preview" | "scope" = "preview",
  token = TOKEN,
): ToolCall {
  return {
    name: "Bash",
    input: {
      command: `python3 -I .claude/skills/pr-creator/scripts/validate-output.py digest ${gate}`,
    },
    result: {
      content: JSON.stringify({
        bodyDigest:
          gate === "scope"
            ? "n/a"
            : createHash("sha256").update(EXACT_BODY).digest("hex"),
        valuesDigest: token,
      }),
      isError: false,
      truncated: false,
    },
  };
}

export function preparedObservation(
  finalText = `Approve ${TOKEN}`,
  gate: "preview" | "scope" = "preview",
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

const SHA_LENGTH = 40;
const HEAD_SHA = "b".repeat(SHA_LENGTH);
const BASE_SHA = "a".repeat(SHA_LENGTH);

export function createdObservation(drift = false): Observation {
  const initial = createTurn({
    finalText: `Approve ${TOKEN}`,
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
        prompt: `APPROVED ${TOKEN}`,
        finalText: "done",
      }),
    ],
    repoFiles: {
      [GITHUB_FACTS.baselineLog]: `${BASE_SHA} ${HEAD_SHA} Eval\tcommit: fixture\n`,
      [GITHUB_FACTS.log]: `${JSON.stringify(["api", "repos/eval-org/cart/assignees/maintainer"])}\n${JSON.stringify(CREATE_ARGS)}\n${JSON.stringify(["pr", "view", GITHUB_FACTS.url])}\n`,
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
        body: drift ? `${EXACT_BODY}\nAutomation footer\n` : EXACT_BODY,
        baseRefName: "main",
        headRefName: GITHUB_FACTS.branch,
        headRefOid: HEAD_SHA,
        isDraft: true,
        assignees: [{ login: "maintainer" }],
        labels: drift ? [{ name: "automation" }] : [],
        reviewRequests: [],
      }),
    },
  });
}
