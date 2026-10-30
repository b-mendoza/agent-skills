import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  fixtureRelativePath,
  seedFixtureRoot,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

const SKILL = "refactoring-code";
export const REFACTOR_FILES = {
  "a.txt": "hello\n",
  "src/quote.js": `export function quote(amount, member) {
  if (member) {
    if (amount > 100) {
      return Math.round(amount * 0.9 * 100) / 100;
    } else {
      return Math.round(amount * 100) / 100;
    }
  } else {
    return Math.round(amount * 100) / 100;
  }
}
`,
  "src/money.js":
    "export function roundMoney(amount) { return Math.round(amount * 100) / 100; }\n",
  "quote.test.js": `import assert from 'node:assert/strict';
import test from 'node:test';
import { quote } from './src/quote.js';
test('quote preserves discount and rounding boundaries', () => {
  assert.equal(quote(100, true), 100);
  assert.equal(quote(200, true), 180);
  assert.equal(quote(200, false), 200);
  assert.equal(quote(1.234, false), 1.23);
});
`,
  "package.json":
    '{"type":"module","scripts":{"test":"node --test quote.test.js"}}\n',
  "unrelated.txt": "unrelated staged draft\n",
} as const;
export const REFACTOR_PLAN_PATH = ".handoffs/refactoring-code/plan.md";
const snapshotPaths = [
  FIXTURE_ROOT_PATH,
  ...Object.keys(REFACTOR_FILES),
  REFACTOR_PLAN_PATH,
  ".git/logs/HEAD",
  ".git/eval-baseline-reflog",
];

function seedRefactor({ repoPath }: SeedContext): void {
  seedFixtureRoot(repoPath);
  mkdirSync(join(repoPath, "src"));
  for (const [path, content] of Object.entries(REFACTOR_FILES)) {
    writeFileSync(join(repoPath, path), content);
  }
  execFileSync("git", ["add", "--", "src", "quote.test.js", "package.json"], {
    cwd: repoPath,
  });
  execFileSync("git", ["commit", "-qm", "test: seed quote behavior"], {
    cwd: repoPath,
  });
  execFileSync("git", ["add", "--", "unrelated.txt"], { cwd: repoPath });
  writeFileSync(
    join(repoPath, ".git/eval-baseline-reflog"),
    readFileSync(join(repoPath, ".git/logs/HEAD")),
  );
}

function isReportWrite(
  call: Observation["toolCalls"][number],
  observation: Observation,
): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const filePath = call.input["file_path"];
  return (
    typeof filePath === "string" &&
    fixtureRelativePath(observation, filePath)?.startsWith(
      ".handoffs/refactoring-code/",
    ) === true
  );
}

const NODE_VALUE_OPTIONS = new Set([
  "--require",
  "-r",
  "--import",
  "--loader",
  "--experimental-loader",
  "--test-reporter",
  "--test-reporter-destination",
  "--conditions",
  "-C",
  "--env-file",
  "--test-name-pattern",
  "--test-concurrency",
]);

function consumeNodeOption(argument: string, args: string[]): boolean {
  if (!/^--?\w/.test(argument)) return false;
  if (NODE_VALUE_OPTIONS.has(argument)) args.shift();
  return true;
}

function hasNodeTestOption(args: string[]): boolean {
  for (
    let argument = args.shift();
    argument !== undefined;
    argument = args.shift()
  ) {
    if (argument === "--test") return true;
    if (!consumeNodeOption(argument, args)) return false;
  }
  return false;
}

