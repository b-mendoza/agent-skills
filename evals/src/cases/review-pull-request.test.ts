import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const [positiveRouting, negativeRouting, previewCase, guardCase] = cases;
const SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;

const HEAD_LOG = `${"a".repeat(SHA_LENGTH)} ${"b".repeat(SHA_LENGTH)} Eval\tcommit: simplify unit price\n`;
const REPORT = `# PR review: refactor: simplify unit price
PR: ${GITHUB_FACTS.url}
Reviewed base: ${"a".repeat(SHA_LENGTH)}
Reviewed head: ${"b".repeat(SHA_LENGTH)}
## Findings
### [important] Restore the zero-count guard
Anchor: pricing.py:3 RIGHT
Placement: inline
Failure scenario: unit_price(10, 0) raises ZeroDivisionError instead of returning zero.
Fix: Restore the count == 0 guard.
Exact body:

Restore the count == 0 guard.

## Dropped candidates
None.
## Review decision
REQUEST_CHANGES
## Review summary

Restore empty-cart handling before merging.

## Coverage
Inspected: pricing.py 1-3
History: complete
## Residual risks
None.
## Verification notes
No tests executed. Head and comparison unchanged.
## Posting
Not posted.
`;
const FINAL = `POST review to eval-org/cart#17
base: main
merge-base: ${"a".repeat(SHA_LENGTH)}
commit_id: ${"b".repeat(SHA_LENGTH)}
event: REQUEST_CHANGES
Summary body:
Restore empty-cart handling before merging.
Inline: {"line":3,"path":"pricing.py","side":"RIGHT"}
Restore the count == 0 guard.
approval-sha256: ${"c".repeat(DIGEST_LENGTH)}
Choose APPROVED, REVISE with text, or ABORT.
Review file: pr-17-review.md
Posting: skipped
Notes: No posting approval supplied.
PR_REVIEW: BLOCKED
Reason: Missing approval.
Next step: Approve the displayed review.
`;
const REQUIRED_HELPERS = [
  {
    name: "Bash",
    input: {
      command:
        "python3 -I .claude/skills/review-pull-request/scripts/validate-output.py --self-test",
    },
  },
  {
    name: "Bash",
    input: {
      command:
        "python3 -I .claude/skills/review-pull-request/scripts/render-review.py --self-test",
    },
  },
  {
    name: "Bash",
    input: {
      command:
        "python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run .handoffs/review-pull-request/run",
    },
  },
];
const TOOLS = [
  ...REQUIRED_HELPERS,
  {
    name: "Write",
    input: { file_path: ".handoffs/review-pull-request/run/context.txt" },
  },
];

function observation(report = REPORT): Observation {
  return createObservation({
    finalText: FINAL,
    toolCalls: TOOLS,
    gitStatusAfter: { kind: "worktree", entries: `?? ${GITHUB_FACTS.report}` },
    repoFiles: {
      [GITHUB_FACTS.report]: report,
      [GITHUB_FACTS.log]: '["pr","view","17"]\n',
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: HEAD_LOG,
      ".git/logs/HEAD": HEAD_LOG,
    },
  });
}

const skillCall = { name: "Skill", input: { skill: "review-pull-request" } };

