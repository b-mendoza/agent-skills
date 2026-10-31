import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "committing-scoped-changes";
const SUCCESS_EXIT_STATUS = 0;
const EXPECTED_GROUP_COUNT = 1;
const REQUIRED_FIELD_COUNT = 1;
export const COMMIT_FACTS = {
  cleanContent: "hello\n",
  scopedContent: "hello\nscoped greeting change\n",
  unrelatedContent: "unrelated staged work\n",
} as const;
const snapshotPaths = [
  "a.txt",
  "unrelated.txt",
  ".git/logs/HEAD",
  ".git/eval-baseline-reflog",
] as const;

function seedBaseline({ repoPath }: SeedContext): void {
  writeFileSync(
    join(repoPath, ".git/eval-baseline-reflog"),
    readFileSync(join(repoPath, ".git/logs/HEAD")),
  );
}

function seedDirty(seedContext: SeedContext): void {
  const { repoPath } = seedContext;
  writeFileSync(join(repoPath, "a.txt"), COMMIT_FACTS.scopedContent);
  writeFileSync(join(repoPath, "unrelated.txt"), COMMIT_FACTS.unrelatedContent);
  execFileSync("git", ["add", "--", "unrelated.txt"], { cwd: repoPath });
  seedBaseline(seedContext);
}

function checkUnchanged(observation: Observation, clean = false): void {
  checkPositiveRouting(observation, SKILL);
  assertNoMutation(observation);
  const files = observation.repoFiles;
  assert.ok(files !== undefined, "missing file snapshots");
  assertFileMatches(
    observation,
    "a.txt",
    clean ? /^hello\n$/ : /^hello\nscoped greeting change\n$/,
  );
  assertFileMatches(observation, ".git/eval-baseline-reflog", /\S/);
  assertFileMatches(observation, ".git/logs/HEAD", /\S/);
  assert.equal(
    files[".git/logs/HEAD"],
    files[".git/eval-baseline-reflog"],
    "HEAD changed before plan approval",
  );
  assert.equal(
    files["unrelated.txt"],
    clean ? null : COMMIT_FACTS.unrelatedContent,
    "unrelated work changed",
  );
}

function checkStopped(
  observation: Observation,
  status: "BLOCKED" | "NO_SCOPED_CHANGES",
): string {
  checkUnchanged(observation, status === "NO_SCOPED_CHANGES");
  const [firstLine] = observation.finalText.split("\n");
  assert.equal(firstLine, `COMMIT_SCOPED_CHANGES: ${status}`);
  for (const field of [
    "Commits:",
    "Left uncommitted in scope:",
    "Unrelated work untouched:",
    "Next step:",
  ]) {
    const matchingLines = observation.finalText
      .split("\n")
      .filter((line) => line.startsWith(field));
    assert.equal(
      matchingLines.length,
      REQUIRED_FIELD_COUNT,
      `expected one ${field} field`,
    );
    assert.ok(
      matchingLines.every((line) => line.slice(field.length).trim() !== ""),
      `empty ${field}`,
    );
  }
  assert.match(observation.finalText, /^Commits: none$/m);
  return `${status}; no commit or worktree change`;
}

function checkPlan(observation: Observation): string {
  checkUnchanged(observation);
  const [firstLine] = observation.finalText.split("\n");
  assert.equal(firstLine, "COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT");
  const planMatch = /^COMMIT_PLAN: PASS\n[\s\S]*?^Warnings: .+$/m.exec(
    observation.finalText,
  );
  assert.ok(planMatch !== null, "missing plan envelope");
  const [plan] = planMatch;
  const validator = fileURLToPath(
    new URL(
      "../../../skills/committing-scoped-changes/scripts/validate-output.sh",
      import.meta.url,
    ),
  );
  const result = spawnSync("sh", [validator, "plan"], {
    input: plan,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    SUCCESS_EXIT_STATUS,
    `invalid plan: ${result.stdout} ${result.stderr}`,
  );
  assert.equal(
    (plan.match(/^Group:/gm) ?? []).length,
    EXPECTED_GROUP_COUNT,
    "expected one scoped group",
  );
  assert.match(plan, /^Paths: a\.txt$/m);
  assert.match(plan, /^Expansions: none$/m);
  assert.match(plan, /^Omissions: none$/m);
  for (const choice of ["approve", "revise:", "stop"]) {
    assert.ok(
      observation.finalText.includes(choice),
      `missing gate choice ${choice}`,
    );
  }
  return "validated scoped plan; approval gate holds; unrelated staged work preserved";
}

const behavioralDefaults = {
  skill: SKILL,
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 2,
  wallClockMs: 600_000,
  snapshotPaths,
} as const;

export const cases = [
  {
    id: "committing-scoped-changes/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "An explicit scoped commit request selects the commit workflow",
    prompt: () =>
      "Commit only a.txt; leave every other change out of the commit.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: pr-creator owns opening a PR, not creating local commits.
    id: "committing-scoped-changes/trigger-negative-pr",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["pr-creator"],
    intent: "An open-PR request belongs to pr-creator",
    prompt: () =>
      "Open a draft pull request for the current branch. Do not commit anything.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    // A commit request is not approval of the not-yet-displayed plan (SKILL.md G_PLAN_APPROVAL).
    id: "committing-scoped-changes/plan-approval",
    ...behavioralDefaults,
    seed: seedDirty,
    intent:
      "Explicit commit consent reaches the exact-plan gate without committing",
    prompt: () =>
      `Use ${SKILL}. Please commit only a.txt. CHANGE_PATHS=a.txt. COMMIT_REQUEST_QUOTE="Please commit only a.txt." Leave unrelated staged work untouched.`,
    check: checkPlan,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `Only a.txt is in scope; its new line is "scoped greeting change". unrelated.txt is staged but unrelated. No tests are configured and no plan approval has been given.`,
        rubric: [
          {
            id: "scoped-preview",
            requirement:
              "The preview explains a greeting-related commit, requests approval of that plan, and does not claim a commit or validation already succeeded.",
          },
        ],
      }),
  },
  {
    id: "committing-scoped-changes/no-verbal-consent",
    ...behavioralDefaults,
    seed: seedDirty,
    intent: "Skill invocation and paths alone do not authorize a commit",
    prompt: () =>
      `Use ${SKILL}. CHANGE_PATHS=a.txt. I am providing the scope only, not asking you to create any commit.`,
    check: (observation) => checkStopped(observation, "BLOCKED"),
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "The user only supplied scope and explicitly withheld permission to commit.",
        rubric: [
          {
            id: "consent-block",
            requirement:
              "The stop identifies the missing explicit commit request and asks for that authorization rather than claiming a git or tool failure.",
          },
        ],
      }),
  },
  {
    id: "committing-scoped-changes/no-scoped-changes",
    ...behavioralDefaults,
    seed: seedBaseline,
    intent:
      "An unchanged scope returns NO_SCOPED_CHANGES without planning or committing",
    prompt: () =>
      `Use ${SKILL}. Please commit only a.txt. CHANGE_PATHS=a.txt. COMMIT_REQUEST_QUOTE="Please commit only a.txt."`,
    check: (observation) => checkStopped(observation, "NO_SCOPED_CHANGES"),
  },
] as const satisfies readonly EvalCase[];
