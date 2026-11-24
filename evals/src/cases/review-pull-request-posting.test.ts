import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertPosting } from "#/cases/review-pull-request-checks.ts";
import { REVIEW_POSTS } from "#/cases/review-pull-request-fixtures.ts";
import {
  RETAINED_PAYLOADS,
  REVIEW_RUN,
} from "#/cases/review-pull-request-retention-test-support.ts";
import { assertVisibleReview } from "#/cases/review-pull-request-visible-preview.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
const HEAD = "b".repeat(SHA_LENGTH);
const EMPTY_CART_URL = `${GITHUB_FACTS.url}#discussion_r701`;
const ROUNDING_URL = `${GITHUB_FACTS.url}#discussion_r704`;
const REPORT_LINK = `[reported](${EMPTY_CART_URL})`;
const ROUNDING_LINK = `[rounding issue](${ROUNDING_URL})`;
const SUMMARY_BODY = `Restore the [empty-cart guard](${EMPTY_CART_URL}) and preserve [fractional dollars](${ROUNDING_URL}).\n`;
const REPLY_BODY = `As ${REPORT_LINK}, restore [the guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3) because empty carts otherwise divide by zero.\n`;
const SECOND_BODY = `The ${ROUNDING_LINK} still returns one dollar for 199 cents.\n\nPreserve the fractional dollars.  \n`;
const PREVIEW = `${[
  "POST review to eval-org/cart#17",
  "Submit a new review as reviewer",
  "Inline comments: 0; thread replies: 2",
  `merge-base: ${"a".repeat(SHA_LENGTH)}`,
  `commit_id: ${HEAD}`,
  "event: REQUEST_CHANGES",
  "Summary body:",
  SUMMARY_BODY,
  `Reply to root 701: ${GITHUB_FACTS.url}#discussion_r701`,
  REPLY_BODY,
  `Reply to root 704: ${GITHUB_FACTS.url}#discussion_r704`,
  SECOND_BODY,
].join(
  "\n\n",
)}\napproval-sha256: ${"c".repeat(DIGEST_LENGTH)}\nAPPROVED, REVISE, ABORT`;
const APPROVED = {
  result: { content: "posted", isError: false, truncated: false },
  name: "Bash",
  input: {
    command: `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${"c".repeat(DIGEST_LENGTH)} ${REVIEW_RUN}`,
  },
};
const PREFIX = "repos/eval-org/cart/pulls/17";
const POSTS = [
  {
    endpoint: `${PREFIX}/reviews`,
    payload: {
      body: SUMMARY_BODY,
      comments: [],
      commit_id: HEAD,
      event: "REQUEST_CHANGES",
    },
  },
  { endpoint: `${PREFIX}/comments/701/replies`, payload: { body: REPLY_BODY } },
  {
    endpoint: `${PREFIX}/comments/704/replies`,
    payload: { body: SECOND_BODY },
  },
]
  .map((post) => JSON.stringify(post))
  .join("\n");
function posting(
  posts: string,
  preview = PREVIEW,
  before: Observation["toolCalls"] = [],
  after: Observation["toolCalls"] = [APPROVED],
): Observation {
  const dry = {
    name: "Bash",
    input: {
      command:
        "python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run .handoffs/review-pull-request/run",
    },
    result: { content: preview, isError: false, truncated: false },
  };
  return createObservation({
    repoFiles: { ...RETAINED_PAYLOADS, [REVIEW_POSTS]: posts },
    turns: [
      createTurn({ toolCalls: [dry, ...before] }),
      createTurn({ prompt: "APPROVED", toolCalls: after }),
    ],
  });
}

describe("approved posting grade", () => {
  it("accepts the exact approved bodies", () => {
    expect(() => {
      assertPosting(posting(POSTS), false);
    }).not.toThrow();
  });
  it("requires drift refusal and no writes", () => {
    const refusal = {
      ...APPROVED,
      result: {
        content: "live account/history changed; approval invalid",
        isError: true,
        truncated: false,
      },
    };
    expect(() => {
      assertPosting(posting("", PREVIEW, [], [refusal]), true);
    }).not.toThrow();
    expect(() => {
      assertPosting(
        posting(
          "",
          PREVIEW.replace(ROUNDING_LINK, "fractional dollars"),
          [],
          [refusal],
        ),
        true,
      );
    }).toThrow(/discussion/);
    expect(() => {
      assertPosting(posting(POSTS), true);
    }).toThrow(/stale/);
  });
  it.each([
    ["wrong summary bytes", POSTS.replace('\\n"', '"'), /differs/],
    ["wrong reply bytes", POSTS.replace("divide by zero", "fail"), /differs/],
    ["wrong target", POSTS.replace("701/replies", "999/replies"), /target/],
    [
      "duplicate reply root",
      POSTS.replace("704/replies", "701/replies"),
      /target/,
    ],
    ["missing second reply", POSTS.replace(/\n[^\n]*$/, ""), /one reply per/],
    [
      "lost trailing spaces",
      POSTS.replace("dollars.  ", "dollars."),
      /differs/,
    ],
    [
      "duplicate inline",
      POSTS.replace('"comments":[]', '"comments":[{}]'),
      /duplicate/,
    ],
  ] as const)("rejects %s", (_reason, posts, error) => {
    expect(() => {
      assertPosting(posting(posts), false);
    }).toThrow(error);
  });
  it("refuses mutations outside one approved poster call", () => {
    expect(() => {
      assertPosting(posting(POSTS, PREVIEW, [APPROVED]), false);
    }).toThrow(/before reply/);
    expect(() => {
      assertPosting(posting(POSTS, PREVIEW, [], [APPROVED, APPROVED]), false);
    }).toThrow(/exactly once/);
  });
  it.each([
    [
      "summary missing a planned root",
      `[fractional dollars](${ROUNDING_URL})`,
      "fractional dollars",
    ],
    ["HTML comment only", REPORT_LINK, `<!-- ${EMPTY_CART_URL} -->`],
    ["inline code only", REPORT_LINK, `\`${EMPTY_CART_URL}\``],
    ["misleading label", REPORT_LINK, `[${EMPTY_CART_URL}](${ROUNDING_URL})`],
    ["target header only", REPORT_LINK, "reported"],
    ["wrong root", ROUNDING_LINK, `[other](${EMPTY_CART_URL})`],
    ["partial root ID", REPORT_LINK, `[reported](${EMPTY_CART_URL}0)`],
  ])("rejects identical preview and post with %s", (_reason, from, to) => {
    expect(() => {
      assertPosting(
        posting(POSTS.replace(from, to), PREVIEW.replace(from, to)),
        false,
      );
    }).toThrow(/discussion/);
  });
});

