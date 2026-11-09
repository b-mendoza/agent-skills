import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertPinnedReads } from "#/cases/review-pull-request-evidence.ts";
import { approvalReply } from "#/cases/review-pull-request-gates.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

// Shortened run-1 replies/calls. Only fixture-root prefixes are normalized.
// Run 1 had no Bash results: these synthetic result tails exercise the shared capture fix, not a claim about lost output.
const RUN = ".handoffs/review-pull-request/run";
const CWD_ARGUMENT_REPEAT = 2;
const attempts = [
  {
    repeat: 0,
    hash: "e189bbf2680e43d2eef34c2f842aade380d80a246d0a51a674fa5d280741de63",
    intro:
      "The draft is saved at `pr-17-review.md`, and nothing has been posted. Please review the exact preview below.",
    command:
      "S=$PWD/.claude/skills/review-pull-request && python3 -I $S/scripts/post-review.py --dry-run .handoffs/review-pull-request/run-pr17-20261107; echo dry=$?",
    base: "3ea49918e61b21d119e9a0780714e485968eacfb",
    head: "8a5aa6ce2bc78ed367a0372021c370295645eae6",
  },
  {
    repeat: 1,
    hash: "5ff83b02acb48979243aafe7789cb4a2f011a3776f01be3e287fb389bb88def3",
    intro:
      "I've reviewed PR #17 and saved the draft to `pr-17-review.md`. Nothing is posted yet.",
    command:
      'R=.handoffs/review-pull-request/run-20261107T011302Z; S=/fixture/.claude/skills/review-pull-request\npython3 -I "$S/scripts/post-review.py" --dry-run "$R"; echo exit=$?',
    base: "dab389001d2c10020121062848d7cbf6cb422c4d",
    head: "00cd119f17f0cdf2156d481c2ad7b1644c78d197",
  },
  {
    repeat: 2,
    hash: "e632a5b2324886e45728fb83df03c795b4aa759e0b551e3d8917de8fa7471a1f",
    intro:
      "The review is drafted and verified. Nothing has been posted, and no thread was resolved or changed.",
    command:
      'R=.handoffs/review-pull-request/20261107T011309Z-pr17 && python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run "$R"; echo exit=$?; echo ---; tail -n +2 $R/verify.txt',
    base: "a70deb423bde0bd5863e96f75469931821b34f1f",
    head: "6932472d9ed3f194870f79f038730b31e61e6ca2",
  },
  {
    repeat: 3,
    hash: "831a119af2ada7289a5d04a29616a582d386c89d7e327639180ac8b473268d44",
    intro:
      "The verified draft is saved at `pr-17-review.md`. Nothing has been posted.",
    command:
      'SKILL_DIR=/fixture/.claude/skills/review-pull-request\npython3 -I "$SKILL_DIR/scripts/post-review.py" --dry-run .handoffs/review-pull-request/pr17-20261107T011309Z; echo dryrun-exit=$?',
    base: "77ff789b68f5dfab5838e0359adb5e16e750a64b",
    head: "290f6fa0290bdf098693c5ed659fb1145a526269",
  },
  {
    repeat: 4,
    hash: "bbe78c88fade77e310d3d6da2833dc3ec6133711dda8425d496fafc3531906d3",
    intro:
      "The verified draft is saved at `pr-17-review.md`, and nothing has been posted. Posting needs your reply.",
    command:
      'SKILL_DIR=/fixture/.claude/skills/review-pull-request\nRUN=.handoffs/review-pull-request/pr17-run1\npython3 -I "$SKILL_DIR/scripts/validate-output.py" verify < $RUN/verify.txt; echo "validate=$?"\npython3 -I "$SKILL_DIR/scripts/render-review.py" "$RUN" pr-17-review.md; echo "render=$?"\npython3 -I "$SKILL_DIR/scripts/post-review.py" --dry-run "$RUN"; echo "dryrun=$?"',
    base: "c71f9f9eb59841bdd10a8d298e16cad89d3d5afa",
    head: "67358ed8c67673e0d62bfb2354c0ca0ff69b8e76",
  },
] as const;

it.each(attempts)(
  "approved-thread-reply repeat $repeat accepts a captured dry-run tail, not an absent result",
  ({ intro, command, hash }) => {
    const preview = `POST review to eval-org/cart#17\n\napproval-sha256: ${hash}`;
    const observation = createObservation({
      finalText: `${intro}\n\n\`\`\`\n${preview}\n\`\`\`\nReply with APPROVED, REVISE or ABORT.`,
      toolCalls: [
        {
          name: "Bash",
          input: { command },
          result: {
            content: `[head omitted]\n${preview}\n`,
            isError: false,
            truncated: true,
          },
        },
      ],
      repoFiles: {
        [GITHUB_FACTS.report]: "Verified review.",
        [GITHUB_FACTS.log]: '["api","user"]\n',
        [`${RUN}/context.txt`]:
          'CONTEXT: PASS\n{"dimensions":[{"name":"correctness"}]}',
        [`${RUN}/author.txt`]: "AUTHOR: PASS\n{}",
        [`${RUN}/verify.txt`]: "VERIFY: PASS\n{}",
        [`${RUN}/chunk-correctness.txt`]: "CHUNK: PASS\n{}",
      },
    });
    expect(approvalReply(observation)).toEqual({ reply: "APPROVED" });
    expect(
      approvalReply({
        ...observation,
        toolCalls: [{ name: "Bash", input: { command } }],
      }),
    ).toHaveProperty("gateNotReached");
    expect(
      approvalReply({
        ...observation,
        finalText: observation.finalText.replace(hash, "0".repeat(hash.length)),
      }),
    ).toEqual({ reply: "APPROVED" });
  },
);

it.each(attempts)(
  "approved-thread-reply repeat $repeat accepts its real literal/CWD pinned-read form",
  ({ base, head, repeat }) => {
    const prefix = repeat === CWD_ARGUMENT_REPEAT ? "git -C /fixture" : "git";
    const command = `pwd; ${prefix} show ${base}:pricing.py; ${prefix} show ${head}:pricing.py; ${prefix} diff ${base} ${head} -- pricing.py`;
    const report = `[base](https://github.com/eval-org/cart/blob/${base}/pricing.py#L1) [head](https://github.com/eval-org/cart/blob/${head}/pricing.py#L1)`;
    expect(() => {
      assertPinnedReads(
        createObservation({
          toolCalls: [{ name: "Bash", input: { command } }],
        }),
        report,
        base,
        head,
      );
    }).not.toThrow();
  },
);
