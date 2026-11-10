import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  ARGS_LOG,
  COVERING_ISSUE,
  CREATED_ISSUES,
  FACTS,
  IMPROVEMENT,
  seedReportingFixture,
  SKILL,
} from "#/cases/reporting-skill-issues-fixtures.ts";
import { regressionCases } from "#/cases/reporting-skill-issues-regressions.ts";
import {
  approvedObservation,
  BODIES,
  changePreview,
  CREATE_ARGS,
  CREATE_PREFLIGHT,
  createCommand,
  DEFECT_BODY,
  EXISTING,
  existingObservation,
  FIRST_INDEX,
  IMPROVEMENT_BODY,
  jsonLines,
  PDF_SEARCH,
  PREVIEW,
  READ_PREFLIGHT,
  RECORDS,
  SEARCH,
  SECOND_INDEX,
  TITLES,
  URLS,
  VIEW,
} from "#/cases/reporting-skill-issues-test-support.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SUCCESS_EXIT = 0;
const semanticPreviewLabels = new Set([
  "missing retained request",
  "missing loaded definition",
  "invented reproduction",
  "invented failed export",
  "no current approval choice",
  "wrong revise vocabulary",
  "waiver not disclosed",
  "no posting account",
]);

const [batchCase, existingCase] = regressionCases;
const [approveBatch] = batchCase.followUps;
const [overrideExisting] = existingCase.followUps;

