import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFilesUnchanged,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles } from "#/fixtures/fixtures.ts";
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
  commitRepoFiles(repoPath, TEST_FILES, "seed checkout test suite");
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
  assertFilesUnchanged(observation, expectedFiles, "fixture changed");
}

const suiteDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  mutationPolicy: "read-only",
  snapshotPaths: Object.keys(TEST_FILES),
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
    ...suiteDefaults,
    id: `${SKILL}/approval-plan`,
    seed: seedTestSuite,
    intent:
      "Review produces an actionable minimal harness plan and requests approval before editing",
    prompt: () =>
      `Use ${SKILL}. TARGET_TEST_FILES=${TEST_PATH}. USER_GOAL=remove brittle implementation checks and duplicates without losing useful checkout coverage. TEST_COMMAND=npm test. SCOPE_LIMITS=test files only. AUTO_APPROVE=false.`,
    check: (observation) => {
      checkUnchangedSuite(observation, TEST_FILES);
      assertNoPublicStatusLine(observation.finalText, "Status");
      const reply = normalizeReplyText(observation.finalText);
      assert.ok(
        observation.finalText.includes(TEST_PATH),
        "plan omits the target test file",
      );
      assert.match(
        reply,
        /\b(?:plan|MINIMAL_HARNESS_DECISION)\b/i,
        "no harness plan",
      );
      assert.match(
        reply,
        /\b(?:keep|retain|preserve)\b/i,
        "plan omits retained behavior",
      );
      assert.match(
        reply,
        /\b(?:delete|remove|consolidate|rewrite)\b/i,
        "plan omits concrete change actions",
      );
      assert.match(
        reply,
        /\bduplicated-coverage\b/,
        "missing verbatim duplicate-test category",
      );
      assert.match(
        reply,
        /\bimplementation-detail-assertion\b/,
        "missing verbatim implementation-coupling category",
      );
      assert.match(
        reply,
        /\b(?:approv(?:e|al)|confirm)\b/i,
        "no approval gate request",
      );
      assert.ok(
        replyAsksFor(reply, /plan|edits?|tests?/i),
        "no approval request",
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
    ...suiteDefaults,
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
      assertNoPublicStatusLine(observation.finalText, "Status");
      const reply = normalizeReplyText(observation.finalText);
      assert.ok(
        replyAsksFor(reply, /commit|stash|abort/i),
        "missing unresolved workspace decision",
      );
      assert.match(
        reply,
        /\b(?:dirty|uncommitted)\b/i,
        "missing workspace blocker",
      );
      assert.match(reply, /Resume Packet/i, "missing blocked resume packet");
      assert.match(
        reply,
        /Pending question/i,
        "missing unresolved workspace decision",
      );
      for (const field of [
        "Inputs",
        "Reports so far",
        "Next step",
        "REPAIR_TOTAL",
      ]) {
        assert.match(
          reply,
          new RegExp(`${field}:`, "i"),
          `resume packet omits ${field}`,
        );
      }
      return "blocked on workspace decision; user edits preserved; resume packet present";
    },
  },
] as const satisfies readonly EvalCase[];
