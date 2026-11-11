import { describe, expect, it } from "vitest";

import {
  approvePreview,
  approveScope,
  checkCreated,
  checkTemplate,
  checkUnknownVerification,
  CREATE_CAPTURE,
  EXACT_BODY,
  READBACK_CAPTURE,
  TOKEN,
} from "#/cases/pr-creator-behavior-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  CREATE_ARGS,
  createdObservation,
  digestCall,
  preparedObservation,
} from "#/cases/pr-creator-test-support.ts";
import { createTurn } from "#/observation/observation-test-support.ts";

const TITLE_PREVIEW = `Title: feat: TASK-42 Use Uppercase Checkpoint Answers\n${TOKEN}`;

describe("pr-creator machine approval boundaries", () => {
  it("uses a successful helper token displayed in any layout", () => {
    expect(
      approvePreview(preparedObservation(`Reply APPROVED ${TOKEN}.`)),
    ).toEqual({ reply: `APPROVED ${TOKEN}` });
    expect(
      approveScope(
        preparedObservation(
          `Reply APPROVED ${TOKEN} to continue only.`,
          "scope",
        ),
      ),
    ).toEqual({ reply: `APPROVED ${TOKEN}` });
  });
  it.each([approvePreview, approveScope])(
    "does not approve prose-only tokens",
    (gate) => {
      expect(gate({ ...preparedObservation(), toolCalls: [] })).toHaveProperty(
        "gateNotReached",
      );
    },
  );
  it("rejects failed, malformed, wrong-gate, hidden and fabricated helper receipts", () => {
    const correct = preparedObservation();
    const failed = digestCall();
    if (failed.result === undefined) throw new Error("missing result");
    failed.result = { ...failed.result, isError: true };
    const wrong = [
      { ...correct, toolCalls: [failed] },
      { ...correct, toolCalls: [digestCall("scope")] },
      {
        ...correct,
        toolCalls: [
          {
            name: "Bash",
            input: { command: "echo forged" },
            result: digestCall().result,
          },
        ],
      },
      { ...correct, finalText: "Token not shown" },
      {
        ...correct,
        toolCalls: [
          {
            name: "Bash",
            input: digestCall().input,
            result: { content: "not JSON", isError: false, truncated: false },
          },
        ],
      },
    ];
    for (const observation of wrong) {
      expect(approvePreview(observation)).toHaveProperty("gateNotReached");
    }
  });
  it("accepts a truncated captured result whose retained tail contains the complete receipt", () => {
    const call = digestCall();
    if (call.result === undefined) throw new Error("missing result");
    call.result = {
      ...call.result,
      truncated: true,
      content: `earlier output omitted\n${call.result.content}`,
    };
    expect(
      approvePreview({ ...preparedObservation(), toolCalls: [call] }),
    ).toHaveProperty("reply");
  });
  it("rejects mutation before approval", () => {
    expect(() =>
      approvePreview({
        ...preparedObservation(),
        toolCalls: [
          digestCall(),
          { name: "Write", input: { file_path: "pricing.py" } },
        ],
      }),
    ).toThrow();
    expect(() =>
      approvePreview({
        ...preparedObservation(),
        toolCalls: [
          digestCall(),
          {
            name: "Bash",
            input: { command: "gh pr create --title premature" },
          },
        ],
      }),
    ).toThrow();
  });
});

