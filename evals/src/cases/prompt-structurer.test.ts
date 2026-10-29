import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/prompt-structurer.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const skill = "prompt-structurer";
const structuredPrompt = `<task>Summarize each customer comment in one sentence.</task>
<output>Keep MarbleDB verbatim, retain input order, and return No comments for empty input.</output>
<success_criteria>One sentence per comment, in input order.</success_criteria>

## Assembly Notes
Flow: light, a short one-shot text transformation.
OMITTED_PASS_REASON: passes 2, 3, 4, 5 add no needed behavior.
Omissions: no unrelated sections. Assumptions: none. Suite alignment: none.
Resources Used: LOCAL_ONLY; semantic-decomposer, xml-prompt-assembler, template-skeleton.
Dispatch: inline fallback. Handoff: inline named sections.
Removal-test summary: task establishes work, output states formatting, success_criteria verifies it.
Follow-ups: none.
PASS`;

function getCase(suffix: string): EvalCase {
  const evalCase = cases.find(
    (candidate) => candidate.id === `${skill}/${suffix}`,
  );
  assert.ok(evalCase !== undefined, `Missing eval case: ${suffix}`);
  return evalCase;
}

function behavioralObservation(suffix: string, finalText: string): Observation {
  const evalCase = getCase(suffix);
  const fixture = makeFixture("clean", [], evalCase.seed);
  try {
    return createObservation({
      finalText,
      repoFiles: snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths ?? []),
    });
  } finally {
    fixture.cleanup();
  }
}

const blockedText =
  "BLOCKED\nPlease provide the existing structured XML prompt so I can apply the change request?";

describe("prompt-structurer routing", () => {
  test("invocation is required for a positive trigger", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  test("plan audits belong to the sibling rather than the structurer", () => {
    const evalCase = getCase("trigger-negative-plan-audit");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).toThrow();
  });
});

describe("prompt-structurer behavior", () => {
  test("seeds the source prompt without dirtying the fixture", () => {
    const fixture = makeFixture("clean", [], getCase("structure-prose").seed);
    try {
      expect(readFileSync(join(fixture.cwd, "prompt.txt"), "utf8")).toContain(
        "MarbleDB",
      );
      expect(readFileSync(join(fixture.cwd, "prompt.txt"), "utf8")).toContain(
        "No comments",
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("accepts XML followed by disclosed assembly notes", () => {
    expect(() =>
      getCase("structure-prose").check(
        behavioralObservation("structure-prose", structuredPrompt),
      ),
    ).not.toThrow();
  });

  test.each([
    [
      "an XML fence",
      structuredPrompt
        .replace(/^/, "```xml\n")
        .replace("\n\n##", "\n```\n\n##"),
    ],
    [
      "nested and self-closing elements, comments, CDATA, and instructions",
      structuredPrompt.replace(
        "<output>",
        '<output format="a > b"><rule /><rule>Keep names.</rule><!-- <ignored> --><![CDATA[<literal>]]><?hint <ignored>?>',
      ),
    ],
    ["XML-like prose in notes", `${structuredPrompt}\nDiscuss <output> here.`],
  ])("accepts %s", (_label, finalText) => {
    expect(() =>
      getCase("structure-prose").check(
        behavioralObservation("structure-prose", finalText),
      ),
    ).not.toThrow();
  });

  test.each([
    ["plain prose instead of XML", "Here is your improved prompt."],
    ["prose before XML", `Here is the contract:\n${structuredPrompt}`],
    ["an unclosed task", structuredPrompt.replace("</task>", "")],
    ["an unclosed output", structuredPrompt.replace("</output>", "")],
    [
      "a mismatched output tag",
      structuredPrompt.replace("</output>", "</format>"),
    ],
    [
      "an unclosed output inside an XML fence",
      structuredPrompt
        .replace(/^/, "```xml\n")
        .replace("</output>", "")
        .replace("\n\n##", "\n```\n\n##"),
    ],
    [
      "no assembly notes",
      structuredPrompt.replace(/## Assembly Notes[^]*/, ""),
    ],
    [
      "missing resource disclosure",
      structuredPrompt.replace("Resources Used:", "Sources:"),
    ],
    [
      "missing omitted-pass reasons",
      structuredPrompt.replace("OMITTED_PASS_REASON:", "Skipped:"),
    ],
    ["internal pass status leaked", `${structuredPrompt}\nRESULT: PASS`],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("structure-prose").check(
        behavioralObservation("structure-prose", finalText),
      ),
    ).toThrow();
  });

  test("blocks a revision without substituting prose for existing XML", () => {
    expect(() =>
      getCase("revision-missing-baseline").check(
        behavioralObservation("revision-missing-baseline", blockedText),
      ),
    ).not.toThrow();
  });

  test.each([
    ["no blocked status", "Please provide the existing XML prompt?"],
    ["no baseline question", "BLOCKED\nI cannot continue."],
    [
      "fabricated replacement",
      `${blockedText}\n<task>Invented replacement</task>`,
    ],
    ["contradictory success", `${blockedText}\nPASS`],
  ])("rejects a revision with %s", (_label, finalText) => {
    expect(() =>
      getCase("revision-missing-baseline").check(
        behavioralObservation("revision-missing-baseline", finalText),
      ),
    ).toThrow();
  });

  test.each([
    ["structure-prose", structuredPrompt],
    ["revision-missing-baseline", blockedText],
  ])(
    "%s rejects source edits, extra writes, and invalid runs",
    (suffix, finalText) => {
      const observation = behavioralObservation(suffix, finalText);
      const evalCase = getCase(suffix);
      expect(() =>
        evalCase.check({
          ...observation,
          repoFiles: { "prompt.txt": "rewritten" },
        }),
      ).toThrow();
      expect(() =>
        evalCase.check({
          ...observation,
          toolCalls: [
            { name: "Write", input: { file_path: "other.xml", content: "x" } },
          ],
        }),
      ).toThrow();
      expect(() =>
        evalCase.check({
          ...observation,
          gitStatusAfter: { kind: "worktree", entries: "?? other.xml" },
        }),
      ).toThrow();
      expect(() =>
        evalCase.check({ ...observation, timedOut: true }),
      ).toThrow();
    },
  );
});
