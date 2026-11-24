import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  REVIEW_POSTS,
  seedReviewFixture,
} from "#/cases/review-pull-request-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const fileSchema = Schema.Struct({
  filename: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  patch: Schema.String,
});
const reviewSchema = Schema.Struct({
  id: Schema.Number,
  state: Schema.String,
  commit_id: Schema.String,
});
const prSchema = Schema.Struct({
  head: Schema.Struct({ sha: Schema.String }),
  base: Schema.Struct({ sha: Schema.String }),
  files: Schema.Array(fileSchema),
  reviews: Schema.Array(reviewSchema),
  additions: Schema.Number,
  deletions: Schema.Number,
});

const EXIT_SUCCESS = 0;

function api(
  fixture: ReturnType<typeof makeFixture>,
  endpoint: string,
): unknown {
  return JSON.parse(
    execFileSync("gh", ["api", endpoint], {
      cwd: fixture.cwd,
      env: {
        ...process.env,
        PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
      },
      encoding: "utf8",
    }),
  );
}

it("refuses to reopen a resolved, permitted thread before approval and preserves its state", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedReviewFixture(context, { reopen: true });
  });
  const gh = (...args: string[]) =>
    spawnSync(join(fixture.binPath, "gh"), ["api", "graphql", "-f", ...args], {
      cwd: fixture.cwd,
      encoding: "utf8",
    });
  const read = () =>
    gh(
      "query={repository{pullRequest{reviewThreads{nodes{id isResolved viewerCanUnresolve}}}}}",
      "--jq",
      ".data.repository.pullRequest.reviewThreads.nodes",
    );
  const expected = [
    { id: "PRRT_701", isResolved: true, viewerCanUnresolve: true },
  ];
  try {
    expect(JSON.parse(read().stdout)).toMatchObject(expected);
    const attempt = spawnSync(
      join(fixture.binPath, "gh"),
      [
        "api",
        "--hostname",
        "github.com",
        "--method",
        "POST",
        "graphql",
        "--input",
        "-",
      ],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
        input: JSON.stringify({
          query:
            "mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}",
          variables: { id: "PRRT_701" },
        }),
      },
    );
    expect(attempt.status).not.toBe(EXIT_SUCCESS);
    expect(attempt.stderr).toMatch(/approval/i);
    expect(JSON.parse(read().stdout)).toMatchObject(expected);
  } finally {
    fixture.cleanup();
  }
});

it("keeps clean-PR metadata, pull files and compare patches consistent with pinned Git objects", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedReviewFixture(context, { clean: true });
  });
  try {
    const pr = Schema.decodeUnknownSync(prSchema)(
      api(fixture, "repos/eval-org/cart/pulls/17"),
    );
    const expected = execFileSync(
      "git",
      ["diff", `${pr.base.sha}...${pr.head.sha}`, "--", "pricing.py"],
      { cwd: fixture.cwd, encoding: "utf8" },
    );
    const expectedStats = execFileSync(
      "git",
      ["diff", "--numstat", `${pr.base.sha}...${pr.head.sha}`],
      { cwd: fixture.cwd, encoding: "utf8" },
    ).trim();
    const [additions, deletions] = expectedStats.split("\t").map(Number);
    expect(pr.files).toEqual([
      expect.objectContaining({
        filename: "pricing.py",
        patch: expected,
        additions,
        deletions,
      }),
    ]);
    expect(pr.additions).toBe(additions);
    expect(pr.deletions).toBe(deletions);
    expect(
      Schema.decodeUnknownSync(Schema.Array(fileSchema))(
        api(fixture, "repos/eval-org/cart/pulls/17/files"),
      ),
    ).toEqual(pr.files);
    const compare = Schema.decodeUnknownSync(
      Schema.Struct({ files: Schema.Array(fileSchema) }),
    )(
      api(
        fixture,
        `repos/eval-org/cart/compare/${pr.base.sha}...${pr.head.sha}`,
      ),
    );
    expect(compare.files).toEqual(pr.files);
    expect(
      Schema.decodeUnknownSync(Schema.Array(reviewSchema))(
        api(fixture, "repos/eval-org/cart/pulls/17/reviews"),
      ),
    ).toEqual(pr.reviews);
    expect(pr.reviews).toEqual([
      expect.objectContaining({ state: "APPROVED", commit_id: pr.head.sha }),
    ]);
  } finally {
    fixture.cleanup();
  }
});

