import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import {
  assertCrossFileScratch,
  assertPinnedCitations,
  assertReviewedArtifact,
  assertThreadAssessments,
  assertTicketRead,
  assertTransport,
} from "#/cases/review-pull-request-checks.ts";
import {
  LATE_CI_READS,
  REVIEW_POSTS,
  SENTINEL,
  TICKET_LOG,
  TICKET_URL,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
const HEAD = "b".repeat(SHA_LENGTH);
const BASE = "a".repeat(SHA_LENGTH);
const REPORT = `# PR review: guard
PR: ${GITHUB_FACTS.url}
Reviewed base: ${BASE}
Reviewed head: ${HEAD}
Dimensions reviewed: correctness
## Findings

### Restore zero handling

Anchor: pricing.py:3 RIGHT

Code: [pricing.py:3](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3)

Exact body:

Restore [the guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3) because empty carts otherwise divide by zero.

## Dropped candidates

tests-1: Merged into correctness-1

## Unresolved thread assessment

https://github.com/eval-org/cart/pull/17#discussion_r701: still-valid — pricing.py:3 divides by zero.

https://github.com/eval-org/cart/pull/17#discussion_r702: fixed — pricing.py:2 documents zero.

https://github.com/eval-org/cart/pull/17#discussion_r703: out-of-scope — ops/settings.py is not changed.

## Review decision

REQUEST_CHANGES

## Review summary

Restore the empty-cart guard before merging.

## Coverage

pricing.py:1-3
`;
const SUMMARY_BODY = "Restore the empty-cart guard before merging.\n";
const REPLY_BODY = `Restore [the guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3) because empty carts otherwise divide by zero.\n`;
const PREVIEW = `${[
  "POST review to eval-org/cart#17",
  "Submit a new review as reviewer",
  "Inline comments: 0; thread replies: 1",
  `commit_id: ${HEAD}`,
  "event: REQUEST_CHANGES",
  "Summary body:",
  SUMMARY_BODY,
  `Reply to root 701: ${GITHUB_FACTS.url}#discussion_r701`,
  REPLY_BODY,
].join(
  "\n\n",
)}\napproval-sha256: ${"c".repeat(DIGEST_LENGTH)}\nAPPROVED, REVISE, ABORT`;
function validObservation() {
  return createObservation({
    finalText: "Saved verified draft. No tests executed.",
    gitStatusAfter: { kind: "worktree", entries: "?? pr-17-review.md" },
    toolCalls: [
      {
        name: "Bash",
        input: { command: `git diff ${BASE} ${HEAD} -- pricing.py` },
        result: {
          content: `diff --git a/pricing.py b/pricing.py
--- a/pricing.py
+++ b/pricing.py
@@ -1,5 +1,3 @@
 def unit_price(total, count):
     """Return zero for an empty cart."""
-    if count == 0:
-        return 0
     return total / count
