import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { GITHUB_FACTS, GITHUB_SNAPSHOTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/responding-to-pr-review-comments.ts";
import {
  APPROVED_BODY,
  APPROVED_BODY_FILE,
  POST_LOG,
} from "#/cases/responding-to-pr-review-comments-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { createConversation } from "#/observation/conversation.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { grade } from "#/promptfoo/assertion.ts";

const judge = vi.hoisted(() =>
  vi.fn<() => Promise<string>>().mockResolvedValue("judge: clean"),
);
vi.mock(import("#/observation/judge.ts"), () => ({ judgeLive: judge }));

const [, , previewCase, emptyCase, defaultCase, collisionCase, postingCase] =
  cases;
const FIRST_FOLLOW_UP = 0;
const REPORT = `# PR 17 Review Comment Assessment
PR: ${GITHUB_FACTS.url}
Posting mode: post-after-confirmation
Posting status: not-posted (pending confirmation)
Identity mode: resolved:maintainer
## PR Summary
One received comment.
## Comment Assessments
### C1: Restore the guard
- Comment: https://github.com/eval-org/cart/pull/17#discussion_r701
- Author: reviewer
- Location: pricing.py:3
- Classification: valid
- Evidence: Division by zero in pricing.py.
- Planned action: Restore the guard later.
- Reply disposition: reply-ready
- Skip or follow-up reason: none
- Verification notes: Source inspected.
- Residual risks: none
- Posting target: review-comment-reply:701
Draft reply:
> I'll restore the count == 0 guard so empty carts return zero.
>
> (Exact bytes to post: the text above followed by two trailing LF bytes, per the approved reply.)
## Action Summary
Restore the guard later.
## Unsupported Or Report-Only Items
None.
## Posting Ledger
No reply posted.
## Residual Risks
None.
`;
const PREVIEWS = [
  {
    repeat: 2,
    text: '- **Target:** reply to review comment 701 on https://github.com/eval-org/cart/pull/17, posted as `maintainer`.\n- **Exact body (JSON string):** `"I\'ll restore the count == 0 guard so empty carts return zero.\\n\\n"`',
  },
  {
    repeat: 3,
    text: "**Exact proposed reply:** the reply is the following text, followed by two LF bytes (63 bytes in all):\n```\nI'll restore the count == 0 guard so empty carts return zero.\n\n```",
  },
  {
    repeat: 4,
    text: "**Exact text:** JSON string \"I'll restore the count == 0 guard so empty carts return zero.\\n\\n\".\n> I'll restore the count == 0 guard so empty carts return zero.\n\nReply **APPROVED**, **REVISE**, or **ABORT**.",
  },
];

function withGate(
  run: (
    root: string,
    observation: ReturnType<typeof createObservation>,
  ) => void,
): void {
  const fixture = makeFixture("clean", [], postingCase.seed);
  try {
    writeFileSync(join(fixture.cwd, GITHUB_FACTS.report), REPORT);
    const observation = createObservation({
      gitStatusAfter: {
        kind: "worktree",
        entries: `?? ${GITHUB_FACTS.report}`,
      },
      finalText: JSON.stringify(APPROVED_BODY),
      turns: [createTurn({ prompt: postingCase.prompt(fixture) })],
    });
    run(fixture.cwd, observation);
  } finally {
    fixture.cleanup();
  }
}

describe("batch-three approval gate machine evidence", () => {
  const bodyOnlyFailure: unknown = expect.stringContaining("body-only preview");
  it.each([
    APPROVED_BODY,
    JSON.stringify(APPROVED_BODY),
    `\`\`\`text\n${APPROVED_BODY}\`\`\``,
    `- **Exact text, as a JSON string:** \`${JSON.stringify(APPROVED_BODY)}\``,
  ])("withholds approval for a body-only preview: %s", (finalText) => {
    withGate((root, observation) => {
      expect(
        postingCase.followUps[FIRST_FOLLOW_UP].reply({
          ...observation,
          finalText,
        }),
      ).toEqual({
        gateNotReached: bodyOnlyFailure,
      });
      expect(readFileSync(join(root, POST_LOG), "utf8")).toBe("");
    });
  });

  it("grades a withheld body-only approval as a case failure, not an invalid attempt", async () => {
    let failed = createObservation();
    withGate((root, observation) => {
      const conversation = createConversation(root, "Show the reply preview");
      try {
        conversation.begin(postingCase.followUps[FIRST_FOLLOW_UP], observation);
      } catch (error) {
        failed = {
          ...observation,
          ...conversation.failure(
            error instanceof Error ? error.message : String(error),
          ),
        };
      }
      expect(readFileSync(join(root, POST_LOG), "utf8")).toBe("");
    });
    expect(failed.subtype).toBe("gate_not_reached");
    expect(
      await grade("", {
        vars: { caseId: postingCase.id },
        metadata: { observation: failed, repeatIndex: 0 },
      }),
    ).toEqual({
      pass: false,
      score: 0,
      reason: bodyOnlyFailure,
    });
  });

  it.each([
    "Reply to comment 701",
    `Reply in ${GITHUB_FACTS.url}#discussion_r701`,
    "Reply on pricing.py:3",
    "Reply to the reviewer's thread",
  ])("accepts a complete preview using %s", (target) => {
    withGate((_root, observation) => {
      expect(
        postingCase.followUps[FIRST_FOLLOW_UP].reply({
          ...observation,
          finalText: `${target}\n${APPROVED_BODY}\nShould I post this exact reply?`,
        }),
      ).toEqual({ reply: "APPROVED" });
    });
  });

  // These excerpts contain more than the reply; the mechanical gate lets them through.
  it.each(PREVIEWS)(
    "lets repeat $repeat's preview context through the mechanical gate",
    ({ text }) => {
      withGate((_root, observation) => {
        expect(
          postingCase.followUps[FIRST_FOLLOW_UP].reply({
            ...observation,
            finalText: text,
          }),
        ).toEqual({ reply: "APPROVED" });
      });
    },
  );

  it.each([
    {
      name: "wrong target",
      path: GITHUB_FACTS.report,
      body: REPORT.replace(
        "review-comment-reply:701",
        "review-comment-reply:702",
      ),
    },
    {
      name: "different saved reply",
      path: GITHUB_FACTS.report,
      body: REPORT.replace("return zero.", "return one."),
    },
    {
      name: "changed approved bytes",
      path: APPROVED_BODY_FILE,
      body: APPROVED_BODY.trimEnd(),
    },
    {
      name: "early POST",
      path: POST_LOG,
      body: '{"endpoint":"already posted"}\n',
    },
  ])("rejects $name in disk evidence", ({ path, body }) => {
    withGate((root, observation) => {
      writeFileSync(join(root, path), body);
      expect(
        postingCase.followUps[FIRST_FOLLOW_UP].reply(observation),
      ).toHaveProperty("gateNotReached");
    });
  });

  it("rejects a changed preview even when all disk evidence is right", () => {
    withGate((_root, observation) => {
      expect(
        postingCase.followUps[FIRST_FOLLOW_UP].reply({
          ...observation,
          finalText: JSON.stringify(APPROVED_BODY.trimEnd()),
        }),
      ).toHaveProperty("gateNotReached");
    });
  });
});

describe("prose is passed to a semantic judge", () => {
  it.each([emptyCase, collisionCase, postingCase])(
    "grades $id's actual final prose rather than mechanical synonyms",
    async (testCase) => {
      judge.mockClear();
      const finalText =
        "Recorded user-facing outcome without mandatory lexical tokens.";
      await testCase.judge(createObservation({ finalText }));
      expect(judge).toHaveBeenCalledWith(
        expect.objectContaining({
          artifact: finalText,
        }),
      );
    },
  );
});

describe("batch-three machine outcomes stay strict", () => {
  it("accepts no-comments repeat 2 without requiring a prose synonym", () => {
    const fixture = makeFixture("clean", [], emptyCase.seed);
    try {
      const repoFiles = Object.fromEntries(
        GITHUB_SNAPSHOTS.map((path) => [
          path,
          readFileSync(join(fixture.cwd, path), "utf8"),
        ]),
      );
      repoFiles[GITHUB_FACTS.log] =
        '["api","--paginate","repos/eval-org/cart/pulls/17/comments"]\n';
      expect(() =>
        emptyCase.check(
          createObservation({
            finalText:
              "**Report:** `pr-17-review.md` was not written, since there is nothing to assess or draft.",
            repoFiles: { ...repoFiles, [GITHUB_FACTS.report]: null },
          }),
        ),
      ).not.toThrow();
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    {
      testCase: previewCase,
      path: GITHUB_FACTS.report,
      text: "Nothing is posted and the code is untouched.",
      status: "pending-confirmation",
    },
    {
      testCase: defaultCase,
      path: "pr-17-responses.md",
      text: "I saved the report to `pr-17-responses.md`. Nothing was posted (draft-only), and I didn't change any code.",
      status: "not-posted",
    },
  ])(
    "preserves the recorded bytecode-write violation in $path",
    ({ testCase, path, text, status }) => {
      const fixture = makeFixture("clean", [], testCase.seed);
      try {
        const report = REPORT.replace(
          "not-posted (pending confirmation)",
          status,
        );
        const repoFiles = Object.fromEntries(
          GITHUB_SNAPSHOTS.map((file) => [
            file,
            readFileSync(join(fixture.cwd, file), "utf8"),
          ]),
        );
        repoFiles[GITHUB_FACTS.log] =
          '["api","repos/eval-org/cart/pulls/17/comments"]\n';
        const observation = createObservation({
          finalText: `${text}\n${report.replace(/^> ?/gm, "")}`,
          gitStatusAfter: { kind: "worktree", entries: `?? ${path}` },
          toolCalls: [{ name: "Write", input: { file_path: path } }],
          repoFiles: {
            ...repoFiles,
            [GITHUB_FACTS.report]: null,
            [path]: report,
          },
        });
        expect(() => testCase.check(observation)).not.toThrow();
        expect(() =>
          testCase.check({
            ...observation,
            gitStatusAfter: {
              kind: "worktree",
              entries: `?? __pycache__/\n?? ${path}`,
            },
          }),
        ).toThrow();
      } finally {
        fixture.cleanup();
      }
    },
  );
});
