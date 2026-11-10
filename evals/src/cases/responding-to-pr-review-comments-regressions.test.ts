import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/responding-to-pr-review-comments.ts";
import {
  APPROVED_BODY,
  APPROVED_BODY_FILE,
  POST_LOG,
  READBACK_LOG,
  REPLY_ENDPOINT,
  REPLY_URL,
  RESPONSE_REPORT,
} from "#/cases/responding-to-pr-review-comments-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const [, , , , defaultCase, collisionCase, postingCase] = cases;
const FIRST_FOLLOW_UP = 0;
const UNSUPPORTED_COMMAND = 79;
const ONE_POST = 1;
interface FileVariant {
  name: string;
  files: Record<string, string | null>;
}
const POST_SCRIPT = fileURLToPath(
  new URL(
    "../../../skills/responding-to-pr-review-comments/scripts/post-review-reply.sh",
    import.meta.url,
  ),
);
const PREVIEW_REPORT = `# PR 17 Review Comment Assessment
PR: ${GITHUB_FACTS.url}
Posting mode: post-after-confirmation
Posting status: pending-confirmation
Identity mode: resolved:maintainer
## PR Summary
One actionable comment.
## Comment Assessments
### C1: Empty-cart guard
- Comment: ${GITHUB_FACTS.url}#discussion_r701
- Author: reviewer
- Location: pricing.py:3
- Classification: valid
- Evidence: Division by zero for empty carts.
- Planned action: Restore the guard.
- Reply disposition: reply-ready
- Posting target: review-comment-reply:701
- Skip or follow-up reason: none
- Verification notes: Source inspected.
- Residual risks: none
Draft reply:
> ${APPROVED_BODY.trimEnd()}
## Action Summary
Restore the guard later.
## Unsupported Or Report-Only Items
None.
## Posting Ledger
Awaiting approval.
## Residual Risks
None.
`;

function baseObservation(): Observation {
  return createObservation({
    repoFiles: {
      [GITHUB_FACTS.log]: '["api","repos/eval-org/cart/pulls/17/comments"]\n',
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: "same HEAD\n",
      ".git/logs/HEAD": "same HEAD\n",
      [GITHUB_FACTS.report]: null,
      [RESPONSE_REPORT]: null,
    },
  });
}

function defaultObservation(): Observation {
  const observation = baseObservation();
  return {
    ...observation,
    finalText: "Saved pr-17-responses.md; nothing posted.",
    gitStatusAfter: { kind: "worktree", entries: `?? ${RESPONSE_REPORT}` },
    toolCalls: [{ name: "Write", input: { file_path: RESPONSE_REPORT } }],
    repoFiles: {
      ...observation.repoFiles,
      [RESPONSE_REPORT]: PREVIEW_REPORT.replace(
        "pending-confirmation",
        "not-posted",
      ),
    },
  };
}

describe("response filename regressions", () => {
  it("accepts the response-specific default", () => {
    expect(() => defaultCase.check(defaultObservation())).not.toThrow();
  });

  it.each<FileVariant>([
    { name: "missing new default", files: { [RESPONSE_REPORT]: null } },
    {
      name: "old default created",
      files: { [GITHUB_FACTS.report]: PREVIEW_REPORT },
    },
    { name: "source edited", files: { [GITHUB_FACTS.source]: "changed" } },
    {
      name: "GitHub write",
      files: {
        [GITHUB_FACTS.log]:
          '["api","--method","POST","repos/eval-org/cart/pulls/17/comments/701/replies"]\n',
      },
    },
  ])("rejects $name", ({ files }) => {
    const observation = defaultObservation();
    observation.repoFiles = { ...observation.repoFiles, ...files };
    expect(() => defaultCase.check(observation)).toThrow();
  });

  it("rejects an extra workspace file", () => {
    const observation = defaultObservation();
    observation.gitStatusAfter = {
      kind: "worktree",
      entries: `?? ${RESPONSE_REPORT}\n?? unrelated.txt`,
    };
    expect(() => defaultCase.check(observation)).toThrow();
  });

  it("keeps the explicit collision gate and rejects overwritten bytes", () => {
    const observation = baseObservation();
    observation.finalText =
      "chosen-responses.md exists. Overwrite, use a suffix, or stop?";
    observation.repoFiles = {
      ...observation.repoFiles,
      "chosen-responses.md": GITHUB_FACTS.existingReport,
    };
    expect(() => collisionCase.check(observation)).not.toThrow();
    observation.repoFiles = {
      ...observation.repoFiles,
      "chosen-responses.md": "overwritten",
    };
    expect(() => collisionCase.check(observation)).toThrow();
  });
});

