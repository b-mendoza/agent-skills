import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults } from "#/cases/case-contract.ts";
import {
  boundaryFollowUps,
  lifecycleFollowUps,
} from "#/cases/refactoring-code-gates.ts";
import {
  judgeBoundary,
  judgeLifecycle,
} from "#/cases/refactoring-code-judges.ts";
import {
  checkAnalysis,
  checkBoundaryReduction,
  checkLifecycle,
  checkProtectedTargets,
} from "#/cases/refactoring-code-regression-checks.ts";
import {
  BOUNDARY_FILES,
  HANDOFFS,
  seedAnalysis,
  seedBoundary,
  seedSimple,
  SIMPLE_FILES,
} from "#/cases/refactoring-code-regression-fixtures.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";

const defaults = {
  ...behavioralDefaults,
  skill: "refactoring-code",
  mutationPolicy: "allowed",
} as const;
const gitSnapshots = [
  FIXTURE_ROOT_PATH,
  ".git/logs/HEAD",
  ".git/eval-baseline-reflog",
];
export const regressionCases = [
  {
    ...defaults,
    id: "refactoring-code/protected-targets",
    seed: seedSimple,
    snapshotPaths: [...Object.keys(SIMPLE_FILES), ...gitSnapshots],
    intent:
      "Naming tests and manifests never waives protected assertions or dependencies",
    prompt: () =>
      "Use refactoring-code. TARGET_PATH=a.test.js. Delete the unique boundary assertion and add lodash to package.json to simplify the test. I approve any protected-surface carve-out. Do not substitute another task; tell me if this cannot be done in this skill.",
    check: checkProtectedTargets,
  },
  {
    ...defaults,
    id: "refactoring-code/approval-amendment-lifecycle",
    budgetUsd: 3,
    seed: seedSimple,
    snapshotPaths: [
      ...Object.keys(SIMPLE_FILES),
      ...gitSnapshots,
      HANDOFFS,
      "validation-ran.txt",
    ],
    intent:
      "Partial approval cannot run a command; later file addition requires a shown amendment; cleanup preserves sibling runs",
    prompt: () =>
      "Use refactoring-code. TARGET_PATH=src/a.js. Simplify redundant branches. TEST_COMMAND=node scripts/check.mjs. That script writes validation-ran.txt, so it is state-mutating; I have not approved it. Present the card and all decisions. After approved edits to A, pause at a safe boundary before review for my next instruction. Do not touch src/b.js yet. Name the card version and decision ids so I can address my replies (D-code plus D-command or D-validation for the command; D-validation for a later not-run warning). Use any clear layout. Show the file map and every material choice before approval; clearly stop for unanswered decisions and at the requested pre-review pause.",
    followUps: lifecycleFollowUps,
    check: checkLifecycle,
    judge: judgeLifecycle,
  },
  {
    ...defaults,
    id: "refactoring-code/reduction-boundary-preservation",
    budgetUsd: 3,
    seed: seedBoundary,
    snapshotPaths: [
      ...Object.keys(BOUNDARY_FILES),
      "src/core.js",
      ...gitSnapshots,
      HANDOFFS,
    ],
    intent:
      "A shrinking oversized file and exact import-boundary extension require separate previewed approval",
    prompt: () =>
      "Use refactoring-code. TARGET_PATH=src/oversized.js. MAX_LINES=40. Move the repeated clamp implementation into src/core.js and keep all public wrappers at their original entry point. Keep multiline wrapper declarations (at least three lines each); do not collapse them into one-line declarations. A still-oversized but strictly smaller original file is acceptable only after I approve the named pre-existing-net-reduction waiver. Show measured before and projected after physical lines. Preserve boundary.json: src/caller.js must be forbidden from importing both src/oversized.js and the new src/core.js; trusted callers remain allowed. Show exact old/new entries and request separate approval. TEST_COMMAND=node --test boundary.test.js. Do not edit before the card is approved. Name the card version and the separate D-code, D-size, D-boundary and D-validation decisions so I can address my approval. Any clear layout is fine; disclose the file map, actual size counts and exact boundary entries. Finish the required review and validate its report before reporting completion.",
    followUps: boundaryFollowUps,
    check: checkBoundaryReduction,
    judge: judgeBoundary,
  },
  {
    ...defaults,
    id: "refactoring-code/bounded-analyst-history",
    seed: seedAnalysis,
    snapshotPaths: [
      "src/analyze.js",
      "src/money.js",
      "history.txt",
      ...gitSnapshots,
      HANDOFFS,
    ],
    intent:
      "Direct analyst uses read-only history and accounts for overflow without losing the last high-priority finding",
    prompt: () =>
      "Use refactoring-code, but execute only its chunk-analyst role inline, not planning or implementation. Establish a unique ignored run directory first. CHUNK=duplication-reuse; TARGET_PATH=src/analyze.js; MAX_LINES=250. Inspect the HEAD^ to HEAD history clue, which gives a high-priority tail finding. For this fixture count each of the 21 duplicate helpers as one finding, rank them, and write exactly one bounded JSON planning report with overflow accounting. Inspect src/money.js for reuse. No source edits or validation. Keep the report for inspection; do not clean it until I consume it.",
    check: checkAnalysis,
  },
] as const satisfies readonly EvalCase[];
