import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/responding-to-pr-review-comments.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const [positiveRouting, negativeRouting, previewCase, guardCase] = cases;

const REPORT = `# PR 17 Review Comment Assessment
PR: ${GITHUB_FACTS.url} Posting mode: post-after-confirmation Posting status: pending-confirmation Identity mode: resolved:maintainer Final envelope intent: pending Working inventory file: none
## PR Summary
One actionable review comment.
## Comment Assessments
### C1: Restore the zero-count guard
- Comment: ${GITHUB_FACTS.url}#discussion_r701
- Author: reviewer
- Location: pricing.py:3
- Classification: valid
- Evidence: pricing.py:3 divides by count; zero now raises ZeroDivisionError.
- Planned action: Restore the zero-count guard.
- Reply disposition: reply-ready
- Posting target: review-comment-reply:701
- Skip or follow-up reason: none
- Verification notes: Current code supports the comment.
- Residual risks: none
Draft reply:
> I'll restore the count == 0 branch so empty carts return zero.
## Action Summary
- Implement: C1
- Clarify: none
- Push back: none
- Ask user: none
## Unsupported Or Report-Only Items
None.
## Posting Ledger
| Comment | Target | Outcome | Reply ID | Reply URL | Reason |
| C1 | review-comment-reply:701 | not-posted | none | none | Awaiting approval |
## Residual Risks
None.
`;
const FINAL = `Reply preview for review-comment-reply:701
I'll restore the count == 0 branch so empty carts return zero.
Do you approve posting this exact reply?
Report: pr-17-review.md
Posting: not-posted
`;

function observation(report = REPORT): Observation {
  return createObservation({
    finalText: FINAL,
    gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
    toolCalls: [{ name: "Write", input: { file_path: GITHUB_FACTS.report } }],
    repoFiles: {
      [GITHUB_FACTS.report]: report,
      [GITHUB_FACTS.log]: '["api","repos/eval-org/cart/pulls/17/comments"]\n',
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: "same HEAD\n",
      ".git/logs/HEAD": "same HEAD\n",
    },
  });
}

const skillCall = {
  name: "Skill",
  input: { skill: "responding-to-pr-review-comments" },
};