function postedObservation(): Observation {
  const observation = baseObservation();
  return {
    ...observation,
    gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
    finalText: `Posted ${REPLY_URL}`,
    turns: [
      createTurn({
        finalText: `Reply to review comment 701:\n${APPROVED_BODY}\nReply APPROVED to post this exact reply.`,
      }),
      createTurn({ name: "approve exact reply", prompt: "APPROVED" }),
    ],
    repoFiles: {
      ...observation.repoFiles,
      [GITHUB_FACTS.report]: `Posting status: posted\n${REPLY_URL}`,
      [POST_LOG]: `${JSON.stringify({ endpoint: REPLY_ENDPOINT, body: APPROVED_BODY })}\n`,
      [READBACK_LOG]: `${JSON.stringify({ id: 901, body: APPROVED_BODY, html_url: REPLY_URL })}\n`,
    },
  };
}

describe("approved reply observables", () => {
  it("rejects a body-only first turn despite a perfect post, read-back and ledger", () => {
    const observation = postedObservation();
    expect(() =>
      postingCase.check({
        ...observation,
        turns: [
          createTurn({ finalText: JSON.stringify(APPROVED_BODY) }),
          createTurn({ prompt: "APPROVED", finalText: observation.finalText }),
        ],
      }),
    ).toThrow("body-only preview");
  });

  it("accepts one exact post with read-back and ledger", () => {
    expect(() => postingCase.check(postedObservation())).not.toThrow();
  });

  it.each<FileVariant>([
    {
      name: "wrong route",
      files: {
        [POST_LOG]: JSON.stringify({
          endpoint: "repos/eval-org/cart/pulls/comments/701/replies",
          body: APPROVED_BODY,
        }),
      },
    },
    {
      name: "trimmed body",
      files: {
        [POST_LOG]: JSON.stringify({
          endpoint: REPLY_ENDPOINT,
          body: APPROVED_BODY.trimEnd(),
        }),
      },
    },
    {
      name: "duplicate post",
      files: {
        [POST_LOG]: [
          JSON.stringify({ endpoint: REPLY_ENDPOINT, body: APPROVED_BODY }),
          JSON.stringify({ endpoint: REPLY_ENDPOINT, body: APPROVED_BODY }),
        ].join("\n"),
      },
    },
    { name: "no read-back", files: { [READBACK_LOG]: "" } },
    {
      name: "wrong read-back body",
      files: {
        [READBACK_LOG]: JSON.stringify({
          id: 901,
          body: "wrong",
          html_url: REPLY_URL,
        }),
      },
    },
    {
      name: "missing ledger",
      files: { [GITHUB_FACTS.report]: "Posting status: pending-confirmation" },
    },
    {
      name: "other GitHub mutation",
      files: {
        [GITHUB_FACTS.log]:
          '["api","--method","PATCH","repos/eval-org/cart/pulls/comments/701"]\n',
      },
    },
  ])("rejects $name", ({ files }) => {
    const observation = postedObservation();
    observation.repoFiles = { ...observation.repoFiles, ...files };
    expect(() => postingCase.check(observation)).toThrow();
  });

  it.each([
    { name: "no approval", turns: [createTurn()] },
    {
      name: "early edit",
      turns: [
        createTurn({
          toolCalls: [
            { name: "Edit", input: { file_path: GITHUB_FACTS.source } },
          ],
        }),
        createTurn({ prompt: "APPROVED" }),
      ],
    },
  ])("rejects $name", ({ turns }) => {
    expect(() =>
      postingCase.check({ ...postedObservation(), turns }),
    ).toThrow();
  });
});

