import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFilesUnchanged,
  assertHeadUnchanged,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkPositiveRouting,
  findBashCalls,
  normalizeReplyText,
} from "#/cases/shared-checks.ts";
import {
  BASELINE_REFLOG,
  commitRepoFiles,
  copyHeadReflog,
  HEAD_LOG,
  writeRepoFiles,
} from "#/fixtures/fixtures.ts";
import type {
  Observation,
  TurnObservation,
} from "#/observation/agent-query.ts";

const SKILL = "committing-scoped-changes";
const VERIFICATION_LOG = ".git/eval-verification.log";
const CHECK_CONFIG = {
  "AGENTS.md":
    "For changes to a.txt, the verification command is `sh check.sh`.\n",
  "check.sh": `printf 'ran\\n' >> ${VERIFICATION_LOG}
grep -qx goodbye a.txt
`,
};
const DIRTY_FILES = {
  "a.txt": "goodbye\n",
  "unrelated.txt": "unrelated staged work\n",
};
const EXPECTED_FILES = { ...CHECK_CONFIG, ...DIRTY_FILES };
const PLAN_ONLY_CLOSE =
  "Plan only. No commits made. No verification commands ran. To commit, make a new commit request; I'll prepare a fresh plan for approval.";
const NO_GATE_CLOSE =
  "No approval gate is open. No commits made. Ask me to commit if you want a fresh plan. Nothing was pushed.";
const PLAN_FORMAT =
  "For the preview, show a numbered group and labeled Message, Paths, Expansions, Verification, Omissions, and Warnings lines.";
const PURE_PLAN_PROMPT = `Use ${SKILL}. Plan commits for a.txt. ${PLAN_FORMAT}`;

const EXCLUSION_CONFIG = {
  ...CHECK_CONFIG,
  "check.sh": `${CHECK_CONFIG["check.sh"]}grep -qx compatible unrelated.txt\n`,
  "unrelated.txt": "compatible\n",
};
const EXCLUSION_DIRTY = {
  ...DIRTY_FILES,
  "unrelated.txt": "compatible\nunrelated staged work\n",
};
const EXCLUSION_FILES = { ...EXCLUSION_CONFIG, ...EXCLUSION_DIRTY };

function seed(
  { repoPath }: SeedContext,
  config = CHECK_CONFIG,
  dirty = DIRTY_FILES,
): void {
  commitRepoFiles(repoPath, config, "configure fixture verification");
  writeRepoFiles(repoPath, dirty);
  execFileSync("git", ["add", "--", "unrelated.txt"], { cwd: repoPath });
  copyHeadReflog(repoPath);
}

function assertPlanText(text: string): void {
  const plain = normalizeReplyText(text).trim();
  assertNoPublicStatusLine(
    plain,
    "COMMIT_SCOPED_CHANGES",
    "COMMIT_PLAN",
    "COMMIT_EXECUTE",
  );
  assert.doesNotMatch(plain, /\bPLANNED_ONLY\b/, "internal status leaked");
  assert.ok(
    plain.endsWith(PLAN_ONLY_CLOSE),
    "missing the plan-only completion text",
  );
  const plan = plain.replace(PLAN_ONLY_CLOSE, "").trim();
  assert.doesNotMatch(
    plan,
    /\?|\brevise:|\b(?:approve|reply|awaiting|phase 3\/4)\b/i,
    "plan-only asked for approval",
  );
  assert.doesNotMatch(
    plan,
    /\b(?:passed|failed|exited|exit code|verified|verification evidence)\b/i,
    "plan-only claims verification evidence",
  );
  assertFixtureGroup(plan);
}

function assertFixtureGroup(plan: string): void {
  assert.deepEqual(
    plan.match(/^(?:group|commit) \d+\b/gim),
    ["Group 1"],
    "expected one group",
  );
  assert.match(
    plan,
    /^message: .*\b(?:greeting|hello|goodbye)\b/im,
    "incorrect commit message",
  );
  assert.deepEqual(
    plan.match(/^expansions:.*$/gim),
    ["Expansions: none"],
    "incorrect expansions",
  );
  assert.deepEqual(
    plan.match(/^paths:.*$/gim),
    ["Paths: a.txt"],
    "incorrect plan paths",
  );
  assert.match(
    plan,
    /^verification: sh (?:\.\/)?check\.sh[ \t]*$/im,
    "expected the proposed verification command",
  );
  assert.match(plan, /^omissions: none[ \t]*$/im, "incorrect omissions");
  assert.match(plan, /^warnings: .+/im, "missing warnings");
  assert.match(plan, /\bshared worktree\b/i, "missing verification scope");
}

