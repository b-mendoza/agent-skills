import { expect, test } from "vitest";

import {
  assertOnlySnapshotWritten,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const observation = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${SNAPSHOT}` },
  repoFiles: { ".git/eval-fixture-root": "/fixture\n/canonical/fixture" },
});

test.each([
  `/outside/${SNAPSHOT}`,
  `../outside/${SNAPSHOT}`,
  `/fixture-other/${SNAPSHOT}`,
])("fetching rejects foreign-root same-suffix write %s", (path) => {
  expect(() => {
    assertOnlySnapshotWritten({
      ...observation,
      toolCalls: [
        { name: "Write", input: { file_path: SNAPSHOT } },
        { name: "Edit", input: { file_path: path } },
      ],
    });
  }).toThrow();
});

test.each([SNAPSHOT, `/fixture/${SNAPSHOT}`, `/canonical/fixture/${SNAPSHOT}`])(
  "fetching accepts fixture artifact %s",
  (path) => {
    expect(() => {
      assertOnlySnapshotWritten({
        ...observation,
        toolCalls: [{ name: "Write", input: { file_path: path } }],
      });
    }).not.toThrow();
  },
);