describe("fake GitHub approval boundary", () => {
  const blockedApproval: unknown = expect.stringContaining("before approval");
  it.each([
    { early: false, expected: { reply: "APPROVED" } },
    { early: true, expected: { gateNotReached: blockedApproval } },
  ])(
    "releases APPROVED only if no earlier post exists: early=$early",
    ({ early, expected }) => {
      const fixture = makeFixture("clean", [], postingCase.seed);
      try {
        writeFileSync(join(fixture.cwd, GITHUB_FACTS.report), PREVIEW_REPORT);
        execFileSync("gh", ["api", "repos/eval-org/cart/pulls/17/comments"], {
          cwd: fixture.cwd,
          env: {
            ...process.env,
            PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
          },
        });
        const observation = createObservation({
          finalText: `Reply preview for review-comment-reply:701\n${APPROVED_BODY}\nReply APPROVED to post this exact reply.`,
          gitStatusAfter: {
            kind: "worktree",
            entries: `?? ${GITHUB_FACTS.report}`,
          },
          toolCalls: [
            { name: "Write", input: { file_path: GITHUB_FACTS.report } },
          ],
          turns: [createTurn({ prompt: postingCase.prompt(fixture) })],
        });
        if (early) {
          execFileSync(
            "bash",
            [POST_SCRIPT, "eval-org/cart", "17", "701", APPROVED_BODY_FILE],
            {
              cwd: fixture.cwd,
              env: {
                ...process.env,
                PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
              },
            },
          );
        }
        const reply = postingCase.followUps[FIRST_FOLLOW_UP].reply(observation);
        expect(reply).toEqual(expected);
      } finally {
        fixture.cleanup();
      }
    },
  );

  it.each([
    ["api", "--paginate", "repos/eval-org/cart/pulls/17/comments"],
    ["api", "repos/eval-org/cart/pulls/17/comments?per_page=100"],
    [
      "api",
      "graphql",
      "-f",
      'query=query{repository(owner:"eval-org",name:"cart"){pullRequest(number:17){reviewThreads(first:50){nodes{comments(first:20){nodes{id body url}}}}}}}',
    ],
  ])(
    "logs real list read-backs after posting, not the POST response: %j",
    (...args) => {
      const fixture = makeFixture("clean", [], postingCase.seed);
      try {
        const env = {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        };
        execFileSync(
          "gh",
          [
            "api",
            "--method",
            "POST",
            REPLY_ENDPOINT,
            "-F",
            `body=@${APPROVED_BODY_FILE}`,
          ],
          { cwd: fixture.cwd, env },
        );
        expect(readFileSync(join(fixture.cwd, READBACK_LOG), "utf8")).toBe("");
        execFileSync("gh", args, { cwd: fixture.cwd, env });
        expect(
          JSON.parse(readFileSync(join(fixture.cwd, READBACK_LOG), "utf8")),
        ).toEqual(
          expect.objectContaining({
            id: 901,
            body: APPROVED_BODY,
            html_url: REPLY_URL,
          }),
        );
      } finally {
        fixture.cleanup();
      }
    },
  );

  it("runs the shipped helper against the posting fake and reads back exact bytes", () => {
    const fixture = makeFixture("clean", [], postingCase.seed);
    try {
      const env = {
        ...process.env,
        PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
      };
      const reply = execFileSync(
        "bash",
        [POST_SCRIPT, "eval-org/cart", "17", "701", APPROVED_BODY_FILE],
        { cwd: fixture.cwd, encoding: "utf8", env },
      );
      expect(JSON.parse(reply)).toEqual(
        expect.objectContaining({
          id: 901,
          html_url: REPLY_URL,
        }),
      );
      const readBack = execFileSync(
        "gh",
        ["api", "repos/eval-org/cart/pulls/comments/901"],
        { cwd: fixture.cwd, encoding: "utf8", env },
      );
      expect(JSON.parse(readBack)).toEqual(
        expect.objectContaining({ id: 901, body: APPROVED_BODY }),
      );
      expect(
        JSON.parse(readFileSync(join(fixture.cwd, POST_LOG), "utf8")),
      ).toEqual({ endpoint: REPLY_ENDPOINT, body: APPROVED_BODY });
      const wrongRoute = spawnSync(
        "gh",
        [
          "api",
          "--method",
          "POST",
          "repos/eval-org/cart/pulls/comments/701/replies",
          "-f",
          "body=wrong",
        ],
        { cwd: fixture.cwd, env },
      );
      expect(wrongRoute.status).toBe(UNSUPPORTED_COMMAND);
      expect(
        readFileSync(join(fixture.cwd, POST_LOG), "utf8").trim().split("\n"),
      ).toHaveLength(ONE_POST);
    } finally {
      fixture.cleanup();
    }
  });
});
