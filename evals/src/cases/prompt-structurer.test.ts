import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { PROMPT_FACTS } from "#/cases/prompt-structurer.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
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
Follow-ups: none.`;

function getCase(suffix: string) {
  return getRegisteredCase(`${skill}/${suffix}`);
}

/** Both behavioral cases seed and capture only the source prompt. */
function behavioralObservation(finalText: string): Observation {
  return createObservation({
    finalText,
    repoFiles: { [PROMPT_FACTS.path]: PROMPT_FACTS.source },
  });
}

const blockedText =
  "I cannot revise the prompt without its baseline. Please provide the existing structured XML prompt so I can apply the change request.";

describe("prompt-structurer behavior", () => {
  test.each(["structure-prose", "revision-missing-baseline"])(
    "%s seeds and captures exactly the source prompt",
    (suffix) => {
      const evalCase = getCase(suffix);
      const fixture = makeFixture("clean", [], evalCase.seed);
      try {
        expect(
          snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths ?? []),
        ).toStrictEqual({ [PROMPT_FACTS.path]: PROMPT_FACTS.source });
      } finally {
        fixture.cleanup();
      }
    },
  );

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
      getCase("structure-prose").check(behavioralObservation(structuredPrompt)),
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
    [
      "quoted attributes with whitespace and case-sensitive names",
      structuredPrompt.replace(
        "<task>",
        "<task priority = \"high\" Priority='' >",
      ),
    ],
    [
      "entity and character references in text and attributes",
      structuredPrompt.replace(
        "<task>",
        '<task label="&amp; &#38; &#x26;">&lt; &gt; &quot; &apos; &#9; &#x1F600; ',
      ),
    ],
    [
      "raw ampersands inside comments, CDATA, and instructions",
      structuredPrompt.replace(
        "<output>",
        "<output><!-- A & B --><![CDATA[A & B]]><?hint A & B?>",
      ),
    ],
    ["XML-like prose in notes", `${structuredPrompt}\nDiscuss <output> here.`],
    [
      "fenced XML with bold notes and tag mentions",
      `${structuredPrompt.replace(/^/, "```xml\n").replace("\n\n## Assembly Notes", "\n```\n\n**Assembly notes**")}\nDiscuss <task> here.`,
    ],
    [
      "a shared skipped-pass reason heading",
      structuredPrompt.replace(
        "OMITTED_PASS_REASON: passes 2, 3, 4, 5 add no needed behavior.",
        "Skipped passes (OMITTED_PASS_REASON):\nPass 2: no philosophy.\nPass 3: empty input is explicit.\nPass 4: no prior failures.\nPass 5: source criteria are explicit.",
      ),
    ],
    [
      "pass numbers before omitted reason",
      structuredPrompt.replace(
        "OMITTED_PASS_REASON: passes 2, 3, 4, 5 add no needed behavior.",
        "Passes 2, 3, 4, 5, OMITTED_PASS_REASON: add no needed behavior.",
      ),
    ],
  ])("accepts %s", (_label, finalText) => {
    expect(() =>
      getCase("structure-prose").check(behavioralObservation(finalText)),
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
    [
      "formatted internal status leaked",
      `${structuredPrompt}\n**RESULT: PASS**`,
    ],
    ["standalone pass status", `${structuredPrompt}\nPASS`],
    ["title-case result envelope", `${structuredPrompt}\n**Result:** PASS.`],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("structure-prose").check(behavioralObservation(finalText)),
    ).toThrow();
  });

  test.each([
    ["a valueless attribute", "<task priority>"],
    ["an unquoted attribute value", "<task priority=high>"],
    ["an attribute missing its value", "<task priority=>"],
    ["duplicate attributes", "<task priority=\"high\" priority='low'>"],
    ["attributes without separating whitespace", '<task a="1"b="2">'],
    ["a valueless attribute on a self-closing tag", "<task><rule priority />"],
    ["a bare ampersand in text", "<task>A & B "],
    ["a bare ampersand in an attribute", '<task label="A & B">'],
    ["an unknown entity", "<task>&unknown; "],
    ["an entity missing its semicolon", "<task>&amp "],
    ["an invalid decimal reference", "<task>&#NN; "],
    ["an invalid hexadecimal reference", "<task>&#xHH; "],
    ["a reference to a null character", "<task>&#0; "],
    ["a reference to a surrogate", "<task>&#xD800; "],
    ["a reference beyond Unicode", "<task>&#x110000; "],
  ])("rejects XML with %s", (_label, opening) => {
    expect(() =>
      getCase("structure-prose").check(
        behavioralObservation(structuredPrompt.replace("<task>", opening)),
      ),
    ).toThrow();
  });

  test("blocks a revision without substituting prose for existing XML", () => {
    expect(() =>
      getCase("revision-missing-baseline").check(
        behavioralObservation(blockedText),
      ),
    ).not.toThrow();
  });

  test.each([
    ["old blocked status", `BLOCKED\n${blockedText}`],
    ["no baseline question", "BLOCKED\nI cannot continue."],
    [
      "fabricated replacement",
      `${blockedText}\n<task>Invented replacement</task>`,
    ],
    ["contradictory success", `${blockedText}\nPASS`],
  ])("rejects a revision with %s", (_label, finalText) => {
    expect(() =>
      getCase("revision-missing-baseline").check(
        behavioralObservation(finalText),
      ),
    ).toThrow();
  });

  test.each([
    ["structure-prose", structuredPrompt],
    ["revision-missing-baseline", blockedText],
  ])("%s rejects source edits and extra writes", (suffix, finalText) => {
    const observation = behavioralObservation(finalText);
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
  });
});