describe("response routing", () => {
  it("distinguishes replies from a new code review", () => {
    expect(() =>
      positiveRouting.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => positiveRouting.check(createObservation())).toThrow();
    expect(() => negativeRouting.check(createObservation())).not.toThrow();
    expect(() =>
      negativeRouting.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });

  it.each([positiveRouting, negativeRouting])(
    "rejects runs that did not happen: $id",
    (testCase) => {
      expect(() =>
        testCase.check(createObservation({ timedOut: true })),
      ).toThrow();
      expect(() =>
        testCase.check(createObservation({ subtype: "query_error" })),
      ).toThrow();
    },
  );
});

describe("response preview and local report", () => {
  it("accepts one grounded assessment with posting held for approval", () => {
    expect(() => previewCase.check(observation())).not.toThrow();
  });

  it.each([
    "PR Summary",
    "Comment Assessments",
    "Action Summary",
    "Unsupported Or Report-Only Items",
    "Posting Ledger",
    "Residual Risks",
  ])("rejects missing section %s", (heading) => {
    expect(() =>
      previewCase.check(
        observation(REPORT.replace(`## ${heading}`, `## Missing ${heading}`)),
      ),
    ).toThrow();
  });

  it.each([
    "Comment",
    "Author",
    "Location",
    "Classification",
    "Evidence",
    "Planned action",
    "Reply disposition",
    "Posting target",
    "Skip or follow-up reason",
    "Verification notes",
    "Residual risks",
  ])("rejects missing assessment field %s", (field) => {
    expect(() =>
      previewCase.check(
        observation(REPORT.replace(`- ${field}:`, "- Missing:")),
      ),
    ).toThrow();
  });

  it.each([
    ["title", "# PR 17 Review Comment Assessment", "# Other"],
    ["URL", GITHUB_FACTS.url, "https://github.com/other/repo/pull/99"],
    [
      "posting mode",
      "Posting mode: post-after-confirmation",
      "Posting mode: draft-only",
    ],
    [
      "status",
      "Posting status: pending-confirmation",
      "Posting status: posted",
    ],
    [
      "identity",
      "Identity mode: resolved:maintainer",
      "Identity mode: degraded-unknown",
    ],
    [
      "classification",
      "- Classification: valid",
      "- Classification: questionable",
    ],
    [
      "disposition",
      "- Reply disposition: reply-ready",
      "- Reply disposition: skipped-resolved",
    ],
    [
      "target",
      "- Posting target: review-comment-reply:701",
      "- Posting target: review-comment-reply:702",
    ],
    ["blockquote", "> I'll restore", "I'll restore"],
  ])("rejects wrong %s", (_name, from, to) => {
    expect(() =>
      previewCase.check(observation(REPORT.replace(from, to))),
    ).toThrow();
  });

  it("rejects a missing or duplicate assessment", () => {
    expect(() =>
      previewCase.check(observation(REPORT.replace("### C1:", "C1:"))),
    ).toThrow();
    expect(() =>
      previewCase.check(observation(`${REPORT}\n### C2: Invented comment`)),
    ).toThrow();
  });

  it.each([
    FINAL.replace("Do you approve posting this exact reply?", "Ready to post."),
    FINAL.replace("review-comment-reply:701", "review-comment-reply:702"),
    FINAL.replace(
      "I'll restore the count == 0 branch so empty carts return zero.",
      "I will do something else.",
    ),
    `${FINAL}\nPosting: posted`,
  ])("rejects missing approval or false posting status", (finalText) => {
    expect(() => previewCase.check({ ...observation(), finalText })).toThrow();
  });

  it("rejects unapproved replies and other report writes", () => {
    const correct = observation();
    expect(() =>
      previewCase.check({
        ...correct,
        repoFiles: {
          ...correct.repoFiles,
          [GITHUB_FACTS.log]:
            '["api","--method","POST","repos/eval-org/cart/pulls/comments/701/replies"]\n',
        },
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        toolCalls: [{ name: "Edit", input: { file_path: "pricing.py" } }],
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        toolCalls: [
          {
            name: "Write",
            input: {
              file_path: ".handoffs/review-pull-request/run/context.txt",
            },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        gitStatusAfter: {
          kind: "worktree",
          entries: "?? extra.md\n?? pr-17-review.md",
        },
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: null },
      }),
    ).toThrow();
  });
});

describe("no-comments terminal", () => {
  function noComments(): Observation {
    const correct = observation();
    return {
      ...correct,
      toolCalls: [],
      gitStatusAfter: { kind: "worktree", entries: "" },
      finalText:
        "PR_COMMENT_RESPONSE: NO_COMMENTS\nReport: none\nPosting: not-posted\nReason: No review or discussion comments found.\nNext step: Wait for review feedback.\n",
      repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: null },
    };
  }

  it("accepts an empty inventory without creating an empty report", () => {
    expect(() => guardCase.check(noComments())).not.toThrow();
  });

  it.each([
    "PR_COMMENT_RESPONSE: NO_COMMENTS",
    "Posting: not-posted",
    "Reason:",
    "Next step:",
  ])("rejects missing terminal field %s", (fragment) => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        finalText: correct.finalText.replace(fragment, "missing"),
      }),
    ).toThrow();
  });

  it("rejects an invented report, no collection evidence, or attempted posting", () => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: REPORT },
      }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.log]: "" },
      }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: {
          ...correct.repoFiles,
          [GITHUB_FACTS.log]: '["pr","comment","17","--body","hi"]\n',
        },
      }),
    ).toThrow();
  });
});

describe("review-comment collection fixture", () => {
  it.each([previewCase, guardCase])(
    "serves the shipped collector for $id",
    (testCase) => {
      const fixture = makeFixture("clean", [], testCase.seed);
      try {
        const script = fileURLToPath(
          new URL(
            "../../../skills/responding-to-pr-review-comments/scripts/collect-review-threads.sh",
            import.meta.url,
          ),
        );
        const output = execFileSync("bash", [script, GITHUB_FACTS.url], {
          cwd: fixture.cwd,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
          },
        });
        const hasComments =
          testCase.id ===
          "responding-to-pr-review-comments/reply-preview-no-approval";
        expect(output.includes(GITHUB_FACTS.comment)).toBe(hasComments);
        expect(output.includes('"id": 701')).toBe(hasComments);
        expect(output.trim() === "[]").toBe(!hasComments);
        expect(
          readFileSync(join(fixture.cwd, GITHUB_FACTS.log), "utf8"),
        ).toContain("--paginate");
      } finally {
        fixture.cleanup();
      }
    },
  );
});
