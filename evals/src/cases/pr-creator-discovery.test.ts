import { execFileSync, spawnSync } from "node:child_process";

import { expect, it } from "vitest";

import {
  GITHUB_FACTS as facts,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const FAILURE = 1;
const branch = "feature/issue-42-cart";
const reviewer = "cart-reviewer";
const initialTitle = "Simplify unit price";
const nextMessage = "Track #43; compare PR #17";
it("publishes the configured head with both commit messages and matching PR identity", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGithubFixture(context, {
      existing: true,
      headHistory: { branch, commitMessages: [initialTitle, nextMessage] },
    });
  });
  try {
    const options = {
      cwd: fixture.cwd,
      encoding: "utf8" as const,
      env: {
        ...process.env,
        PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
      },
    };
    expect(
      execFileSync(
        "git",
        ["log", "--format=%s", "--reverse", `main..origin/${branch}`],
        options,
      )
        .trim()
        .split("\n"),
    ).toEqual([initialTitle, nextMessage]);
    expect(
      execFileSync(
        "gh",
        ["pr", "view", "17", "--json", "headRefName", "--jq", ".headRefName"],
        options,
      ).trim(),
    ).toBe(branch);
  } finally {
    fixture.cleanup();
  }
});
it("lists only the configured requestable collaborators", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGithubFixture(context, { collaborators: [reviewer] });
  });
  try {
    const stdout = execFileSync(
      "gh",
      ["api", `repos/${facts.repository}/collaborators`],
      {
        cwd: fixture.cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
      },
    );
    expect(JSON.parse(stdout)).toEqual([{ login: reviewer }]);
  } finally {
    fixture.cleanup();
  }
});
const collaboratorCheck = (login: string) => [
  "api",
  "--hostname",
  "github.com",
  "--method",
  "GET",
  "--include",
  `repos/${facts.repository}/collaborators/${login}`,
];
it("returns collaborator status for the requested login", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedGithubFixture(context, { collaborators: [reviewer] });
  });
  try {
    const check = (login: string) =>
      spawnSync("gh", collaboratorCheck(login), {
        cwd: fixture.cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
      });
    const listed = check(reviewer);
    expect(listed.status).toBe(SUCCESS);
    expect(listed.stdout).toContain("204 No Content");
    const missing = check("not-listed");
    expect(missing.status).toBe(FAILURE);
    expect(missing.stdout).toContain("404 Not Found");
  } finally {
    fixture.cleanup();
  }
});
