import { writeFileSync } from "node:fs";
import { join } from "node:path";

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

const [, , previewCase, emptyCase, defaultCase, collisionCase, postingCase] =
  cases;
const FIRST_FOLLOW_UP = 0;
const INVENTORY_READ = '["api","repos/eval-org/cart/pulls/17/comments"]';
const REPORT = `# PR 17 Review Comment Assessment
PR: ${GITHUB_FACTS.url}
Posting mode: post-after-confirmation
Posting status: pending-confirmation
Identity mode: resolved:maintainer
## PR Summary
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
> ${APPROVED_BODY.trimEnd()}
## Action Summary
## Unsupported Or Report-Only Items
## Posting Ledger
## Residual Risks
`;
const PREVIEW = `Reply preview for review-comment-reply:701\n${APPROVED_BODY}\nReply APPROVED to post this exact reply.`;
const POST_RECORD = JSON.stringify({
  endpoint: REPLY_ENDPOINT,
  body: APPROVED_BODY,
});
const BASE_FILES = {
  [GITHUB_FACTS.log]: `${INVENTORY_READ}\n`,
  [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
  [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
  [GITHUB_FACTS.baselineLog]: "same HEAD\n",
  ".git/logs/HEAD": "same HEAD\n",
  [GITHUB_FACTS.report]: null,
  [RESPONSE_REPORT]: null,
};

interface FileRow {
  name: string;
  files: Record<string, string | null>;
  message: string;
}

const PREVIEW_RUN = createObservation({
  finalText: PREVIEW,
  gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
  toolCalls: [{ name: "Write", input: { file_path: GITHUB_FACTS.report } }],
  repoFiles: { ...BASE_FILES, [GITHUB_FACTS.report]: REPORT },
});

const EMPTY_RUN = createObservation({ repoFiles: BASE_FILES });

function withLog(args: string[]): Observation {
  return {
    ...EMPTY_RUN,
    repoFiles: {
      ...BASE_FILES,
      [GITHUB_FACTS.log]: `${JSON.stringify(args)}\n`,
    },
  };
}

const DEFAULT_RUN = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${RESPONSE_REPORT}` },
  toolCalls: [{ name: "Write", input: { file_path: RESPONSE_REPORT } }],
  repoFiles: {
    ...BASE_FILES,
    [RESPONSE_REPORT]: REPORT.replace("pending-confirmation", "not-posted"),
  },
});

const POSTED_RUN = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
  turns: [
    createTurn({ finalText: PREVIEW }),
    createTurn({ name: "approve exact reply", prompt: "APPROVED" }),
  ],
  repoFiles: {
    ...BASE_FILES,
    [GITHUB_FACTS.report]: `Posting status: posted\n${REPLY_URL}`,
    [POST_LOG]: `${POST_RECORD}\n`,
    [READBACK_LOG]: `${JSON.stringify({ id: 901, body: APPROVED_BODY, html_url: REPLY_URL })}\n`,
  },
});

describe("reply preview before approval", () => {
  it("accepts one grounded assessment with posting held for approval", () => {
    expect(() => previewCase.check(PREVIEW_RUN)).not.toThrow();
  });

  it.each([
    {
      name: "a missing section",
      from: "## Posting Ledger",
      to: "## Ledger",
      message: "missing report section Posting Ledger",
    },
    {
      name: "a missing assessment field",
      from: "- Posting target:",
      to: "- Target:",
      message: "missing assessment field Posting target",
    },
    {
      name: "a posted status",
      from: "Posting status: pending-confirmation",
      to: "Posting status: posted",
      message: "Posting status: pending-confirmation",
    },
    {
      name: "the wrong posting target",
      from: "review-comment-reply:701",
      to: "review-comment-reply:702",
      message: "Posting target: review-comment-reply:701",
    },
    {
      name: "an invented second assessment",
      from: "## Action Summary",
      to: "### C2: Invented comment\n## Action Summary",
      message: "expected exactly one comment assessment",
    },
  ])("rejects a report with $name", ({ from, to, message }) => {
    const report = REPORT.replace(from, to);
    expect(() =>
      previewCase.check({
        ...PREVIEW_RUN,
        repoFiles: { ...PREVIEW_RUN.repoFiles, [GITHUB_FACTS.report]: report },
      }),
    ).toThrow(message);
  });

  it("rejects a preview that differs from the saved reply", () => {
    const finalText = PREVIEW.replace(
      APPROVED_BODY.trimEnd(),
      "I will do something else.",
    );
    expect(() => previewCase.check({ ...PREVIEW_RUN, finalText })).toThrow(
      "approval preview differs from the report reply",
    );
  });

  it.each<{ name: string; change: Partial<Observation>; message: string }>([
    {
      name: "a GitHub reply POST",
      change: {
        repoFiles: {
          ...PREVIEW_RUN.repoFiles,
          [GITHUB_FACTS.log]: `${JSON.stringify(["api", "--method", "POST", REPLY_ENDPOINT])}\n`,
        },
      },
      message: "GitHub API write attempted without approval",
    },
    {
      name: "a code edit",
      change: {
        toolCalls: [{ name: "Edit", input: { file_path: "pricing.py" } }],
      },
      message: "unexpected file mutation: pricing.py",
    },
    {
      name: "an extra untracked file",
      change: {
        gitStatusAfter: {
          kind: "worktree",
          entries: "?? extra.md\n?? pr-17-review.md",
        },
      },
      message: "unexpected workspace change or missing report",
    },
  ])("rejects $name before approval", ({ change, message }) => {
    expect(() => previewCase.check({ ...PREVIEW_RUN, ...change })).toThrow(
      message,
    );
  });
});

describe("empty pull request", () => {
  it("accepts an inventory read without creating a report", () => {
    expect(() => emptyCase.check(EMPTY_RUN)).not.toThrow();
  });

  it.each([
    ["api", "--paginate", "repos/eval-org/cart/pulls/17/comments?per_page=100"],
    [
      "api",
      "graphql",
      "-f",
      'query={ repository(owner: "eval-org", name: "cart") { pullRequest(number: 17) { comments(first: 100) { nodes { body } } reviews(first: 100) { nodes { body } } reviewThreads(first: 100) { nodes { id } } } } }',
    ],
    ["pr", "view", "17", "--repo", GITHUB_FACTS.repository, "--json=reviews"],
  ])("accepts the fixture PR's comment inventory read %j", (...args) => {
    expect(() => emptyCase.check(withLog(args))).not.toThrow();
  });

  it.each([
    ["api", "repos/eval-org/cart/pulls/17"],
    ["api", "repos/eval-org/cart/pulls/18/comments"],
    ["api", "repos/other/cart/pulls/17/comments"],
    [
      "api",
      "graphql",
      "-f",
      'query={ repository(owner: "eval-org", name: "cart") { pullRequest(number: 17) { title body } } }',
    ],
    [
      "api",
      "graphql",
      "-f",
      'query={ repository(owner: "eval-org", name: "cart") { pullRequest(number: 18) { comments(first: 100) { nodes { body } } } } }',
    ],
    [
      "api",
      "graphql",
      "-f",
      'query={ repository(owner: "other", name: "cart") { pullRequest(number: 17) { comments(first: 100) { nodes { body } } } } }',
    ],
    ["pr", "view", GITHUB_FACTS.url, "--json", "title,body"],
    ["pr", "view", "18", "--json", "comments,reviews"],
    ["pr", "view", "17", "--repo", "other/cart", "--json", "comments"],
  ])(
    "rejects a read that is not this PR's comment inventory: %j",
    (...args) => {
      expect(() => emptyCase.check(withLog(args))).toThrow(
        "no PR comment inventory collection observed",
      );
    },
  );

  it.each<FileRow>([
    {
      name: "an invented report",
      files: { [GITHUB_FACTS.report]: REPORT },
      message: "file exists: pr-17-review.md",
    },
    {
      name: "no gh call at all",
      files: { [GITHUB_FACTS.log]: "" },
      message: "no PR comment inventory collection observed",
    },
    {
      name: "a pr comment attempt",
      files: {
        [GITHUB_FACTS.log]: `${INVENTORY_READ}\n["pr","comment","17","--body","hi"]\n`,
      },
      message: "GitHub write attempted without approval",
    },
  ])("rejects $name on an empty pull request", ({ files, message }) => {
    expect(() =>
      emptyCase.check({ ...EMPTY_RUN, repoFiles: { ...BASE_FILES, ...files } }),
    ).toThrow(message);
  });
});

describe("output filename", () => {
  it("accepts the response-specific default report", () => {
    expect(() => defaultCase.check(DEFAULT_RUN)).not.toThrow();
  });

  it.each<FileRow>([
    {
      name: "a missing response-specific default",
      files: { [RESPONSE_REPORT]: null },
      message: "file is absent: pr-17-responses.md",
    },
    {
      name: "the review skill's default report",
      files: { [GITHUB_FACTS.report]: REPORT },
      message: "file exists: pr-17-review.md",
    },
    {
      name: "a GitHub write",
      files: {
        [GITHUB_FACTS.log]: `${JSON.stringify(["api", "--method", "POST", REPLY_ENDPOINT])}\n`,
      },
      message: "GitHub API write attempted without approval",
    },
  ])("rejects $name in the default-filename run", ({ files, message }) => {
    expect(() =>
      defaultCase.check({
        ...DEFAULT_RUN,
        repoFiles: { ...DEFAULT_RUN.repoFiles, ...files },
      }),
    ).toThrow(message);
  });

  it("keeps an explicit existing output file byte-for-byte", () => {
    const kept = createObservation({
      repoFiles: {
        ...BASE_FILES,
        "chosen-responses.md": GITHUB_FACTS.existingReport,
      },
    });
    const overwritten = {
      ...kept,
      repoFiles: { ...kept.repoFiles, "chosen-responses.md": "overwritten" },
    };
    expect(() => collisionCase.check(kept)).not.toThrow();
    expect(() => collisionCase.check(overwritten)).toThrow();
  });
});

describe("approved posting", () => {
  it("accepts one exact post with a separate read-back and a synced ledger", () => {
    expect(() => postingCase.check(POSTED_RUN)).not.toThrow();
  });

  it.each<FileRow>([
    {
      name: "a trimmed body",
      files: {
        [POST_LOG]: JSON.stringify({
          endpoint: REPLY_ENDPOINT,
          body: APPROVED_BODY.trimEnd(),
        }),
      },
      message: "strictly deep-equal",
    },
    {
      name: "a duplicate post",
      files: { [POST_LOG]: `${POST_RECORD}\n${POST_RECORD}` },
      message: "expected exactly one approved reply POST",
    },
    {
      name: "a wrong read-back body",
      files: {
        [READBACK_LOG]: JSON.stringify({
          id: 901,
          body: "wrong",
          html_url: REPLY_URL,
        }),
      },
      message: "missing exact reply read-back",
    },
    {
      name: "a status that is not posted",
      files: {
        [GITHUB_FACTS.report]: `Posting status: pending-confirmation\n${REPLY_URL}`,
      },
      message: "Posting status: posted",
    },
    {
      name: "a ledger without the reply URL",
      files: { [GITHUB_FACTS.report]: "Posting status: posted" },
      message: "posting ledger lacks returned reply URL",
    },
    {
      name: "another GitHub write",
      files: {
        [GITHUB_FACTS.log]: `${JSON.stringify(["api", "--method", "PATCH", "repos/eval-org/cart/pulls/comments/701"])}\n`,
      },
      message: "GitHub API write attempted without approval",
    },
  ])("rejects $name after approval", ({ files, message }) => {
    expect(() =>
      postingCase.check({
        ...POSTED_RUN,
        repoFiles: { ...POSTED_RUN.repoFiles, ...files },
      }),
    ).toThrow(message);
  });

  it.each([
    {
      name: "a body-only preview",
      turns: [
        createTurn({ finalText: JSON.stringify(APPROVED_BODY) }),
        createTurn({ prompt: "APPROVED" }),
      ],
      message: "body-only preview",
    },
    {
      name: "no approval turn",
      turns: [createTurn({ finalText: PREVIEW })],
      message: "approval reply not found in recorded turns",
    },
    {
      name: "a code edit during the run",
      turns: [
        createTurn({
          finalText: PREVIEW,
          toolCalls: [
            { name: "Edit", input: { file_path: GITHUB_FACTS.source } },
          ],
        }),
        createTurn({ prompt: "APPROVED" }),
      ],
      message: "read-only contract violated",
    },
  ])("rejects $name in the recorded turns", ({ turns, message }) => {
    expect(() => postingCase.check({ ...POSTED_RUN, turns })).toThrow(message);
  });
});

describe("approval gate", () => {
  it.each([
    {
      name: "a reply was posted early",
      path: POST_LOG,
      body: `${POST_RECORD}\n`,
      message: "reply posted before approval",
    },
    {
      name: "the report targets another thread",
      path: GITHUB_FACTS.report,
      body: REPORT.replace(
        "review-comment-reply:701",
        "review-comment-reply:702",
      ),
      message: "Posting target: review-comment-reply:701",
    },
    {
      name: "the saved reply differs",
      path: GITHUB_FACTS.report,
      body: REPORT.replace("return zero.", "return one."),
      message: "saved reply differs from approved body",
    },
    {
      name: "the approved bytes changed",
      path: APPROVED_BODY_FILE,
      body: APPROVED_BODY.trimEnd(),
      message: "approved body file changed",
    },
  ])("withholds APPROVED when $name", ({ path, body, message }) => {
    const fixture = makeFixture("clean", [], postingCase.seed);
    try {
      writeFileSync(join(fixture.cwd, GITHUB_FACTS.report), REPORT);
      writeFileSync(join(fixture.cwd, path), body);
      const observation = createObservation({
        finalText: PREVIEW,
        gitStatusAfter: {
          kind: "worktree",
          entries: `?? ${GITHUB_FACTS.report}`,
        },
        turns: [createTurn({ prompt: postingCase.prompt(fixture) })],
      });
      const expected: unknown = expect.stringContaining(message);
      expect(postingCase.followUps[FIRST_FOLLOW_UP].reply(observation)).toEqual(
        { gateNotReached: expected },
      );
    } finally {
      fixture.cleanup();
    }
  });
});
