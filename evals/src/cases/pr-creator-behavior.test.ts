import { describe, expect, it } from "vitest";

import {
  approvePreview,
  approvePush,
  approveScope,
  checkCreated,
  checkTemplate,
  checkUnknownVerification,
  CREATE_CAPTURE,
  EXACT_BODY,
  READBACK_CAPTURE,
} from "#/cases/pr-creator-behavior-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  CREATE_ARGS,
  createdObservation,
  digestCall,
  preparedObservation,
} from "#/cases/pr-creator-test-support.ts";
import { createTurn } from "#/observation/observation-test-support.ts";

const TITLE_PREVIEW = `Title: feat: TASK-42 Use Uppercase Checkpoint Answers`;

describe("pr-creator machine approval boundaries", () => {
  it.each([
    ["push", "preview", "git push origin HEAD", approvePreview],
  ] as const)(
    "allows the approved %s action before the %s proposal only",
    (firstKind, nextKind, command, approve) => {
      const write = { name: "Bash", input: { command } };
      const first = digestCall(firstKind);
      const next = digestCall(nextKind);
      function staged(
        initial: Array<typeof first>,
        latest: Array<typeof first>,
      ) {
        return {
          ...preparedObservation(),
          toolCalls: [...initial, ...latest],
          turns: [
            createTurn({ toolCalls: initial }),
            createTurn({ prompt: "approved", toolCalls: latest }),
          ],
        };
      }
      expect(approve(staged([first], [write, next]))).toEqual({
        reply: "approved",
      });
      expect(() => approve(staged([write, first], [next]))).toThrow();
      expect(() =>
        approve(staged([{ name: "Read", input: {} }], [write, next])),
      ).toThrow();
      expect(() => approve(staged([first], [next, write]))).toThrow();
      expect(approve(staged([first], [write]))).toHaveProperty(
        "gateNotReached",
      );
    },
  );
  it.each([
    ["preview", approvePreview],
    ["scope", approveScope],
    ["push", approvePush],
  ] as const)(
    "answers the prepared %s gate with only a plain affirmative",
    (kind, approve) => {
      expect(approve(preparedObservation("Proceed?", kind))).toEqual({
        reply: "approved",
      });
    },
  );
  it("does not approve a push with a scope receipt", () => {
    const call = { ...digestCall("scope"), input: digestCall("push").input };
    expect(
      approvePush({ ...preparedObservation(), toolCalls: [call] }),
    ).toHaveProperty("gateNotReached");
  });
  it("does not approve a digest from an earlier turn", () => {
    const prepared = preparedObservation("Proceed?", "preview");
    expect(
      approvePreview({
        ...prepared,
        turns: [
          createTurn({ toolCalls: prepared.toolCalls }),
          createTurn({ toolCalls: [] }),
        ],
      }),
    ).toHaveProperty("gateNotReached");
  });
  it.each([approvePreview, approveScope])(
    "does not approve prose-only tokens",
    (gate) => {
      expect(gate({ ...preparedObservation(), toolCalls: [] })).toHaveProperty(
        "gateNotReached",
      );
    },
  );
  it("rejects failed, malformed, wrong-gate, and fabricated helper receipts", () => {
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
            input: { command: "echo validate-output.py digest preview" },
            result: digestCall().result,
          },
        ],
      },
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
  it("accepts a captured validator receipt from command substitution", () => {
    const call = digestCall();
    call.input = {
      command:
        'receipt=$(python3 -I "$SKILL_DIR/scripts/validate-output.py" digest preview < values.json); printf "%s" "$receipt"',
    };
    expect(
      approvePreview({ ...preparedObservation(), toolCalls: [call] }),
    ).toEqual({ reply: "approved" });
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
  it.each(["exact", "additions", "drift"] as const)(
    "accepts exact captured args/body and readback, outcome=%s",
    (outcome) => {
      expect(() =>
        checkCreated(createdObservation(outcome), outcome),
      ).not.toThrow();
    },
  );
  it("does not mistake additions for drift", () => {
    expect(() =>
      checkCreated(createdObservation("additions"), "drift"),
    ).toThrow();
  });
  it("classifies an explicitly unreadable supported field as drift", () => {
    const original = createdObservation();
    const readback = original.repoFiles?.[READBACK_CAPTURE];
    if (typeof readback !== "string") {
      throw new Error("missing readback fixture");
    }
    const repoFiles = {
      ...original.repoFiles,
      [READBACK_CAPTURE]: readback.replace('"labels":[]', '"labels":null'),
    };
    expect(() =>
      checkCreated({ ...original, repoFiles }, "drift"),
    ).not.toThrow();
    expect(() => checkCreated({ ...original, repoFiles }, "exact")).toThrow();
  });
  it.each(
    [
      CREATE_ARGS.map((arg) => (arg === "--repo" ? "-R" : arg)),
      [
        "pr",
        "create",
        `--repo=github.com/${GITHUB_FACTS.repository}`,
        "--base=main",
        `--head=${GITHUB_FACTS.branch}`,
        ...CREATE_ARGS.slice(CREATE_ARGS.indexOf("--title")),
      ],
    ].map((args) => ({ args })),
  )("accepts equivalent create arguments: $args", ({ args }) => {
    const original = createdObservation();
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
    expect(() =>
      checkCreated({ ...original, repoFiles }, "exact"),
    ).not.toThrow();
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
    expect(() => checkCreated({ ...original, repoFiles }, "exact")).toThrow();
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
      expect(() => checkCreated({ ...original, repoFiles }, "exact")).toThrow();
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
          "exact",
        ),
      ).toThrow();
    }
  });
  it("rejects missing approval and an earlier write even if final captures match", () => {
    expect(() =>
      checkCreated({ ...createdObservation(), turns: [] }, "exact"),
    ).toThrow();
    const original = createdObservation();
    const early = createTurn({
      finalText: "Create it?",
      toolCalls: [
        { name: "Bash", input: { command: "gh pr create" } },
        digestCall(),
      ],
    });
    expect(() =>
      checkCreated(
        {
          ...original,
          turns: [early, createTurn({ prompt: "approved" })],
        },
        "exact",
      ),
    ).toThrow();
  });
});

describe("pr-creator structural versus semantic checks", () => {
  it.each([
    "feat: TASK-42 Use Uppercase Checkpoint Answers",
    "feat: TASK-42 Simplify Unit Price",
    "feat: TASK-42 Update v2.0 via Cache",
  ])("checks title structure, leaving grounding to the judge: %s", (title) => {
    expect(() =>
      checkTemplate(preparedObservation(`Title: ${title}`)),
    ).not.toThrow();
  });
  it.each([
    "feat: TASK-42 Update via",
    "Feat: TASK-42 Update Answers",
    "feat(scope): TASK-42 Update Answers",
    "feat: Update TASK-42 Answers",
    "feat: TASK-42 update answers",
  ])("rejects structurally wrong title %s", (title) => {
    expect(() =>
      checkTemplate(preparedObservation(`Title: ${title}`)),
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
