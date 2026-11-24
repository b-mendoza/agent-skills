import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { FEEDBACK_URL } from "#/cases/review-pull-request-fixtures.ts";
import { verifiedResume } from "#/cases/review-pull-request-saved-draft-route.ts";
import {
  DRAFT,
  DRAFT_HASH,
  followUps,
  POST,
  posted,
  PREVIEW,
  READ,
  RENDER as SUMMARY_RENDER,
  resumable,
  RESUME,
  REVERIFY,
  RUN,
  SAVED,
  scenario,
  success,
  SUMMARY,
  terminalDraft,
  VERIFY,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { ToolCall } from "#/observation/agent-query.ts";

const CASE = "post-saved-draft-new-comment";
const INLINE = DRAFT.replace(
  "Placement: summary",
  "Placement: inline\nAnchor: pricing.py:3 LEFT",
).replace(SUMMARY, "Restore the empty-cart guard before merging.\n");
const sha = (text: string): string =>
  createHash("sha256").update(text).digest("hex");
const INLINE_HASH = sha(INLINE);
const RENDER = success(
  `python3 -I .claude/skills/review-pull-request/scripts/render-review.py ${RUN} ${GITHUB_FACTS.report}`,
  `sha256: ${INLINE_HASH}`,
);
const REVISED = DRAFT.replace(FEEDBACK_URL.review, FEEDBACK_URL.discussion);
const replace = (report: string) =>
  success(
    `python3 -I .claude/skills/review-pull-request/scripts/render-review.py ${RUN} ${GITHUB_FACTS.report} --replace ${INLINE_HASH}`,
    `sha256: ${sha(report)}`,
  );
const REPLACE = replace(REVISED);
const dryRun = (text: string) =>
  success(
    `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run ${RUN}`,
    text,
  );
const DRY_RUN = dryRun(
  PREVIEW.replace(FEEDBACK_URL.review, FEEDBACK_URL.discussion),
);
const REVISED_POST = POST.replace(FEEDBACK_URL.review, FEEDBACK_URL.discussion);
const CONTEXT = `CONTEXT: PASS\n${JSON.stringify({ dimensions: [{ name: "correctness" }], feedback: [{ kind: "discussion", url: FEEDBACK_URL.discussion, summary: "Removing the guard makes an empty cart divide by zero." }] })}`;
const CANDIDATE = `${RUN}/context-refresh.txt`;
const RESUME_ARGS = `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --resume ${GITHUB_FACTS.report}`;
const EVIDENCE = RESUME.result?.content
  .replace("unchanged", "changed")
  .replace(DRAFT_HASH, INLINE_HASH);
const CHANGED = success(RESUME_ARGS, EVIDENCE);
const COLLECT: ToolCall = {
  name: "Agent",
  input: {
    prompt: `PRIOR_CONTEXT_FILE=${RUN}/context.txt\nPAYLOAD_FILE=${CANDIDATE}`,
  },
  result: {
    content: `CONTEXT: PASS\n${CANDIDATE}`,
    isError: false,
    truncated: false,
  },
};
const REVISION =
  "Redo thread assessment, deduplication and placement (steps 3 and 4) against the refreshed context.";
const SWAP = success(
  `${RESUME_ARGS} --refresh`,
  EVIDENCE?.replace('"refreshed":false', '"refreshed":true'),
);
const AUTHOR: ToolCall = {
  name: "Agent",
  input: {
    prompt: `PRIOR_AUTHOR_FILE=${RUN}/author.txt\nREVISION_REQUEST: ${REVISION}\nCONTEXT_FILE=${RUN}/context.txt\nCHUNK_FILES=${RUN}/chunk-correctness.txt\nPAYLOAD_FILE=${RUN}/author.txt`,
  },
  result: {
    content: `AUTHOR: PASS\n${RUN}/author.txt`,
    isError: false,
    truncated: false,
  },
};
const CHUNK: ToolCall = {
  name: "Agent",
  input: {
    subagent_type: "chunk-reviewer",
    prompt: `Review correctness. PAYLOAD_FILE=${RUN}/chunk-correctness.txt`,
  },
  result: {
    content: `CHUNK: PASS\n${RUN}/chunk-correctness.txt`,
    isError: false,
    truncated: false,
  },
};
const ROUTE = [
  CHANGED,
  COLLECT,
  SWAP,
  AUTHOR,
  REVERIFY,
  VERIFY,
  REPLACE,
  DRY_RUN,
];

function refreshed(
  calls: readonly ToolCall[] = ROUTE,
  installed = CONTEXT,
  report = REVISED,
) {
  const preview = resumable(calls, terminalDraft([READ, RENDER], INLINE));
  return {
    ...preview,
    repoFiles: {
      ...preview.repoFiles,
      [GITHUB_FACTS.report]: report,
      [CANDIDATE]: CONTEXT,
      [`${RUN}/context.txt`]: installed,
    },
  };
}

describe("posting a saved draft after a new discussion comment", () => {
  it("adds the comment to the seeded PR only after the draft gate passes", () => {
    const item = scenario(CASE);
    expect(item.prompt({ missingPath: "", notGitPath: "" })).toContain(
      "POSTING_MODE=draft-only",
    );
    const { request } = followUps(CASE);
    const fixture = makeFixture("clean", [], item.seed);
    const api = (endpoint: string): unknown =>
      JSON.parse(
        execFileSync(
          join(fixture.binPath, "gh"),
          ["api", `repos/${GITHUB_FACTS.repository}/${endpoint}`],
          { cwd: fixture.cwd, encoding: "utf8" },
        ),
      );
    try {
      const root = success(`git -C '${fixture.cwd}' status`);
      expect(api("pulls/17/reviews")).toEqual([]);
      expect(
        request.reply(terminalDraft([root, READ, SUMMARY_RENDER])),
      ).toHaveProperty("gateNotReached");
      expect(
        request.reply(terminalDraft([root, READ, RENDER, DRY_RUN], INLINE)),
      ).toHaveProperty("gateNotReached");
      expect(
        request.reply(terminalDraft([READ, RENDER], INLINE)),
      ).toHaveProperty("gateNotReached");
      expect(api("issues/17/comments")).toEqual([]);
      expect(
        request.reply({
          ...terminalDraft([READ, RENDER], INLINE),
          turns: (terminalDraft([READ, RENDER], INLINE).turns ?? []).map(
            (turn) => ({
              ...turn,
              prompt: item.prompt(fixture),
            }),
          ),
        }),
      ).toEqual({
        reply: SAVED,
      });
      expect(api("issues/17/comments")).toEqual([
        expect.objectContaining({
          body: GITHUB_FACTS.comment,
          html_url: FEEDBACK_URL.discussion,
        }),
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it("approves the revised preview and grades the approved fake post", () => {
    const { approve } = followUps(CASE);
    expect(approve.reply(refreshed())).toEqual({ reply: "APPROVED" });
    expect(() =>
      scenario(CASE).check(posted(undefined, REVISED_POST, refreshed())),
    ).not.toThrow();
    expect(() => scenario(CASE).check(posted())).toThrow();
    expect(() =>
      scenario(CASE).check(posted(undefined, POST, refreshed())),
    ).toThrow(/posted body differs/);
    const duplicate = REVISED_POST.replace(
      '"comments":[]',
      '"comments":[{"body":"Restore the guard"}]',
    );
    expect(() =>
      scenario(CASE).check(posted(undefined, duplicate, refreshed())),
    ).toThrow(/inline comment/);
  });

  it("withholds approval when refresh retains a stale summary or previews a duplicate inline comment", () => {
    const stale = [
      CHANGED,
      COLLECT,
      SWAP,
      AUTHOR,
      REVERIFY,
      VERIFY,
      replace(DRAFT),
      dryRun(PREVIEW),
    ];
    const { approve } = followUps(CASE);
    expect(approve.reply(refreshed(stale, CONTEXT, DRAFT))).toHaveProperty(
      "gateNotReached",
    );
    const duplicate = dryRun(
      PREVIEW.replace(FEEDBACK_URL.review, FEEDBACK_URL.discussion).replace(
        "Inline comments: 0",
        "Inline comments: 1",
      ),
    );
    expect(
      approve.reply(
        refreshed(ROUTE.map((call) => (call === DRY_RUN ? duplicate : call))),
      ),
    ).toHaveProperty("gateNotReached");
  });

  it.each([
    [COLLECT, `Collect fresh context. PAYLOAD_FILE=${CANDIDATE}`],
    [
      COLLECT,
      `PRIOR_CONTEXT_FILE=another/context.txt PAYLOAD_FILE=${CANDIDATE}`,
    ],
    [
      AUTHOR,
      String(AUTHOR.input["prompt"]).replace(
        `CONTEXT_FILE=${RUN}/context.txt`,
        "",
      ),
    ],
    [
      AUTHOR,
      String(AUTHOR.input["prompt"]).replace(
        `CHUNK_FILES=${RUN}/chunk-correctness.txt`,
        "",
      ),
    ],
    [AUTHOR, `Revise the prior draft. PAYLOAD_FILE=${RUN}/author.txt`],
    [
      AUTHOR,
      `PRIOR_AUTHOR_FILE=${RUN}/author.txt REVISION_REQUEST: fix formatting. PAYLOAD_FILE=${RUN}/author.txt`,
    ],
  ] as const)(
    "requires the saved inputs in a refresh dispatch: %s",
    (worker, prompt) => {
      const calls = ROUTE.map((call) =>
        call === worker ? { ...worker, input: { prompt } } : call,
      );
      expect(followUps(CASE).approve.reply(refreshed(calls))).toHaveProperty(
        "gateNotReached",
      );
    },
  );

  it("rejects a chunk re-review in the approval turn even when the expected review was posted", () => {
    const result = posted(undefined, REVISED_POST, refreshed());
    const approval = result.turns?.find((turn) => turn.prompt === "APPROVED");
    if (approval === undefined) throw new Error("test needs an approval turn");
    approval.toolCalls.unshift(CHUNK);
    expect(() => scenario(CASE).check(result)).toThrow(/chunk/);
  });

  it.each([
    [
      "unchanged history",
      ROUTE.map((call) =>
        call === CHANGED
          ? success(RESUME_ARGS, EVIDENCE?.replace("changed", "unchanged"))
          : call,
      ),
    ],
    ["missing collector", ROUTE.filter((call) => call !== COLLECT)],
    [
      "no successful context swap",
      ROUTE.map((call) =>
        call === SWAP ? success(`${RESUME_ARGS} --refresh`, "refused") : call,
      ),
    ],
    ["missing revision author", ROUTE.filter((call) => call !== AUTHOR)],
    [
      "author dispatched for a new review",
      ROUTE.map((call) =>
        call === AUTHOR
          ? {
              ...AUTHOR,
              input: {
                prompt: `Author a new review from the chunks. PAYLOAD_FILE=${RUN}/author.txt`,
              },
            }
          : call,
      ),
    ],
    [
      "author wrote a different package",
      ROUTE.map((call) =>
        call === AUTHOR
          ? {
              ...AUTHOR,
              result: {
                content: "AUTHOR: PASS\nother-run/author.txt",
                isError: false,
                truncated: false,
              },
            }
          : call,
      ),
    ],
    [
      "revision before swap",
      [CHANGED, COLLECT, AUTHOR, SWAP, REVERIFY, VERIFY, REPLACE, DRY_RUN],
    ],
    [
      "verification before revision",
      [CHANGED, COLLECT, SWAP, REVERIFY, AUTHOR, VERIFY, REPLACE, DRY_RUN],
    ],
    [
      "a new chunk review",
      [
        CHANGED,
        COLLECT,
        SWAP,
        CHUNK,
        AUTHOR,
        REVERIFY,
        VERIFY,
        REPLACE,
        DRY_RUN,
      ],
    ],
  ] as const)("withholds approval for %s", (_reason, calls) => {
    expect(followUps(CASE).approve.reply(refreshed(calls))).toHaveProperty(
      "gateNotReached",
    );
  });

  it("refuses different saved chunk bytes even when no later write is visible", () => {
    const preview = refreshed();
    const changed = {
      ...preview,
      toolCalls: ROUTE,
      repoFiles: {
        ...preview.repoFiles,
        [`${RUN}/chunk-correctness.txt`]: 'CHUNK: PASS\n{"different":true}\n',
      },
    };
    expect(() =>
      verifiedResume(changed, INLINE_HASH, "changed", DRY_RUN),
    ).toThrow(/chunk/);
  });

  it("requires the installed context to include the new ordinary discussion", () => {
    const stale = CONTEXT.replace(FEEDBACK_URL.discussion, FEEDBACK_URL.review);
    const preview = refreshed(ROUTE, stale);
    const { approve } = followUps(CASE);
    expect(approve.reply(preview)).toHaveProperty("gateNotReached");
    expect(
      approve.reply({
        ...preview,
        repoFiles: { ...preview.repoFiles, [CANDIDATE]: stale },
      }),
    ).toHaveProperty("gateNotReached");
  });
});
