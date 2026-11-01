import assert from "node:assert/strict";

import { describe, expect, test } from "vitest";

import { minimizeReply, outcomeOf } from "#/cases/minimize-reply.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function requireText(pattern: RegExp, message: string) {
  return (observation: Observation) => {
    if (!pattern.test(observation.finalText)) throw new Error(message);
    return "ok";
  };
}

const currentCheck = requireText(/Which option\?/, "missing question");
const contrastCheck = (observation: Observation) => {
  if (observation.finalText.includes("not a string")) {
    throw new Error("old check rejects the type explanation");
  }
  return "ok";
};

const REPLY = [
  "I stopped before editing.",
  "The pinned 7 is not a string. Rejecting it changes behavior.",
  "",
  "Which option? Pick one.",
  "Thanks for reading.",
].join("\n");

describe("outcomeOf", () => {
  test("reports the returned outcome or the exact thrown message", () => {
    expect(
      outcomeOf(currentCheck, createObservation({ finalText: REPLY })),
    ).toBe("pass:ok");
    expect(outcomeOf(currentCheck, createObservation())).toBe(
      "fail:missing question",
    );
  });

  test("drops the reply that a generated match message echoes", () => {
    const check = (observation: Observation) => {
      assert.match(observation.finalText, /NEEDS_INPUT/);
      return "ok";
    };
    expect(outcomeOf(check, createObservation({ finalText: REPLY }))).toBe(
      "fail:match /NEEDS_INPUT/",
    );
  });
});

describe("minimizeReply", () => {
  test("keeps a failing reply failing with the same message", () => {
    const result = minimizeReply({
      check: requireText(/Which deadline\?/, "missing deadline"),
      observation: createObservation({ finalText: REPLY }),
    });
    expect(result).toStrictEqual({
      finalText: "I stopped before editing.",
      outcome: "fail:missing deadline",
      linesBefore: 5,
      linesAfter: 1,
    });
  });

  test("keeps the contrast-triggering sentence of a passing reply, in order", () => {
    const result = minimizeReply({
      check: currentCheck,
      contrastCheck,
      observation: createObservation({ finalText: REPLY }),
    });
    expect(result).toStrictEqual({
      finalText: "The pinned 7 is not a string. \nWhich option? ",
      outcome: "pass:ok",
      contrastOutcome: "fail:old check rejects the type explanation",
      linesBefore: 5,
      linesAfter: 2,
    });
  });

  test.each(["  ", "\t"])(
    "preserves verbatim sentence separators in a passing reply with %j",
    (separator) => {
      const reply = `I will restore the guard.${separator}I will add coverage.`;
      const check = (observation: Observation) => {
        if (!observation.finalText.includes(reply)) {
          throw new Error("approval preview differs from the report reply");
        }
        return "ok";
      };
      const observation = createObservation({
        finalText: `Unneeded introduction.\n${reply}\nUnneeded conclusion.`,
      });
      const result = minimizeReply({
        check,
        contrastCheck: requireText(
          /Already fixed/,
          "old check rejects the reply",
        ),
        observation,
      });
      expect(result).toStrictEqual({
        finalText: reply,
        outcome: "pass:ok",
        contrastOutcome: "fail:old check rejects the reply",
        linesBefore: 3,
        linesAfter: 1,
      });
      expect(
        outcomeOf(check, { ...observation, finalText: result.finalText }),
      ).toBe(result.outcome);
    },
  );

  test("throws if the final reply no longer yields the target outcome", () => {
    let firstAttempt = true;
    const check = () => {
      const message = firstAttempt ? "original failure" : "changed failure";
      firstAttempt = false;
      throw new Error(message);
    };
    expect(() =>
      minimizeReply({
        check,
        observation: createObservation({ finalText: "One sentence." }),
      }),
    ).toThrow(/minimized reply does not preserve the target outcomes/);
  });

  test("keeps the branch a passing reply took, not just the pass", () => {
    const branchingCheck = (observation: Observation) =>
      observation.finalText.includes("Which option?") ? "asked" : "explained";
    const result = minimizeReply({
      check: branchingCheck,
      contrastCheck,
      observation: createObservation({ finalText: REPLY }),
    });
    expect(result.outcome).toBe("pass:asked");
    // Dropping the question still passes, as "explained"; that is rejected.
    expect(result.finalText).toBe(
      "The pinned 7 is not a string. \nWhich option? ",
    );
  });

  test("carries the other observation fields into every candidate", () => {
    const toolCalls = [{ name: "Skill", input: { skill: "x" } }];
    const toolsRequired = (observation: Observation) => {
      if (!observation.toolCalls.some((call) => call.name === "Skill")) {
        throw new Error("no tools");
      }
      return currentCheck(observation);
    };
    expect(
      minimizeReply({
        check: toolsRequired,
        contrastCheck,
        observation: createObservation({ finalText: REPLY, toolCalls }),
      }).finalText,
    ).toBe("The pinned 7 is not a string. \nWhich option? ");
  });

  test.each([
    {
      name: "no contrast",
      contrast: undefined,
      reason: /contrast check from a ref/,
    },
    { name: "a passing contrast", contrast: () => "ok", reason: /also passes/ },
  ])("refuses a passing reply with $name", ({ contrast, reason }) => {
    expect(() =>
      minimizeReply({
        check: currentCheck,
        ...(contrast === undefined ? {} : { contrastCheck: contrast }),
        observation: createObservation({ finalText: REPLY }),
      }),
    ).toThrow(reason);
  });

  test("returns identical output for identical input", () => {
    const request = {
      check: currentCheck,
      contrastCheck,
      observation: createObservation({ finalText: REPLY }),
    };
    expect(minimizeReply(request)).toStrictEqual(minimizeReply(request));
  });
});
