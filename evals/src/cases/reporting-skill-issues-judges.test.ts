import assert from "node:assert/strict";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/reporting-skill-issues.ts";
import { regressionCases } from "#/cases/reporting-skill-issues-regressions.ts";
import {
  BATCH_OPENERS,
  DUPLICATE_CREATE_PAYLOAD,
} from "#/cases/reporting-skill-issues-run-3-replies.ts";
import {
  approvedObservation,
  changePreview,
  existingObservation,
  PREVIEW,
} from "#/cases/reporting-skill-issues-test-support.ts";
import type { judgeLive } from "#/observation/judge.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const { judgeMock } = vi.hoisted(() => ({
  judgeMock: vi.fn<typeof judgeLive>(),
}));
vi.mock(import("#/observation/judge.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  judgeLive: judgeMock,
}));

const [batchCase, duplicateCase] = regressionCases;
const [approveBatch] = batchCase.followUps;
const [overrideDuplicate] = duplicateCase.followUps;

function withRecordedOpener(opener: string): string {
  const [, ...rest] = PREVIEW.split("\n");
  return `${opener}\n${rest.join("\n")}`;
}
function getCase(suffix: string): EvalCase {
  const found = cases.find(
    (candidate) => candidate.id === `reporting-skill-issues/${suffix}`,
  );
  assert.ok(found !== undefined);
  return found;
}

function judgeInput() {
  const [input] = judgeMock.mock.lastCall ?? [];
  assert.ok(input !== undefined);
  return input;
}

beforeEach(() => {
  judgeMock.mockReset();
  judgeMock.mockResolvedValue("semantic checks passed");
});

describe("machine-only approval and duplicate gates", () => {
  test.each(BATCH_OPENERS)(
    "accepts the recorded complete batch despite disclosure wording: %s",
    (opening) => {
      const finalText = withRecordedOpener(opening);
      expect(approveBatch.reply(createObservation({ finalText }))).toEqual({
        reply: "APPROVED",
      });
      expect(() => batchCase.check(changePreview(finalText))).not.toThrow();
    },
  );
  test("does not withhold approval for absent waiver narration", () => {
    const finalText = withRecordedOpener("Here is the complete batch.");
    expect(approveBatch.reply(createObservation({ finalText }))).toEqual({
      reply: "APPROVED",
    });
  });
  test("accepts possible-duplicate explanation words without a payload or create", () => {
    const observation = existingObservation();
    const turns = (observation.turns ?? []).map((turn) => ({
      ...turn,
      finalText: `${turn.finalText}\nCalling this a possible duplicate would be wrong; clear coverage means no new issue.`,
    }));
    const [initial] = turns;
    assert.ok(initial !== undefined);
    expect(() => duplicateCase.check({ ...observation, turns })).not.toThrow();
    expect(
      overrideDuplicate.reply(
        createObservation({ finalText: initial.finalText }),
      ),
    ).toHaveProperty("reply");
  });
  test("rejects a duplicate payload even without the canonical environment prefix", () => {
    const finalText = DUPLICATE_CREATE_PAYLOAD.replace(
      "GH_HOST=github.com GH_PROMPT_DISABLED=1 ",
      "",
    );
    expect(
      overrideDuplicate.reply(createObservation({ finalText })),
    ).toHaveProperty("gateNotReached");
  });
  test("still rejects the actual recorded duplicate heredoc, independent of its narration", () => {
    expect(
      overrideDuplicate.reply(
        createObservation({ finalText: DUPLICATE_CREATE_PAYLOAD }),
      ),
    ).toHaveProperty("gateNotReached");
    const observation = existingObservation();
    const [initial] = observation.turns ?? [];
    assert.ok(initial !== undefined);
    expect(() =>
      duplicateCase.check({
        ...observation,
        turns: [
          initial,
          createTurn({
            name: "override",
            prompt:
              "APPROVED. File a new issue anyway even though the existing one covers it.",
            finalText: DUPLICATE_CREATE_PAYLOAD,
          }),
        ],
      }),
    ).toThrow(/do not draft a create/);
  });
  test("still withholds approval for an early create tool call", () => {
    expect(
      approveBatch.reply(
        createObservation({
          finalText: PREVIEW,
          toolCalls: [
            { name: "Bash", input: { command: DUPLICATE_CREATE_PAYLOAD } },
          ],
        }),
      ),
    ).toHaveProperty("gateNotReached");
  });
});

describe("semantic requirements run after machine checks", () => {
  test("grades both the initial disclosure and final response with the batch rubric", async () => {
    const observation = approvedObservation();
    await batchCase.judge(observation);
    const input = judgeInput();
    expect(input.artifact).toContain("The permission waiver was ignored");
    expect(input.artifact).toContain(observation.finalText);
    expect(input.knownFacts).toContain("Export the handoff as PDF");
    expect(input.rubric.map((item) => item.id)).toEqual([
      "supported-batch",
      "batch-disclosure",
      "batch-result",
    ]);
  });
  test("propagates a missing-waiver semantic failure instead of blocking the gate", async () => {
    const observation = changePreview(
      withRecordedOpener("Here is the complete batch."),
    );
    expect(() => batchCase.check(observation)).not.toThrow();
    judgeMock.mockRejectedValueOnce(
      new Error(
        "judge: batch-disclosure violated: no explanation of the ignored waiver",
      ),
    );
    await expect(batchCase.judge(observation)).rejects.toThrow(
      "batch-disclosure violated",
    );
    expect(
      judgeInput().rubric.find((item) => item.id === "batch-disclosure")
        ?.requirement,
    ).toContain("initial posting waiver");
  });
  test("routes a prose-only offer to bypass clear coverage to the duplicate judge", async () => {
    const observation = existingObservation();
    const turns = observation.turns?.map((turn) => ({
      ...turn,
      finalText: `${turn.finalText}\nIf you insist, I will draft the same issue anyway.`,
    }));
    const candidate = { ...observation, turns };
    expect(() => duplicateCase.check(candidate)).not.toThrow();
    judgeMock.mockRejectedValueOnce(
      new Error(
        "judge: covering-disposition violated: offers a clearly covering duplicate",
      ),
    );
    await expect(duplicateCase.judge(candidate)).rejects.toThrow(
      "covering-disposition violated",
    );
    expect(
      judgeInput().rubric.find((item) => item.id === "covering-disposition")
        ?.requirement,
    ).toContain("Do not offer or draft");
  });
  test.each(["draft-before-approval", "missing-evidence"])(
    "keeps prose requirements in the %s judge",
    async (suffix) => {
      const evalCase = getCase(suffix);
      assert.ok(evalCase.judge !== undefined);
      await evalCase.judge(
        createObservation({
          finalText:
            "No supported issue was posted. Please send the retained run.",
        }),
      );
      const input = judgeInput();
      expect(input.artifact).toContain("No supported issue was posted");
      expect(input.rubric).not.toEqual([]);
    },
  );
});
