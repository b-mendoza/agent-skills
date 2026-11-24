import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import {
  REVIEW_POSTS,
  SENTINEL,
} from "#/cases/review-pull-request-fixtures.ts";
import { RETAINED_PAYLOADS } from "#/cases/review-pull-request-retention-test-support.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const [, , previewCase] = cases;
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
      ...RETAINED_PAYLOADS,
      [REVIEW_POSTS]: "",
      [SENTINEL]: "unrelated run: preserve me\n",
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
      input: {
        command: `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${"c".repeat(DIGEST_LENGTH)} run`,
      },
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
  it("does not credit a saved draft when the paused run tree was never captured", () => {
    const paused = observation();
    const repoFiles = { ...paused.repoFiles };
    delete repoFiles[".handoffs/review-pull-request/"];
    expect(() => previewCase.check({ ...paused, repoFiles })).toThrow();
  });
  it("accepts the paused review with its assigned scratch, but not emptied notes", () => {
    const draft = observation();
    const path = ".handoffs/review-pull-request/run/scratch-verify.txt";
    const content = "Checked the pinned guard.";
    const paused = {
      ...draft,
      toolCalls: [
        ...draft.toolCalls,
        { name: "Task", input: { prompt: `SCRATCH_FILE=${path}` } },
        { name: "Write", input: { file_path: path, content } },
      ],
    };
    expect(() =>
      previewCase.check({
        ...paused,
        repoFiles: { ...paused.repoFiles, [path]: content },
      }),
    ).not.toThrow();
    expect(() =>
      previewCase.check({
        ...paused,
        repoFiles: { ...paused.repoFiles, [path]: "" },
      }),
    ).toThrow(path);
  });
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
