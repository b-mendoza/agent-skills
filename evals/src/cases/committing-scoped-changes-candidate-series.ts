import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { join } from "node:path";

import {
  behavioralDefaults,
  type EvalCase,
  type SeedContext,
} from "#/cases/case-contract.ts";
import { agentOutputs } from "#/cases/committing-scoped-changes-plan-evidence.ts";
import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  capturedText,
  checkPositiveRouting,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles, writeRepoFiles } from "#/fixtures/fixtures.ts";
import type { ToolCall, TurnObservation } from "#/observation/agent-query.ts";

const skill = "committing-scoped-changes";
const eventsPath = ".candidate-evidence/events";
const groups = [
  { path: "a.txt", message: "fix: update greeting", state: "goodbye old" },
  { path: "guide.txt", message: "docs: update guide", state: "goodbye new" },
];
const checkCommand = "sh check.sh";
const executable = 0o755;
const first = 0;
const eventsPerCommit = 2;
const afterCheck = 1;

function seed({ repoPath }: SeedContext) {
  commitRepoFiles(
    repoPath,
    {
      ".gitignore": ".candidate-evidence/\n",
      "guide.txt": "old\n",
      "check.sh": `#!/bin/sh
set -eu
test ! -e .git
read -r greeting < a.txt
read -r guide < guide.txt
test "$greeting" = goodbye
case "$guide" in old|new) ;; *) exit 1 ;; esac
printf 'check %s %s\\n' "$greeting" "$guide" >> ${eventsPath}
printf 'greeting and guide passed\\n'
`,
    },
    "seed candidate checks",
  );
  const hook = ".git/hooks/post-commit";
  writeRepoFiles(repoPath, {
    "a.txt": "goodbye\n",
    "guide.txt": "new\n",
    [eventsPath]: "",
    [hook]: `#!/bin/sh\nprintf 'commit %s %s\\n' "$(git log -1 --format='%T %s')" "$(git diff-tree -r --name-only --no-commit-id HEAD)" >> ${eventsPath}\n`,
  });
  chmodSync(join(repoPath, hook), executable);
}

function candidatePlan(calls: readonly ToolCall[]): string {
  return (
    agentOutputs(calls).findLast((output) =>
      /^COMMIT_PLAN: PASS$/m.test(output),
    ) ?? ""
  );
}

function previewMatches(turn: TurnObservation | undefined): boolean {
  if (turn === undefined) return false;
  const text = normalizeReplyText(turn.finalText);
  const plan = candidatePlan(turn.toolCalls);
  return (
    /^Checks: candidate$/m.test(plan) &&
    /\bapprove\b.*\brevise:.*\bstop\b/i.test(text) &&
    groups.every(({ message, path }) =>
      text.includes(
        `Message: ${message}\nPaths: ${path}\nVerification: ${checkCommand}`,
      ),
    )
  );
}

function assertReceipt(
  output: string | undefined,
  path: string,
  message: string,
  tree: string,
) {
  const lines = output?.split("\n") ?? [];
  for (const expected of [
    "COMMIT_EXECUTE: PASS",
    `Paths: ${path}`,
    `Tree: ${tree}=${tree}`,
    `Verification: ${checkCommand}`,
    "Verification exit: 0",
    `Verification scope: candidate tree ${tree}; ignored files linked from the worktree`,
  ]) {
    assert.ok(
      lines.includes(expected),
      `receipt for ${message} lacks ${expected}`,
    );
  }
}

export const candidateSeries = {
  ...behavioralDefaults,
  id: `${skill}/candidate-series`,
  skill,
  mutationPolicy: "allowed",
  seed,
  snapshotPaths: [eventsPath],
  intent: "Run the same check separately on each approved commit's own tree",
  prompt: () =>
    `Use ${skill}. Commit a.txt first as 'fix: update greeting', then guide.txt as 'docs: update guide'. Verify each commit on its own tree using sh check.sh. Show each group with consecutive Message:, Paths:, and Verification: lines.`,
  followUps: [
    {
      name: "approve candidate checks",
      reply: (observation) => {
        if (!previewMatches(observation.turns?.at(first))) {
          return { gateNotReached: "missing two-group candidate plan" };
        }
        assertNoMutation(observation);
        return { reply: "approve" };
      },
    },
  ],
  check: (observation) => {
    checkPositiveRouting(observation, skill);
    const approved = assertNoMutationBeforeReply(
      observation,
      (turn) => turn.prompt === "approve",
    );
    assert.ok(
      previewMatches(observation.turns?.at(first)),
      "missing approved candidate plan",
    );
    const receipts = agentOutputs(approved.toolCalls).filter((output) =>
      /^COMMIT_EXECUTE:/m.test(output),
    );
    const events = capturedText(observation, eventsPath).trimEnd().split("\n");
    assert.equal(
      receipts.length,
      groups.length,
      "expected one receipt per commit",
    );
    assert.equal(
      events.length,
      groups.length * eventsPerCommit,
      "expected one check per commit",
    );
    groups.forEach(({ message, path, state }, index) => {
      const offset = index * eventsPerCommit;
      assert.equal(
        events[offset],
        `check ${state}`,
        "check ran on wrong group state",
      );
      const commit = events[offset + afterCheck];
      assert.ok(commit !== undefined, "missing group commit");
      const [, tree] = commit.split(" ");
      assert.ok(tree !== undefined);
      assert.match(tree, /^[0-9a-f]{40}$/);
      assert.equal(
        commit,
        `commit ${tree} ${message} ${path}`,
        "expected checked group commit",
      );
      assertReceipt(receipts[index], path, message, tree);
    });
    return "Both commands ran on the approved candidate states and receipts match the committed trees";
  },
} as const satisfies EvalCase;
