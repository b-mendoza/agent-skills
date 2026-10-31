import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Schema } from "effect";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import { judgeLive } from "#/observation/judge.ts";

const SKILL = "generate-handoff-document";
export const FIXTURE_ROOT_PATH = ".git/eval-fixture-root";

export const HANDOFF_PATHS = {
  target: "docs/cache-handoff.md",
  transcript: "docs/cache-handoff.transcript.md",
  context: "docs/cache-handoff.context.json",
  insights: "docs/cache-handoff.insights.json",
  claims: "docs/cache-handoff.claims.json",
  backup: "docs/cache-handoff.prev.md",
} as const;

export const HANDOFF_FACTS = {
  subject: "Tenant cache investigation",
  mandate:
    "Investigate stale cache results after tenant switches. Do not implement changes yet.",
  failedApproach:
    "Disabling the cache globally was rejected because it doubled upstream requests.",
  proposal:
    "Include the tenant identifier in the cache key. This is a proposal, not an implemented fix.",
  openQuestion:
    "Confirm whether tenant identifiers remain stable across migrations before implementing a fix.",
  secret: "sk_live_eval_only_secret_73x",
  existingDocument:
    "# Existing handoff\nKeep this exact prior handoff until an update mode is chosen.\n",
} as const;

const writtenPaths = [
  HANDOFF_PATHS.target,
  HANDOFF_PATHS.transcript,
  HANDOFF_PATHS.context,
  HANDOFF_PATHS.insights,
];
const snapshotPaths = [...Object.values(HANDOFF_PATHS), "a.txt"];
const sectionNames = [
  "Original Instructions & Scope",
  "Q&A Log",
  "Observations & Insights",
  "Unverified Claims & Validation Checklist",
  "Open Questions & Recommended Next Steps",
];
const SECTION_COUNT = 5;

const decodeContext = Schema.decodeUnknownSync(
  Schema.Struct({
    subject: Schema.String,
    mandate: Schema.Struct({
      summary: Schema.String,
      status: Schema.Literals(["active", "superseded", "unclear"]),
      evidence: Schema.Array(Schema.String),
    }),
    original_instructions: Schema.Array(Schema.Unknown),
    qa_log: Schema.Array(Schema.Unknown),
    amendments: Schema.Array(Schema.Unknown),
    source_summary: Schema.Struct({
      transcript_file: Schema.String,
      prior_handoff_file: Schema.NullOr(Schema.String),
      chunked: Schema.Boolean,
      line_count: Schema.Number,
      instruction_blocks: Schema.Number,
      qa_exchanges: Schema.Number,
      amendments: Schema.Number,
      warnings: Schema.Array(Schema.String),
    }),
  }),
);
const decodeInsights = Schema.decodeUnknownSync(
  Schema.Struct({
    subject: Schema.String,
    insights: Schema.Array(
      Schema.Struct({
        title: Schema.String,
        claim: Schema.String,
        rationale: Schema.String,
        evidence: Schema.Array(Schema.String),
        verification_status: Schema.Literals([
          "verified",
          "partial",
          "unverified",
        ]),
        verification_notes: Schema.String,
        category: Schema.Literals([
          "decision",
          "risk",
          "constraint",
          "implementation",
          "finding",
          "failed_approach",
          "open_question",
          "other",
        ]),
        priority: Schema.Literals(["critical", "important", "informational"]),
      }),
    ),
    summary: Schema.Struct({
      insights: Schema.Number,
      critical: Schema.Number,
      unverified_or_partial: Schema.Number,
      warnings: Schema.Array(Schema.String),
    }),
  }),
);

function seedDirectory({ repoPath }: SeedContext): void {
  writeFileSync(
    join(repoPath, FIXTURE_ROOT_PATH),
    `${repoPath}\n${realpathSync(repoPath)}`,
  );
  // Track one sentinel so git status expands new docs files rather than collapsing to "?? docs/".
  mkdirSync(join(repoPath, "docs"));
  writeFileSync(join(repoPath, "docs/.gitkeep"), "");
  execFileSync("git", ["add", "docs/.gitkeep"], { cwd: repoPath });
  execFileSync("git", ["commit", "-qm", "plant handoff directory"], {
    cwd: repoPath,
  });
}

function seedExistingTarget(context: SeedContext): void {
  seedDirectory(context);
  writeFileSync(
    join(context.repoPath, HANDOFF_PATHS.target),
    HANDOFF_FACTS.existingDocument,
  );
  execFileSync("git", ["add", HANDOFF_PATHS.target], { cwd: context.repoPath });
  execFileSync("git", ["commit", "-qm", "plant existing handoff"], {
    cwd: context.repoPath,
  });
}

function readCaptured(observation: Observation, path: string): string {
  assertFileExists(observation, path);
  const content = observation.repoFiles?.[path];
  assert.ok(typeof content === "string", `missing text snapshot: ${path}`);
  return content;
}

