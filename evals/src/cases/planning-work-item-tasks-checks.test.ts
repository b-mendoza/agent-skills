import { expect, test } from "vitest";

import {
  assertPlanningWrites,
  HEAD_LOG,
} from "#/cases/planning-work-item-tasks-checks.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const artifact = "docs/acme-app-42.md";
const observation = createObservation({
  gitStatusAfter: { kind: "worktree", entries: `?? ${artifact}` },
  repoFiles: {
    [artifact]: "plan",
    [HEAD_LOG]: "commit: seed planning inputs\n",
    ".git/eval-fixture-root": "/fixture\n/canonical/fixture",
  },
});

test.each([
  `/outside/${artifact}`,
  `../outside/${artifact}`,
  `/fixture-other/${artifact}`,
])("planning rejects foreign-root same-suffix write %s", (path) => {
  expect(() => {
    assertPlanningWrites(
      {
        ...observation,
        toolCalls: [
          { name: "Write", input: { file_path: artifact } },
          { name: "Edit", input: { file_path: path } },
        ],
      },
      [artifact],
      {},
    );
  }).toThrow();
});

test.each([artifact, `/fixture/${artifact}`, `/canonical/fixture/${artifact}`])(
  "planning accepts fixture artifact %s",
  (path) => {
    expect(() => {
      assertPlanningWrites(
        {
          ...observation,
          toolCalls: [{ name: "Write", input: { file_path: path } }],
        },
        [artifact],
        {},
      );
    }).not.toThrow();
  },
);
