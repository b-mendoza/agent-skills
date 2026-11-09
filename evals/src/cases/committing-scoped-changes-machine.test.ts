import { describe, expect, test } from "vitest";

import {
  approveCommitPlan,
  checkKnownFailurePlan,
} from "#/cases/committing-scoped-changes-checks.ts";
import {
  COMMIT_TARGETS,
  EXPECTED_MANIFEST,
} from "#/cases/committing-scoped-changes-fixtures.ts";
import { capturedPlanGroups } from "#/cases/committing-scoped-changes-plan-evidence.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const DIGEST_LENGTH = 40;
const FIRST_CALL = 0;
const MESSAGE = "update client defaults and exchange guide and policy content";
const PATHS = "checksums.txt client.js guide.md policy.md";
const PAYLOAD = `COMMIT_PLAN: PASS\nGroup: 1\nMessage: ${MESSAGE}\nPaths: ${PATHS}\nExpansions: none\nVerification: none\nDigest: ${"a".repeat(DIGEST_LENGTH)}\nOmissions: none\nWarnings: shared worktree\n`;
function observation(payload = PAYLOAD) {
  return createObservation({
    finalText: `The exact subject is ${MESSAGE}. Files are ${PATHS}. Verification is none.`,
    toolCalls: [
      {
        name: "Bash",
        input: {
          command: `sh "$SKILL_DIR/scripts/validate-output.sh" plan <<'EOF'\n${payload}EOF`,
        },
        result: { content: "exit=0", isError: false, truncated: false },
      },
    ],
  });
}

describe("scoped commit approval machine boundaries", () => {
  test("a validated machine plan supplies facts independently of Markdown layout", () => {
    const correct = observation();
    expect(capturedPlanGroups(correct)).toEqual([
      { message: MESSAGE, paths: PATHS.split(" "), verification: "none" },
    ]);
    expect(approveCommitPlan(correct)).toEqual({ reply: "approve" });
    expect(
      approveCommitPlan({
        ...correct,
        finalText: `${PATHS}. I cannot prepare messages or verification yet. Please revise the request before you can approve.`,
      }),
    ).toHaveProperty("gateNotReached");
    expect(
      approveCommitPlan({
        ...correct,
        finalText: correct.finalText.replace(MESSAGE, "different subject"),
      }),
    ).toHaveProperty("gateNotReached");
  });
  test("public group facts cannot contradict the captured approval artifact", () => {
    const correct = observation();
    const finalText = `## Group 1\nMessage: ${MESSAGE}\nPaths: ${PATHS}\nVerification: sh check.sh behavior\nWarnings: none`;
    expect(approveCommitPlan({ ...correct, finalText })).toHaveProperty(
      "gateNotReached",
    );
    expect(
      approveCommitPlan({
        ...correct,
        finalText: finalText.replace("sh check.sh behavior", "none"),
      }),
    ).toEqual({ reply: "approve" });
  });
  test("a captured success does not override malformed, empty-hash or out-of-scope plans", () => {
    for (const payload of [
      PAYLOAD.replace(`Paths: ${PATHS}`, "Paths: unrelated.txt"),
      PAYLOAD.replace(
        `Digest: ${"a".repeat(DIGEST_LENGTH)}`,
        "Digest: e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
      ),
      PAYLOAD.replace(`Message: ${MESSAGE}\n`, ""),
    ]) {
      expect(capturedPlanGroups(observation(payload))).toBeUndefined();
      expect(approveCommitPlan(observation(payload))).toHaveProperty(
        "gateNotReached",
      );
    }
  });
  test("failed or missing validator results cannot authorize a layout-free preview", () => {
    const correct = observation();
    const [call] = correct.toolCalls;
    expect(call).toBeDefined();
    expect(approveCommitPlan({ ...correct, toolCalls: [] })).toHaveProperty(
      "gateNotReached",
    );
    expect(
      approveCommitPlan({
        ...correct,
        toolCalls: [
          {
            name: "Bash",
            input: call?.input ?? {},
            result: {
              content: "plan: line 7: invalid digest",
              isError: true,
              truncated: false,
            },
          },
        ],
      }),
    ).toHaveProperty("gateNotReached");
  });
  test("fallback Markdown accepts complete table and annotated none but not missing facts", () => {
    const text = `| Group | Message | Files | Verification |\n| --- | --- | --- | --- |\n| 1 | ${MESSAGE} | ${PATHS} | none. No configured check exists. |\nReply approve, revise: changes, or stop.`;
    expect(approveCommitPlan(createObservation({ finalText: text }))).toEqual({
      reply: "approve",
    });
    expect(
      approveCommitPlan(
        createObservation({ finalText: text.replace(MESSAGE, "TBD") }),
      ),
    ).toHaveProperty("gateNotReached");
  });
  test("known failure remains forbidden at a real validated PASS boundary", () => {
    const base = observation(
      PAYLOAD.replace(
        "Verification: none",
        "Verification: sh check.sh behavior",
      ),
    );
    const seeded = {
      ...base,
      toolCalls: [
        { name: "Skill", input: { skill: "committing-scoped-changes" } },
        ...base.toolCalls,
      ],
      repoFiles: {
        ...COMMIT_TARGETS,
        "checksums.txt": EXPECTED_MANIFEST,
        "unrelated.txt": "unrelated staged work\n",
        ".git/eval-git.json": "[]",
      },
    };
    expect(() => checkKnownFailurePlan(seeded)).toThrow(
      /known-failing behavior command/,
    );
    const narrow = observation(
      PAYLOAD.replace("Verification: none", "Verification: sh check.sh format"),
    );
    expect(() =>
      checkKnownFailurePlan({
        ...seeded,
        toolCalls: [
          seeded.toolCalls[FIRST_CALL] ?? {
            name: "Skill",
            input: { skill: "committing-scoped-changes" },
          },
          ...narrow.toolCalls,
        ],
        finalText: "Choose one of the safer options.",
      }),
    ).not.toThrow();
  });
});
