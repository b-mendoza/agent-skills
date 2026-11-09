import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  CREATED_BODY,
  EVIDENCE,
  EVIDENCE_PATH,
  FACTS,
  seedReportingFixture,
  SKILL,
} from "#/cases/reporting-skill-issues-fixtures.ts";
import { GH_LOG, makeFixture } from "#/fixtures/fixtures.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const EXECUTABLE_BITS = 0o111;
const SUCCESS_EXIT = 0;
const SEARCH =
  "issue\tlist\t--repo\tb-mendoza/agent-skills\t--state\tall\t--limit\t20\t--search\tgenerate-handoff-document backup\t--json\tnumber,title,url,state,stateReason\t\n";
test("fake gh serves preflight, bounded search, view, and recorded writes without network", () => {
  const fixture = makeFixture("clean", [SKILL], seedReportingFixture);
  const cli = join(fixture.binPath, "gh");
  const invoke = (...args: string[]) =>
    execFileSync(cli, args, { cwd: fixture.cwd, encoding: "utf8" });
  try {
    expect(statSync(cli).mode & EXECUTABLE_BITS).not.toBe(SUCCESS_EXIT);
    expect(readFileSync(join(fixture.cwd, EVIDENCE_PATH), "utf8")).toBe(
      EVIDENCE,
    );
    for (const subcommand of ["list", "view"]) {
      expect(invoke("issue", subcommand, "--help")).toContain("stateReason");
    }
    expect(invoke("issue", "create", "--help")).toContain("--body-file");
    expect(
      invoke("auth", "status", "--active", "--hostname", "github.com"),
    ).toContain(FACTS.login);
    expect(
      invoke(
        "api",
        "--hostname",
        "github.com",
        "user",
        "--jq",
        ".login",
      ).trim(),
    ).toBe(FACTS.login);
    expect(invoke(...SEARCH.trim().split("\t")).trim()).toBe("[]");
    expect(
      invoke(
        "issue",
        "view",
        "17",
        "--repo",
        "b-mendoza/agent-skills",
        "--json",
        "body",
      ),
    ).toContain("Unrelated");
    expect(
      spawnSync(cli, ["issue", "list", "--repo", "wrong/repo"], {
        cwd: fixture.cwd,
      }).status,
    ).not.toBe(SUCCESS_EXIT);
    expect(
      spawnSync(cli, ["release", "create"], { cwd: fixture.cwd }).status,
    ).not.toBe(SUCCESS_EXIT);
    const before = snapshotRepoFiles(fixture.cwd, [CREATED_BODY]);
    expect(before[CREATED_BODY]).toBeNull();
    expect(
      execFileSync(
        cli,
        [
          "issue",
          "create",
          "--repo",
          "b-mendoza/agent-skills",
          "--title",
          "test",
          "--body-file",
          "-",
        ],
        { cwd: fixture.cwd, encoding: "utf8", input: "exact body\n" },
      ).trim(),
    ).toBe("https://github.com/b-mendoza/agent-skills/issues/999");
    expect(readFileSync(join(fixture.cwd, CREATED_BODY), "utf8")).toBe(
      "exact body\n",
    );
    expect(readFileSync(join(fixture.cwd, GH_LOG), "utf8")).toContain(
      "issue\tcreate\t--repo\tb-mendoza/agent-skills",
    );
    expect(invoke("api", "user", "--jq", ".login").trim()).toBe(FACTS.login);
  } finally {
    fixture.cleanup();
  }
});