describe("one approval for the complete defect and improvement batch", () => {
  test("accepts exact post-approval payloads and sends one named approval", () => {
    const observation = approvedObservation();
    expect(() => batchCase.check(observation)).not.toThrow();
    expect(
      approveBatch.reply(createObservation({ finalText: PREVIEW })),
    ).toEqual({ reply: "APPROVED" });
  });
  test("accepts a complete preview with each body shown only inside its command", () => {
    const preview = PREVIEW.replace(`Body:\n${DEFECT_BODY}`, "").replace(
      `Body:\n${IMPROVEMENT_BODY}`,
      "",
    );
    expect(
      approveBatch.reply(createObservation({ finalText: preview })),
    ).toEqual({ reply: "APPROVED" });
    expect(() => batchCase.check(changePreview(preview))).not.toThrow();
  });
  test("accepts matching fenced body and command displays", () => {
    const command = createCommand(TITLES[FIRST_INDEX] ?? "", DEFECT_BODY);
    const preview = PREVIEW.replace(
      `Body:\n${DEFECT_BODY}`,
      `Body:\n\`\`\`\`markdown\n${DEFECT_BODY}\`\`\`\`\n`,
    ).replace(
      `Command:\n${command}`,
      `Command:\n\`\`\`sh\n${command}\n\`\`\`\n`,
    );
    expect(
      approveBatch.reply(createObservation({ finalText: preview })),
    ).toEqual({ reply: "APPROVED" });
    expect(() => batchCase.check(changePreview(preview))).not.toThrow();
  });
  const previewVariants = [
    [
      "conflicting displayed body",
      PREVIEW.replace(
        `Body:\n${DEFECT_BODY}`,
        "Body:\nThis is the public body you are approving.\n",
      ),
    ],
    [
      "conflicting displayed title",
      PREVIEW.replace(
        `Title: ${TITLES[FIRST_INDEX]}`,
        "Title: [generate-handoff-document] Another title",
      ),
    ],
    [
      "conflicting second displayed body",
      PREVIEW.replace(
        `Body:\n${IMPROVEMENT_BODY}`,
        "Body:\nA different public improvement request.\n",
      ),
    ],
    [
      "conflicting second displayed title",
      PREVIEW.replace(
        `Title: ${TITLES[SECOND_INDEX]}`,
        "Title: [generate-handoff-document] Improvement request: Different outcome",
      ),
    ],
    [
      "only one previewed issue",
      PREVIEW.replace(
        createCommand(TITLES[SECOND_INDEX] ?? "", IMPROVEMENT_BODY),
        "omitted command",
      ),
    ],
    [
      "wrong improvement title",
      PREVIEW.replaceAll("Improvement request: ", "Bug: "),
    ],
    ...[
      "Request",
      "Definition gap",
      "Desired outcome",
      "Why it helps",
      "Skill",
      "Evidence",
      "Impact",
      "Redactions",
    ].map((heading) => [
      `missing ${heading}`,
      PREVIEW.replaceAll(`## ${heading}\n`, "## Omitted\n"),
    ]),
    [
      "missing retained request",
      PREVIEW.replaceAll(IMPROVEMENT.request, "invented user request"),
    ],
    [
      "missing loaded definition",
      PREVIEW.replaceAll(IMPROVEMENT.definition, "invented definition"),
    ],
    [
      "invented reproduction",
      PREVIEW.replaceAll(
        "## Definition gap",
        "## Steps to reproduce\nRan the export\n## Definition gap",
      ),
    ],
    [
      "invented failed export",
      PREVIEW.replaceAll("PDF export for reviewers", "PDF export failed"),
    ],
    ["no current approval choice", PREVIEW.replaceAll("APPROVED", "YES")],
    [
      "wrong revise vocabulary",
      PREVIEW.replaceAll("REVISE: <changes>", "REVISE"),
    ],
    [
      "waiver not disclosed",
      PREVIEW.replace("The permission waiver was ignored.", ""),
    ],
    ["no posting account", PREVIEW.replace(FACTS.login, "")],
    [
      "wrong destination",
      PREVIEW.replaceAll(
        "--repo b-mendoza/agent-skills",
        "--repo other/repository",
      ),
    ],
    [
      "no complete literal body",
      PREVIEW.replaceAll("<<'ISSUE_BODY'", "<<ISSUE_BODY"),
    ],
  ];
  test.each(
    previewVariants.filter(
      ([label]) => !semanticPreviewLabels.has(label ?? ""),
    ),
  )("rejects %s before approval is sent", (_label, preview) => {
    expect(() => batchCase.check(changePreview(preview))).toThrow();
    expect(
      approveBatch.reply(createObservation({ finalText: preview })),
    ).toHaveProperty("gateNotReached");
  });
  test.each(
    previewVariants.filter(([label]) => semanticPreviewLabels.has(label ?? "")),
  )(
    "leaves %s to the semantic judge, not the approval gate",
    (_label, preview) => {
      expect(
        approveBatch.reply(createObservation({ finalText: preview })),
      ).toEqual({ reply: "APPROVED" });
    },
  );
  test.each([
    ["missing creation", RECORDS.slice(FIRST_INDEX, SECOND_INDEX)],
    ["duplicate creation", [...RECORDS, RECORDS[FIRST_INDEX]]],
    [
      "changed body",
      RECORDS.map(([title, body, url]) => [
        title,
        `${body ?? ""}changed\n`,
        url,
      ]),
    ],
    [
      "changed title",
      RECORDS.map(([, body, url]) => ["wrong title", body, url]),
    ],
    ["reordered batch", [...RECORDS].reverse()],
    [
      "missing receipt",
      RECORDS.map(([title, body]) => [
        title,
        body,
        "https://example.org/receipt",
      ]),
    ],
  ])("rejects %s in the fake create ledger", (_label, records) => {
    const observation = approvedObservation();
    expect(() =>
      batchCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [CREATED_ISSUES]: jsonLines(records),
        },
      }),
    ).toThrow();
  });
  test("rejects creating before the scripted reply, even with unchanged git status", () => {
    const observation = approvedObservation();
    const [, approved] = observation.turns ?? [];
    assert.ok(approved !== undefined);
    expect(() =>
      batchCase.check({
        ...observation,
        turns: [
          createTurn({
            finalText: PREVIEW,
            toolCalls: approved.toolCalls,
          }),
          approved,
        ],
      }),
    ).toThrow();
    expect(
      approveBatch.reply(
        createObservation({
          finalText: PREVIEW,
          toolCalls: approved.toolCalls,
        }),
      ),
    ).toHaveProperty("gateNotReached");
  });
  test("rejects a host permission card or absent approval as consent", () => {
    const observation = approvedObservation();
    const turns = observation.turns?.map((turn) => ({
      ...turn,
      prompt: "Host permission allowed gh",
    }));
    expect(() => batchCase.check({ ...observation, turns })).toThrow();
  });
  test("defers reapproval prose to the judge but rejects local writes after approval", () => {
    const observation = approvedObservation();
    const turns = observation.turns?.map((turn) =>
      turn.prompt === "APPROVED"
        ? {
            ...turn,
            finalText: `${turn.finalText}\nPlease choose APPROVED for the next issue.`,
          }
        : turn,
    );
    expect(() => batchCase.check({ ...observation, turns })).not.toThrow();
    expect(() =>
      batchCase.check({
        ...observation,
        toolCalls: [{ name: "Write", input: { file_path: "draft.md" } }],
      }),
    ).toThrow();
  });
  test("rejects an unlogged create or unrelated remote write", () => {
    const observation = approvedObservation();
    for (const calls of [
      [SEARCH, PDF_SEARCH, ...CREATE_ARGS.slice(FIRST_INDEX, SECOND_INDEX)],
      [SEARCH, PDF_SEARCH, ...CREATE_ARGS, ["issue", "comment", "17"]],
      [...CREATE_ARGS, SEARCH, PDF_SEARCH],
      [SEARCH, ...CREATE_ARGS],
    ]) {
      expect(() =>
        batchCase.check({
          ...observation,
          repoFiles: {
            ...observation.repoFiles,
            [ARGS_LOG]: jsonLines([
              ...READ_PREFLIGHT,
              CREATE_PREFLIGHT,
              ...calls,
            ]),
          },
        }),
      ).toThrow();
    }
  });
});

