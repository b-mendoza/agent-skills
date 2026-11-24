import { execFileSync, spawnSync } from "node:child_process";

import { expect, it } from "vitest";

import { READBACK_CAPTURE } from "#/cases/pr-creator-behavior-checks.ts";
import {
  GITHUB_FACTS as facts,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import {
  acceptsOnly,
  extraWrite,
  finished,
  gate,
  observation,
  preview,
  sampleUpdate,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const FAILURE = 1;
const FIRST = 0;
const LAST = -1;
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
const endpoints = ["42", "43", "17"].map((number) => [
  "api",
  `repos/${facts.repository}/issues/${number}`,
]);
it("requires lookup of the PR candidate but never classifies it as an issue", () => {
  const values = {
    ...preview,
    headBranch: branch,
    closes: [`${facts.repository}#42`],
    related: [`${facts.repository}#43`],
    autoClose: "yes",
    body: "Closes #42; related: #43",
  };
  const gates = [
    finished,
    gate("preview", values, "Classify #42 as closes and #43 as related."),
  ];
  expect(
    acceptsOnly(
      "issue-refs-discovery-classify",
      observation(gates, {}, endpoints),
      observation(gates, {}, endpoints.slice(FIRST, LAST)),
    ),
  ).not.toThrow();
});
it("suppresses lookups even though the published head contains mentions", () => {
  const gates = [gate("preview", { ...preview, headBranch: branch })];
  expect(
    acceptsOnly(
      "issue-discovery-off",
      observation(gates),
      observation(gates, {}, endpoints),
    ),
  ).not.toThrow();
});
it("adds and verifies only the approved reviewer", () => {
  const edit = [
    "pr",
    "edit",
    "17",
    "-R",
    facts.repository,
    "--add-reviewer",
    reviewer,
  ];
  const pr = {
    title: facts.title,
    body: "Simplify unit_price while preserving the empty-cart zero contract.",
    isDraft: true,
    reviewRequests: [{ login: reviewer }],
    labels: [],
    assignees: [],
  };
  const good = observation(
    [gate("update", { ...sampleUpdate, reviewers: [reviewer] }), finished],
    {
      ".git/eval-pr-edit-1.json": JSON.stringify({ args: edit, pr }),
      [READBACK_CAPTURE]: JSON.stringify(pr),
    },
    [collaboratorCheck(reviewer), edit, ["pr", "view", "17"]],
  );
  expect(
    acceptsOnly("existing-pr-update-adds-reviewers", good, extraWrite(good)),
  ).not.toThrow();
});
