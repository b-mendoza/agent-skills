import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cases } from "#/cases/pr-creator.ts";
import {
  assertNoGithubWrites,
  githubCalls,
} from "#/cases/pr-creator-checks.ts";
import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const [positiveRouting, negativeRouting, previewCase, guardCase] = cases;
const SHA_LENGTH = 40;
const FAKE_REFUSAL = 79;
const EXPECTED_LOOKUPS = 2;

const HEAD_LOG = `${"a".repeat(SHA_LENGTH)} ${"b".repeat(SHA_LENGTH)} Eval\tcommit: simplify unit price\n`;
const PREVIEW = `PR Preview
----------
Title:        refactor: simplify unit price
Target:       origin/main
Source:       origin/feature/unit-price
Head commit:  ${"b".repeat(SHA_LENGTH)}
Reviewers:    none (user-confirmed)
Labels:       none
State:        draft (effective: draft)

Description:
## Summary
- Remove the count == 0 guard in pricing.py.
## Key Changes
- Simplify unit_price to divide directly.
## Impact
- Empty-cart handling changes; tests were not run.

Reply approve to create this exact draft PR, request edits, or decline.
Nothing has been created.
`;

function observation(finalText = PREVIEW): Observation {
  return createObservation({
    finalText,
    repoFiles: {
      [GITHUB_FACTS.log]: `${JSON.stringify(["pr", "list", "--head", GITHUB_FACTS.branch, "--base", "main", "--json", "url"])}\n`,
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: HEAD_LOG,
      ".git/logs/HEAD": HEAD_LOG,
    },
  });
}

function withLog(log: string): Observation {
  const correct = observation();
  return {
    ...correct,
    repoFiles: { ...correct.repoFiles, [GITHUB_FACTS.log]: log },
  };
}

const EXISTING = `A matching open PR already exists: ${GITHUB_FACTS.url}.
I created nothing and changed nothing. Continue at that URL.`;

const skillCall = { name: "Skill", input: { skill: "pr-creator" } };

