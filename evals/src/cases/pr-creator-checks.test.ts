import { expect, test } from "vitest";

import { assertOnlyReportWritten } from "#/cases/pr-creator-checks.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const { report } = GITHUB_FACTS;
const runFile = ".handoffs/review-pull-request/run-1/context.txt";
const observation = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${report}` },
  repoFiles: {
    [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
    [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
    ".git/logs/HEAD": "baseline",
    [GITHUB_FACTS.baselineLog]: "baseline",
    [GITHUB_FACTS.log]: "",
    ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
  },
});

test.each([
  `/outside/${report}`,
  `../outside/${report}`,
  `/fixture/.claude/${report}`,
  `/outside/${runFile}`,
  `/fixture/.claude/${runFile}`,
])("PR report rejects foreign-root same-suffix write %s", (path) => {
  expect(() => {
    assertOnlyReportWritten(
      {
        ...observation,
        toolCalls: [
          { name: "Write", input: { file_path: report } },
          { name: "Edit", input: { file_path: path } },
        ],
      },
      true,
    );
  }).toThrow();
});

test.each([
  report,
  `/fixture/${report}`,
  `/canonical/fixture/${report}`,
  runFile,
  `/fixture/${runFile}`,
  `/canonical/fixture/${runFile}`,
])("PR report accepts fixture artifact %s", (path) => {
  expect(() => {
    assertOnlyReportWritten(
      {
        ...observation,
        toolCalls: [{ name: "Write", input: { file_path: path } }],
      },
      true,
    );
  }).not.toThrow();
});
