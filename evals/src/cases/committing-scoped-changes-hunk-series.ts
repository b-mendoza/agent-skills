import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { join } from "node:path";

import {
  behavioralDefaults,
  type EvalCase,
  type SeedContext,
} from "#/cases/case-contract.ts";
import {
  agentOutputs,
  validEnvelope,
} from "#/cases/committing-scoped-changes-plan-evidence.ts";
import {
  assertNoMutation,
  assertNoMutationBeforeReply,
  capturedText,
  checkPositiveRouting,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles, writeRepoFiles } from "#/fixtures/fixtures.ts";
import type { TurnObservation } from "#/observation/agent-query.ts";

const skill = "committing-scoped-changes";
const initial = "timeout=30\nseparator\ncolor=blue\n";
const intermediate = initial.replace("30", "60");
const final = intermediate.replace("blue", "green");
const logPath = ".git/hunk-series";
const executable = 0o755;
const first = 0;
const states = [intermediate, final];

function seed({ repoPath }: SeedContext) {
  commitRepoFiles(
    repoPath,
    { "a.txt": initial },
    "seed two independent settings",
  );
  const hook = ".git/hooks/post-commit";
  // Read the real checkout, regardless of the working directory used for hooks.
  writeRepoFiles(repoPath, {
    "a.txt": final,
    [hook]: `#!/bin/sh
set -eu
dir=$(git rev-parse --absolute-git-dir)
{
  git rev-parse 'HEAD^{tree}'
  git diff-tree --no-commit-id --name-only -r HEAD
  git show HEAD:a.txt
  cat "$dir/../a.txt"
} >> "$dir/hunk-series"
`,
  });
  chmodSync(join(repoPath, hook), executable);
}

function envelopeText(output: string, pattern: RegExp): string {
  return pattern.exec(output)?.[first] ?? "";
}

function splitPlan(turn: TurnObservation, base: string | null): boolean {
  const output =
    agentOutputs(turn.toolCalls).findLast((text) =>
      /^COMMIT_PLAN:/m.test(text),
    ) ?? "";
  const plan = envelopeText(
    output,
    /^COMMIT_PLAN: PASS\n[\s\S]*?^Warnings: [^\n]+/m,
  );
  if (!validEnvelope(plan, "plan")) return false;
  const selections = plan
    .split("\n")
    .filter((line) => line.startsWith("Hunks:") || line.startsWith("Paths:"));
  return (
    selections.join("\n") ===
    `Paths: a.txt\nHunks: ${base} a.txt#1\nPaths: a.txt\nHunks: ${base} a.txt#2+1`
  );
}

function visibleSplit(text: string): boolean {
  return (
    text.includes("@@ -1 +1 @@ -timeout=30") &&
    text.includes("@@ -3 +3 @@ -color=blue") &&
    /\bapprove\b.*\brevise:.*\bstop\b/is.test(text)
  );
}

function splitPreview(turn: TurnObservation | undefined): boolean {
  if (turn?.gitHeadAfter.kind !== "head") return false;
  return (
    splitPlan(turn, turn.gitHeadAfter.oid) &&
    visibleSplit(normalizeReplyText(turn.finalText))
  );
}

function receiptTree(output: string): string {
  const payload = envelopeText(
    output,
    /^COMMIT_EXECUTE: PASS\n[\s\S]*?^Verification scope: [^\n]+/m,
  );
  assert.ok(validEnvelope(payload, "execute"), "missing valid PASS receipt");
  assert.match(payload, /^Paths: a\.txt$/m);
  const tree = /^Tree: (?<tree>[0-9a-f]{40})=/m.exec(payload)?.groups?.["tree"];
  assert.ok(tree !== undefined, "missing tree proof");
  return tree;
}

export const hunkSeries = {
  ...behavioralDefaults,
  id: `${skill}/hunk-series`,
  skill,
  mutationPolicy: "allowed",
  seed,
  intent:
    "Split two independent changes to the same file across approved commits",
  snapshotPaths: [logPath],
  prompt: () =>
    `Use ${skill}. Split a.txt's changes across two commits: commit the timeout change first and the color change second. Include each selected hunk's header and first changed line verbatim in the preview.`,
  followUps: [
    {
      name: "approve split",
      reply: (observation) => {
        if (!splitPreview(observation.turns?.at(first))) {
          return { gateNotReached: "missing two-group hunk plan" };
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
      splitPreview(observation.turns?.at(first)),
      "missing approved split plan",
    );
    const receipts = agentOutputs(approved.toolCalls).filter((text) =>
      /^COMMIT_EXECUTE:/m.test(text),
    );
    assert.equal(receipts.length, states.length, "expected two receipts");
    const expected = receipts
      .map(
        (receipt, index) =>
          `${receiptTree(receipt)}\na.txt\n${states[index]}${final}`,
      )
      .join("");
    assert.equal(
      capturedText(observation, logPath),
      expected,
      "commit evidence does not match approved hunk states and worktree",
    );
    return "Both committed trees match their receipts; the second hunk stayed in the worktree until its commit";
  },
} as const satisfies EvalCase;
