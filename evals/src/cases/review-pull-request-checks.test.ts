import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import {
  assertPinnedCitations,
  assertReviewedArtifact,
  assertThreadAssessments,
  assertTicketRead,
} from "#/cases/review-pull-request-checks.ts";
import {
  FEEDBACK_URL,
  LATE_CI_READS,
  REVIEW_POSTS,
  SENTINEL,
  TICKET_LOG,
  TICKET_URL,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  approvalCheckpoint,
  RETAINED_PAYLOADS,
  REVIEW_RUN,
} from "#/cases/review-pull-request-retention-test-support.ts";
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

https://github.com/eval-org/cart/pull/17#discussion_r704: still-valid — cents_to_dollars drops fractional dollars.

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
  `${SUMMARY_BODY}See ${GITHUB_FACTS.url}#discussion_r701`,
  `Reply to root 701: ${GITHUB_FACTS.url}#discussion_r701`,
  `${REPLY_BODY}See ${GITHUB_FACTS.url}#discussion_r701`,
].join(
  "\n\n",
)}\napproval-sha256: ${"c".repeat(DIGEST_LENGTH)}\nAPPROVED, REVISE, ABORT`;
function validObservation() {
  return createObservation({
    finalText: `Saved verified draft. Run: ${REVIEW_RUN}. No tests executed.`,
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
      ...RETAINED_PAYLOADS,
      ...approvalCheckpoint(RETAINED_PAYLOADS),
      [TICKET_LOG]: `["read","${TICKET_URL}"]\n`,
      [REVIEW_POSTS]: "",
      [LATE_CI_READS]: "",
    },
  });
}

function duplicateReport(channel: keyof typeof FEEDBACK_URL): string {
  return REPORT.replace(
    /Anchor: pricing\.py[\s\S]+?(?=## Dropped candidates)/,
    `ID: correctness-1\nConfidence: high\nPlacement: summary\n\nEvidence: https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3\n\n`,
  ).replace(
    SUMMARY_BODY,
    `${SUMMARY_BODY.trimEnd()} See ${FEEDBACK_URL[channel]}.\n`,
  );
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
    const author = `${REVIEW_RUN}/author.txt`;
    expect(() =>
      testCase.check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [author]: null },
      }),
    ).toThrow(author);
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
  it.each(["thread", "head"] as const)(
    "retains declared chunks after %s drift without requiring posting receipts",
    (drift) => {
      const good = validObservation();
      const dry = {
        name: "Bash",
        input: {
          command: `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run ${REVIEW_RUN}`,
        },
        result: { content: PREVIEW, isError: false, truncated: false },
      };
      const refusal = {
        name: "Bash",
        input: {
          command: `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${"c".repeat(DIGEST_LENGTH)} ${REVIEW_RUN}`,
        },
        result: {
          content:
            drift === "head"
              ? "live PR state/head/base changed; approval invalid"
              : "live account/history changed; approval invalid",
          isError: true,
          truncated: false,
        },
      };
      const observation = {
        ...good,
        toolCalls: [...good.toolCalls, dry, refusal],
        turns: [
          createTurn({ toolCalls: [...good.toolCalls, dry] }),
          createTurn({ prompt: "APPROVED", toolCalls: [refusal] }),
        ],
      };
      const testCase = extensionCase(`approved-${drift}`);
      expect(() => testCase.check(observation)).not.toThrow();
      const chunk = `${REVIEW_RUN}/chunk-tests.txt`;
      expect(() =>
        testCase.check({
          ...observation,
          repoFiles: { ...good.repoFiles, [chunk]: null },
        }),
      ).toThrow(chunk);
    },
  );
  it("requires the PR head rather than the divergent checkout head", () => {
    const good = validObservation();
    const observation = {
      ...good,
      repoFiles: {
        ...good.repoFiles,
        [GITHUB_FACTS.report]: duplicateReport("review"),
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
  it.each([
    ["divergent-checkout", "review"],
    ["historical-draft", "discussion"],
  ] as const)(
    "rejects missing or misrouted duplicate feedback in %s",
    (suffix, channel) => {
      const good = validObservation();
      const checkReport = (report: string) =>
        extensionCase(suffix).check({
          ...good,
          repoFiles: {
            ...good.repoFiles,
            [GITHUB_FACTS.report]: report,
            ".git/reviewed-pr-head": HEAD,
            ".git/checkout-head": BASE,
          },
        });
      const report = `${duplicateReport(channel)}\nPR state: closed (historical assessment)`;
      for (const placement of ["inline", "reply", "unknown"]) {
        expect(() =>
          checkReport(
            report.replace("Placement: summary", `Placement: ${placement}`),
          ),
        ).toThrow(/summary finding/);
      }
      expect(() =>
        checkReport(
          report.replace(FEEDBACK_URL[channel], `${FEEDBACK_URL[channel]}0`),
        ),
      ).toThrow(/feedback link/);
      expect(() =>
        checkReport(
          report.replace(
            "Placement: summary",
            "Placement: summary\n\nID: another\nPlacement: inline",
          ),
        ),
      ).toThrow(/summary finding/);
    },
  );
  it("requires historical state and rejects a new-review gate for author replies", () => {
    const good = validObservation();
    const testCase = extensionCase("historical-draft");
    const historical = {
      ...good,
      repoFiles: {
        ...good.repoFiles,
        [GITHUB_FACTS.report]: `${duplicateReport("discussion")}\nPR state: closed (historical assessment)`,
      },
    };
    for (const finalText of [
      "Draft saved.",
      `Run: ${REVIEW_RUN}-other.`,
      `Payload: ${REVIEW_RUN}/verify.txt`,
      `Run: /some-other-repo/${REVIEW_RUN}`,
    ]) {
      expect(() => testCase.check({ ...historical, finalText })).toThrow(
        /run directory/,
      );
    }
    expect(() => testCase.check(historical)).not.toThrow();
    expect(() => {
      testCase.check(good);
    }).toThrow();
    const replyCase = extensionCase("clarify-author-reply-intent");
    const reply = createObservation({
      finalText:
        "No run files were created. Please clarify: replies to feedback or a separate new review?",
      repoFiles: {
        ".handoffs/review-pull-request/": "",
        [SENTINEL]: "unrelated run: preserve me\n",
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
            input: {
              command:
                "python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run run",
            },
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
    ".handoffs/review-pull-request/unrelated/author.txt",
    ".handoffs/review-pull-request/other-run/chunk-tests.txt",
    `${REVIEW_RUN}/receipts.json`,
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
  it("rejects a changed unrelated-run sentinel", () => {
    const good = validObservation();
    expect(() =>
      assertReviewedArtifact({
        ...good,
        repoFiles: { ...good.repoFiles, [SENTINEL]: "changed" },
      }),
    ).toThrow(/scratch changed/);
  });
  it("requires a structured disposition for every unresolved root", () => {
    expect(() => {
      assertThreadAssessments(
        REPORT.replace("discussion_r704", "discussion_r705"),
        true,
      );
    }).toThrow(/704/);
    expect(() => {
      assertThreadAssessments(REPORT, true);
    }).not.toThrow();
    expect(() => {
      assertThreadAssessments(REPORT.replace("fixed", "still-valid"), true);
    }).not.toThrow();
    expect(() => {
      assertThreadAssessments(REPORT.replace("fixed", "maybe"), true);
    }).toThrow(/702/);
    expect(() => {
      assertThreadAssessments(
        REPORT.replace("discussion_r701", "discussion_r999"),
        true,
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
