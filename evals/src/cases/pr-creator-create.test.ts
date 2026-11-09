import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  GITHUB_FACTS,
  seedGithubFixture,
} from "#/cases/pr-creator-fixtures.ts";
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
          "-R",
          GITHUB_FACTS.repository,
          "--head",
          GITHUB_FACTS.branch,
          "--base",
          "main",
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
