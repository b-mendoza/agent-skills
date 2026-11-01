import assert from "node:assert/strict";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileExists,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const PROMPT_FACTS = {
  path: "prompt.txt",
  source:
    "Summarize each supplied customer comment in exactly one sentence. " +
    "Keep the product name MarbleDB verbatim. Return the summaries in input order. " +
    "If there are no comments, return No comments.\n",
} as const;

const SKILL = "prompt-structurer";
const SKIPPED_PASSES = ["2", "3", "4", "5"] as const;
const suiteDefaults = {
  ...behavioralDefaults,
  mutationPolicy: "read-only",
  snapshotPaths: [PROMPT_FACTS.path],
} as const;

function seedPrompt({ repoPath }: SeedContext): void {
  commitRepoFiles(
    repoPath,
    { [PROMPT_FACTS.path]: PROMPT_FACTS.source },
    "seed source prompt",
  );
}

function assertSourceIntact(observation: Observation): void {
  assertNoMutation(observation);
  assertFileExists(observation, PROMPT_FACTS.path);
  assert.equal(
    observation.repoFiles?.[PROMPT_FACTS.path],
    PROMPT_FACTS.source,
    "source prompt was changed",
  );
}

function assertXmlCharacter(reference: string): void {
  const codePoint = Number(reference.replace(/^#x/, "0x").replace(/^#/, ""));
  assert.match(
    String.fromCodePoint(codePoint),
    /^[\t\n\r\x20-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]$/u,
    "invalid XML character reference",
  );
}

function assertXmlReferences(text: string): void {
  const references =
    /&(?:amp|lt|gt|quot|apos|(?<character>#(?:\d+|x[\da-fA-F]+)));|&/g;
  for (const match of text.matchAll(references)) {
    const [reference] = match;
    assert.notEqual(
      reference,
      "&",
      "invalid XML entity or character reference",
    );
    const character = match.groups?.["character"];
    if (character !== undefined) {
      assertXmlCharacter(character);
    }
  }
}

function assertXmlAttributes(text: string): void {
  const attribute =
    /^[ \t\r\n]+(?<name>[a-z_][\w.:-]*)[ \t\r\n]*=[ \t\r\n]*(?:"[^"<]*"|'[^'<]*')/i;
  const names = new Set<string>();
  let remaining = text;
  while (!/^[ \t\r\n]*$/.test(remaining)) {
    const match = attribute.exec(remaining);
    assert.ok(match?.groups !== undefined, "malformed XML attribute");
    const { name } = match.groups;
    assert.ok(name !== undefined, "missing XML attribute name");
    assert.ok(!names.has(name), "duplicate XML attribute");
    names.add(name);
    const [token] = match;
    remaining = remaining.slice(token.length);
  }
}

function assertXmlTag(token: string, stack: string[]): void {
  const tag =
    /^<(?<closing>\/?)(?<name>[a-z_][\w.:-]*)(?<attributes>(?:[ \t\r\n/][^]*)?)>$/i.exec(
      token,
    );
  assert.ok(tag?.groups !== undefined, "malformed XML tag");
  const { name, closing, attributes } = tag.groups;
  assert.ok(name !== undefined, "missing XML tag name");
  assert.ok(attributes !== undefined, "missing XML attributes");
  if (closing === "/") {
    assert.match(
      token,
      /^<\/[a-z_][\w.:-]*\s*>$/i,
      "malformed XML closing tag",
    );
    assert.equal(stack.pop(), name, "mismatched XML closing tag");
  } else {
    assertXmlAttributes(attributes.replace(/\/$/, ""));
    if (!token.endsWith("/>")) {
      stack.push(name);
    }
  }
}

function assertBalancedXml(xml: string): void {
  // A synthetic root permits sibling elements without accepting stray closings.
  const root = "#root";
  const stack = [root];
  const nonElements = /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|<\?[^]*?\?>/;
  const elements = /<(?:[^<>"']|"[^"]*"|'[^']*')*>|</;
  const tokens = new RegExp(
    `(?<ignored>${nonElements.source})|(?<element>${elements.source})|[^<]+`,
    "g",
  );
  for (const match of xml.matchAll(tokens)) {
    const [token] = match;
    assert.ok(match.groups !== undefined, "missing XML token groups");
    const { ignored, element } = match.groups;
    if (ignored !== undefined) {
      continue;
    }
    assertXmlReferences(token);
    if (element !== undefined) {
      assertXmlTag(token, stack);
    }
  }
  assert.deepEqual(stack, [root], "unclosed XML element");
}

function extractPromptXml(text: string): string {
  const fenced = /^```xml[^\S\r\n]*\r?\n(?<xml>[^]*?)\r?\n```/i.exec(text);
  if (fenced !== null) {
    assert.ok(fenced.groups !== undefined);
    return fenced.groups["xml"] ?? "";
  }
  const [beforeNotes = ""] = text.split(
    /^(?:#{1,6}\s+|\*\*)Assembly Notes(?:\*\*)?\s*$/im,
  );
  return beforeNotes.trim();
}

function assertXmlFirst(text: string): void {
  assert.match(
    text,
    /^(?:```xml\s*\n)?<[a-z_][\w.-]*(?:\s[^<>]*)?>/i,
    "XML must precede prose notes",
  );
  const xml = extractPromptXml(text);
  assertBalancedXml(xml);
  const task = /<task\b[^>]*>(?<content>[^]*?)<\/task>/i.exec(xml);
  assert.ok(task !== null, "missing closed task element");
  const content = task.groups?.["content"] ?? "";
  assert.notEqual(content.trim(), "", "task element is empty");
}

function checkStructuredPrompt(observation: Observation): string {
  assertSourceIntact(observation);
  const rawText = observation.finalText.trim();
  assertNoPublicStatusLine(rawText, "RESULT", "Result", "Status");
  const text = normalizeReplyText(rawText);
  assert.doesNotMatch(text, /^(?:PASS|BLOCKED|FAIL|ERROR|REPAIR_NEEDED)\s*$/im);
  assertXmlFirst(rawText);
  assert.match(text, /^Assembly Notes\s*$/im, "missing assembly notes");
  assert.match(
    text,
    /\blight\b/i,
    "this one-shot prompt should use the light route",
  );
  assert.match(text, /OMITTED_PASS_REASON/, "missing skipped-pass disclosure");
  for (const pass of SKIPPED_PASSES) {
    assert.ok(
      text
        .split("\n")
        .some(
          (line) =>
            /OMITTED_PASS_REASON|\bPass(?:es)?\b/i.test(line) &&
            /:\s*\S/.test(line) &&
            new RegExp(`\\b${pass}\\b`).test(line),
        ),
      `missing reason for skipped pass ${pass}`,
    );
  }
  for (const disclosure of [
    /Resources Used/i,
    /Dispatch\b/i,
    /Handoff\b/i,
    /Removal[ -]Test/i,
  ]) {
    assert.match(text, disclosure, "missing assembly disclosure");
  }

  return "XML first, light-route disclosures, and unchanged source";
}

function checkMissingBaseline(observation: Observation): string {
  assertSourceIntact(observation);
  const text = observation.finalText;
  assertNoPublicStatusLine(text, "RESULT", "Result", "Status");
  assert.doesNotMatch(
    normalizeReplyText(text),
    /^(?:PASS|BLOCKED|FAIL|ERROR|REPAIR_NEEDED)\s*$/im,
  );
  assert.ok(
    replyAsksFor(
      text,
      /(?:existing|original|baseline).*?(?:XML|structured)|(?:XML|structured).*?(?:existing|original|baseline)/i,
    ),
    "request the existing XML baseline",
  );
  assert.doesNotMatch(
    text,
    /<task\b/i,
    "prose was substituted for the missing XML baseline",
  );

  return "revision blocked pending the existing XML prompt";
}

export const cases = [
  {
    id: "prompt-structurer/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent:
      "A request to turn prose instructions into XML triggers the structurer",
    prompt: () =>
      "Turn this prompt into a compact XML contract: summarize each customer comment in one sentence and preserve the original order.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // validate-implementation-plan owns audits of an existing implementation plan.
    id: "prompt-structurer/trigger-negative-plan-audit",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["validate-implementation-plan"],
    intent: "Auditing plan traceability is not prompt conversion",
    prompt: () =>
      "Audit docs/export-plan.md against the requirement to export only my active tasks. Find missing requirements and unnecessary complexity, and write a standalone audit without changing the plan.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "prompt-structurer/structure-prose",
    ...suiteDefaults,
    skill: SKILL,
    intent:
      "A short prose source becomes conversational XML without execution or file writes",
    seed: seedPrompt,
    prompt: () =>
      "Use prompt-structurer on PROMPT_TEXT in prompt.txt. Return the structured contract in chat, not a file. This is prompt conversion only, not a request to run the resulting instructions.",
    check: checkStructuredPrompt,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The entire source prompt is: ${PROMPT_FACTS.source} No comments were supplied to execute it on. There is no output file target or autonomous run request.`,
        rubric: [
          {
            id: "source-coverage",
            requirement:
              "The XML preserves one sentence per customer comment, the exact product name MarbleDB, input order, and the exact empty-input response No comments.",
          },
          {
            id: "conversion-not-execution",
            requirement:
              "The answer structures the source rather than running its summarization task; it introduces no new agents, external services, file writes, or unrelated requirements.",
          },
          {
            id: "removal-test",
            requirement:
              "Assembly notes explain the behavioral purpose of the emitted tags and give a reason for omitting each of passes 2 through 5.",
          },
        ],
      }),
  },
  {
    id: "prompt-structurer/revision-missing-baseline",
    ...suiteDefaults,
    skill: SKILL,
    intent:
      "A revision cannot use prose as a substitute for missing existing XML",
    seed: seedPrompt,
    prompt: () =>
      "Use prompt-structurer in revision mode. CHANGE_REQUEST: change the output format to a Markdown table. The original prose is in prompt.txt, but I do not have the existing structured XML prompt in this session.",
    check: checkMissingBaseline,
  },
] as const satisfies readonly EvalCase[];
