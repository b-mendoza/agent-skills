import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileExists,
  assertFileMatches,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "rewriting-code-strictly";
export const STRICT_FILES = {
  "a.txt": "hello\n",
  "src/name.ts": `export function nameFromJson(text: string): any {
  const payload: any = JSON.parse(text);
  return payload.name || "guest";
}
`,
  "name.test.ts": `import assert from 'node:assert/strict';
import test from 'node:test';
import { nameFromJson } from './src/name.ts';
test('legacy boundary values are caller-visible', () => {
  assert.equal(nameFromJson('{"name":"Ada"}'), 'Ada');
  assert.equal(nameFromJson('{"name":7}'), 7);
  assert.equal(nameFromJson('{"name":""}'), 'guest');
  assert.equal(nameFromJson('{}'), 'guest');
});
`,
  "package.json":
    '{"type":"module","scripts":{"test":"node --test name.test.ts"}}\n',
  "unrelated.txt": "unrelated staged work\n",
} as const;

function seedStrict({ repoPath }: SeedContext): void {
  mkdirSync(join(repoPath, "src"));
  for (const [path, content] of Object.entries(STRICT_FILES)) {
    writeFileSync(join(repoPath, path), content);
  }
  execFileSync("git", ["add", "--", "src", "name.test.ts", "package.json"], {
    cwd: repoPath,
  });
  execFileSync("git", ["commit", "-qm", "test: pin legacy name boundary"], {
    cwd: repoPath,
  });
  execFileSync("git", ["add", "--", "unrelated.txt"], { cwd: repoPath });
  writeFileSync(
    join(repoPath, ".git/eval-baseline-reflog"),
    readFileSync(join(repoPath, ".git/logs/HEAD")),
  );
}

function checkClarification(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  assertNoMutation(observation);
  assertNoPublicStatusLine(
    observation.finalText,
    "Status",
    "NEEDS_CLARIFICATION",
    "STRICT_REWRITE",
  );
  assert.doesNotMatch(
    normalizeReplyText(observation.finalText),
    /^NEEDS_CLARIFICATION\b/m,
  );
  assert.ok(
    !observation.toolCalls.some(
      (call) => call.name === "WebFetch" || call.name === "WebSearch",
    ),
    "unauthorized external reference fetch",
  );
  return "clarification requested; no mutation or external fetch";
}

function checkBehaviorGate(observation: Observation): string {
  checkClarification(observation);
  assert.ok(
    replyAsksFor(observation.finalText, /behavior|reject|preserv|inputs?/i),
    "missing behavior decision",
  );
  const files = observation.repoFiles;
  assert.ok(files !== undefined, "missing file snapshots");
  for (const [path, content] of Object.entries(STRICT_FILES)) {
    assertFileExists(observation, path);
    assert.equal(
      files[path],
      content,
      `changed file before expansion approval: ${path}`,
    );
  }
  assertFileMatches(observation, ".git/logs/HEAD", /\S/);
  assertFileMatches(observation, ".git/eval-baseline-reflog", /\S/);
  assert.equal(
    files[".git/logs/HEAD"],
    files[".git/eval-baseline-reflog"],
    "HEAD changed before expansion approval",
  );
  assert.ok(
    observation.finalText.includes("src/name.ts"),
    "missing concrete target",
  );
  return "behavior expansion requires clarification; files and HEAD preserved";
}

const behavioralDefaults = {
  skill: SKILL,
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 2,
  wallClockMs: 600_000,
} as const;

export const cases = [
  {
    id: "rewriting-code-strictly/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "Strict boundary hardening selects the rewrite workflow",
    prompt: () =>
      "Make src/name.ts strict TypeScript: remove unsafe any and validate parsed JSON at the boundary without broad cleanup.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: refactoring-code owns behavior-preserving deduplication.
    id: "rewriting-code-strictly/trigger-negative-refactor",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["refactoring-code"],
    intent: "Pure branch simplification belongs to refactoring-code",
    prompt: () =>
      "Simplify the duplicated branches in src/quote.js while preserving its behavior and public API. No typing changes or boundary validation work.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    // This skill gates expansions, not all rewrites; rejecting legacy inputs is a behavior expansion.
    id: "rewriting-code-strictly/behavior-expansion-gate",
    ...behavioralDefaults,
    seed: seedStrict,
    snapshotPaths: [
      ...Object.keys(STRICT_FILES),
      ".git/logs/HEAD",
      ".git/eval-baseline-reflog",
    ],
    intent:
      "A strict validation goal conflicting with legacy outputs stops for an explicit behavior decision",
    prompt: () =>
      `Use ${SKILL}. TARGET_CODE=src/name.ts LANGUAGE=typescript. Remove unsafe any and validate parsed names as nonempty strings, rejecting malformed names. Preserve the caller-visible outputs and errors pinned in name.test.ts; no behavior change is approved. SCOPE_LIMITS=target only, no dependency/config/test changes or external fetches. VALIDATION_COMMAND=node --test name.test.ts. If those requirements conflict, ask before editing.`,
    check: checkBehaviorGate,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "src/name.ts returns payload.name || 'guest'. Numeric name 7 currently returns 7; empty string and absent name return 'guest'. name.test.ts pins these caller-visible results. The user asks for nonempty-string validation but explicitly has not approved changed behavior or tests. No external source is needed.",
        rubric: [
          {
            id: "behavior-conflict",
            requirement:
              "The response identifies the conflict between rejecting non-string/empty names and the concrete legacy outputs (7 and/or guest), and asks one focused decision about preserving legacy behavior versus authorizing its change.",
          },
          {
            id: "honest-gate",
            requirement:
              "The response does not claim a strict rewrite, implementation review, or changed-behavior tests completed; it treats the unanswered behavior decision as a stop rather than permission.",
          },
        ],
      }),
  },
  {
    id: "rewriting-code-strictly/missing-target",
    ...behavioralDefaults,
    intent:
      "Missing target asks a focused intake question without inspecting or modifying arbitrary code",
    prompt: () =>
      `Use ${SKILL}. I want strict typing and validation but have not supplied any target file or pasted code.`,
    check: (observation) => {
      checkClarification(observation);
      assert.ok(
        replyAsksFor(observation.finalText, /target|file|path|code/i),
        "missing target request",
      );
      return "target requested; no mutation or external fetch";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts:
          "No TARGET_CODE or language was supplied; this is intake, before baseline mapping.",
        rubric: [
          {
            id: "target-intake",
            requirement:
              "The response asks one focused question requesting a target file or pasted code, rather than selecting a target or claiming baseline/strategy work completed.",
          },
        ],
      }),
  },
] as const satisfies readonly EvalCase[];
