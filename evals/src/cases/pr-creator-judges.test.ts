import { describe, expect, it, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/pr-creator.ts";
import {
  createdObservation,
  preparedObservation,
} from "#/cases/pr-creator-test-support.ts";
import { judgeLive } from "#/observation/judge.ts";

vi.mock(import("#/observation/judge.ts"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    judgeLive: vi.fn().mockResolvedValue("offline judge configuration checked"),
  };
});

const LAST = -1;
function lastJudgeInput() {
  const call = vi.mocked(judgeLive).mock.calls.at(LAST);
  if (call === undefined) throw new Error("judge was not called");
  const [input] = call;
  return input;
}

function caseWithJudge(id: string): EvalCase {
  const found: EvalCase | undefined = cases.find(
    (candidate) => candidate.id === `pr-creator/${id}`,
  );
  if (found?.judge === undefined) throw new Error(`judge missing for ${id}`);
  return found;
}

describe("pr-creator prose quality stays in judge rubrics", () => {
  it.each([
    ["approved-exact-bytes-assignee", "Accurately explain that the PR exists"],
    ["created-with-drift", "each body/label mismatch"],
    ["template-title-observed-retained", "not unit-price simplification"],
    [
      "unknown-verification-no-assignee",
      "unknown rather than passed or definitely not run",
    ],
    ["scope-record-continues", "separate helper-token create approval"],
    ["preview-awaits-approval", "complete proposed title, body"],
  ] as const)(
    "%s retains its semantic requirement",
    async (id, requirement) => {
      vi.mocked(judgeLive).mockClear();
      const evalCase = caseWithJudge(id);
      const observation =
        id.includes("created") || id.includes("approved")
          ? createdObservation()
          : preparedObservation();
      await evalCase.judge?.(observation);
      const input = lastJudgeInput();
      expect(input.rubric.map((item) => item.requirement).join("\n")).toContain(
        requirement,
      );
      expect(input.knownFacts).toContain("valuesDigest");
    },
  );
  it("grounding judge receives captured results without granting unobserved commit evidence", async () => {
    const evalCase = caseWithJudge("preview-awaits-approval");
    await evalCase.judge?.(preparedObservation());
    expect(lastJudgeInput().knownFacts).toContain(
      "require a retained source/tool result",
    );
  });
});