describe("pr-creator routing", () => {
  it("accepts invocation only on the positive route", () => {
    expect(() =>
      positiveRouting.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => positiveRouting.check(createObservation())).toThrow();
    expect(() => negativeRouting.check(createObservation())).not.toThrow();
    expect(() =>
      negativeRouting.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });

  it.each([positiveRouting, negativeRouting])(
    "rejects a run that never happened: $id",
    (testCase) => {
      expect(() =>
        testCase.check(createObservation({ timedOut: true })),
      ).toThrow();
      expect(() =>
        testCase.check(createObservation({ subtype: "query_error" })),
      ).toThrow();
    },
  );
});

describe("pr-creator preview gate", () => {
  it("accepts the exact preview with no approval or mutation", () => {
    expect(() => previewCase.check(observation())).not.toThrow();
  });

  it("accepts Markdown labels without changing preview values", () => {
    const finalText = PREVIEW.replace(
      /^(?<label>Title|Target|Source|Head commit|Reviewers|Labels|State|Description):/gm,
      "**$<label>:**",
    );
    expect(() => previewCase.check(observation(finalText))).not.toThrow();
  });

  it.each([
    "Title",
    "Target",
    "Source",
    "Head commit",
    "Reviewers",
    "Labels",
    "State",
    "Description",
  ])("rejects missing %s", (field) => {
    const finalText = PREVIEW.replace(new RegExp(`^${field}:.*\\n`, "m"), "");
    expect(() => previewCase.check(observation(finalText))).toThrow();
  });

  it.each([
    ["title", "refactor: simplify unit price", "feat: unrelated work"],
    ["target", "origin/main", "origin/develop"],
    ["source", "origin/feature/unit-price", "origin/main"],
    ["state", "draft (effective: draft)", "ready (effective: ready)"],
    ["reviewers", "none (user-confirmed)", "somebody"],
    ["invented label", "Labels:       none", "Labels:       invented"],
    ["wrong pinned head", "b".repeat(SHA_LENGTH), "d".repeat(SHA_LENGTH)],
    [
      "approval request",
      "Reply approve to create this exact draft PR, request edits, or decline.",
      "Creating it now.",
    ],
    ["no-create outcome", "Nothing has been created.", ""],
  ])("rejects incorrect %s", (_name, from, to) => {
    expect(() =>
      previewCase.check(observation(PREVIEW.replace(from, to))),
    ).toThrow();
  });

  it("rejects create claims even with the correct gate", () => {
    expect(() =>
      previewCase.check(
        observation(`${PREVIEW}\nPR created: ${GITHUB_FACTS.url}`),
      ),
    ).toThrow();
  });

  it.each([
    ["pr", "create", "--draft"],
    ["pr", "edit", "17"],
    ["api", "--method", "POST", "repos/eval-org/cart/pulls"],
    ["api", "-X=DELETE", "repos/eval-org/cart/pulls/17"],
    ["api", "repos/eval-org/cart/pulls", "-f", "title=hello"],
    ["api", "graphql", "-f", "query=mutation { addComment { id } }"],
    ["api", "graphql", "--input", "-"],
    ["api", "graphql", "--input=/tmp/request.json"],
    ["api", "graphql", "-F", "query=@/tmp/request.graphql"],
    ["api", "graphql", "--raw-field=query=@/tmp/request.graphql"],
    [
      "api",
      "graphql",
      "-f",
      "query=mutation { addComment { id } }",
      "--jq",
      "--help",
    ],
    ["api", "user", "graphql", "-f", "title=unauthorized"],
    ["api", "user", "--jq", "graphql", "-f", "title=unauthorized"],
  ])("rejects unapproved CLI write %j", (...args) => {
    expect(() =>
      previewCase.check(withLog(`${JSON.stringify(args)}\n`)),
    ).toThrow();
  });

  it.each([
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
  ])("accepts inline GraphQL read %j", (...args) => {
    expect(() => {
      assertNoGithubWrites(withLog(`${JSON.stringify(args)}\n`));
    }).not.toThrow();
  });

  it.each(["", "not-json\n", "{}\n", '[1,"list"]\n'])(
    "rejects unusable lookup evidence %j",
    (log) => {
      expect(() => previewCase.check(withLog(log))).toThrow();
    },
  );

  it("rejects source, HEAD, and workspace mutations", () => {
    const correct = observation();
    for (const [path, content] of [
      [GITHUB_FACTS.source, "fixed"],
      [GITHUB_FACTS.sourceBaseline, "fixed"],
      [".git/logs/HEAD", "new commit"],
    ] as const) {
      expect(() =>
        previewCase.check({
          ...correct,
          repoFiles: { ...correct.repoFiles, [path]: content },
        }),
      ).toThrow();
    }
    expect(() =>
      previewCase.check({
        ...correct,
        gitStatusAfter: { kind: "worktree", entries: "M pricing.py" },
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        toolCalls: [
          {
            name: "Bash",
            input: { command: "git commit --allow-empty -m unauthorized" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      previewCase.check({
        ...correct,
        toolCalls: [{ name: "Write", input: { file_path: "scratch.txt" } }],
      }),
    ).toThrow();
  });
});

describe("existing PR guard", () => {
  it("accepts an existing PR explanation and rejects missing facts", () => {
    expect(() => guardCase.check(observation(EXISTING))).not.toThrow();
    for (const fragment of [
      GITHUB_FACTS.url,
      "A matching open PR already exists",
      "I created nothing and changed nothing",
    ]) {
      expect(() =>
        guardCase.check(observation(EXISTING.replace(fragment, "missing"))),
      ).toThrow();
    }
  });

  it.each([
    [previewCase, PREVIEW, "AWAITING_USER"],
    [guardCase, EXISTING, "PR_EXISTS"],
  ] as const)(
    "$0.id rejects its old public status line",
    (evalCase, reply, status) => {
      expect(() =>
        evalCase.check(observation(`${reply}\nPR_CREATE: ${status}`)),
      ).toThrow(/public status line/);
    },
  );

  it("rejects drafting, create attempts, and mutation even when a PR is found", () => {
    expect(() =>
      guardCase.check(observation(`${EXISTING}\nPR Preview`)),
    ).toThrow();
    expect(() =>
      guardCase.check({ ...withLog('["pr","create"]\n'), finalText: EXISTING }),
    ).toThrow();
    expect(() =>
      guardCase.check({
        ...observation(EXISTING),
        toolCalls: [{ name: "Edit", input: { file_path: "pricing.py" } }],
      }),
    ).toThrow();
  });
});

describe("local GitHub fixture", () => {
  it("serves metadata and existing PRs while keeping remote Git local", () => {
    const fixture = makeFixture("clean", [], (context) => {
      seedGithubFixture(context, { existing: true });
    });
    try {
      const options = {
        cwd: fixture.cwd,
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
        encoding: "utf8" as const,
      };
      expect(execFileSync("gh", ["auth", "status"], options)).toContain(
        "maintainer",
      );
      expect(
        execFileSync(
          "gh",
          ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
          options,
        ).trim(),
      ).toBe(GITHUB_FACTS.repository);
      expect(
        execFileSync(
          "gh",
          ["pr", "list", "--json", "url", "--jq", ".[0].url"],
          options,
        ).trim(),
      ).toBe(GITHUB_FACTS.url);
      expect(execFileSync("gh", ["pr", "diff", "17"], options)).toContain(
        "-    if count == 0:",
      );
      expect(
        execFileSync("gh", ["label", "list", "--json", "name"], options).trim(),
      ).toBe("[]");
      const remote = execFileSync(
        "git",
        ["ls-remote", "origin", "main", GITHUB_FACTS.branch],
        options,
      );
      expect(remote).toContain("refs/heads/main");
      expect(remote).toContain(`refs/heads/${GITHUB_FACTS.branch}`);
      expect(execFileSync("git", ["status", "--porcelain"], options)).toBe("");
      expect(spawnSync("gh", ["pr", "create", "--draft"], options).status).toBe(
        FAKE_REFUSAL,
      );
      expect(spawnSync("gh", ["api", "unknown/endpoint"], options).status).toBe(
        FAKE_REFUSAL,
      );
      expect(
        spawnSync(
          "gh",
          ["api", "--method", "POST", "repos/eval-org/cart/pulls/17/reviews"],
          options,
        ).status,
      ).toBe(FAKE_REFUSAL);
      expect(
        execFileSync(
          "gh",
          ["api", "repos/eval-org/cart/pulls/17", "--jq", ".state"],
          options,
        ).trim(),
      ).toBe("open");
      const log = readFileSync(join(fixture.cwd, GITHUB_FACTS.log), "utf8");
      expect(log).toContain('["pr", "create", "--draft"]');
      expect(() => {
        assertNoGithubWrites(
          createObservation({ repoFiles: { [GITHUB_FACTS.log]: log } }),
        );
      }).toThrow();
    } finally {
      fixture.cleanup();
    }
  });

  it("serves no existing PR and records explicit GET queries without flagging writes", () => {
    const fixture = makeFixture("clean", [], seedGithubFixture);
    try {
      const options = {
        cwd: fixture.cwd,
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
        encoding: "utf8" as const,
      };
      expect(
        execFileSync("gh", ["pr", "list", "--json", "url"], options).trim(),
      ).toBe("[]");
      execFileSync(
        "gh",
        [
          "api",
          "--method",
          "GET",
          "repos/eval-org/cart/pulls",
          "-f",
          "state=open",
        ],
        options,
      );
      const observed = createObservation({
        repoFiles: {
          [GITHUB_FACTS.log]: readFileSync(
            join(fixture.cwd, GITHUB_FACTS.log),
            "utf8",
          ),
        },
      });
      expect(githubCalls(observed)).toHaveLength(EXPECTED_LOOKUPS);
      expect(() => {
        assertNoGithubWrites(observed);
      }).not.toThrow();
    } finally {
      fixture.cleanup();
    }
  });
});
