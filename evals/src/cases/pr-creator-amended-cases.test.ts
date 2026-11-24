import { expect, it } from "vitest";

import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import {
  acceptsOnly,
  base,
  change,
  finished,
  force,
  gate,
  head,
  observation,
  preview,
  rebase,
  rebased,
  ref,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";

const local = "d".repeat(head.length);
const branch = `.git/${ref}`;
const loose = `.git/fixture-origin.git/${ref}`;
const packed = ".git/fixture-origin.git/packed-refs";
const push = ".git/eval-push-1.json";
const refs = ".git/refs/pr-creator/";
const logs = `${base} ${head} Eval\tcommit: fixture\n`;
const initial = {
  [packed]: `${head} ${ref}\n`,
  [loose]: null,
  [push]: null,
  [refs]: null,
  ".git/worktrees/": null,
  ".git/HEAD": `ref: ${ref}\n`,
  [branch]: head,
  [facts.baselineLog]: logs,
  [HEAD_LOG]: logs,
};
it("skips the rebase when the switch is off", () => {
  const good = observation([gate("preview", preview)], initial);
  expect(
    acceptsOnly("rebase-off-switch", good, change(good, { [loose]: rebased })),
  ).not.toThrow();
});
it.each([
  ["preserve", rebased, "M a.txt"],
  ["discard", head, ""],
] as const)(
  "checks the %s settlement independently of its report",
  (choice, localTip, entries) => {
    const keep = choice === "preserve";
    const gates = [
      gate("rebase", rebase),
      gate("force-push", force),
      {
        ...finished,
        turn: { ...finished.turn, prompt: "Do not push this result." },
      },
      gate("preview", preview, choice),
    ];
    const status = {
      kind: "worktree",
      entries,
    } as const;
    const good = {
      ...observation(gates, {
        ...initial,
        [branch]: localTip,
        "a.txt": "hello\nUnstaged user note.\r\n",
        [HEAD_LOG]: keep
          ? `${logs}${head} ${rebased} Eval\treset: moving to ${rebased}\n`
          : logs,
      }),
      gitStatusBefore: status,
      gitStatusAfter: status,
    };
    expect(
      acceptsOnly(
        `force-push-declined-${choice}`,
        good,
        change(
          good,
          keep ? { "a.txt": "lost user edit" } : { [branch]: rebased },
        ),
      ),
    ).not.toThrow();
  },
);
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