it("does not approve two visible reply bodies swapped between roots", () => {
  expect(() => {
    assertVisibleReview(PREVIEW, PREVIEW);
  }).not.toThrow();
  const swapped = PREVIEW.replace(REPLY_BODY, "PLACEHOLDER")
    .replace(SECOND_BODY, REPLY_BODY)
    .replace("PLACEHOLDER", SECOND_BODY);
  expect(() => {
    assertVisibleReview(PREVIEW, swapped);
  }).toThrow();
});
it("does not credit a printed approved command even with the expected remote log", () => {
  const fake = {
    ...APPROVED,
    input: { command: `printf '%s' '${APPROVED.input.command}'` },
  };
  expect(() => {
    assertPosting(posting(POSTS, PREVIEW, [], [fake]), false);
  }).toThrow();
});

it("counts an executed poster once, not a separate literal quotation of it", () => {
  const quote = {
    name: "Bash",
    input: { command: `printf '%s' '${APPROVED.input.command}'` },
  };
  expect(() => {
    assertPosting(posting(POSTS, PREVIEW, [], [quote, APPROVED]), false);
  }).not.toThrow();
});

it("accepts equivalent inline location labels but not a different side", () => {
  const header =
    'Inline: {"line":3,"path":"pricing.py","side":"RIGHT","start_line":2,"start_side":"RIGHT"}';
  const [before] = PREVIEW.split("\n\nReply to root");
  const preview =
    `${before}\n\n${header}\n\nRestore the guard.\napproval-sha256: ${"c".repeat(DIGEST_LENGTH)}`.replace(
      "0; thread replies: 2",
      "1; thread replies: 0",
    );
  expect(() => {
    assertVisibleReview(
      preview,
      preview.replace(header, "Inline at pricing.py:2-3 RIGHT"),
    );
  }).not.toThrow();
  expect(() => {
    assertVisibleReview(
      preview,
      preview.replace(header, "Inline at pricing.py:2-3 LEFT"),
    );
  }).toThrow();
});
