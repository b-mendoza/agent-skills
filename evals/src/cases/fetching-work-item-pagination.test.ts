import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "vitest";

import { seedGitHubReferences } from "#/cases/fetching-work-item-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const FAILURE = 1;

test("explicit timeline page 3 terminates rather than repeating page 1", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGitHubReferences(context);
  });
  try {
    const first = spawnSync(
      join(fixture.binPath, "gh"),
      [
        "api",
        "--include",
        "repos/acme/app/issues/42/timeline?per_page=100&page=1",
      ],
      { encoding: "utf8" },
    );
    const last = spawnSync(
      join(fixture.binPath, "gh"),
      [
        "api",
        "--include",
        "repos/acme/app/issues/42/timeline?per_page=100&page=2",
      ],
      { encoding: "utf8" },
    );
    const empty = spawnSync(
      join(fixture.binPath, "gh"),
      ["api", "repos/acme/app/issues/42/timeline?per_page=100&page=3"],
      { encoding: "utf8" },
    );
    expect(first.stdout).toContain('rel="next"');
    expect(last.stdout).not.toContain('rel="next"');
    expect(empty.status).toBe(SUCCESS);
    expect(JSON.parse(empty.stdout)).toStrictEqual([]);
  } finally {
    fixture.cleanup();
  }
});

// Commands issued in done-when-pr-references repeat 3 were legitimate read paths.
test.each(["51", "52"])(
  "PR %s review comments are verified empty, not an unsupported endpoint",
  (number) => {
    const fixture = makeFixture("clean", [], (context) => {
      seedGitHubReferences(context);
    });
    try {
      const result = spawnSync(
        join(fixture.binPath, "gh"),
        [
          "api",
          "--paginate",
          `repos/acme/app/pulls/${number}/comments?per_page=100`,
        ],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(SUCCESS);
      expect(JSON.parse(result.stdout)).toStrictEqual([]);
    } finally {
      fixture.cleanup();
    }
  },
);

test("the deliberate inaccessible second page still fails closed", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGitHubReferences(context, true);
  });
  try {
    const result = spawnSync(
      join(fixture.binPath, "gh"),
      ["api", "repos/acme/app/issues/42/timeline?page=2"],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(FAILURE);
    expect(result.stderr).toContain("HTTP 403");
  } finally {
    fixture.cleanup();
  }
});