function assertReadOnlyPlan(
  observation: Observation,
  expectedFiles = EXPECTED_FILES,
): void {
  checkPositiveRouting(observation, SKILL);
  assertNoMutation(observation);
  assertHeadUnchanged(observation, "HEAD reflog changed during plan-only run");
  assertFilesUnchanged(observation, expectedFiles, "fixture bytes changed");
  assertFileAbsent(observation, VERIFICATION_LOG);
  assert.deepEqual(
    [
      ...findBashCalls(
        observation,
        /(?:^|[;&|])[ \t]*sh\s+(?:\.\/)?check\.sh\b/m,
      ),
      ...findBashCalls(
        observation,
        /(?:^|[;&|])[ \t]*git (?:--literal-pathspecs )?diff [^\n;&|]*\B--check\b/m,
      ),
    ],
    [],
    "plan-only ran the verification command",
  );
}

function assertPlanTurn(
  turn: TurnObservation | undefined,
): asserts turn is TurnObservation {
  assert.ok(turn !== undefined, "missing initial plan turn");
  assert.equal(turn.gitHeadBefore.kind, "head", "missing initial HEAD sample");
  assertPlanText(turn.finalText);
}

function checkPlanOnly(observation: Observation): string {
  assertReadOnlyPlan(observation);
  const [initial, ...rest] = observation.turns ?? [];
  assertPlanTurn(initial);
  assert.deepEqual(rest, [], "unexpected turns after plan only");
  assert.equal(observation.finalText, initial.finalText);
  return "Scoped plan shown; no approval gate, verification, or mutation";
}

function checkFollowUp(observation: Observation): string {
  assertReadOnlyPlan(observation);
  const [initial, followUp, ...rest] = observation.turns ?? [];
  assertPlanTurn(initial);
  assert.ok(followUp !== undefined, "missing follow-up turn");
  assert.equal(followUp.prompt, "approve", "missing bare approve follow-up");
  assert.deepEqual(rest, [], "unexpected turns after approve");
  assert.deepEqual(
    followUp.gitHeadBefore,
    initial.gitHeadAfter,
    "HEAD changed between turns",
  );
  assert.deepEqual(followUp.toolCalls, [], "bare approve invoked tools");
  assert.equal(followUp.finalText, observation.finalText);
  assert.equal(normalizeReplyText(followUp.finalText).trim(), NO_GATE_CLOSE);
  return "Bare approve was refused; no approval gate or execution";
}

function assertApprovalPreview(text: string): void {
  assert.match(
    text,
    /\breply approve\b[^\n]*\brevise:[^\n]*\bstop\b/i,
    "missing commit approval choices",
  );
  assert.match(
    text,
    /\bno commits (?:have been )?made\b/i,
    "missing no-commit statement",
  );
}

function checkFrozenExclusion(observation: Observation): string {
  assertReadOnlyPlan(observation, EXCLUSION_FILES);
  const plain = normalizeReplyText(observation.finalText);
  assertNoPublicStatusLine(plain, "COMMIT_PLAN", "COMMIT_EXECUTE");
  assert.match(
    plain,
    /^Resolved scope \(frozen\):[ \t]*\n(?:[ \t]*\n)*a\.txt[ \t]*\n(?:[ \t]*\n)*Group 1\b/m,
    "missing or incorrect frozen scope before the plan",
  );
  assertFixtureGroup(plain);
  assertApprovalPreview(plain);
  const resolutions = findBashCalls(
    observation,
    /\/scripts\/collect-state\.py['"]?\s+resolve-scope\b/,
  );
  assert.ok(
    resolutions.some(
      ({ result }) =>
        result?.isError === false &&
        !result.truncated &&
        result.content.trim() === "a.txt",
    ),
    "missing successful collector evidence for the frozen scope",
  );
  return "The frozen scope and approved paths exclude the staged dependency";
}

const planDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  mutationPolicy: "read-only",
  seed,
  snapshotPaths: [
    ...Object.keys(EXPECTED_FILES),
    HEAD_LOG,
    BASELINE_REFLOG,
    VERIFICATION_LOG,
  ],
} as const;

