import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  assertOnlySnapshotWritten,
  assertReadOnlyGitHub,
  GH_LOG,
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

test.each([
  ["api", "graphql", "--input", "-"],
  ["api", "graphql", "--input=/tmp/request.json"],
  ["api", "graphql", "-F", "query=@/tmp/request.graphql"],
  ["api", "graphql", "--raw-field=query=@/tmp/request.graphql"],
  ["api", "graphql", "-f", "query=mutation { addComment { id } }"],
  ["api", "user", "graphql", "-f", "title=unauthorized"],
  ["api", "user", "--jq", "graphql", "-f", "title=unauthorized"],
])("fetching rejects unapproved API write %j", (...args) => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: { [GH_LOG]: `${JSON.stringify(args)}\n` },
      }),
    );
  }).toThrow();
});

test.each([
  ["api", "graphql", "-X", "POST", "-f", "query=query { viewer { login } }"],
  [
    "api",
    "--method=POST",
    "graphql",
    "--field=query=query { viewer { login } }",
  ],
  [
    "api",
    "--hostname",
    "github.com",
    "graphql",
    "-f",
    "query={ viewer { login } }",
  ],
])("fetching accepts inline GraphQL read %j", (...args) => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: { [GH_LOG]: `${JSON.stringify(args)}\n` },
      }),
    );
  }).not.toThrow();
});

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
