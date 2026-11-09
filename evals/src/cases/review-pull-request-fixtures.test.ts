import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { seedReviewFixture } from "#/cases/review-pull-request-fixtures.ts";
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
