import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import { assertPosting } from "#/cases/review-pull-request-checks.ts";
import { REVIEW_POSTS } from "#/cases/review-pull-request-fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const [, , previewCase, guardCase] = cases;
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
const INLINE_TARGET = '{"line":3,"path":"pricing.py","side":"RIGHT"}';
const FINAL = `POST review to eval-org/cart#17
base: main
merge-base: ${"a".repeat(SHA_LENGTH)}
commit_id: ${"b".repeat(SHA_LENGTH)}
event: REQUEST_CHANGES
Summary body:
Restore empty-cart handling before merging.
Inline: ${INLINE_TARGET}
Restore the count == 0 guard.
approval-sha256: ${"c".repeat(DIGEST_LENGTH)}
Choose APPROVED, REVISE with text, or ABORT.
`;
const DRY_RUN_TOOL = {
  name: "Bash",
  input: {
    command:
      "python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run .handoffs/review-pull-request/run",
  },
  result: { content: FINAL, isError: false, truncated: false },
};
const WRITE_RUN_FILE_TOOL = {
  name: "Write",
  input: { file_path: ".handoffs/review-pull-request/run/context.txt" },
};

function observation(report = REPORT, preview = FINAL): Observation {
  return createObservation({
    finalText: FINAL,
    toolCalls: [
      { ...DRY_RUN_TOOL, result: { ...DRY_RUN_TOOL.result, content: preview } },
      WRITE_RUN_FILE_TOOL,
    ],
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

function withTool(tool: Observation["toolCalls"][number]): Observation {
  const correct = observation();
  return { ...correct, toolCalls: [...correct.toolCalls, tool] };
}

function withFile(path: string, content: string | null): Observation {
  const correct = observation();
  return { ...correct, repoFiles: { ...correct.repoFiles, [path]: content } };
}

function anchored(anchor: string, target: string): readonly [string, string] {
  return [
    REPORT.replace("pricing.py:3 RIGHT", anchor),
    FINAL.replace(INLINE_TARGET, target),
  ];
}

const ACCEPTED_PREVIEWS: ReadonlyArray<readonly [string, string, string]> = [
  ["a saved grounded review with posting held", REPORT, FINAL],
  [
    "a RIGHT range",
    ...anchored(
      "pricing.py:2-3 RIGHT",
      '{"line":3,"path":"pricing.py","side":"RIGHT","start_line":2,"start_side":"RIGHT"}',
    ),
  ],
  [
    "a LEFT range on base-only lines",
    ...anchored(
      "pricing.py:3-4 LEFT",
      '{"line":4,"path":"pricing.py","side":"LEFT","start_line":3,"start_side":"LEFT"}',
    ),
  ],
];

const REJECTED_PREVIEWS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "a missing Residual risks section",
    REPORT.replace("## Residual risks", "## Missing Residual risks"),
    FINAL,
  ],
  [
    "the wrong PR identity",
    REPORT.replace(GITHUB_FACTS.url, "https://github.com/other/repo/pull/99"),
    FINAL,
  ],
  [
    "the wrong base SHA",
    REPORT.replace("a".repeat(SHA_LENGTH), "d".repeat(SHA_LENGTH)),
    FINAL,
  ],
  [
    "the wrong head SHA",
    REPORT.replace("b".repeat(SHA_LENGTH), "d".repeat(SHA_LENGTH)),
    FINAL,
  ],
  [
    "a mismatched summary",
    REPORT.replace(
      "Restore empty-cart handling before merging.",
      "Unrelated summary.",
    ),
    FINAL,
  ],
  [
    "a mismatched exact body",
    REPORT.replace(
      "Exact body:\n\nRestore the count == 0 guard.",
      "Exact body:\n\nDifferent reply.",
    ),
    FINAL,
  ],
  [
    "an invented anchor",
    REPORT.replace("Anchor: pricing.py:3", "Anchor: invented.py:3"),
    FINAL,
  ],
  ["the wrong decision", REPORT.replace("REQUEST_CHANGES", "APPROVE"), FINAL],
  ["a posted marker", REPORT.replace("Not posted.", "Posted."), FINAL],
  [
    "no POST review header",
    REPORT,
    FINAL.replace("POST review to eval-org/cart#17", "missing"),
  ],
  ["no inline target", REPORT, FINAL.replace(INLINE_TARGET, "")],
  [
    "an inline target on the wrong side",
    REPORT,
    FINAL.replace(
      INLINE_TARGET,
      '{"line":3,"path":"pricing.py","side":"LEFT"}',
    ),
  ],
  [
    "an anchor outside the pinned fixture",
    ...anchored(
      "pricing.py:999 RIGHT",
      '{"line":999,"path":"pricing.py","side":"RIGHT"}',
    ),
  ],
  [
    "a reversed range",
    ...anchored(
      "pricing.py:3-2 RIGHT",
      '{"line":2,"path":"pricing.py","side":"RIGHT","start_line":3,"start_side":"RIGHT"}',
    ),
  ],
];

const REJECTED_ACTIONS: ReadonlyArray<readonly [string, Observation]> = [
  [
    "skips the poster dry-run",
    { ...observation(), toolCalls: [WRITE_RUN_FILE_TOOL] },
  ],
  ["leaves no report", withFile(GITHUB_FACTS.report, null)],
  [
    "commits",
    withTool({
      name: "Bash",
      input: { command: "git commit --allow-empty -m unauthorized" },
    }),
  ],
  [
    "runs the approved poster before approval",
    withTool({
      name: "Bash",
      input: { command: "python3 -I post-review.py --approved hash run" },
    }),
  ],
  [
    "writes the source",
    withTool({ name: "Write", input: { file_path: "pricing.py" } }),
  ],
  [
    "edits another skill's run file",
    withTool({
      name: "Edit",
      input: { file_path: ".handoffs/other-skill/run/context.txt" },
    }),
  ],
  [
    "edits a notebook",
    withTool({
      name: "NotebookEdit",
      input: { notebook_path: "analysis.ipynb" },
    }),
  ],
  [
    "logs a gh POST",
    withFile(
      GITHUB_FACTS.log,
      `${JSON.stringify(["api", "-X", "POST", "repos/eval-org/cart/pulls/17/reviews"])}\n`,
    ),
  ],
  [
    "adds an untracked file",
    {
      ...observation(),
      gitStatusAfter: {
        kind: "worktree",
        entries: "?? extra.txt\n?? pr-17-review.md",
      },
    },
  ],
  ["moves HEAD", withFile(".git/logs/HEAD", "new commit")],
  ["changes the source", withFile(GITHUB_FACTS.source, "changed")],
];

describe("verified review preview", () => {
  it.each(ACCEPTED_PREVIEWS)("accepts %s", (_label, report, preview) => {
    expect(() => previewCase.check(observation(report, preview))).not.toThrow();
  });

  it.each(REJECTED_PREVIEWS)(
    "rejects a review or preview with %s",
    (_label, report, preview) => {
      expect(() => previewCase.check(observation(report, preview))).toThrow();
    },
  );

  it.each(REJECTED_ACTIONS)("rejects a preview run that %s", (_label, run) => {
    expect(() => previewCase.check(run)).toThrow();
  });
});

function collision(): Observation {
  return {
    ...observation(GITHUB_FACTS.existingReport),
    toolCalls: [],
    gitStatusBefore: { kind: "worktree", entries: "?? pr-17-review.md" },
  };
}

const REJECTED_COLLISIONS: ReadonlyArray<readonly [string, Observation]> = [
  [
    "overwrote the report",
    {
      ...collision(),
      repoFiles: { ...collision().repoFiles, [GITHUB_FACTS.report]: REPORT },
    },
  ],
  [
    "wrote the report path",
    {
      ...collision(),
      toolCalls: [{ name: "Write", input: { file_path: GITHUB_FACTS.report } }],
    },
  ],
];

describe("create-only output guard", () => {
  it("accepts a collision run that leaves the existing report unchanged", () => {
    expect(() => guardCase.check(collision())).not.toThrow();
  });

  it.each(REJECTED_COLLISIONS)(
    "rejects a collision run that %s",
    (_label, run) => {
      expect(() => guardCase.check(run)).toThrow();
    },
  );
});

const HEAD = "b".repeat(SHA_LENGTH);
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
const DRY_TOOL = {
  name: "Bash",
  input: { command: "python3 -I post-review.py --dry-run run" },
  result: { content: PREVIEW, isError: false, truncated: false },
};
const APPROVED_TOOL = {
  name: "Bash",
  input: {
    command: `python3 -I post-review.py --approved ${"c".repeat(DIGEST_LENGTH)} run`,
  },
};
const POSTS = [
  {
    endpoint: "repos/eval-org/cart/pulls/17/reviews",
    payload: {
      body: SUMMARY_BODY,
      comments: [],
      commit_id: HEAD,
      event: "REQUEST_CHANGES",
    },
  },
  {
    endpoint: "repos/eval-org/cart/pulls/17/comments/701/replies",
    payload: { body: REPLY_BODY },
  },
]
  .map((post) => JSON.stringify(post))
  .join("\n");
const POSTED = createObservation({
  turns: [
    createTurn({ toolCalls: [DRY_TOOL] }),
    createTurn({ prompt: "APPROVED", toolCalls: [APPROVED_TOOL] }),
  ],
  repoFiles: { [REVIEW_POSTS]: POSTS },
});

function posted(posts: string): Observation {
  return { ...POSTED, repoFiles: { [REVIEW_POSTS]: posts } };
}

const DRIFT_REFUSED: Observation = {
  ...posted(""),
  turns: [
    createTurn({ toolCalls: [DRY_TOOL] }),
    createTurn({
      prompt: "APPROVED",
      toolCalls: [
        {
          ...APPROVED_TOOL,
          result: {
            content:
              "live account/history changed; approval invalid; re-assess and preview anew",
            isError: true,
            truncated: false,
          },
        },
      ],
    }),
  ],
};

const ACCEPTED_POSTINGS: ReadonlyArray<
  readonly [string, Observation, boolean]
> = [
  ["the exact posts after the reply", POSTED, false],
  ["a drift refusal with nothing posted", DRIFT_REFUSED, true],
];

const REJECTED_POSTINGS: ReadonlyArray<
  readonly [string, Observation, boolean, RegExp]
> = [
  [
    "a mutation before the reply",
    {
      ...POSTED,
      turns: [
        createTurn({ toolCalls: [DRY_TOOL, APPROVED_TOOL] }),
        createTurn({ prompt: "APPROVED", toolCalls: [APPROVED_TOOL] }),
      ],
    },
    false,
    /before reply/,
  ],
  [
    "a review body without its trailing newline",
    posted(POSTS.replace('\\n"', '"')),
    false,
    /differs/,
  ],
  [
    "a changed reply body",
    posted(POSTS.replace("otherwise divide by zero", "may fail")),
    false,
    /differs/,
  ],
  [
    "a wrong reply target",
    posted(POSTS.replace("/comments/701/", "/comments/999/")),
    false,
    /target/,
  ],
  [
    "a new inline comment for a known duplicate",
    posted(POSTS.replace('"comments":[]', '"comments":[{}]')),
    false,
    /duplicate/,
  ],
  [
    "a second approved poster call",
    {
      ...POSTED,
      turns: [
        createTurn({ toolCalls: [DRY_TOOL] }),
        createTurn({
          prompt: "APPROVED",
          toolCalls: [APPROVED_TOOL, APPROVED_TOOL],
        }),
      ],
    },
    false,
    /exactly once/,
  ],
  ["a post after a drift refusal", POSTED, true, /stale/],
];

describe("approved posting grade", () => {
  it.each(ACCEPTED_POSTINGS)("accepts %s", (_label, run, stopped) => {
    expect(() => {
      assertPosting(run, stopped);
    }).not.toThrow();
  });

  it.each(REJECTED_POSTINGS)("rejects %s", (_label, run, stopped, error) => {
    expect(() => {
      assertPosting(run, stopped);
    }).toThrow(error);
  });
});
