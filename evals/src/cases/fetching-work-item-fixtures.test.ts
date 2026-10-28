import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  assertOnlySnapshotWritten,
  seedGitHub,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
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

const MISSING_ISSUE_EXIT_CODE = 1;

test("missing issue remains missing through GraphQL", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGitHub(context, "missing");
  });
  try {
    const result = spawnSync(
      join(fixture.binPath, "gh"),
      [
        "api",
        "graphql",
        "-f",
        'query=query { repository(owner: "acme", name: "app") { issue(number: 42) { title } } }',
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(MISSING_ISSUE_EXIT_CODE);
    expect(result.stderr).toMatch(/Not Found|Could not resolve/);
    expect(result.stdout).toBe("");
  } finally {
    fixture.cleanup();
  }
});
