import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
import { commands } from "#/cases/pr-creator-rewrite-fixture-tests.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SUCCESS = 0;
const BODY = "## Résumé\n\n雪 and café\n";

describe("pr-creator create fixture", () => {
  it.each([false, true])(
    "records exact approved bytes with drift=%s",
    (drift) => {
      const fixture = makeFixture("clean", [], (context) => {
        seedGithubFixture(context, { allowCreate: true, readbackDrift: drift });
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
        const assignment = execFileSync(
          "gh",
          ["api", "repos/eval-org/cart/assignees/maintainer", "-i"],
          options,
        );
        expect(assignment).toContain("HTTP/2.0 204 No Content");
        const rejected = spawnSync(
          "gh",
          ["api", "repos/eval-org/cart/assignees/not-assignable", "--include"],
          options,
        );
        expect(rejected.status).not.toBe(SUCCESS);
        expect(rejected.stdout).toContain("HTTP/2.0 404 Not Found");
        const bodyPath = join(fixture.cwd, ".git", "body.txt");
        writeFileSync(bodyPath, BODY);
        const args = [
          "pr",
          "create",
          "--repo",
          `github.com/${GITHUB_FACTS.repository}`,
          `--head=${GITHUB_FACTS.branch}`,
          "--base=main",
          "--title",
          GITHUB_FACTS.title,
          "--body-file",
          bodyPath,
          "--draft",
          "--assignee",
          "maintainer",
        ];
        const result = spawnSync("gh", args, options);
        expect(result.status).toBe(SUCCESS);
        expect(result.stdout.trim()).toBe(GITHUB_FACTS.url);
        const captured = Schema.decodeUnknownSync(
          Schema.Struct({
            args: Schema.Array(Schema.String),
            body: Schema.String,
            assignees: Schema.Array(Schema.String),
          }),
        )(
          JSON.parse(
            readFileSync(join(fixture.cwd, ".git/eval-created.json"), "utf8"),
          ),
        );
        expect(captured).toMatchObject({
          args,
          body: BODY,
          assignees: ["maintainer"],
        });
        const returned = Schema.decodeUnknownSync(
          Schema.Struct({
            body: Schema.String,
            labels: Schema.Array(Schema.Struct({ name: Schema.String })),
            assignees: Schema.Array(Schema.Struct({ login: Schema.String })),
          }),
        )(
          JSON.parse(
            execFileSync(
              "gh",
              [
                "pr",
                "view",
                GITHUB_FACTS.url,
                "--json",
                "body,labels,assignees",
              ],
              options,
            ),
          ),
        );
        expect(returned.body).toBe(
          drift ? `${BODY}\nAutomation footer\n` : BODY,
        );
        expect(returned.labels).toEqual(drift ? [{ name: "automation" }] : []);
        expect(returned.assignees).toEqual([{ login: "maintainer" }]);
        const snapshot = Schema.decodeUnknownSync(
          Schema.Struct({ body: Schema.String }),
        )(
          JSON.parse(
            readFileSync(join(fixture.cwd, ".git/eval-readback.json"), "utf8"),
          ),
        );
        expect(snapshot.body).toBe(returned.body);
        expect(
          spawnSync(
            "gh",
            ["pr", "edit", GITHUB_FACTS.url, "--body", "wrong"],
            options,
          ).status,
        ).not.toBe(SUCCESS);
      } finally {
        fixture.cleanup();
      }
    },
  );
});

const TARGET = ["17", "-R", GITHUB_FACTS.repository];
const ISSUE = ["12", `--repo=github.com/${GITHUB_FACTS.repository}`];
const ISSUES = [
  { number: 12, title: "Price", state: "open" },
  { number: 14, title: "Fix", state: "closed", isPr: true },
] as const;
const FIXTURE_TIMEOUT_MS = 30_000;
it(
  "preserves applied fields when ready fails, and derives closures from the edited body",
  ({ onTestFinished }) => {
    const fixture = commands({
      existing: true,
      allowEdit: true,
      issues: ISSUES,
      editFailsOn: "pr ready",
    });
    onTestFinished(fixture.cleanup);
    const path = join(fixture.cwd, ".git/body");
    writeFileSync(path, "Fixes #12, related to #14");
    fixture.gh(
      "pr",
      "edit",
      ...TARGET,
      "--add-reviewer",
      "peer",
      "--body-file",
      path,
    );
    expect(fixture.capture("pr-edit-1")).toMatchObject({
      args: [
        "pr",
        "edit",
        ...TARGET,
        "--add-reviewer",
        "peer",
        "--body-file",
        path,
      ],
    });
    expect(() => fixture.gh("pr", "ready", ...TARGET)).toThrow();
    expect(JSON.parse(fixture.gh("pr", "view", ...TARGET))).toMatchObject({
      isDraft: true,
      reviewRequests: [{ login: "peer" }],
      closingIssuesReferences: [{ number: 12 }],
    });
    writeFileSync(path, "Related: #12");
    fixture.gh("pr", "edit", ...TARGET, "--body-file", path);
    expect(JSON.parse(fixture.gh("pr", "view", ...TARGET))).toMatchObject({
      closingIssuesReferences: [],
    });
  },
  FIXTURE_TIMEOUT_MS,
);
it(
  "returns the baseline before simulating an external edit",
  ({ onTestFinished }) => {
    const fixture = commands({ existing: true, mutateBeforeEdit: true });
    onTestFinished(fixture.cleanup);
    const view = () =>
      fixture.gh(
        "pr",
        "view",
        ...TARGET,
        "--json",
        "title,body",
        "--jq",
        ".title",
      );
    expect(view()).toBe(GITHUB_FACTS.title);
    expect(view()).not.toBe(GITHUB_FACTS.title);
  },
  FIXTURE_TIMEOUT_MS,
);
it(
  "reads PR identity, exact issue comments, and the close reason",
  ({ onTestFinished }) => {
    const fixture = commands({
      issues: ISSUES,
      allowIssueWrites: true,
      me: "author",
    });
    onTestFinished(fixture.cleanup);
    const api = `repos/${GITHUB_FACTS.repository}/issues`;
    expect(JSON.parse(fixture.gh("api", `${api}/14`))).toHaveProperty(
      "pull_request",
    );
    const path = join(fixture.cwd, ".git/body");
    const body = `${BODY}\r\n`;
    writeFileSync(path, body);
    const url = fixture.gh("issue", "comment", ...ISSUE, "--body-file", path);
    const [, id] = url.split("#issuecomment-");
    expect(
      JSON.parse(fixture.gh("api", `${api}/comments/${id}`)),
    ).toMatchObject({
      body,
      user: { login: "author" },
    });
    expect(fixture.capture("issue-comment-1")).toMatchObject({ body });
    expect(
      JSON.parse(fixture.gh("api", "--paginate", `${api}/12/comments`)),
    ).toMatchObject([{ body, issue_url: `https://api.github.com/${api}/12` }]);
    expect(fixture.gh("api", "user", "--jq", ".login")).toBe("author");
    fixture.gh("issue", "close", ...ISSUE, "--reason=not planned");
    expect(JSON.parse(fixture.gh("issue", "view", ...ISSUE))).toMatchObject({
      state: "CLOSED",
      stateReason: "NOT_PLANNED",
    });
  },
  FIXTURE_TIMEOUT_MS,
);

it.for(["comment", "close"] as const)(
  "refuses only the configured %s on issue 13",
  { timeout: FIXTURE_TIMEOUT_MS },
  (action, { onTestFinished }) => {
    const number = 13;
    const fixture = commands({
      issues: [...ISSUES, { number, state: "open", title: "Other" }],
      allowIssueWrites: true,
      issueWriteFailsOn: { action, number },
    });
    onTestFinished(fixture.cleanup);
    const body = join(fixture.cwd, ".git/body");
    writeFileSync(body, BODY);
    const write = (verb: "comment" | "close", issue: string) =>
      fixture.gh(
        "issue",
        verb,
        issue,
        "-R",
        GITHUB_FACTS.repository,
        ...(verb === "comment"
          ? ["--body-file", body]
          : ["--reason", "not planned"]),
      );
    write(action, "12");
    write(action === "comment" ? "close" : "comment", String(number));
    expect(() => write(action, String(number))).toThrow(/unsupported command/);
    expect(fixture.capture(`issue-${action}-1`)).toMatchObject({
      args: [
        "issue",
        action,
        "12",
        "-R",
        GITHUB_FACTS.repository,
        ...(action === "comment"
          ? ["--body-file", body]
          : ["--reason", "not planned"]),
      ],
    });
    expect(() => fixture.capture(`issue-${action}-2`)).toThrow(/ENOENT/);
  },
);
