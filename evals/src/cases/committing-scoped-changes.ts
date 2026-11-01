import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileMatches,
  assertHeadUnchanged,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import {
  BASELINE_REFLOG,
  copyHeadReflog,
  HEAD_LOG,
} from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "committing-scoped-changes";
export const COMMIT_FACTS = {
  cleanContent: "hello\n",
  scopedContent: "hello\nscoped greeting change\n",
  unrelatedContent: "unrelated staged work\n",
} as const;
const snapshotPaths = [
  "a.txt",
  "unrelated.txt",
  HEAD_LOG,
  BASELINE_REFLOG,
] as const;

function seedBaseline({ repoPath }: SeedContext): void {
  copyHeadReflog(repoPath);
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
  assertHeadUnchanged(observation, "HEAD changed before plan approval");
  assert.equal(
    files["unrelated.txt"],
    clean ? null : COMMIT_FACTS.unrelatedContent,
    "unrelated work changed",
  );
  assertNoPublicStatusLine(
    observation.finalText,
    "COMMIT_SCOPED_CHANGES",
    "COMMIT_PLAN",
    "COMMIT_EXECUTE",
  );
}

function checkStopped(
  observation: Observation,
  status: "BLOCKED" | "NO_SCOPED_CHANGES",
): string {
  checkUnchanged(observation, status === "NO_SCOPED_CHANGES");
  return `${status}; no commit or worktree change`;
}

function checkPlan(observation: Observation): string {
  checkUnchanged(observation);
  return "No commit or worktree change; unrelated staged work preserved";
}

const suiteDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  mutationPolicy: "read-only",
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
    ...suiteDefaults,
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
              "The readable preview proposes exactly one group with an exact greeting-related commit message and only a.txt as its path; it explicitly reports none for expansions, verification, omissions, and warnings, excludes unrelated staged work, states that no commits have been made, requests approval of this exact plan with approve, revise:, and stop choices, and does not claim validation already succeeded.",
          },
        ],
      }),
  },
  {
    id: "committing-scoped-changes/no-verbal-consent",
    ...suiteDefaults,
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
              "The stop honestly states that no commits were made, identifies the missing explicit verbal commit request, and asks the user to authorize committing the supplied scope rather than claiming a git or tool failure or implying repository inspection occurred.",
          },
        ],
      }),
  },
  {
    id: "committing-scoped-changes/no-scoped-changes",
    ...suiteDefaults,
    seed: seedBaseline,
    intent:
      "An unchanged scope returns NO_SCOPED_CHANGES without planning or committing",
    prompt: () =>
      `Use ${SKILL}. Please commit only a.txt. CHANGE_PATHS=a.txt. COMMIT_REQUEST_QUOTE="Please commit only a.txt."`,
    check: (observation) => checkStopped(observation, "NO_SCOPED_CHANGES"),
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "The scoped a.txt is unchanged from HEAD. There are no scoped changes to commit.",
        rubric: [
          {
            id: "clean-scope-stop",
            requirement:
              "Explains that the scoped file is unchanged or has no changes to commit, honestly states that no commits were made, and does not present a commit plan or claim a tool failure.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
