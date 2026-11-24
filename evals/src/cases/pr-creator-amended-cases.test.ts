import { expect, it } from "vitest";

import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import {
  acceptsOnly,
  base,
  gate,
  head,
  observation,
  ref,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";

const local = "d".repeat(head.length);
const branch = `.git/${ref}`;
const loose = `.git/fixture-origin.git/${ref}`;
const packed = ".git/fixture-origin.git/packed-refs";
const push = ".git/eval-push-1.json";
const logs = `${base} ${head} Eval\tcommit: fixture\n`;
const initial = {
  [packed]: `${head} ${ref}\n`,
  [loose]: null,
  [push]: null,
  [facts.baselineLog]: logs,
  [HEAD_LOG]: logs,
};
it("requires the actual git setting in the plain push values", () => {
  const values = {
    headBranch: facts.branch,
    headSha: local,
    headRemote: "origin",
    action: `git push origin ${facts.branch}`,
    extras: ["push.followTags=true"],
  };
  const files = { ...initial, [branch]: local };
  expect(
    acceptsOnly(
      "push-discloses-settings",
      observation([gate("push", values)], files),
      observation([gate("push", { ...values, extras: [] })], files),
    ),
  ).not.toThrow();
});
