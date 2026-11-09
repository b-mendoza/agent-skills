import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  approvalReply,
  assertPinnedCitations,
} from "#/cases/review-pull-request-checks.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const HASH_LENGTH = 64;
const BASE = "a".repeat(SHA_LENGTH);
const HEAD = "b".repeat(SHA_LENGTH);
const HASH = "c".repeat(HASH_LENGTH);
const RUN = ".handoffs/review-pull-request/run";
const DRY_COMMAND = `python3 -I /fixture/.claude/skills/review-pull-request/scripts/post-review.py --dry-run ${RUN}`;
const PREVIEW = `POST review to eval-org/cart#17\nSummary body:\nA verified review.\napproval-sha256: ${HASH}\nChoose APPROVED, REVISE or ABORT.`;

function atPreview() {
  return createObservation({
    finalText: PREVIEW,
    toolCalls: [
      {
        name: "Bash",
        input: {
          command: DRY_COMMAND,
        },
        result: { content: PREVIEW, isError: false, truncated: false },
      },
    ],
    repoFiles: {
      [GITHUB_FACTS.report]: "Verified review.\n",
      [GITHUB_FACTS.log]: '["api","user"]\n',
      [`${RUN}/context.txt`]:
        'CONTEXT: PASS\n{"dimensions":[{"name":"correctness"}]}',
      [`${RUN}/author.txt`]: "AUTHOR: PASS\n{}",
      [`${RUN}/verify.txt`]: "VERIFY: PASS\n{}",
      [`${RUN}/chunk-correctness.txt`]: "CHUNK: PASS\n{}",
    },
  });
}

function previewContent(variant: string): string {
  if (variant === "ambiguous") {
    return `${PREVIEW}\napproval-sha256: ${"d".repeat(HASH_LENGTH)}`;
  }
  if (variant === "truncated") {
    return "POST review to eval-org/cart#17\n[truncated; approval hash absent]";
  }
  return PREVIEW;
}

describe("review approval evidence", () => {
  it("requires an observed successful matching preview and retained files", () => {
    expect(approvalReply(atPreview())).toEqual({ reply: "APPROVED" });
  });
  it("does not require any hash or approval wording in final prose", () => {
    expect(
      approvalReply({ ...atPreview(), finalText: "The review is ready." }),
    ).toEqual({ reply: "APPROVED" });
  });
  it("rejects the fabricated hash with no tools or prepared review", () => {
    const observation = createObservation({
      finalText: `I have not prepared any review. Say APPROVED.\napproval-sha256: ${"0".repeat(HASH_LENGTH)}`,
    });
    expect(approvalReply(observation)).toHaveProperty("gateNotReached");
  });
  it("rejects the coordinator's already-posted counterexample", () => {
    const good = atPreview();
    const write = [
      "api",
      "--method",
      "POST",
      "repos/eval-org/cart/pulls/17/reviews",
    ];
    expect(
      approvalReply({
        ...good,
        toolCalls: [
          ...good.toolCalls,
          { name: "Bash", input: { command: `gh ${write.join(" ")}` } },
        ],
        repoFiles: {
          ...good.repoFiles,
          [GITHUB_FACTS.log]: `${JSON.stringify(write)}\n`,
        },
      }),
    ).toHaveProperty("gateNotReached");
  });
  it.each(["POST", "PATCH", "PUT", "DELETE"])(
    "rejects %s from the boundary gh log even if command text hides it",
    (method) => {
      const good = atPreview();
      expect(
        approvalReply({
          ...good,
          repoFiles: {
            ...good.repoFiles,
            [GITHUB_FACTS.log]: `${JSON.stringify(["api", "-X", method, "repos/eval-org/cart/pulls/17/reviews"])}\n`,
          },
        }),
      ).toHaveProperty("gateNotReached");
    },
  );
  it("rejects an approved poster invocation even without a gh write receipt", () => {
    const good = atPreview();
    expect(
      approvalReply({
        ...good,
        toolCalls: [
          ...good.toolCalls,
          {
            name: "Bash",
            input: {
              command: `python3 -I /fixture/post-review.py --approved ${HASH} ${RUN}`,
            },
          },
        ],
      }),
    ).toHaveProperty("gateNotReached");
  });
  it("rejects GraphQL mutation evidence", () => {
    const good = atPreview();
    expect(
      approvalReply({
        ...good,
        repoFiles: {
          ...good.repoFiles,
          [GITHUB_FACTS.log]:
            '["api","graphql","-f","query=mutation { resolveReviewThread(input: {threadId: \\"T1\\"}) { thread { id } } }"]\n',
        },
      }),
    ).toHaveProperty("gateNotReached");
  });
  it.each(["missing", "failed", "truncated", "ambiguous"])(
    "rejects %s preview evidence",
    (variant) => {
      const good = atPreview();
      const content = previewContent(variant);
      const toolCalls =
        variant === "missing"
          ? []
          : [
              {
                name: "Bash",
                input: { command: DRY_COMMAND },
                result: {
                  content,
                  isError: variant === "failed",
                  truncated: variant === "truncated",
                },
              },
            ];
      expect(approvalReply({ ...good, toolCalls })).toHaveProperty(
        "gateNotReached",
      );
    },
  );
  it.each([
    GITHUB_FACTS.report,
    `${RUN}/context.txt`,
    `${RUN}/author.txt`,
    `${RUN}/verify.txt`,
    `${RUN}/chunk-correctness.txt`,
  ])("rejects cleanup of %s while waiting", (path) => {
    const good = atPreview();
    expect(
      approvalReply({
        ...good,
        repoFiles: { ...good.repoFiles, [path]: null },
      }),
    ).toHaveProperty("gateNotReached");
  });
});

