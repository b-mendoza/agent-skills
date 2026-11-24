import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { commands } from "#/cases/pr-creator-rewrite-fixture-tests.ts";

it("serves playbook capability probes without enabling writes", ({
  onTestFinished,
}) => {
  const fixture = commands({ existing: true });
  onTestFinished(fixture.cleanup);
  for (const subcommand of [
    "pr create",
    "pr ready",
    "pr edit",
    "pr view",
    "issue view",
    "issue close",
    "issue comment",
  ]) {
    expect(fixture.gh(...subcommand.split(" "), "--help")).toContain(
      `gh ${subcommand}`,
    );
  }
  expect(() => fixture.gh("pr", "merge", "--help")).toThrow();
  const repo = "repos/eval-org/cart";
  expect(fixture.gh("api", "--method=GET", "--include", repo)).toContain(
    "200 OK",
  );
  expect(
    fixture.gh("api", "--method=GET", "--paginate", `${repo}/labels`),
  ).toBe("[]");
  expect(() =>
    fixture.gh("api", "--method=GET", `${repo}/labels/unknown`),
  ).toThrow(/404/);
  expect(() => fixture.gh("api", "-XPATCH", repo)).toThrow(
    /unsupported command/,
  );
  expect(() =>
    fixture.gh("pr", "view", "17", "--repo=other.host/eval-org/cart"),
  ).toThrow(/unsupported command/);

  expect(() =>
    fixture.gh("api", "repos/eval-org/cart/pulls", "--raw-field", "state=open"),
  ).toThrow();
  expect(
    fixture.gh(
      "auth",
      "status",
      "--hostname",
      "github.com",
      "--active",
      "--no-refresh",
    ),
  ).toContain("Logged in");
  const pulls = (head: string) =>
    JSON.parse(
      fixture.gh(
        "api",
        "--hostname",
        "github.com",
        "--method",
        "GET",
        "--paginate",
        "repos/eval-org/cart/pulls",
        "--raw-field",
        "state=open",
        "--raw-field=base=main",
        "--raw-field",
        `head=eval-org:${head}`,
      ),
    );
  expect(pulls(GITHUB_FACTS.branch)).toMatchObject([{ number: 17 }]);
  expect(pulls("other")).toEqual([]);
});