describe("review-pull-request routing", () => {
  it("distinguishes review from response drafting", () => {
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
    "rejects invalid runs: $id",
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

describe("verified review preview", () => {
  it("accepts a saved grounded review and withheld posting", () => {
    expect(() => previewCase.check(observation())).not.toThrow();
  });

  it.each([
    "Findings",
    "Dropped candidates",
    "Review decision",
    "Review summary",
    "Coverage",
    "Residual risks",
    "Verification notes",
    "Posting",
  ])("rejects a missing %s section", (heading) => {
    expect(() =>
      previewCase.check(
        observation(REPORT.replace(`## ${heading}`, `## Missing ${heading}`)),
      ),
    ).toThrow();
  });

  it.each([
    ["title", "# PR review:", "# Other:"],
    ["identity", GITHUB_FACTS.url, "https://github.com/other/repo/pull/99"],
    ["base pin", "Reviewed base:", "Old base:"],
    ["head pin", "Reviewed head:", "Old head:"],
    ["wrong base SHA", "a".repeat(SHA_LENGTH), "d".repeat(SHA_LENGTH)],
    ["wrong head SHA", "b".repeat(SHA_LENGTH), "d".repeat(SHA_LENGTH)],
    [
      "summary mismatch",
      "Restore empty-cart handling before merging.",
      "Unrelated summary.",
    ],
    [
      "body mismatch",
      "Exact body:\n\nRestore the count == 0 guard.",
      "Exact body:\n\nDifferent reply.",
    ],
    ["anchor", "Anchor: pricing.py:3 RIGHT", "Anchor: invented.py:3 RIGHT"],
    ["decision", "REQUEST_CHANGES", "APPROVE"],
    ["posting", "Not posted.", "Posted."],
  ])("rejects wrong %s in the report", (_name, from, to) => {
    expect(() =>
      previewCase.check(observation(REPORT.replace(from, to))),
    ).toThrow();
  });

  it.each([
    "POST review to eval-org/cart#17",
    "approval-sha256:",
    "APPROVED",
    "PR_REVIEW: BLOCKED",
    "Review file: pr-17-review.md",
    "Posting: skipped",
  ])("rejects missing preview contract %s", (fragment) => {
    expect(() =>
      previewCase.check({
        ...observation(),
        finalText: FINAL.replace(fragment, "missing"),
      }),
    ).toThrow();
  });

  it.each(["", "not-json"])(
    "rejects a preview-only inline target mismatch: %s",
    (target) => {
      expect(() =>
        previewCase.check({
          ...observation(),
          finalText: FINAL.replace(
            '{"line":3,"path":"pricing.py","side":"RIGHT"}',
            target,
          ),
        }),
      ).toThrow();
    },
  );

  it.each(REQUIRED_HELPERS)(
    "rejects an omitted required helper invocation $input.command",
    (tool) => {
      const remainingTools = TOOLS.filter((candidate) => candidate !== tool);
      expect(() =>
        previewCase.check({
          ...observation(),
          toolCalls: remainingTools,
        }),
      ).toThrow();
    },
  );

  it("rejects absent or uncaptured artifacts", () => {
    const correct = observation();
    expect(() =>
      previewCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: null },
      }),
    ).toThrow();
    expect(() => previewCase.check({ ...correct, repoFiles: {} })).toThrow();
  });

  it.each([
    {
      name: "Bash",
      input: { command: "git commit --allow-empty -m unauthorized" },
    },
    {
      name: "Bash",
      input: { command: "python3 -I post-review.py --approved hash run" },
    },
    { name: "Write", input: { file_path: "pricing.py" } },
    {
      name: "Edit",
      input: { file_path: ".handoffs/other-skill/run/context.txt" },
    },
    { name: "NotebookEdit", input: { notebook_path: "analysis.ipynb" } },
    { name: "Write", input: { file_path: "../pr-17-review.md" } },
  ])("rejects unauthorized actions $name $input", (tool) => {
    expect(() =>
      previewCase.check({ ...observation(), toolCalls: [...TOOLS, tool] }),
    ).toThrow();
  });

  it("rejects unapproved review and reply API writes", () => {
    const correct = observation();
    for (const endpoint of [
      "repos/eval-org/cart/pulls/17/reviews",
      "repos/eval-org/cart/pulls/comments/701/replies",
    ]) {
      expect(() =>
        previewCase.check({
          ...correct,
          repoFiles: {
            ...correct.repoFiles,
            [GITHUB_FACTS.log]: `${JSON.stringify(["api", "-X", "POST", endpoint])}\n`,
          },
        }),
      ).toThrow();
    }
  });

  it("rejects unexpected tracked or untracked changes and HEAD movement", () => {
    const correct = observation();
    expect(() =>
      previewCase.check({
        ...correct,
        gitStatusAfter: {
          kind: "worktree",
          entries: "?? extra.txt\n?? pr-17-review.md",
        },
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, ".git/logs/HEAD": "new commit" },
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.source]: "changed" },
      }),
    ).toThrow();
  });
});

describe("create-only output guard", () => {
  function collision(): Observation {
    const correct = observation(GITHUB_FACTS.existingReport);
    return {
      ...correct,
      toolCalls: [],
      gitStatusBefore: { kind: "worktree", entries: "?? pr-17-review.md" },
      finalText:
        "Review file: pr-17-review.md\nPosting: skipped\nPR_REVIEW: NEEDS_CONTEXT\nReason: Output already exists.\nNext step: Choose an unused output path.\n",
    };
  }

  it("preserves the previous report and names the missing input", () => {
    expect(() => guardCase.check(collision())).not.toThrow();
  });

  it("rejects overwriting the report or claiming a successful review", () => {
    const correct = collision();
    expect(() =>
      guardCase.check({
        ...correct,
        repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.report]: REPORT },
      }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...correct,
        finalText: correct.finalText.replace(
          "NEEDS_CONTEXT",
          "VERIFIED_DRAFT_SAVED",
        ),
      }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...correct,
        finalText: correct.finalText.replace("Next step:", "Next:"),
      }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...correct,
        toolCalls: [
          { name: "Write", input: { file_path: GITHUB_FACTS.report } },
        ],
      }),
    ).toThrow();
  });
});

describe("review collector fixture", () => {
  it.each([false, true])(
    "supports the shipped collector's exact GraphQL projection, comments=%s",
    (comments) => {
      const fixture = makeFixture("clean", [], (context) => {
        seedGithubFixture(context, { comments });
      });
      try {
        const script = fileURLToPath(
          new URL(
            "../../../skills/review-pull-request/scripts/collect-pr-review-comments.sh",
            import.meta.url,
          ),
        );
        const output = execFileSync("sh", [script, "eval-org", "cart", "17"], {
          cwd: fixture.cwd,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
          },
        });
        expect(output.includes('"root_comment_id":"701"')).toBe(comments);
        expect(output.trim() === "").toBe(!comments);
        expect(
          readFileSync(join(fixture.cwd, GITHUB_FACTS.log), "utf8"),
        ).toContain('"graphql"');
      } finally {
        fixture.cleanup();
      }
    },
  );

  it("seeds the collision file unchanged", () => {
    const fixture = makeFixture("clean", [], guardCase.seed);
    try {
      expect(readFileSync(join(fixture.cwd, GITHUB_FACTS.report), "utf8")).toBe(
        GITHUB_FACTS.existingReport,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