const REPORT = `Reviewed base: ${BASE}\nReviewed head: ${HEAD}\nAnchor: pricing.py:3 RIGHT\n\nCode: [pricing](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3)\n\nExact body:\n\n[Guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3) divides by zero.\n\n## End`;

describe("pinned read evidence", () => {
  it("rejects SHAs echoed after git status", () => {
    expect(() => {
      assertPinnedCitations(
        createObservation({
          toolCalls: [
            {
              name: "Bash",
              input: { command: `git status; echo ${BASE} ${HEAD}` },
            },
          ],
        }),
        REPORT,
      );
    }).toThrow(/pinned reads/);
  });
  it.each([
    `git show ${HEAD}:pricing.py`,
    `git diff ${BASE} ${HEAD} -- pricing.py`,
    `git diff ${BASE}...${HEAD} -- pricing.py`,
    `gh api 'repos/eval-org/cart/contents/pricing.py?ref=${HEAD}'`,
    `gh api repos/eval-org/cart/compare/${BASE}...${HEAD}`,
    `HEAD="${HEAD}"; git show "$HEAD:pricing.py"`,
    `BASE=${BASE}; HEAD=${HEAD}; git diff "$BASE" "$HEAD" -- pricing.py`,
    `export HEAD='${HEAD}'\ngit show "\${HEAD}:pricing.py"`,
  ])("accepts an explicit pinned read: %s", (command) => {
    expect(() => {
      assertPinnedCitations(
        createObservation({
          toolCalls: [{ name: "Bash", input: { command } }],
        }),
        REPORT,
      );
    }).not.toThrow();
  });
  it.each([
    `git show ${BASE}:pricing.py`,
    `git show ${HEAD}:other.py`,
    `echo 'git show ${HEAD}:pricing.py'`,
    `git show "$HEAD:pricing.py"`,
    `HEAD=${HEAD}; HEAD=${BASE}; git show "$HEAD:pricing.py"`,
    `HEAD=${HEAD}; git show '$HEAD:pricing.py'`,
    `HEAD=${HEAD}; unset HEAD; git show "$HEAD:pricing.py"`,
    `HEAD=$(git rev-parse HEAD); git show "$HEAD:pricing.py"`,
  ])("rejects unrelated evidence: %s", (command) => {
    expect(() => {
      assertPinnedCitations(
        createObservation({
          toolCalls: [{ name: "Bash", input: { command } }],
        }),
        REPORT,
      );
    }).toThrow(/pinned reads/);
  });
});
