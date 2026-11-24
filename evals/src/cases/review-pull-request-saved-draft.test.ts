import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { REVIEW_POSTS } from "#/cases/review-pull-request-fixtures.ts";
import {
  APPROVED,
  DRAFT_HASH,
  DRY_RUN,
  followUps,
  HASH,
  POST,
  posted,
  PREVIEW,
  READ,
  REFRESHED_DRAFT,
  RENDER,
  REPLACE,
  resumable,
  RESUME,
  REVERIFY,
  RUN,
  SAVED,
  scenario,
  success,
  SUMMARY,
  terminalDraft,
  VERIFY,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";

describe("posting a saved draft", () => {
  it("asks to post only after the draft terminal saved without a preview", () => {
    expect(scenario().prompt({ missingPath: "", notGitPath: "" })).toContain(
      "POSTING_MODE=draft-only",
    );
    const { request } = followUps();
    expect(request.reply(terminalDraft())).toEqual({ reply: SAVED });
    expect(
      request.reply(terminalDraft([READ, VERIFY, RENDER, DRY_RUN])),
    ).toHaveProperty("gateNotReached");
  });

  it("requires both the draft and the retained run path in each terminal reply", () => {
    const { request } = followUps();
    for (const pathAlone of [GITHUB_FACTS.report, RUN]) {
      expect(
        request.reply({ ...terminalDraft(), finalText: pathAlone }),
      ).toHaveProperty("gateNotReached");
      expect(() =>
        scenario().check({ ...posted(), finalText: pathAlone }),
      ).toThrow(/terminal reply/);
    }
  });

  it("does not request posting after a premature GitHub write or lost draft", () => {
    const { request } = followUps();
    const draft = terminalDraft();
    for (const files of [
      { [REVIEW_POSTS]: POST },
      { [GITHUB_FACTS.report]: null },
    ]) {
      expect(
        request.reply({
          ...draft,
          repoFiles: { ...draft.repoFiles, ...files },
        }),
      ).toHaveProperty("gateNotReached");
    }
  });

  it("does not request posting after the draft terminal discards a needed payload", () => {
    const { request } = followUps();
    const draft = terminalDraft();
    expect(
      request.reply({
        ...draft,
        repoFiles: { ...draft.repoFiles, [`${RUN}/verify.txt`]: null },
      }),
    ).toHaveProperty("gateNotReached");
  });

  it("approves the new preview only after successful re-verification in the request turn", () => {
    const { approve } = followUps();
    expect(approve.reply(resumable())).toEqual({ reply: "APPROVED" });
    const failedVerify = success(
      `python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify < ${RUN}/verify.txt`,
    );
    assert.ok(failedVerify.result !== undefined);
    for (const calls of [
      [RESUME, VERIFY, REPLACE, DRY_RUN],
      [RESUME, REPLACE, DRY_RUN, REVERIFY, VERIFY],
      [RESUME, REVERIFY, VERIFY, REPLACE],
      [RESUME, REVERIFY, VERIFY, REPLACE, DRY_RUN, APPROVED],
      [
        RESUME,
        REVERIFY,
        { ...failedVerify, result: { ...failedVerify.result, isError: true } },
        REPLACE,
        DRY_RUN,
      ],
      [
        RESUME,
        REVERIFY,
        success(
          "python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify < other/verify.txt",
        ),
        REPLACE,
        DRY_RUN,
      ],
    ]) {
      expect(approve.reply(resumable(calls))).toHaveProperty("gateNotReached");
    }
  });

  it("requires the saved review resume check before the verifier", () => {
    const { approve } = followUps();
    const wrongDraft = success(
      "python3 -I .claude/skills/review-pull-request/scripts/post-review.py --resume different.md",
      RESUME.result?.content,
    );
    const wrongHash = success(
      `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --resume ${GITHUB_FACTS.report}`,
      RESUME.result?.content.replace(DRAFT_HASH, HASH),
    );
    for (const calls of [
      [REVERIFY, VERIFY, REPLACE, DRY_RUN],
      [REVERIFY, VERIFY, RESUME, REPLACE, DRY_RUN],
      [wrongDraft, REVERIFY, VERIFY, REPLACE, DRY_RUN],
      [wrongHash, REVERIFY, VERIFY, REPLACE, DRY_RUN],
    ]) {
      expect(approve.reply(resumable(calls))).toHaveProperty("gateNotReached");
    }
  });

  it("uses the resumed file hash for the verification render before preview", () => {
    const { approve } = followUps();
    expect(approve.reply(resumable())).toEqual({ reply: "APPROVED" });
    const wrongHash = success(
      `python3 -I .claude/skills/review-pull-request/scripts/render-review.py ${RUN} ${GITHUB_FACTS.report} --replace ${HASH}`,
      REPLACE.result?.content,
    );
    for (const calls of [
      [RESUME, REVERIFY, VERIFY, DRY_RUN],
      [RESUME, REVERIFY, REPLACE, VERIFY, DRY_RUN],
      [RESUME, REVERIFY, VERIFY, DRY_RUN, REPLACE],
      [RESUME, REVERIFY, VERIFY, wrongHash, DRY_RUN],
    ]) {
      expect(approve.reply(resumable(calls))).toHaveProperty("gateNotReached");
    }
  });

  it("does not approve a mutated draft or a write before its fresh approval", () => {
    const { approve } = followUps();
    const preview = resumable();
    for (const files of [
      {
        [GITHUB_FACTS.report]: REFRESHED_DRAFT.replace(
          "Rechecked",
          "Not checked",
        ),
      },
      { [REVIEW_POSTS]: POST },
    ]) {
      expect(
        approve.reply({
          ...preview,
          repoFiles: { ...preview.repoFiles, ...files },
        }),
      ).toHaveProperty("gateNotReached");
    }
  });

  it("does not approve a preview that trims bytes from the saved body", () => {
    const { approve } = followUps();
    const changed = success(
      `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run ${RUN}`,
      PREVIEW.replace(SUMMARY, SUMMARY.trimEnd()),
    );
    expect(
      approve.reply(resumable([RESUME, REVERIFY, VERIFY, REPLACE, changed])),
    ).toHaveProperty("gateNotReached");
  });

  it("grades only the review bytes posted under the fresh approval hash", () => {
    expect(() => scenario().check(posted())).not.toThrow();
    expect(() =>
      scenario().check(
        posted(
          success(
            `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${DRAFT_HASH} ${RUN}`,
          ),
        ),
      ),
    ).toThrow(/approval hash/);
    expect(() =>
      scenario().check(posted(APPROVED, POST.replace("Restore", "Ignore"))),
    ).toThrow(/posted body differs/);
  });
});