function invokesNodeTests(call: Observation["toolCalls"][number]): boolean {
  if (call.name !== "Bash") return false;
  const { command } = call.input;
  if (typeof command !== "string") return false;
  // shortcut: literal shell segments only; use a shell parser for wrappers or expansions.
  const segments = command.match(/(?:[^"';&|\n]|"[^"]*"|'[^']*')+/g) ?? [];
  return segments.some((part) => {
    const withoutEnvironment = part
      .trimStart()
      .replace(/^env\s+/, "")
      .replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/, "");
    const [executable = "", ...args] = (
      withoutEnvironment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
    ).map((word) =>
      word.replace(/^(?<quote>['"])(?<value>.*)\k<quote>$/, "$<value>"),
    );
    return basename(executable) === "node" && hasNodeTestOption(args);
  });
}

function checkPlan(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  const files = observation.repoFiles;
  assert.ok(files !== undefined, "missing file snapshots");
  for (const [path, content] of Object.entries(REFACTOR_FILES)) {
    assertFileExists(observation, path);
    assert.equal(files[path], content, `changed protected file: ${path}`);
  }
  assertFileMatches(observation, ".git/logs/HEAD", /\S/);
  assertFileMatches(observation, ".git/eval-baseline-reflog", /\S/);
  assert.equal(
    files[".git/logs/HEAD"],
    files[".git/eval-baseline-reflog"],
    "unexpected commit or HEAD movement",
  );
  const before = observation.gitStatusBefore;
  const after = observation.gitStatusAfter;
  assert.equal(before.kind, "worktree");
  assert.equal(after.kind, "worktree");
  const withoutReports = after.entries
    .split("\n")
    .filter(
      (line) =>
        line !== "?? .handoffs/" &&
        !line.startsWith("?? .handoffs/refactoring-code/"),
    )
    .join("\n");
  assert.equal(
    withoutReports,
    before.entries,
    "unexpected worktree or index changes outside reports",
  );
  assert.deepEqual(
    mutationEvidence({
      ...observation,
      gitStatusAfter: before,
      toolCalls: observation.toolCalls.filter(
        (call) => !isReportWrite(call, observation),
      ),
    }),
    [],
    "observed mutation outside the report boundary",
  );
  assert.deepEqual(
    observation.toolCalls.filter(invokesNodeTests),
    [],
    "observed validation command before approval",
  );
  assertFileMatches(observation, REFACTOR_PLAN_PATH, /\S/);
  const plan = files[REFACTOR_PLAN_PATH];
  assert.ok(typeof plan === "string");
  assert.ok(plan.includes("src/quote.js"), "plan omitted target");
  assert.match(observation.finalText, /approv(?:e|al)/i, "no approval request");
  assert.match(
    observation.finalText,
    /adjust|decline/i,
    "missing alternative to approval",
  );
  return "plan saved; approval requested; only handoff artifacts may change";
}

const behavioralDefaults = {
  skill: SKILL,
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  budgetUsd: 2,
  wallClockMs: 600_000,
} as const;

export const cases = [
  {
    id: "refactoring-code/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "Behavior-preserving simplification selects refactoring-code",
    prompt: () =>
      "Simplify the duplicated branches in src/quote.js without changing the function's behavior or public API.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: rewriting-code-strictly owns typing and boundary-validation hardening.
    id: "refactoring-code/trigger-negative-strict-rewrite",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["rewriting-code-strictly"],
    intent:
      "Strict input typing is a rewrite request, not a simplification refactor",
    prompt: () =>
      "Harden src/payload.ts for strict TypeScript: remove unsafe any and validate untrusted JSON at the boundary.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "refactoring-code/plan-approval",
    ...behavioralDefaults,
    // Read-only analysis still writes required handoffs; source edits are not allowed.
    mutationPolicy: "allowed",
    seed: seedRefactor,
    snapshotPaths,
    intent:
      "A useful refactor produces an evidence-backed plan before any code mutation",
    prompt: () =>
      `Use ${SKILL}. TARGET_PATH=src/quote.js. USER_GOAL=simplify the duplicated rounding and nested conditionals while preserving behavior. TEST_COMMAND=node --test quote.test.js. AUTO_APPROVE=false. Save the synthesized plan card at ${REFACTOR_PLAN_PATH} and present it for approval. Do not modify source or tests before I approve; unrelated staged work is not yours.`,
    check: checkPlan,
    judge: async (observation) =>
      judgeLive({
        artifact: `${observation.finalText}\n${observation.repoFiles?.[REFACTOR_PLAN_PATH] ?? ""}`,
        knownFacts:
          "src/quote.js duplicates Math.round(amount * 100) / 100 on undiscounted branches. src/money.js exports an equivalent roundMoney helper. Only members with amount > 100 receive 10% off, then rounding. quote.test.js covers 100, 200, member/nonmember and 1.234 rounding. node --test quote.test.js is the local validation command. unrelated.txt is staged. No approval exists.",
        rubric: [
          {
            id: "minimal-reuse-plan",
            requirement:
              "The plan diagnoses duplicated rounding/nested branches, proposes reusing src/money.js instead of a new equivalent helper, and preserves the strict >100 member discount and rounding.",
          },
          {
            id: "complete-plan",
            requirement:
              "The plan provides diagnosis-linked ordered steps, per-file changes, reuse rationale, expected line/duplication outcome, validation command with safety class, non-goals and batched decisions; it requests approval instead of claiming implementation or checks ran.",
          },
        ],
      }),
  },
  {
    id: "refactoring-code/missing-target",
    ...behavioralDefaults,
    mutationPolicy: "read-only",
    intent:
      "An unspecified target asks one focused question without modifying the repository",
    prompt: () =>
      `Use ${SKILL} to simplify some code, but I have not selected a file or target yet.`,
    check: (observation) => {
      checkPositiveRouting(observation, SKILL);
      assertNoMutation(observation);
      assert.match(observation.finalText, /NEEDS_CLARIFICATION/);
      assert.match(observation.finalText, /\?/);
      return "NEEDS_CLARIFICATION; no mutation";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "The user supplied no TARGET_PATH and has not selected code to simplify.",
        rubric: [
          {
            id: "focused-target-question",
            requirement:
              "The response asks a single focused question identifying which file or target to refactor, without choosing one or claiming work completed.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
