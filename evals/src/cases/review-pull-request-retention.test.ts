import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertReviewedTerminal } from "#/cases/review-pull-request-checks.ts";
import { SENTINEL } from "#/cases/review-pull-request-fixtures.ts";
import { retainedApprovalReply } from "#/cases/review-pull-request-gates.ts";
import {
  assertPartialReviewRetention,
  assertRetainedReviewFiles,
} from "#/cases/review-pull-request-retention.ts";
import { APPROVAL_CHECKPOINT } from "#/cases/review-pull-request-retention-checkpoint.ts";
import {
  DRY_RUN,
  followUps,
  RENDER,
  RUN,
  terminalDraft,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";
import {
  assertSavedChunks,
  SAVED_FILES,
  savedFileHashes,
} from "#/cases/review-pull-request-saved-files.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const ROOT = ".handoffs/review-pull-request/";
const scratch = `${RUN}/scratch-author.txt`;
const notes = "Count can be zero.";
const assign = { name: "Agent", input: { prompt: `SCRATCH_FILE=${scratch}` } };
function write(path: string, content: string): ToolCall {
  return { name: "Write", input: { file_path: path, content } };
}

it.each(["Task", "Agent"])(
  "requires a stopped %s role's returned file even without a child Write trace",
  (name) => {
    const path = `${RUN}/context.txt`;
    const partial = createObservation({
      finalText: `Ticket access denied. Run directory: ${RUN}.`,
      toolCalls: [
        {
          name,
          input: { prompt: `PAYLOAD_FILE=${path}` },
          result: {
            content: `CONTEXT: NEEDS_CONTEXT\n${path}`,
            truncated: false,
            isError: false,
          },
        },
      ],
      repoFiles: { [ROOT]: "", [SENTINEL]: "unrelated run: preserve me\n" },
    });
    expect(() => {
      assertPartialReviewRetention(partial);
    }).toThrow(path);
    expect(() => {
      assertPartialReviewRetention({
        ...partial,
        repoFiles: {
          ...partial.repoFiles,
          [path]: 'CONTEXT: NEEDS_CONTEXT\n{"reason":"ticket denied"}',
        },
      });
    }).not.toThrow();
  },
);

const inlineNotes = "Role: review-author (inline). Redacted notes, no diffs.";
const dispatch = {
  name: "Agent",
  input: { prompt: `PAYLOAD_FILE=${RUN}/author.txt` },
};
const failed = {
  ...dispatch,
  result: {
    content: "Agent terminated early due to an API error: API Error: 503",
    isError: true,
    truncated: false,
  },
};

it.each([
  [],
  [failed, failed],
  [{ ...dispatch, input: { prompt: `PAYLOAD_FILE=${RUN}/context.txt` } }],
])(
  "retains a bounded inline scratch write without a dispatch assignment (%#)",
  (...prior) => {
    const draft = terminalDraft([...prior, write(scratch, inlineNotes)]);
    expect(() => {
      assertRetainedReviewFiles({
        ...draft,
        finalText:
          "I ran the context, chunk, author and verify roles inline, so the verification is not independent of the author.",
        repoFiles: { ...draft.repoFiles, [scratch]: inlineNotes },
      });
    }).not.toThrow();
  },
);

it("does not infer an inline writer from the filename after a different role was dispatched", () => {
  const context = {
    ...dispatch,
    input: { prompt: `PAYLOAD_FILE=${RUN}/context.txt` },
  };
  const draft = terminalDraft([context, write(scratch, notes)]);
  expect(() => {
    assertRetainedReviewFiles({
      ...draft,
      repoFiles: { ...draft.repoFiles, [scratch]: notes },
    });
  }).toThrow(/assignment/);
});

it.each(["", "rewritten notes"])(
  "rejects scratch changed to %j at approval and after the turn",
  (replacement) => {
    const draft = terminalDraft([assign, write(scratch, notes), DRY_RUN]);
    const snapshot = {
      ...draft,
      repoFiles: { ...draft.repoFiles, [scratch]: replacement },
    };
    expect(() => {
      assertRetainedReviewFiles(snapshot);
    }).toThrow(/scratch/);
    expect(retainedApprovalReply(snapshot)).toHaveProperty("gateNotReached");
    const preserved = {
      ...snapshot,
      repoFiles: { ...snapshot.repoFiles, [scratch]: notes },
    };
    expect(retainedApprovalReply(preserved)).toEqual({ reply: "APPROVED" });
  },
);

it("permits a returning author to revise the notes assigned to it", () => {
  const revision = {
    ...assign,
    result: {
      content: `AUTHOR: PASS\n${RUN}/author.txt`,
      isError: false,
      truncated: false,
    },
  };
  const draft = terminalDraft([assign, write(scratch, notes), revision]);
  expect(() => {
    assertRetainedReviewFiles({
      ...draft,
      repoFiles: { ...draft.repoFiles, [scratch]: "Revised inspection notes." },
    });
  }).not.toThrow();
  expect(() => {
    assertRetainedReviewFiles({
      ...draft,
      repoFiles: { ...draft.repoFiles, [scratch]: "" },
    });
  }).toThrow(scratch);
});

it("requires the last observed payload bytes, allowing the assigned role to revise its file", () => {
  const path = `${RUN}/verify.txt`;
  const revised = "VERIFY: PASS\n{}\n";
  const before = "VERIFY: FAIL\n{}\n";
  const draft = terminalDraft([write(path, before), write(path, revised)]);
  expect(() => {
    assertRetainedReviewFiles(draft);
  }).not.toThrow();
  expect(() => {
    assertRetainedReviewFiles({
      ...draft,
      repoFiles: { ...draft.repoFiles, [path]: before },
    });
  }).toThrow(path);
});

it("keeps the child-produced bytes seen at approval even without a child Write trace", () => {
  const draft = terminalDraft([assign, DRY_RUN]);
  const paused = {
    ...draft,
    repoFiles: { ...draft.repoFiles, [scratch]: notes },
  };
  const fixture = makeFixture("clean", []);
  try {
    expect(retainedApprovalReply(paused, undefined, fixture.cwd)).toEqual({
      reply: "APPROVED",
    });
    const terminal = {
      ...paused,
      turns: [createTurn({ prompt: "ABORT" })],
      repoFiles: {
        ...paused.repoFiles,
        ...snapshotRepoFiles(fixture.cwd, [APPROVAL_CHECKPOINT]),
      },
    };
    expect(() => assertReviewedTerminal(terminal)).not.toThrow();
    for (const [path, replacement] of [
      [scratch, ""],
      [`${RUN}/author.txt`, "AUTHOR: PASS\nchanged"],
    ] as const) {
      expect(() =>
        assertReviewedTerminal({
          ...terminal,
          repoFiles: { ...terminal.repoFiles, [path]: replacement },
        }),
      ).toThrow(path);
    }
  } finally {
    fixture.cleanup();
  }
});

it("keeps the draft turn's scratch notes until fresh approval unless the owning role revises them", () => {
  const draft = terminalDraft();
  const saved = JSON.stringify({
    ...savedFileHashes(draft),
    [scratch]: createHash("sha256").update(notes).digest("hex"),
  });
  const files = { ...draft.repoFiles, [SAVED_FILES]: saved };
  for (const bytes of [null, "", "unrelated"]) {
    expect(() => {
      assertSavedChunks(
        { ...draft, repoFiles: { ...files, [scratch]: bytes } },
        RUN,
      );
    }).toThrow(scratch);
  }
  expect(() => {
    assertSavedChunks(
      { ...draft, repoFiles: { ...files, [scratch]: notes } },
      RUN,
    );
  }).not.toThrow();
  expect(() => {
    assertSavedChunks(
      {
        ...draft,
        toolCalls: [assign],
        repoFiles: { ...files, [scratch]: "Updated notes" },
      },
      RUN,
    );
  }).not.toThrow();
});

it("compares the first saved draft's reported directory with files actually present", () => {
  const draft = terminalDraft();
  const other = `${RUN}-different`;
  const report = String(draft.repoFiles?.[GITHUB_FACTS.report]).replace(
    RUN,
    other,
  );
  const render = {
    ...RENDER,
    result: {
      content: `sha256: ${createHash("sha256").update(report).digest("hex")}`,
      isError: false,
      truncated: false,
    },
  };
  const wrong = terminalDraft([render], report);
  expect(
    followUps().request.reply({
      ...wrong,
      finalText: `Saved ${GITHUB_FACTS.report}; retained ${other}.`,
    }),
  ).toHaveProperty("gateNotReached");
});
