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

const [, , previewCase, guardCase] = cases;

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
Saved the report to pr-17-review.md. Nothing was posted.
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

describe("response preview and local report", () => {
  it("accepts one grounded assessment with posting held for approval", () => {
    expect(() => previewCase.check(observation())).not.toThrow();
  });

  it("accepts an imperative approval request without question punctuation", () => {
    expect(() =>
      previewCase.check({
        ...observation(),
        finalText: FINAL.replace(
          "Do you approve posting this exact reply?",
          "Reply approve to post this exact reply.",
        ),
      }),
    ).not.toThrow();
  });

  it("rejects a public status line even with a valid preview", () => {
    expect(() =>
      previewCase.check({
        ...observation(),
        finalText: `${FINAL}\nPR_COMMENT_RESPONSE: PASS`,
      }),
    ).toThrow(/public status line/);
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
    `${FINAL}\n**Posting:** posted`,
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
        "No review comments found. No report was written and nothing was posted. Re-run when feedback arrives.\n",
      repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: null },
    };
  }

  it.each([
    `PR #17 (\`refactor: simplify unit price\`, open draft) has no reviewer comments, so I wrote no replies and no \`pr-17-review.md\`.
Nothing was posted or changed, so the posting state is not-posted (\`draft-only\`).
If comments land later, I can run this again.`,
    `Posting: not-posted (draft-only; nothing was sent to GitHub)
No reviewer has commented, so there is nothing to assess or reply to. I didn't create \`pr-17-review.md\`, and I changed nothing in the repo.
Once reviewers have commented, I can run this again.`,
    `Review comments, review summaries and PR conversation comments each came back as empty lists.
Next step: Ask reviewers to leave comments, then re-run.
- **Nothing posted or written:** No GitHub posts were made and no \`pr-17-review.md\` was created.`,
  ])(
    "accepts recorded empty-inventory prose without its retired status line",
    (finalText) => {
      expect(() =>
        guardCase.check({ ...noComments(), finalText }),
      ).not.toThrow();
    },
  );
  it("accepts an empty inventory without creating an empty report", () => {
    expect(() => guardCase.check(noComments())).not.toThrow();
  });

  it.each([
    ["api", "--paginate", "repos/eval-org/cart/pulls/17/comments?per_page=100"],
    ["api", "repos/eval-org/cart/pulls/17/reviews"],
    ["api", "repos/eval-org/cart/issues/17/comments"],
    [
      "api",
      "graphql",
      "-f",
      'query={ repository(owner: "eval-org", name: "cart") { pullRequest(number: 17) { comments(first: 100) { nodes { body } } reviews(first: 100) { nodes { body } } reviewThreads(first: 100) { nodes { id } } } } }',
    ],
    ["pr", "view", GITHUB_FACTS.url, "--json", "comments,reviews"],
    ["pr", "view", "17", "--repo", GITHUB_FACTS.repository, "--json=reviews"],
  ])("accepts fixture-PR inventory read %j", (...args) => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: {
          ...correct.repoFiles,
          [GITHUB_FACTS.log]: `${JSON.stringify(args)}\n`,
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ["auth", "status"],
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
  ])("rejects non-inventory or other-PR read %j", (...args) => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: {
          ...correct.repoFiles,
          [GITHUB_FACTS.log]: `${JSON.stringify(args)}\n`,
        },
      }),
    ).toThrow("no PR comment inventory collection observed");
  });

  it.each([
    "No review comments found",
    "No report was written",
    "nothing was posted",
    "Re-run when feedback arrives",
  ])("rejects missing outcome detail %s", (fragment) => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        finalText: correct.finalText.replace(fragment, "missing"),
      }),
    ).toThrow();
  });

  it("rejects the old public status line", () => {
    const correct = noComments();
    expect(() =>
      guardCase.check({
        ...correct,
        finalText: `PR_COMMENT_RESPONSE: NO_COMMENTS\n${correct.finalText}`,
      }),
    ).toThrow(/public status line/);
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

it("accepts the recorded exact-reply posting question", () => {
  expect(() =>
    previewCase.check({
      ...observation(),
      finalText: FINAL.replace(
        "Do you approve posting this exact reply?",
        "Should I post this reply exactly as written? You can also give me edits and I'll show you the revised text first.",
      ),
    }),
  ).not.toThrow();
});
