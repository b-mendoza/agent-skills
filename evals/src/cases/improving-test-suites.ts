import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileExists,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "improving-test-suites";
export const TEST_PATH = "tests/checkout.test.mjs";
export const TEST_FILES = {
  "package.json": `${JSON.stringify({ name: "checkout-tests", private: true, type: "module", scripts: { test: "node --test tests/checkout.test.mjs" } })}\n`,
  "src/checkout.mjs": `export function checkoutTotal(subtotal, shipping) {
  if (subtotal < 0 || shipping < 0) throw new RangeError("negative amount");
  return subtotal + shipping;
}
`,
  [TEST_PATH]: `import assert from "node:assert/strict";
import test from "node:test";
import { checkoutTotal } from "../src/checkout.mjs";

test("adds shipping", () => assert.equal(checkoutTotal(100, 5), 105));
test("same shipping example again", () => assert.equal(checkoutTotal(100, 5), 105));
test("uses the current parameter spelling", () => assert.match(checkoutTotal.toString(), /subtotal/));
test("rejects negative amounts", () => assert.throws(() => checkoutTotal(-1, 5), RangeError));
`,
} as const;
export const DIRTY_TEST_CONTENT = `${TEST_FILES[TEST_PATH]}\n// Uncommitted user work: retain a free-shipping boundary test.\ntest("free shipping", () => assert.equal(checkoutTotal(25, 0), 25));\n`;

export function seedTestSuite({ repoPath }: SeedContext): void {
  for (const [path, content] of Object.entries(TEST_FILES)) {
    mkdirSync(dirname(join(repoPath, path)), { recursive: true });
    writeFileSync(join(repoPath, path), content);
  }
  execFileSync("git", ["add", "--", ...Object.keys(TEST_FILES)], {
    cwd: repoPath,
  });
  execFileSync("git", ["commit", "-qm", "seed checkout test suite"], {
    cwd: repoPath,
  });
}

export function seedDirtyTestSuite(context: SeedContext): void {
  seedTestSuite(context);
  writeFileSync(join(context.repoPath, TEST_PATH), DIRTY_TEST_CONTENT);
}

function checkUnchangedSuite(
  observation: Observation,
  expectedFiles: Readonly<Record<string, string>>,
): void {
  assertNoMutation(observation);
  for (const [path, content] of Object.entries(expectedFiles)) {
    assertFileExists(observation, path);
    assert.equal(
      observation.repoFiles?.[path],
      content,
      `fixture changed: ${path}`,
    );
  }
}

const behavioralDefaults = {
  skill: SKILL,
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  mutationPolicy: "read-only",
  snapshotPaths: Object.keys(TEST_FILES),
  budgetUsd: 2.0,
  wallClockMs: 600_000,
} as const;

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent:
      "An existing-test improvement request invokes the test-suite workflow",
    prompt: () =>
      "Trim brittle and duplicate tests in our checkout suite while keeping the behavior coverage that matters.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-refactor`,
    skill: SKILL,
    extraSkills: ["refactoring-code"],
    // Sibling boundary: refactoring-code owns production-only simplification.
    intent:
      "A production refactor that preserves the tests does not invoke test-suite improvement",
    prompt: () =>
      "Simplify the production checkout module by extracting its duplicated calculations. Preserve behavior and leave every test file unchanged.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/approval-plan`,
    seed: seedTestSuite,
    intent:
      "Review produces an actionable minimal harness plan and requests approval before editing",
    prompt: () =>
      `Use ${SKILL}. TARGET_TEST_FILES=${TEST_PATH}. USER_GOAL=remove brittle implementation checks and duplicates without losing useful checkout coverage. TEST_COMMAND=npm test. SCOPE_LIMITS=test files only. AUTO_APPROVE=false.`,
    check: (observation) => {
      checkUnchangedSuite(observation, TEST_FILES);
      assert.ok(
        observation.finalText.includes(TEST_PATH),
        "plan omits the target test file",
      );
      assert.match(
        observation.finalText,
        /\b(?:plan|MINIMAL_HARNESS_DECISION)\b/i,
        "no harness plan",
      );
      assert.match(
        observation.finalText,
        /\b(?:keep|retain|preserve)\b/i,
        "plan omits retained behavior",
      );
      assert.match(
        observation.finalText,
        /\b(?:delete|remove|consolidate|rewrite)\b/i,
        "plan omits concrete change actions",
      );
      assert.match(
        observation.finalText,
        /\bduplicated-coverage\b/,
        "missing verbatim duplicate-test category",
      );
      assert.match(
        observation.finalText,
        /\bimplementation-detail-assertion\b/,
        "missing verbatim implementation-coupling category",
      );
      assert.match(
        observation.finalText,
        /\b(?:approv(?:e|al)|confirm)\b/i,
        "no approval gate request",
      );
      assert.doesNotMatch(
        observation.finalText,
        /^Status:\s*CHANGED_PASS\s*$/m,
        "claimed mutation before approval",
      );
      return "harness plan and approval gate; fixture unchanged";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `The target ${TEST_PATH} has four tests. 'adds shipping' checks checkoutTotal(100,5) equals 105. 'same shipping example again' duplicates it exactly. 'uses the current parameter spelling' checks function.toString() for subtotal and tests implementation spelling rather than behavior. 'rejects negative amounts' protects the RangeError contract. AUTO_APPROVE=false and no approval was given.`,
        rubric: [
          {
            id: "minimal-plan",
            requirement:
              "The plan identifies both the duplicate example and the function-source spelling assertion as low-value, proposes concrete actions, and preserves shipping addition and negative-input rejection coverage.",
          },
          {
            id: "approval",
            requirement:
              "The response asks the user to approve the proposed edits and does not claim to have applied them or treat the request itself as approval.",
          },
        ],
      }),
  },
  {
    ...behavioralDefaults,
    id: `${SKILL}/dirty-target-blocked`,
    seed: seedDirtyTestSuite,
    intent: "AUTO_APPROVE cannot bypass unresolved uncommitted target edits",
    prompt: () =>
      `Use ${SKILL}. TARGET_TEST_FILES=${TEST_PATH}. USER_GOAL=remove duplicate and implementation-coupled tests. TEST_COMMAND=npm test. SCOPE_LIMITS=test files only. AUTO_APPROVE=true. The uncommitted edits are mine; I have not chosen commit, stash, or abort. This is a headless run with no follow-up answer.`,
    check: (observation) => {
      checkUnchangedSuite(observation, {
        ...TEST_FILES,
        [TEST_PATH]: DIRTY_TEST_CONTENT,
      });
      const statuses = [
        ...observation.finalText.matchAll(/^Status:\s*(?<status>\S+)\s*$/gm),
      ];
      assert.deepEqual(
        statuses.map((match) => match.groups?.["status"]),
        ["COMPLETE_BLOCKED"],
        "dirty targets require one blocked terminal status",
      );
      assert.match(
        observation.finalText,
        /\b(?:dirty|uncommitted)\b/i,
        "missing workspace blocker",
      );
      assert.match(
        observation.finalText,
        /Resume Packet/i,
        "missing blocked resume packet",
      );
      assert.match(
        observation.finalText,
        /Pending question/i,
        "missing unresolved workspace decision",
      );
      return "COMPLETE_BLOCKED; user edits preserved; resume packet present";
    },
  },
] as const satisfies readonly EvalCase[];