function checkDocumentShape(document: string): void {
  const sections = [...document.matchAll(/^## \d+\. (?<title>.+)$/gm)].map(
    (match) => match.groups?.["title"],
  );
  assert.deepEqual(
    sections,
    sectionNames,
    "the handoff needs its five canonical sections",
  );
  assert.equal(
    [...document.matchAll(/^## \d+\. [^\n]+\n\s*\*\*Fulfills:\*\*/gm)].length,
    SECTION_COUNT,
  );
  assert.match(document, /^## Session Metadata$/m);
  assert.match(document, /Working artifacts/i);
  for (const path of [
    HANDOFF_PATHS.transcript,
    HANDOFF_PATHS.context,
    HANDOFF_PATHS.insights,
  ]) {
    assert.ok(document.includes(path), `manifest omitted ${path}`);
  }
  assert.match(
    document,
    /No tracking files were supplied; independent claim validation was skipped\./,
  );
  assert.doesNotMatch(
    document,
    /<[A-Za-z_][^>\n]*>/,
    "unresolved template placeholder",
  );
}

function assertPermittedToolWrite(
  call: ToolCall,
  repoPaths: readonly string[],
): void {
  assert.notEqual(
    call.name,
    "NotebookEdit",
    "notebooks are outside this artifact set",
  );
  if (call.name !== "Write" && call.name !== "Edit") return;
  const filePath = call.input["file_path"];
  assert.ok(typeof filePath === "string", "file write has no observable path");
  assert.ok(
    !filePath.split("/").includes(".."),
    "write path contains traversal",
  );
  assert.ok(
    repoPaths.some((repoPath) =>
      writtenPaths.some(
        (path) => resolve(repoPath, filePath) === join(repoPath, path),
      ),
    ),
    `unexpected write path: ${filePath}`,
  );
}

function checkWriteScope(observation: Observation): void {
  const before = observation.gitStatusBefore;
  const after = observation.gitStatusAfter;
  assert.equal(before.kind, "worktree");
  assert.equal(after.kind, "worktree");
  assert.equal(before.entries, "", "seed did not provide a clean baseline");
  assert.deepEqual(
    after.entries
      .split("\n")
      .sort((first, second) => first.localeCompare(second)),
    writtenPaths
      .map((path) => `?? ${path}`)
      .sort((first, second) => first.localeCompare(second)),
    "unexpected writes or missing artifacts",
  );
  const repoPaths = readCaptured(observation, FIXTURE_ROOT_PATH).split("\n");
  for (const call of observation.toolCalls) {
    assertPermittedToolWrite(call, repoPaths);
    if (call.name !== "Bash") continue;
    const { command } = call.input;
    assert.ok(
      typeof command !== "string" || !isMutatingGitCommand(command),
      "handoff generation must not mutate git history or index",
    );
  }
  assert.equal(
    readCaptured(observation, "a.txt"),
    "hello\n",
    "product file was changed",
  );
  assertFileAbsent(observation, HANDOFF_PATHS.claims);
  assertFileAbsent(observation, HANDOFF_PATHS.backup);
}

function checkPackage(observation: Observation): string {
  checkPositiveRouting(observation, SKILL);
  assertNoPublicStatusLine(
    observation.finalText,
    "Completed",
    "Blocked",
    "Status",
    "EXTERNAL",
    "CONTEXT",
    "INSIGHTS",
    "CLAIMS",
    "HANDOFF",
    "REVIEW",
  );
  const text = normalizeReplyText(observation.finalText);
  assert.match(
    text,
    /(?:passed review|review passed|REVIEW:\s*WARN\b[^\n]*\bno failed gates\b)/i,
  );
  assert.match(text, /claims?[^\n]*(?:skip|not (?:run|validated))/i);
  assert.match(
    text,
    /external[^\n]*(?:skip|used|unavailable|not (?:used|fetched))/i,
  );
  assert.ok(text.includes(HANDOFF_PATHS.target), "handoff path missing");
  checkWriteScope(observation);
  const document = readCaptured(observation, HANDOFF_PATHS.target);
  checkDocumentShape(document);
  const contextJson: unknown = JSON.parse(
    readCaptured(observation, HANDOFF_PATHS.context),
  );
  const insightsJson: unknown = JSON.parse(
    readCaptured(observation, HANDOFF_PATHS.insights),
  );
  decodeContext(contextJson);
  decodeInsights(insightsJson);
  for (const path of writtenPaths) {
    assert.ok(
      !readCaptured(observation, path).includes(HANDOFF_FACTS.secret),
      `unredacted secret in ${path}`,
    );
  }
  for (const artifact of [contextJson, insightsJson]) {
    assert.ok(
      !JSON.stringify(artifact).includes(HANDOFF_FACTS.secret),
      "unredacted secret in parsed JSON artifact",
    );
  }
  const transcript = readCaptured(
    observation,
    HANDOFF_PATHS.transcript,
  ).replace(/\s+/g, " ");
  for (const fact of [
    HANDOFF_FACTS.mandate,
    HANDOFF_FACTS.failedApproach,
    HANDOFF_FACTS.proposal,
    HANDOFF_FACTS.openQuestion,
  ]) {
    assert.ok(
      transcript.includes(fact),
      "the materialized conversation omitted a planted session fact",
    );
  }
  assert.match(transcript, /\[REDACTED\]/);
  return "reviewed five-section package; structured artifacts; faithful redacted transcript; only expected files written";
}

const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  skill: SKILL,
  fixture: "clean",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  snapshotPaths,
} as const;

export const cases = [
  {
    id: "generate-handoff-document/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent:
      "Saving an investigation for a fresh agent invokes conversation handoff generation",
    prompt: () =>
      "Save this investigation so a fresh agent can resume without our chat history. Create the handoff package at docs/cache-handoff.md, including decisions, failed attempts, and unresolved questions.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // Sibling boundary: analyzing-recent-project-state reports git evidence, not conversation history.
    id: "generate-handoff-document/trigger-negative-git-state",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["analyzing-recent-project-state"],
    intent:
      "A read-only recent git-state briefing is not a persisted session handoff",
    prompt: () =>
      "What changed in this repository over the last five commits, and what is still dirty? Give me a read-only project state snapshot in chat. Do not create a file.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "generate-handoff-document/conversation-package",
    ...behavioralDefaults,
    mutationPolicy: "allowed",
    seed: seedDirectory,
    snapshotPaths: [...snapshotPaths, FIXTURE_ROOT_PATH],
    intent:
      "Materialize supplied conversation facts into a redacted, reviewed cold-start package",
    prompt: () =>
      `Use the ${SKILL} skill. Session facts to preserve from this conversation:\nOriginal mandate: ${HANDOFF_FACTS.mandate}\nFailed approach: ${HANDOFF_FACTS.failedApproach}\nDecision: ${HANDOFF_FACTS.proposal}\nOpen question: ${HANDOFF_FACTS.openQuestion}\nA log sample contained API_KEY=${HANDOFF_FACTS.secret}; redact the value in every written artifact. These are reported investigation notes, not independently executed or verified results. No implementation edits or tests have been run.\nCreate TARGET_FILE=${HANDOFF_PATHS.target}, SUBJECT="${HANDOFF_FACTS.subject}", CONTEXT_SOURCE=current conversation. No TRACKING_FILES were supplied. Use bundled contracts; external research is unnecessary.`,
    check: checkPackage,
    judge: async (observation) =>
      judgeLive({
        artifact: `${readCaptured(observation, HANDOFF_PATHS.target)}\n${readCaptured(observation, HANDOFF_PATHS.context)}\n${readCaptured(observation, HANDOFF_PATHS.insights)}`,
        knownFacts: [
          HANDOFF_FACTS.mandate,
          HANDOFF_FACTS.failedApproach,
          HANDOFF_FACTS.proposal,
          HANDOFF_FACTS.openQuestion,
          "All facts are session reports, not independently verified code facts. No implementation changes or tests ran.",
        ].join("\n"),
        rubric: [
          {
            id: "continuation",
            requirement:
              "The package preserves the investigation mandate, rejected global-cache approach and reason, proposed tenant-specific cache key, and the unresolved identifier-stability question well enough for a fresh agent to resume.",
          },
          {
            id: "certainty",
            requirement:
              "The package does not claim the proposed fix was implemented, tests passed, or reported cache behavior was independently verified. It distinguishes the proposal and open question from completed work.",
          },
        ],
      }),
  },
  {
    id: "generate-handoff-document/existing-target-gate",
    ...behavioralDefaults,
    mutationPolicy: "read-only",
    budgetUsd: 0.7,
    wallClockMs: 180_000,
    seed: seedExistingTarget,
    intent:
      "An existing handoff without an update mode asks before overwriting or producing siblings",
    prompt: () =>
      `Use the ${SKILL} skill. TARGET_FILE=${HANDOFF_PATHS.target}, SUBJECT="${HANDOFF_FACTS.subject}". Preserve this session for resumption. I have not selected UPDATE_MODE.`,
    check: (observation) => {
      checkPositiveRouting(observation, SKILL);
      assertNoMutation(observation);
      assert.equal(
        readCaptured(observation, HANDOFF_PATHS.target),
        HANDOFF_FACTS.existingDocument,
      );
      for (const path of snapshotPaths.filter(
        (path) => path !== HANDOFF_PATHS.target && path !== "a.txt",
      )) {
        assertFileAbsent(observation, path);
      }
      assert.match(observation.finalText, /overwrite/i);
      assert.match(observation.finalText, /update/i);
      assert.match(observation.finalText, /new[ -]path|different path/i);
      assert.ok(
        replyAsksFor(observation.finalText, /\bmode\b|overwrite|update|path/i),
      );
      assertNoPublicStatusLine(
        observation.finalText,
        "Completed",
        "Blocked",
        "Status",
      );
      return "update mode requested; existing handoff unchanged; no sibling artifacts";
    },
  },
] as const satisfies readonly EvalCase[];
