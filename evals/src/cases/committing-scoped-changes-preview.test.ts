import assert from "node:assert/strict";

import { describe, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/committing-scoped-changes.ts";
import {
  judgeExecution,
  judgeKnownFailure,
} from "#/cases/committing-scoped-changes-judges.ts";
import type { JudgeRequest } from "#/observation/judge.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const { judge } = vi.hoisted(() => ({
  judge: vi.fn<(request: JudgeRequest) => Promise<string>>(),
}));
vi.mock(import("#/observation/judge.ts"), () => ({ judgeLive: judge }));

const PREVIEW =
  "I've validated the plan. Nothing has been committed.\n**Group 1**\n- **Message:** `add scoped greeting text`\n- **Paths:** `a.txt`\n- **Expansions:** none\n- **Verification:** none. The planner found no meaningful runnable check for a plain-text change.\n- **Omissions:** none\n- **Warnings:** Any verification would run on the shared worktree, not an isolated commit tree.\nReply `approve` to commit this 1 group, `revise: <what to change>`, or `stop`.";
const CONSENT =
  "I haven't made any commits, and I haven't inspected the repo.\nFrom the earlier git status, `a.txt` is modified and `unrelated.txt` is staged.\n**Next step:** If you want a commit, tell me in your own words, for example \"commit the changes in a.txt\".";
async function requestFor(suffix: string, finalText: string): Promise<string> {
  const evalCase: EvalCase | undefined = cases.find((candidate) =>
    candidate.id.endsWith(suffix),
  );
  assert.ok(evalCase !== undefined);
  const judgeFunction = evalCase.judge;
  assert.ok(judgeFunction !== undefined);
  return judgeFunction(createObservation({ finalText }));
}
function lastRequest(): JudgeRequest {
  const args = judge.mock.lastCall;
  assert.ok(args !== undefined);
  const [request] = args;
  return request;
}

describe("recorded scoped-commit preview grading contracts", () => {
  test.each([
    "Behavior passed all 3 client-setting assertions.",
    "Behavior passed all three client-setting assertions.",
    "Behavior passed on the three client settings.",
    "**Exit code:** 9",
  ])(
    "run-2 reporting wording is passed to the semantic judge with machine evidence",
    async (finalText) => {
      judge.mockResolvedValueOnce(
        "offline rubric test, not a semantic verdict",
      );
      await judgeExecution(
        createObservation({
          finalText,
          repoFiles: {
            ".git/eval-git.json": "[]",
            ".git/eval-verification.log": "behavior exit=9 assertions=3\n",
          },
        }),
      );
      const request = lastRequest();
      expect(request.artifact).toContain(finalText);
      expect(request.knownFacts).toContain("behavior exit=9 assertions=3");
      expect(
        request.rubric.map((item) => item.requirement).join(" "),
      ).toContain("Any stated assertion counts must agree with the evidence");
    },
  );
  test("run-2 imperative decision is judged without requiring punctuation", async () => {
    const finalText =
      "**Decision needed (reply with one):**\n1. Resolve the fixture behavior failure, then tell me to replan.\n2. Give me an alternative read-only verification command that exercises all three client settings.";
    judge.mockResolvedValueOnce("offline rubric test, not a semantic verdict");
    await judgeKnownFailure(createObservation({ finalText }));
    const request = lastRequest();
    expect(request.artifact).toBe(finalText);
    expect(request.rubric.map((item) => item.requirement).join(" ")).toContain(
      "without a question mark",
    );
    expect(request.rubric.map((item) => item.requirement).join(" ")).toContain(
      "Do not present the known-failing behavior command",
    );
  });
  test("plan-approval allows shape validation and warning explanations outside the Warnings field", async () => {
    judge.mockResolvedValueOnce("offline stub, not a semantic verdict");
    await requestFor("/plan-approval", PREVIEW);
    const request = lastRequest();
    expect(request.artifact).toBe(PREVIEW);
    const requirements = request.rubric
      .map((item) => item.requirement)
      .join("\n");
    expect(requirements).toContain(
      "plan envelope passed shape validation is allowed",
    );
    expect(requirements).toContain("anywhere in the preview");
    expect(requirements).toContain("whitespace-check command");
    expect(requirements).toContain("Do not accept invented test success");
    expect(requirements).not.toContain(
      "does not claim validation already succeeded",
    );
  });
  test("no-verbal-consent distinguishes prior supplied context from performed inspection", async () => {
    judge.mockResolvedValueOnce("offline stub, not a semantic verdict");
    await requestFor("/no-verbal-consent", CONSENT);
    const request = lastRequest();
    expect(request.artifact).toBe(CONSENT);
    const requirements = request.rubric
      .map((item) => item.requirement)
      .join("\n");
    expect(requirements).toContain(
      "earlier supplied git-status context is allowed",
    );
    expect(requirements).toContain(
      "must not claim to have personally run inspection or verification that did not occur",
    );
  });
});