describe("pr-creator machine create and readback checks", () => {
  it.each([false, true])(
    "accepts exact captured args/body and readback, drift=%s",
    (drift) => {
      expect(() =>
        checkCreated(createdObservation(drift), drift),
      ).not.toThrow();
    },
  );
  it("accepts the gh -R repository alias", () => {
    const original = createdObservation();
    const args = CREATE_ARGS.map((arg) => (arg === "--repo" ? "-R" : arg));
    const repoFiles = {
      ...original.repoFiles,
      [GITHUB_FACTS.log]: `["api","repos/eval-org/cart/assignees/maintainer"]\n${JSON.stringify(args)}\n["pr","view"]\n`,
      [CREATE_CAPTURE]: JSON.stringify({
        args,
        body: EXACT_BODY,
        title: GITHUB_FACTS.title,
        assignees: ["maintainer"],
        labels: [],
        reviewers: [],
      }),
    };
    expect(() => checkCreated({ ...original, repoFiles }, false)).not.toThrow();
  });
  it.each([
    { body: EXACT_BODY.trimEnd() },
    { body: "changed" },
    { assignees: [] },
    { title: "wrong" },
    { labels: ["unapproved"] },
    { reviewers: ["unapproved"] },
  ])("rejects wrong create evidence %j", (wrong) => {
    const original = createdObservation();
    const repoFiles = {
      ...original.repoFiles,
      [CREATE_CAPTURE]: JSON.stringify({
        args: CREATE_ARGS,
        body: EXACT_BODY,
        title: GITHUB_FACTS.title,
        assignees: ["maintainer"],
        labels: [],
        reviewers: [],
        ...wrong,
      }),
    };
    expect(() => checkCreated({ ...original, repoFiles }, false)).toThrow();
  });
  it("rejects missing or changed readback, absent lookup and edit/retry writes", () => {
    const original = createdObservation();
    for (const repoFiles of [
      { ...original.repoFiles, [READBACK_CAPTURE]: null },
      { ...original.repoFiles, [READBACK_CAPTURE]: "{}" },
      {
        ...original.repoFiles,
        [GITHUB_FACTS.log]: `${JSON.stringify(CREATE_ARGS)}\n["pr","view"]\n`,
      },
      {
        ...original.repoFiles,
        [GITHUB_FACTS.log]: `${original.repoFiles?.[GITHUB_FACTS.log] ?? ""}["pr","edit"]\n`,
      },
    ]) {
      expect(() => checkCreated({ ...original, repoFiles }, false)).toThrow();
    }
  });
  it("rejects altered body, head and state in the actual readback snapshot", () => {
    const original = createdObservation();
    const readback = original.repoFiles?.[READBACK_CAPTURE];
    if (typeof readback !== "string") {
      throw new Error("missing readback fixture");
    }
    for (const wrong of [
      readback.replace(
        JSON.stringify(EXACT_BODY),
        JSON.stringify("changed body"),
      ),
      readback.replace(/"headRefOid":"[^"]+"/, '"headRefOid":"wrong"'),
      readback.replace('"isDraft":true', '"isDraft":false'),
    ]) {
      expect(() =>
        checkCreated(
          {
            ...original,
            repoFiles: { ...original.repoFiles, [READBACK_CAPTURE]: wrong },
          },
          false,
        ),
      ).toThrow();
    }
  });
  it("rejects missing approval and an earlier write even if final captures match", () => {
    expect(() =>
      checkCreated({ ...createdObservation(), turns: [] }, false),
    ).toThrow();
    const original = createdObservation();
    const early = createTurn({
      finalText: TOKEN,
      toolCalls: [
        { name: "Bash", input: { command: "gh pr create" } },
        digestCall(),
      ],
    });
    expect(() =>
      checkCreated(
        {
          ...original,
          turns: [early, createTurn({ prompt: `APPROVED ${TOKEN}` })],
        },
        false,
      ),
    ).toThrow();
  });
});

describe("pr-creator structural versus semantic checks", () => {
  it.each([
    "feat: TASK-42 Use Uppercase Checkpoint Answers",
    "feat: TASK-42 Simplify Unit Price",
  ])("checks title structure, leaving grounding to the judge: %s", (title) => {
    expect(() =>
      checkTemplate(preparedObservation(`Title: ${title}\n${TOKEN}`)),
    ).not.toThrow();
  });
  it.each([
    "Feat: TASK-42 Update Answers",
    "feat(scope): TASK-42 Update Answers",
    "feat: Update TASK-42 Answers",
    "feat: TASK-42 update answers",
  ])("rejects structurally wrong title %s", (title) => {
    expect(() =>
      checkTemplate(preparedObservation(`Title: ${title}\n${TOKEN}`)),
    ).toThrow();
  });
  it("still requires preparation and no writes for preview-only cases", () => {
    expect(() => checkUnknownVerification(preparedObservation())).not.toThrow();
    expect(() =>
      checkUnknownVerification({ ...preparedObservation(), toolCalls: [] }),
    ).toThrow(/digest/);
    expect(() =>
      checkTemplate({
        ...preparedObservation(TITLE_PREVIEW),
        gitStatusAfter: { kind: "worktree", entries: "M pricing.py" },
      }),
    ).toThrow();
  });
});