it("serves pinned root contents and recursive trees, and distinguishes absent files from unsupported APIs", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedReviewFixture(context, { divergent: true });
  });
  const env = {
    ...process.env,
    PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
  };
  try {
    const head = readFileSync(
      join(fixture.cwd, ".git/reviewed-pr-head"),
      "utf8",
    );
    const contents = Schema.decodeUnknownSync(
      Schema.Array(Schema.Struct({ path: Schema.String })),
    )(api(fixture, `repos/eval-org/cart/contents?ref=${head}`));
    expect(contents.map(({ path }) => path)).toEqual(["a.txt", "pricing.py"]);
    const tree = Schema.decodeUnknownSync(
      Schema.Struct({
        truncated: Schema.Boolean,
        tree: Schema.Array(Schema.Struct({ path: Schema.String })),
      }),
    )(api(fixture, `repos/eval-org/cart/git/trees/${head}?recursive=1`));
    expect(tree.truncated).toBe(false);
    expect(tree.tree.map(({ path }) => path)).toEqual(["a.txt", "pricing.py"]);
    const source = Schema.decodeUnknownSync(
      Schema.Struct({ content: Schema.String }),
    )(api(fixture, `repos/eval-org/cart/contents/pricing.py?ref=${head}`));
    expect(Buffer.from(source.content, "base64").toString("utf8")).toBe(
      GITHUB_FACTS.headSource,
    );
    expect(readFileSync(join(fixture.cwd, "pricing.py"), "utf8")).toBe(
      GITHUB_FACTS.baseSource,
    );
    const absent = spawnSync(
      "gh",
      ["api", `repos/eval-org/cart/contents/AGENTS.md?ref=${head}`],
      { cwd: fixture.cwd, env, encoding: "utf8" },
    );
    expect(absent.status).not.toBe(EXIT_SUCCESS);
    expect(absent.stderr).toContain("HTTP 404");
  } finally {
    fixture.cleanup();
  }
});

const pulls = "repos/eval-org/cart/pulls/17";

it.each([
  "query { viewer { login } }",
  "# mutation is not the operation\nquery { viewer { login } }",
])("treats a JSON GraphQL POST query as a read: %s", (query) => {
  const fixture = makeFixture("clean", [], seedReviewFixture);
  try {
    const result = spawnSync(
      join(fixture.binPath, "gh"),
      ["api", "--method", "POST", "graphql", "--input", "-"],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
        input: JSON.stringify({ query }),
      },
    );
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(JSON.parse(result.stdout)).toEqual({
      data: { viewer: { login: "reviewer" } },
    });
    expect(readFileSync(join(fixture.cwd, REVIEW_POSTS), "utf8")).toBe("");
  } finally {
    fixture.cleanup();
  }
});

it.each([
  ["comments/999999/typo", { body: "Reply" }],
  ["comments/999999/replies", { body: "Reply" }],
  [
    "reviews",
    {
      body: "Review",
      event: "COMMENT",
      comments: [
        { path: "file.py", side: "RIGHT", line: 1, body: "No such anchor" },
      ],
    },
  ],
  [
    "reviews",
    {
      body: "Review",
      event: "COMMENT",
      comments: [
        { path: "pricing.py", side: "RIGHT", line: 99, body: "Outside hunk" },
      ],
    },
  ],
] as const)(
  "rejects an unsupported write to %s before recording it",
  (route, payload) => {
    const fixture = makeFixture("clean", [], seedReviewFixture);
    try {
      const result = spawnSync(
        join(fixture.binPath, "gh"),
        ["api", "-X", "POST", `${pulls}/${route}`, "--input", "-"],
        { cwd: fixture.cwd, input: JSON.stringify(payload) },
      );
      expect(result.status).not.toBe(EXIT_SUCCESS);
      expect(readFileSync(join(fixture.cwd, REVIEW_POSTS), "utf8")).toBe("");
    } finally {
      fixture.cleanup();
    }
  },
);