const unsupportedRequests = [
  {
    suffix: "",
    label: "history rewrites",
    request: "Amend the last commit with the changes in a.txt. Do not push.",
    limit:
      "I cannot amend commits or rewrite history. No commits made. If you want a new local commit instead, ask for one.",
    preview: false,
  },
  {
    suffix: "-granularity",
    label: "granularity preferences",
    request: `Commit a.txt. I prefer the finest granularity setting, but normal grouping is fine. Don't amend. ${PLAN_FORMAT}`,
    limit:
      "There is no granularity setting. I'll show the proposed grouping; at commit approval, use `revise: <change>` to adjust it.",
    preview: true,
  },
] as const;

const unsupportedCases = unsupportedRequests.map(
  ({ suffix, label, request, limit, preview }): EvalCase => ({
    ...planDefaults,
    id: `${SKILL}/unsupported-intake${suffix}`,
    intent: `Respect intake limits for ${label}`,
    prompt: () => `Use ${SKILL}. ${request}`,
    check: (observation) => {
      assertReadOnlyPlan(observation);
      const plain = normalizeReplyText(observation.finalText).trim();
      assertNoPublicStatusLine(plain, "COMMIT_PLAN", "COMMIT_EXECUTE");
      if (preview) {
        assertApprovalPreview(plain);
        assertFixtureGroup(plain);
        assert.ok(
          plain.includes(normalizeReplyText(limit)),
          "missing granularity limit",
        );
        return "Granularity limit stated; normal grouping offered for approval";
      }
      assert.doesNotMatch(
        plain,
        /\b(?:approv\w*|revise:|phase 3\/4)\b/i,
        "unsupported request reached approval",
      );
      assert.ok(
        !observation.toolCalls.some(
          ({ name }) => name === "Agent" || name === "Task",
        ),
        "unsupported request dispatched a subagent",
      );
      assert.ok(plain.includes(limit), "missing intake refusal");
      return "Intake declined the requested action without approval or dispatch";
    },
  }),
);

export const intakeCases = [
  ...unsupportedCases,
  {
    ...planDefaults,
    id: `${SKILL}/frozen-exclusion-plan`,
    seed: (context) => {
      seed(context, EXCLUSION_CONFIG, EXCLUSION_DIRTY);
    },
    intent: "Exclusions freeze the path boundary even with a staged dependency",
    prompt: () =>
      `Use ${SKILL}. Commit all changes except unrelated.txt. Show the frozen list before the first group. ${PLAN_FORMAT}`,
    check: checkFrozenExclusion,
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-plan-only`,
    skill: SKILL,
    intent: "Explicit plan-only wording selects the scoped commit skill",
    prompt: () => "Plan commits without committing for the changes in a.txt.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...planDefaults,
    id: `${SKILL}/plan-only`,
    intent: "An explicit plan request ends without opening an approval gate",
    prompt: () => PURE_PLAN_PROMPT,
    check: checkPlanOnly,
  },
  {
    ...planDefaults,
    id: `${SKILL}/commit-but-not-yet`,
    intent: "Do not commit yet overrides commit wording in the same request",
    prompt: () =>
      `Use ${SKILL}. Commit only a.txt. Do not commit yet. ${PLAN_FORMAT}`,
    check: checkPlanOnly,
  },
  {
    ...planDefaults,
    id: `${SKILL}/plan-only-follow-up`,
    intent: "Bare approve after plan-only cannot execute the old plan",
    prompt: () => PURE_PLAN_PROMPT,
    followUps: [
      { name: "approve-after-plan-only", reply: () => ({ reply: "approve" }) },
    ],
    check: checkFollowUp,
  },
] as const satisfies readonly EvalCase[];
