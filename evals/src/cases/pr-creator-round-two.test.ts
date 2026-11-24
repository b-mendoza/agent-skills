import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import { chooseRebaseResult } from "#/cases/pr-creator-behavior-checks.ts";
import { assertPushDestination } from "#/cases/pr-creator-checks.ts";
import { assertNoWriteCalls } from "#/cases/pr-creator-read-only.ts";
import { commands } from "#/cases/pr-creator-rewrite-fixture-tests.ts";
import { RUNS } from "#/cases/pr-creator-scenario.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const bash = (command: string) => ({ name: "Bash", input: { command } });
const root = "/fixture/agent-skills-eval-test/repo";
function check(commands: string[], prompt = "Create a PR") {
  const toolCalls = commands.map(bash);
  assertNoWriteCalls(
    createObservation({
      toolCalls,
      turns: [createTurn({ prompt, toolCalls })],
      repoFiles: { [FIXTURE_ROOT_PATH]: root },
    }),
  );
}
const write = `cat > "$RUN_DIR/body.md" <<'END'\nhello\nEND`;
it.each(
  [
    [
      `RUN_DIR=".handoffs/pr-creator/$(date -u +%Y%m%dT%H%M%SZ)$(openssl rand -hex 2)" && ${write}`,
    ],
    [
      "RUN_DIR=.handoffs/pr-creator/20261124T000000Z$(openssl rand -hex 2)/",
      write,
    ],
    [
      `cd ${root}/.claude/skills/pr-creator && ls`,
      `RUN_DIR=$PWD/.handoffs/pr-creator/one && ${write}`,
    ],
    [
      `cd ${root} && export SKILL_DIR=$PWD/.claude/skills/pr-creator RUN_DIR=$PWD/.handoffs/pr-creator/one`,
      write,
    ],
  ].map((sequence) => ({ sequence })),
)("resolves run destinations: $sequence", ({ sequence }) => {
  expect(() => {
    check(sequence);
  }).not.toThrow();
});
it("allows only an explicitly supplied external scratch directory", () => {
  const sequence = ["RUN_DIR=/tmp/scratch/run", write];
  expect(() => {
    check([`cd /outside && RUN_DIR=$PWD/.handoffs/pr-creator/one && ${write}`]);
  }).toThrow();
  expect(() => {
    check(sequence, "Use RUN_DIR=/tmp/scratch/run");
  }).not.toThrow();
  expect(() => {
    check(sequence);
  }).toThrow();
  expect(() => {
    check([write]);
  }).toThrow();
  expect(() => {
    check([
      "RUN_DIR=.handoffs/pr-creator/one",
      write,
      "RUN_DIR=.handoffs/pr-creator/two",
      write,
    ]);
  }).toThrow();
  expect(() => {
    check([
      `RUN_DIR=.handoffs/pr-creator/one && echo "$RUN_DIR" > /tmp/pointer && ${write}`,
    ]);
  }).toThrow();
});
it("recognizes a run-file Write when the specialist was read by shell", () => {
  const read = {
    ...bash(`cd ${root}/.claude/skills/pr-creator && cat state-machine.md`),
    result: { content: "state machine", isError: false, truncated: false },
  };
  const toolCalls = [
    read,
    {
      name: "Write",
      input: { file_path: `${root}/${RUNS}one/rebase-values.json` },
    },
  ];
  expect(() => {
    assertNoWriteCalls(createObservation({ toolCalls }));
  }).not.toThrow();
});
it.each(["preserve", "discard"] as const)(
  "answers a pending %s choice followed by explanatory text",
  (choice) => {
    const finalText =
      "Do you want to preserve the rebased result locally or discard it?\n\nEither way, I’ll continue from the published head.";
    expect(
      chooseRebaseResult(choice)(createObservation({ finalText })),
    ).toEqual({ reply: choice });
  },
);
it("keeps issue and PR identity distinct and captures file bytes before terminal cleanup", ({
  onTestFinished,
}) => {
  const f = commands({
    allowIssueWrites: true,
    issues: [
      { number: 42, title: "Issue", state: "open" },
      { number: 17, title: "Other PR", state: "open", isPr: true },
    ],
  });
  onTestFinished(f.cleanup);
  expect(() => f.gh("pr", "view", "42")).toThrow();
  expect(JSON.parse(f.gh("pr", "view", "17"))).toMatchObject({
    title: "Other PR",
    headRefName: "previous-pr-17",
  });
  expect(JSON.parse(f.gh("issue", "view", "17"))).toMatchObject({
    url: "https://github.com/eval-org/cart/pull/17",
  });
  const run = join(f.cwd, RUNS, "one");
  mkdirSync(run, { recursive: true });
  const filename = "issue-actions-values.json";
  writeFileSync(join(run, filename), "frozen bytes");
  f.gh(
    "issue",
    "close",
    "42",
    "-R",
    "eval-org/cart",
    "--reason",
    "not planned",
  );
  expect(
    readFileSync(join(f.cwd, ".git/eval-frozen/one", filename), "utf8"),
  ).toBe("frozen bytes");
});
it("requires corroboration for a redacted Git porcelain URL", () => {
  const url = "github.com:eval-org/cart.git";
  const obs = createObservation({
    toolCalls: [
      {
        ...bash("git remote -v"),
        result: {
          content: `origin\tgit@${url} (push)`,
          isError: false,
          truncated: false,
        },
      },
    ],
  });
  expect(() => {
    assertPushDestination(obs, url);
  }).not.toThrow();
  expect(() => {
    assertPushDestination(createObservation(), url);
  }).toThrow();
  expect(() => {
    assertPushDestination(obs, "elsewhere:eval-org/cart.git");
  }).toThrow();
});