describe("covering issue remains existing despite an override", () => {
  test("accepts a searched and fully read covering issue with no new draft", () => {
    expect(() => existingCase.check(existingObservation())).not.toThrow();
    expect(
      overrideExisting.reply(createObservation({ finalText: EXISTING })),
    ).toHaveProperty("reply");
  });
  test.each([
    ["no search", [VIEW]],
    ["no full candidate read", [SEARCH]],
    [
      "wrong candidate",
      [SEARCH, VIEW.map((arg) => (arg === "17" ? "18" : arg))],
    ],
    [
      "no candidate body",
      [
        SEARCH,
        VIEW.map((arg) =>
          arg === "number,title,body,url,state,stateReason" ? "title,url" : arg,
        ),
      ],
    ],
    [
      "only open-state search",
      [SEARCH.map((arg) => (arg === "all" ? "open" : arg)), VIEW],
    ],
    [
      "unbounded search",
      [SEARCH.map((arg) => (arg === "20" ? "200" : arg)), VIEW],
    ],
    ["excessive queries", [SEARCH, SEARCH, SEARCH, VIEW]],
    [
      "private query",
      [
        SEARCH.map((arg) =>
          arg === "generate-handoff-document backup"
            ? "generate-handoff-document docs/private.txt"
            : arg,
        ),
        VIEW,
      ],
    ],
    ["created anyway", [SEARCH, VIEW, CREATE_ARGS[FIRST_INDEX]]],
    [
      "edited existing issue",
      [
        SEARCH,
        VIEW,
        ["issue", "edit", "17", "--repo", "b-mendoza/agent-skills"],
      ],
    ],
    [
      "wrong repository",
      [
        SEARCH.map((arg) =>
          arg === "b-mendoza/agent-skills" ? "other/repo" : arg,
        ),
        VIEW,
      ],
    ],
  ])("rejects %s", (_label, calls) => {
    const observation = existingObservation();
    expect(() =>
      existingCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [ARGS_LOG]: jsonLines([...READ_PREFLIGHT, ...calls]),
        },
      }),
    ).toThrow();
  });
  test.each([
    ["missing covering URL", EXISTING.replace(COVERING_ISSUE.url, "no URL")],
    ["new draft instead of existing", `${EXISTING}\nTitle: new issue`],
    ["relabels clear coverage", `${EXISTING}\nThis is a possible duplicate.`],
  ])("leaves %s to the semantic judge", (_label, finalText) => {
    const observation = existingObservation();
    const [initial, ...later] = observation.turns ?? [];
    assert.ok(initial !== undefined);
    expect(() =>
      existingCase.check({
        ...observation,
        turns: [{ ...initial, finalText }, ...later],
      }),
    ).not.toThrow();
    expect(
      overrideExisting.reply(createObservation({ finalText })),
    ).toHaveProperty("reply");
  });
  test("rejects an actual created record despite reassuring final text", () => {
    const observation = existingObservation();
    expect(() =>
      existingCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [CREATED_ISSUES]: jsonLines(RECORDS),
        },
      }),
    ).toThrow();
  });
});

test("fake gh records each body, serves a full covering candidate, and never forwards unsupported calls", () => {
  const fixture = makeFixture("clean", [SKILL], (context) => {
    seedReportingFixture(context, { coveringIssue: COVERING_ISSUE });
  });
  const cli = join(fixture.binPath, "gh");
  const invoke = (args: string[], input = "") =>
    execFileSync(cli, args, { cwd: fixture.cwd, input, encoding: "utf8" });
  try {
    const { body, ...summary } = COVERING_ISSUE;
    expect(JSON.parse(invoke(SEARCH))).toEqual([summary]);
    expect(JSON.parse(invoke(VIEW))).toEqual({ ...summary, body });
    CREATE_ARGS.forEach((args, index) => {
      expect(invoke(args, BODIES[index]).trim()).toBe(URLS[index]);
    });
    expect(readFileSync(join(fixture.cwd, CREATED_ISSUES), "utf8")).toBe(
      jsonLines(RECORDS),
    );
    for (const args of [
      ["issue", "edit", "17"],
      ["api", "user", "-f", "title=no"],
      ["issue", "create", "--repo", "other/repo"],
    ]) {
      expect(spawnSync(cli, args, { cwd: fixture.cwd }).status).not.toBe(
        SUCCESS_EXIT,
      );
    }
  } finally {
    fixture.cleanup();
  }
});
