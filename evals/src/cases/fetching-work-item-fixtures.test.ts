import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vitest";

import { testArtifactWriteMatrix } from "#/cases/case-test-support.ts";
import {
  assertOnlySnapshotWritten,
  assertReadOnlyGitHub,
  seedGitHub,
  SNAPSHOT,
} from "#/cases/fetching-work-item-fixtures.ts";
import { GH_LOG, makeFixture } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const observation = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${SNAPSHOT}` },
  repoFiles: { ".git/eval-fixture-root": "/fixture\n/canonical/fixture" },
});

testArtifactWriteMatrix({
  label: "fetching",
  artifact: SNAPSHOT,
  check: (candidate) => {
    assertOnlySnapshotWritten(candidate);
  },
  valid: () => ({
    ...observation,
    toolCalls: [{ name: "Write", input: { file_path: SNAPSHOT } }],
  }),
});

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

test.each([
  "mcp__github__add_issue_comment",
  "mcp__github__create_pull_request",
  "mcp__github__merge_pull_request",
  "mcp__github__push_files",
  "mcp__github__reply_to_review",
  "mcp__github__updateIssue",
  "mcp__github__createPullRequest",
])("fetching rejects remote write tool %s", (name) => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: { [GH_LOG]: '["issue","view","42"]\n' },
        toolCalls: [{ name, input: {} }],
      }),
    );
  }).toThrow(/remote mutation tool/);
});

test.each([
  "mcp__github__get_issue",
  "mcp__github__list_issue_comments",
  "mcp__github__search_pull_requests",
  "mcp__github__get_commit",
])("fetching accepts remote read tool %s", (name) => {
  expect(() => {
    assertReadOnlyGitHub(
      createObservation({
        repoFiles: { [GH_LOG]: '["issue","view","42"]\n' },
        toolCalls: [{ name, input: {} }],
      }),
    );
  }).not.toThrow();
});

const apiMethodCases = [
  { options: ["--method=PATCH", "--raw-field=title=changed"], readOnly: false },
  { options: ["--raw-field=title=changed"], readOnly: false },
  { options: ["--field=title=changed"], readOnly: false },
  { options: ["--input=request.json"], readOnly: false },
  { options: ["-XPOST"], readOnly: false },
  { options: ["-ftitle=x"], readOnly: false },
  { options: ["-Ftitle=x"], readOnly: false },
  { options: ["-f", "--method=GET"], readOnly: false },
  { options: ["--method", "GET", "-f", "per_page=100"], readOnly: true },
  { options: ["--method=GET", "-f", "per_page=100"], readOnly: true },
  { options: ["-XGET", "--field=per_page=100"], readOnly: true },
  { options: ["--method=GET", "-f", "--method=PATCH"], readOnly: true },
  { options: ["--method=GET", "-f", "--input"], readOnly: true },
  { options: ["--method=GET", "-f", "title=edit"], readOnly: true },
];
const SUCCESS_EXIT_CODE = 0;
const MISSING_ISSUE_EXIT_CODE = 1;

test.each(apiMethodCases.filter(({ readOnly }) => !readOnly))(
  "fetching rejects REST API writes with $options",
  ({ options }) => {
    expect(() => {
      assertReadOnlyGitHub(
        createObservation({
          repoFiles: {
            [GH_LOG]: `${JSON.stringify(["api", "repos/acme/app/issues/42", ...options])}\n`,
          },
        }),
      );
    }).toThrow(/remote write/);
  },
);

test.each(apiMethodCases.filter(({ readOnly }) => readOnly))(
  "fetching accepts REST API reads with $options",
  ({ options }) => {
    expect(() => {
      assertReadOnlyGitHub(
        createObservation({
          repoFiles: {
            [GH_LOG]: `${JSON.stringify(["api", "repos/acme/app/issues/42", ...options])}\n`,
          },
        }),
      );
    }).not.toThrow();
  },
);

test.each(apiMethodCases)(
  "fake gh classifies REST API options $options as read-only=$readOnly",
  ({ options, readOnly }) => {
    const fixture = makeFixture("clean", [], seedGitHub);
    try {
      const result = spawnSync(
        join(fixture.binPath, "gh"),
        ["api", "repos/acme/app/issues/42", ...options],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(
        readOnly ? SUCCESS_EXIT_CODE : MISSING_ISSUE_EXIT_CODE,
      );
      expect(result.stdout).toMatch(readOnly ? /"number":42/ : /^$/);
      expect(result.stderr).toBe(
        readOnly ? "" : "Remote writes are not permitted\n",
      );
    } finally {
      fixture.cleanup();
    }
  },
);

test("fake gh serves API reads without TypeScript or require(esm) support", () => {
  const fixture = makeFixture("clean", [], seedGitHub);
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--no-experimental-strip-types",
        "--no-experimental-require-module",
        join(fixture.binPath, "gh"),
        "api",
        "repos/acme/app/issues/42",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(SUCCESS_EXIT_CODE);
    expect(result.stdout).toContain('"number":42');
    expect(result.stderr).toBe("");
  } finally {
    fixture.cleanup();
  }
});

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