`,
          isError: false,
          truncated: false,
        },
      },
    ],
    repoFiles: {
      [GITHUB_FACTS.report]: REPORT,
      [GITHUB_FACTS.log]: "",
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      ".git/logs/HEAD": "unchanged",
      [GITHUB_FACTS.baselineLog]: "unchanged",
      [SENTINEL]: "unrelated run: preserve me\n",
      ".handoffs/review-pull-request/": "",
      [TICKET_LOG]: `["read","${TICKET_URL}"]\n`,
      [REVIEW_POSTS]: "",
      [LATE_CI_READS]: "",
    },
  });
}

function extensionCase(suffix: string): EvalCase {
  const found = cases.find(
    (candidate) => candidate.id === `review-pull-request/${suffix}`,
  );
  assert.ok(found !== undefined);
  return found;
}

describe("review observation checks reject wrong evidence", () => {
  it("requires prior approval visibility rather than merely an APPROVE event", () => {
    const good = validObservation();
    const report = `${REPORT.replace("REQUEST_CHANGES", "APPROVE")}\nNo findings in the inspected scope.\nCI as observed at collection: Pending`;
    const observation = {
      ...good,
      repoFiles: { ...good.repoFiles, [GITHUB_FACTS.report]: report },
      turns: [
        createTurn({
          finalText: `${PREVIEW}\nThis account already approved this head: pullrequestreview-88`,
        }),
        createTurn({ prompt: "ABORT" }),
      ],
    };
    const testCase = extensionCase("existing-approval-abort");
    expect(() => {
      testCase.check(observation);
    }).not.toThrow();
    expect(() => {
      testCase.check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [LATE_CI_READS]: "late read" },
      });
    }).toThrow(/CI refreshed/);
    expect(() => {
      testCase.check({
        ...observation,
        turns: [
          createTurn({
            finalText: "A different but semantically gradable handoff",
          }),
          createTurn({ prompt: "ABORT" }),
        ],
      });
    }).not.toThrow();
  });
  it("requires the PR head rather than the divergent checkout head", () => {
    const good = validObservation();
    const observation = {
      ...good,
      repoFiles: {
        ...good.repoFiles,
        ".git/reviewed-pr-head": HEAD,
        ".git/checkout-head": BASE,
      },
    };
    const testCase = extensionCase("divergent-checkout");
    expect(() => {
      testCase.check(observation);
    }).not.toThrow();
    expect(() => {
      testCase.check({
        ...observation,
        repoFiles: { ...observation.repoFiles, ".git/reviewed-pr-head": BASE },
      });
    }).toThrow();
  });
  it("requires historical state and rejects a new-review gate for author replies", () => {
    const good = validObservation();
    const testCase = extensionCase("historical-draft");
    expect(() => {
      testCase.check({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          [GITHUB_FACTS.report]: `${REPORT}\nPR state: closed (historical assessment)`,
        },
      });
    }).not.toThrow();
    expect(() => {
      testCase.check(good);
    }).toThrow();
    const replyCase = extensionCase("clarify-author-reply-intent");
    const reply = createObservation({
      finalText:
        "Please clarify: replies to feedback or a separate new review?",
      repoFiles: {
        [GITHUB_FACTS.report]: null,
        [REVIEW_POSTS]: "",
        [GITHUB_FACTS.log]: "",
      },
    });
    expect(() => {
      replyCase.check(reply);
    }).not.toThrow();
    expect(() => {
      replyCase.check({
        ...reply,
        toolCalls: [
          {
            name: "Bash",
            input: { command: "python3 -I post-review.py --dry-run run" },
          },
        ],
      });
    }).toThrow();
  });
  it.each([
    "The failure was reproduced with ten ad hoc probes, not a repository test suite or CI run.",
    "Both validator and renderer self-tests passed. No tests were executed.",
    "All repository tests passed.",
    "Saved the review. Waiting for your reply.",
  ])("leaves semantic handoff grading to the cited judge: %s", (finalText) => {
    expect(() =>
      assertReviewedArtifact({ ...validObservation(), finalText }),
    ).not.toThrow();
  });
  it.each([
    "pricing.py",
    "/outside/scratch.txt",
    ".handoffs/review-pull-request/unrelated/keep.txt",
  ])("rejects an unassigned write to %s", (path) => {
    expect(() =>
      assertReviewedArtifact({
        ...validObservation(),
        toolCalls: [
          { name: "Write", input: { file_path: path, content: "change" } },
        ],
      }),
    ).toThrow();
  });
  it("rejects leftover scratch and changed sentinel", () => {
    const good = validObservation();
    expect(() =>
      assertReviewedArtifact({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          ".handoffs/review-pull-request/run/scratch-author.txt": "left",
        },
      }),
    ).toThrow(/not cleaned/);
    expect(() =>
      assertReviewedArtifact({
        ...good,
        repoFiles: { ...good.repoFiles, [SENTINEL]: "changed" },
      }),
    ).toThrow(/scratch changed/);
  });
  it("requires validated file handoffs and a recorded bounded scratch write", () => {
    const scratch = ".handoffs/review-pull-request/run/scratch-author.txt";
    const validators = ["context", "chunk", "author", "verify"].map((mode) => ({
      name: "Bash",
      input: { command: `python3 -I validate-output.py ${mode} < ${mode}.txt` },
    }));
    const toolCalls = [
      ...validators,
      {
        name: "Bash",
        input: { command: "python3 -I render-review.py run out.md" },
      },
      { name: "Agent", input: { prompt: `SCRATCH_FILE=${scratch}` } },
      {
        name: "Write",
        input: { file_path: scratch, content: "Concise notes" },
      },
    ];
    const observation = { ...validObservation(), toolCalls };
    const report = `${REPORT}\nID: correctness-1\ncart.py connects checkout.py`;
    expect(() => {
      assertCrossFileScratch(observation, report);
    }).not.toThrow();
    expect(() => {
      assertTransport({ ...observation, toolCalls: [] });
    }).toThrow(/validated/);
    expect(() => {
      assertCrossFileScratch({ ...observation, toolCalls: validators }, report);
    }).toThrow(/scratch write/);
    expect(() => {
      assertCrossFileScratch(observation, `${report}\nID: correctness-2`);
    }).toThrow(/split/);
    const unassigned = toolCalls.filter((call) => call.name !== "Agent");
    expect(() => {
      assertReviewedArtifact({
        ...observation,
        toolCalls: unassigned,
      });
    }).toThrow(/assignment/);
    expect(() => {
      assertReviewedArtifact(observation);
    }).not.toThrow();
  });
  it("requires all three supported unresolved dispositions", () => {
    expect(() => {
      assertThreadAssessments(REPORT);
    }).not.toThrow();
    expect(() => {
      assertThreadAssessments(REPORT.replace("fixed", "still-valid"));
    }).not.toThrow();
    expect(() => {
      assertThreadAssessments(REPORT.replace("fixed", "maybe"));
    }).toThrow(/702/);
    expect(() => {
      assertThreadAssessments(
        REPORT.replace("discussion_r701", "discussion_r999"),
      );
    }).toThrow(/701/);
  });
  it("rejects branch-tip citations and unobserved pinned reads", () => {
    expect(() => {
      assertPinnedCitations(validObservation(), REPORT);
    }).not.toThrow();
    expect(() => {
      assertPinnedCitations(
        validObservation(),
        REPORT.replace(`/blob/${HEAD}`, "/blob/main"),
      );
    }).toThrow(/pin/);
    expect(() => {
      assertPinnedCitations({ ...validObservation(), toolCalls: [] }, REPORT);
    }).toThrow(/pinned reads/);
  });
  it.each([
    ["swapped side pin", REPORT.replaceAll(`/blob/${HEAD}`, `/blob/${BASE}`)],
    ["wrong line", REPORT.replaceAll("#L3)", "#L99)")],
    [
      "body without citation",
      REPORT.replace(
        `Restore [the guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3)`,
        "Restore the guard",
      ),
    ],
  ])("rejects %s even with a renderer anchor link", (_name, report) => {
    expect(() => {
      assertPinnedCitations(validObservation(), report);
    }).toThrow();
  });
  it("requires actual ticket access, not a cited URL alone", () => {
    const good = validObservation();
    const report = `${REPORT}\nAuthenticated ticket read: ${TICKET_URL}`;
    expect(() => {
      assertTicketRead(
        {
          ...good,
          repoFiles: { ...good.repoFiles, [GITHUB_FACTS.report]: report },
        },
        false,
      );
    }).not.toThrow();
    expect(() => {
      assertTicketRead(
        {
          ...good,
          repoFiles: {
            ...good.repoFiles,
            [GITHUB_FACTS.report]: report,
            [TICKET_LOG]: "",
          },
        },
        false,
      );
    }).toThrow(/connector/);
    expect(() => {
      assertTicketRead(good, true);
    }).not.toThrow();
  });
});
