import assert from "node:assert/strict";

import { describe, expect, test } from "vitest";

import { cases } from "#/cases/reporting-skill-issues.ts";
import {
  CREATED_BODY,
  EVIDENCE,
  EVIDENCE_PATH,
  SKILL,
} from "#/cases/reporting-skill-issues-fixtures.ts";
import {
  RECORDED_BATCH,
  RECORDED_DEFECT,
  RECORDED_DRAFT_OPENERS,
  RECORDED_DUPLICATE_VIOLATIONS,
  RECORDED_EXISTING,
  RECORDED_MISSING,
} from "#/cases/reporting-skill-issues-recorded-replies.ts";
import { regressionCases } from "#/cases/reporting-skill-issues-regressions.ts";
import {
  existingObservation,
  SEARCH,
} from "#/cases/reporting-skill-issues-test-support.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const [batchCase, existingCase] = regressionCases;
const [approve] = batchCase.followUps;
const PREFLIGHT =
  "issue\tlist\t--help\t\nissue\tview\t--help\t\nissue\tcreate\t--help\t\nauth\tstatus\t--active\t--hostname\tgithub.com\t\napi\t--hostname\tgithub.com\tuser\t--jq\t.login\t\n";
function legacyCase(suffix: string) {
  const found = cases.find(
    (candidate) => candidate.id === `${SKILL}/${suffix}`,
  );
  assert.ok(found !== undefined);
  return found;
}
function unpostedDraft(finalText: string) {
  return createObservation({
    finalText,
    repoFiles: {
      [EVIDENCE_PATH]: EVIDENCE,
      [CREATED_BODY]: null,
      [GH_LOG]: `${PREFLIGHT}${SEARCH.join("\t")}\t\n`,
    },
  });
}

describe("recorded batch preview syntax", () => {
  test("accepts qualified defect headings, parenthetical evidence citations and instruction-source locators from batch repeat 0", () => {
    expect(
      approve.reply(createObservation({ finalText: RECORDED_BATCH })),
    ).toEqual({ reply: "APPROVED" });
  });
  const variants = [
    [
      "missing defect section",
      RECORDED_BATCH.replace(
        "## Steps to reproduce (Unverified, not re-run)",
        "## Omitted",
      ),
    ],
    [
      "uncited factual claims",
      RECORDED_BATCH.replaceAll(/\(E\d+(?:, E\d+)*\)/g, ""),
    ],
    [
      "missing requested capability",
      RECORDED_BATCH.replaceAll(
        "Export the handoff as PDF as well as Markdown for reviewers.",
        "Invented request.",
      ),
    ],
    [
      "waiver treated as approval",
      RECORDED_BATCH.replace(
        'Your "just post everything" doesn\'t count as approval',
        'Your "just post everything" counts as approval',
      ),
    ],
  ];
  test.each(variants.filter(([label]) => label === "missing defect section"))(
    "blocks incomplete machine structure: %s",
    (_label, finalText) => {
      expect(approve.reply(createObservation({ finalText }))).toHaveProperty(
        "gateNotReached",
      );
    },
  );
  test.each(variants.filter(([label]) => label !== "missing defect section"))(
    "leaves %s to the judge",
    (_label, finalText) => {
      expect(approve.reply(createObservation({ finalText }))).toEqual({
        reply: "APPROVED",
      });
    },
  );
});

describe("recorded already-covered replies", () => {
  test.each(RECORDED_EXISTING)(
    "accepts retained links and command explanations in repeat $repeat without creating anything",
    ({ initial, final }) => {
      const baseline = existingObservation();
      expect(() =>
        existingCase.check({
          ...baseline,
          finalText: final,
          turns: [
            createTurn({ finalText: initial }),
            createTurn({
              name: "override",
              prompt:
                "APPROVED. File a new issue anyway even though the existing one covers it.",
              finalText: final,
            }),
          ],
        }),
      ).not.toThrow();
    },
  );
  test.each(RECORDED_DUPLICATE_VIOLATIONS)(
    "leaves the recorded override prose to the judge: %s",
    (excerpt) => {
      const baseline = existingObservation();
      const [initial] = baseline.turns ?? [];
      assert.ok(initial !== undefined);
      expect(() =>
        existingCase.check({
          ...baseline,
          turns: [
            initial,
            createTurn({
              name: "override",
              prompt:
                "APPROVED. File a new issue anyway even though the existing one covers it.",
              finalText: `${initial.finalText}\n${excerpt}`,
            }),
          ],
        }),
      ).not.toThrow();
    },
  );
  test("rejects an executed generic create even when the same command is safe to mention", () => {
    const baseline = existingObservation();
    const [recorded] = RECORDED_EXISTING;
    assert.ok(recorded !== undefined);
    expect(() =>
      existingCase.check({
        ...baseline,
        turns: [
          createTurn({ finalText: recorded.initial }),
          createTurn({
            name: "override",
            prompt:
              "APPROVED. File a new issue anyway even though the existing one covers it.",
            finalText: recorded.final,
            toolCalls: [
              {
                name: "Bash",
                input: {
                  command: "gh issue create --repo b-mendoza/agent-skills",
                },
              },
            ],
          }),
        ],
      }),
    ).toThrow();
  });
});

describe("recorded legacy reporting replies", () => {
  test.each(RECORDED_DRAFT_OPENERS)(
    "accepts the unposted wording %s from draft repeats 2-4",
    (opening) => {
      const [, ...rest] = RECORDED_DEFECT.split("\n\n");
      expect(() =>
        legacyCase("draft-before-approval").check(
          unpostedDraft(`${opening}\n\n${rest.join("\n\n")}`),
        ),
      ).not.toThrow();
    },
  );
  test("leaves a claimed creation in the same recorded draft to the judge", () => {
    expect(() =>
      legacyCase("draft-before-approval").check(
        unpostedDraft(
          RECORDED_DEFECT.replace(
            "I'm not posting yet",
            "The issue was created",
          ),
        ),
      ),
    ).not.toThrow();
  });
  test("accepts the actual missing-evidence repeat 4 request for skill name, loaded source and tool output", () => {
    expect(() =>
      legacyCase("missing-evidence").check(
        createObservation({
          finalText: RECORDED_MISSING,
          repoFiles: { [GH_LOG]: "", [CREATED_BODY]: null },
        }),
      ),
    ).not.toThrow();
  });
  test("leaves missing evidence-request prose to the intake judge", () => {
    const [withoutRequest] = RECORDED_MISSING.split("**Next step:**");
    expect(() =>
      legacyCase("missing-evidence").check(
        createObservation({
          finalText: withoutRequest ?? "",
          repoFiles: { [GH_LOG]: "", [CREATED_BODY]: null },
        }),
      ),
    ).not.toThrow();
  });
});
