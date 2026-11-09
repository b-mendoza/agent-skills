import assert from "node:assert/strict";

import { expect, test } from "vitest";

import { cases } from "#/cases/fetching-work-item.ts";
import { ISSUE, SNAPSHOT } from "#/cases/fetching-work-item-fixtures.ts";
import { GH_LOG } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function checkReply(finalText: string): string {
  const evalCase = cases.find(
    (candidate) => candidate.id === "fetching-work-item/not-found",
  );
  assert.ok(evalCase !== undefined);
  return evalCase.check(
    createObservation({
      finalText,
      repoFiles: {
        [SNAPSHOT]: null,
        [GH_LOG]: `${JSON.stringify(["issue", "view", ISSUE.url])}\n`,
      },
    }),
  );
}

// Shortened verbatim from fetching-work-item/not-found, paid run 1, repeat 0.
const RECORDED_REPLY =
  "Retrieval failed, so no snapshot was written.\n\n- **Issue:** `acme/app#42` (`https://github.com/acme/app/issues/42`)\n- **Failure category:** `NOT_FOUND`\n- **Reason:** `gh: Not Found (HTTP 404)`";
const PROSE_REPLY =
  "I couldn't retrieve acme/app#42 because GitHub returned 404. The issue may be missing or inaccessible to the current account. No snapshot was written, and GitHub was not changed. Check the issue URL and the account's access, then retry.";

test("NOT_FOUND still rejects the recorded labelled failure reply", () => {
  expect(() => checkReply(RECORDED_REPLY)).toThrow(
    /reply contains public status line/,
  );
});

test("NOT_FOUND accepts the route's concrete user-mode prose reply", () => {
  expect(checkReply(PROSE_REPLY)).toBe(
    "NOT_FOUND with no artifact or mutation",
  );
});

test.each([
  "FETCH: FAIL",
  "Failure category: NOT_FOUND",
  "Validation: NOT_RUN",
  "File written: None",
])("NOT_FOUND still rejects leaked handoff field %s", (field) => {
  expect(() => checkReply(`${PROSE_REPLY}\n${field}`)).toThrow(
    /reply contains public status line/,
  );
});
