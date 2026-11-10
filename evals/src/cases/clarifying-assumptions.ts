import assert from "node:assert/strict";

import type { EvalCase } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  CLARIFICATION_FACTS,
  CLARIFICATION_INPUTS,
  COPY_EDIT_INPUTS,
  COPY_EDIT_NEW,
  COPY_EDIT_OLD,
  PUBLICATION_INPUTS,
  seedClarificationArtifacts,
  seedCopyEditArtifacts,
  seedPublicationArtifacts,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import { assertReadOnlyGitHub } from "#/cases/fetching-work-item-fixtures.ts";
import {
  assertFileAbsent,
  assertFileMatches,
  assertFilesUnchanged,
  assertNoMutation,
  assertNoMutationBeforeReply,
  assertNoPublicStatusLine,
  assertOnlyInitialCommit,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  fixtureRelativePath,
  normalizeReplyText,
  replyAsksFor,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import { GH_LOG, HEAD_LOG } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const SKILL = "clarifying-assumptions";
const snapshotPaths = [
  FIXTURE_ROOT_PATH,
  ...Object.keys(CLARIFICATION_INPUTS),
  CLARIFICATION_FACTS.critiquePath,
  CLARIFICATION_FACTS.decisionsPath,
  "a.txt",
  HEAD_LOG,
  GH_LOG,
];

function checkInputsUnchanged(observation: Observation): void {
  assertFilesUnchanged(observation, CLARIFICATION_INPUTS, "changed input");
  assert.equal(observation.repoFiles?.["a.txt"], "hello\n");
  assertOnlyInitialCommit(observation);
  assertFileAbsent(observation, CLARIFICATION_FACTS.decisionsPath);
}

function isCritiqueWrite(call: ToolCall, observation: Observation): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  return (
    typeof path === "string" &&
    fixtureRelativePath(observation, path) === CLARIFICATION_FACTS.critiquePath
  );
}

function checkOnlyCritiqueChanged(observation: Observation): void {
  const before = observation.gitStatusBefore;
  const after = observation.gitStatusAfter;
  assert.equal(before.kind, "worktree");
  assert.equal(after.kind, "worktree");
  const expectedEntries = [
    ...before.entries.split("\n").filter(Boolean),
    `?? ${CLARIFICATION_FACTS.critiquePath}`,
  ].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(
    after.entries
      .split("\n")
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    expectedEntries,
    "unexpected changed paths",
  );
  assertNoMutation(
    withoutAllowedChanges(observation, (call) =>
      isCritiqueWrite(call, observation),
    ),
  );
}

const REVISION_TURNS = 4;
const NO_ITEMS = 0;

function checkCopyEdit(
  path: string,
  original: string,
  observation: Observation,
): void {
  const content = observation.repoFiles?.[path] ?? "";
  if (!path.endsWith(".md")) {
    assert.equal(content, original);
    return;
  }
  assert.ok(content.includes(COPY_EDIT_NEW), `copy edit missing: ${path}`);
  assert.ok(!content.includes(COPY_EDIT_OLD), `stale wording: ${path}`);
}
function hasRevisionResult(result: ToolCall["result"]): boolean {
  if (result === undefined) return false;
  return (
    !result.isError && /^LOCAL_REVISION: PASS files=3$/m.test(result.content)
  );
}
function isSuccessfulRevisionValidation(call: ToolCall): boolean {
  return (
    call.name === "Bash" &&
    JSON.stringify(call.input).includes("validate-local-revision.py") &&
    hasRevisionResult(call.result)
  );
}
const REVISION_PATHS = new Set([
  CLARIFICATION_FACTS.critiquePath,
  ...Object.keys(COPY_EDIT_INPUTS).filter((path) => path.endsWith(".md")),
]);
function isRevisionWrite(call: ToolCall, observation: Observation): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  if (typeof path !== "string") return false;
  return REVISION_PATHS.has(fixtureRelativePath(observation, path) ?? "");
}
function checkRevisionBoundary(
  observation: Observation,
  expected: string,
): void {
  assertOnlyInitialCommit(observation);
  assert.ok(
    (observation.turns ?? []).length >= REVISION_TURNS,
    "revision gate was not answered",
  );
  assertNoMutationBeforeReply(
    withoutAllowedChanges(observation, (call) =>
      isCritiqueWrite(call, observation),
    ),
    (turn) => turn.name === "confirm and revise",
  );
  assertNoMutation(
    withoutAllowedChanges(observation, (call) =>
      isRevisionWrite(call, observation),
    ),
  );
  assert.match(
    observation.finalText,
    new RegExp(`RE_PLAN_NEEDED: ${expected}\\b`),
  );
  assert.match(observation.finalText, /BLOCKERS_PRESENT: false/);
}
function hasDecisionRecord(plan: string): boolean {
  const [, afterHeading = ""] = plan.split(/^## Decisions Log[ \t]*\r?$/m);
  const [log = ""] = afterHeading.split(/^#{1,2}[ \t]/m);
  // Check record structure here; the judge checks the freely worded decision.
  const hasLogEntry =
    /^\|.*\|\s*(?:confirmed|revised|skipped|resolved|override|blocked)\s*\|.*\|[ \t]*\r?$/m.test(
      log,
    );
  const hasAnnotation =
    /\[DECISION [^\]\r\n]+ — (?:confirmed|revised|skipped|resolved|override|blocked): [^\]\r\n]+\]/.test(
      plan,
    );
  return hasLogEntry || hasAnnotation;
}

function checkStructuralRevision(observation: Observation): string {
  checkRevisionBoundary(observation, "true");
  assert.ok(
    hasDecisionRecord(
      observation.repoFiles?.[CLARIFICATION_FACTS.planPath] ?? "",
    ),
    "no persisted decision in the Decisions Log or a decision annotation",
  );
  return "scope revision recorded and retains re-plan flag";
}

async function judgeStructuralRevision(
  observation: Observation,
): Promise<string> {
  return judgeLive({
    artifact: `<main_plan>\n${observation.repoFiles?.[CLARIFICATION_FACTS.planPath] ?? ""}\n</main_plan>`,
    knownFacts:
      "The seed plan leaves the export audience unresolved, already mentions tenant administrators in an open question, and says 'No accepted decisions yet.' The user first described owner-only export, then explicitly revised the final decision: tenant administrators must export all tenant accounts, including other owners. This changes authorization and requires re-planning. The user asked to record that final decision and finish.",
    rubric: [
      {
        id: "persisted-structural-decision",
        requirement:
          "Evaluate persisted decision records in main_plan only. At least one Decisions Log entry or [DECISION ...] annotation must unambiguously record the user's final revised choice: tenant administrators may export every account in their tenant, including accounts owned by other users. It must be recorded as decided, not merely asked, proposed, blocked, or deferred, and supersede any earlier owner-only choice. A matching phrase only in an unresolved question, copied seed text, or the terminal reply does not satisfy this. Accept equivalent wording, any stable item ID, and either contracted record form; do not require rewriting every stale question or performing the re-plan in this case.",
      },
    ],
  });
}
function checkLocalRevision(observation: Observation): string {
  checkRevisionBoundary(observation, "false");
  for (const [path, original] of Object.entries(COPY_EDIT_INPUTS)) {
    checkCopyEdit(path, original, observation);
  }
  assert.ok(
    observation.toolCalls.some(isSuccessfulRevisionValidation),
    "no successful local revision validation observed",
  );
  return "all planning artifact wording updated and validated without full re-plan";
}

const suiteDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  seed: seedClarificationArtifacts,
  snapshotPaths,
} as const;

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent: "Plan-wide upfront clarification routes to the conversation layer",
    prompt: () =>
      "Run upfront clarification for the acme-app-42 task plan. Challenge its assumptions and ask me the unresolved questions before any implementation.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-plan-validation`,
    skill: SKILL,
    intent:
      "A standalone written plan audit is not a conversational clarification session",
    // validate-implementation-plan owns independent plan audits.
    prompt: () =>
      "Audit docs/acme-app-42-task-1-execution-plan.md for requirements traceability, avoidable complexity, and evidence gaps. Return a standalone written validation report, not an interview.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...suiteDefaults,
    id: `${SKILL}/upfront-preview-gate`,
    mutationPolicy: "allowed",
    intent:
      "A high-severity unresolved audience writes a critique and stops at the manifest readiness gate without choosing for the user",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=upfront ITERATION=1.`,
    check: (observation) => {
      checkInputsUnchanged(observation);
      checkOnlyCritiqueChanged(observation);
      assertFileMatches(
        observation,
        CLARIFICATION_FACTS.critiquePath,
        /^CRITIQUE: (?:PASS|WARN)\nTicket: acme-app-42 \| Mode: upfront \| Task: -\nArtifact: docs\/acme-app-42-upfront-critique\.md\n/,
      );
      for (const heading of [
        "## Critique Report",
        "### Artifacts Reviewed",
        "### Codebase Verification",
        "### Problem Framing Critique",
        "### Technology Critique Items",
        "### Items Not Raised",
        "### Summary",
      ]) {
        assertFileMatches(
          observation,
          CLARIFICATION_FACTS.critiquePath,
          new RegExp(`^${heading}\\s*$`, "m"),
        );
      }
      assertFileMatches(
        observation,
        CLARIFICATION_FACTS.critiquePath,
        /\|\s*PF\d+\s*\|\s*HIGH\s*\|/,
      );
      const text = normalizeReplyText(observation.finalText);
      assertNoPublicStatusLine(
        observation.finalText,
        "RE_PLAN_NEEDED",
        "BLOCKERS_PRESENT",
        "Blocking verdict",
      );
      assert.match(text, /^Question Manifest - acme-app-42\s*$/m);
      assert.match(
        text,
        /Questions now: [1-9]\d* \| Deferred: \d+ \| Irrelevant: \d+/,
      );
      assert.match(
        text,
        /\|\s*#\s*\|\s*Item ID\s*\|\s*Category\s*\|\s*Severity\s*\|\s*Model\s*\|\s*Skippable\s*\|\s*Affects\s*\|/,
      );
      assert.match(
        text,
        /\|\s*\d+\s*\|\s*PF\d+\s*\|\s*Problem framing\s*\|\s*HIGH\s*\|\s*A\s*\|\s*No\s*\|/,
      );
      assert.ok(
        replyAsksFor(text, /ready|start/i),
        "missing readiness request",
      );
      assert.doesNotMatch(
        text,
        /^(?:Brief \d|Accepted decisions summary:|RE_PLAN_NEEDED:)/m,
        "revealed a Model A brief or recorded unanswered decisions",
      );
      return "critique written; hard-gate manifest preview; only critique changed";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: `<internal_critique_artifact>\n${observation.repoFiles?.[CLARIFICATION_FACTS.critiquePath] ?? ""}\n</internal_critique_artifact>\n\n<user_facing_preview>\n${observation.finalText}\n</user_facing_preview>`,
        knownFacts: `${CLARIFICATION_FACTS.audienceGap} The code currently grants account access only to the account owner. No user has selected an audience, answered a question, or authorized a scope change.`,
        rubric: [
          {
            id: "unresolved-audience",
            requirement:
              "Evaluate only internal_critique_artifact for this item: the critique treats the export audience and its authorization consequences as unresolved, rather than inventing an accepted audience or a developer decision. This internal artifact is allowed to contain the full critique; it is not the user-facing preview.",
          },
          {
            id: "preview-staged-reveal",
            requirement:
              "Evaluate only user_facing_preview for this item, never the internal critique artifact. The preview asks for readiness without revealing the Model A per-item brief, critique argument, proposed answer, or recommendation. Manifest metadata such as Problem framing, HIGH, Model A, non-skippability, and a generic statement that the task remains blocked are allowed and are not a revealed brief.",
          },
        ],
      }),
  },
  {
    ...suiteDefaults,
    id: `${SKILL}/publication-risk-preview`,
    seed: seedPublicationArtifacts,
    mutationPolicy: "allowed",
    budgetUsd: 2.0,
    intent:
      "Task 2 HIGH security concerns must be asked before the task text is published",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=upfront. Next action is publishing every task's current text as child issues. Stop at the readiness preview.`,
    check: (observation) => {
      assertReadOnlyGitHub(observation, false);
      assertFilesUnchanged(observation, PUBLICATION_INPUTS, "changed input");
      checkOnlyCritiqueChanged(observation);
      const critique =
        observation.repoFiles?.[CLARIFICATION_FACTS.critiquePath] ?? "";
      const securityRows = critique
        .split("\n")
        .filter(
          (line) =>
            line.includes("HIGH") &&
            /token|canReadAccount|authoriz|secret/i.test(line),
        );
      const ids = securityRows.flatMap((line) =>
        [...line.matchAll(/\b(?:TC|UI|PF)\d+\b/g)].map(
          (match) => match.at(NO_ITEMS) ?? "",
        ),
      );
      assert.ok(
        ids.length > NO_ITEMS,
        "security concern absent from HIGH critique rows",
      );
      const preview = normalizeReplyText(observation.finalText);
      const [now = ""] = preview.split(/Deferred Questions|## Deferred/);
      assert.ok(
        ids.some((id) =>
          new RegExp(
            `\\|\\s*${id}\\s*\\|[^\\n]*HIGH[^\\n]*\\|\\s*B\\s*\\|\\s*No\\s*\\|[^\\n]*2`,
          ).test(now),
        ),
        "HIGH Task 2 publication concern was deferred or skippable",
      );
      assert.ok(replyAsksFor(preview, /ready|start/i));
      return "Task 2 security question promoted before publication; no plan or remote changes";
    },
  },
  ...[false, true].map((structural): EvalCase => ({
    ...suiteDefaults,
    id: `${SKILL}/${structural ? "structural-revision-replans" : "localized-copy-edit"}`,
    seed: seedCopyEditArtifacts,
    mutationPolicy: "allowed",
    budgetUsd: 2.5,
    wallClockMs: 1_200_000,
    intent:
      "A post-gate wording correction needs all artifact bytes validated; a scope change still requires re-planning",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=upfront RESULT_FORMAT=handoff. Show the readiness preview before asking one question at a time.`,
    followUps: [
      {
        name: "ready",
        reply: ({ finalText }) =>
          /Ready to start/i.test(finalText)
            ? { reply: "Ready. Start." }
            : { gateNotReached: "readiness preview missing" },
      },
      {
        name: "answer audience",
        reply: ({ finalText }) =>
          /Question|audience|owner/i.test(finalText)
            ? {
                reply:
                  "The end user is the authenticated account owner exporting only their own records, exactly as canReadAccount already enforces. The CSV addresses the monthly audit need.",
              }
            : { gateNotReached: "audience question missing" },
      },
      {
        name: "confirm and revise",
        reply: ({ finalText }) =>
          /Question|decision|confirm|owner/i.test(finalText)
            ? {
                reply: structural
                  ? "Revise the scope: tenant administrators must export all tenant accounts, including other owners. This changes authorization and requires re-planning. Record this as the final decision and finish."
                  : `Keep the existing owner-only approach; confirm, not a scope revision. Separately revise wording only: replace exactly '${COPY_EDIT_OLD}' with '${COPY_EDIT_NEW}' wherever it occurs in all three planning artifacts. I approve those exact local prose edits only. No behavior, scope, dependency, or technology changes. Record and validate the copy edit before finishing.`,
              }
            : { gateNotReached: "final decision gate missing" },
      },
    ],
    check: structural ? checkStructuralRevision : checkLocalRevision,
    ...(structural ? { judge: judgeStructuralRevision } : {}),
  })),
  {
    ...suiteDefaults,
    id: `${SKILL}/critique-missing-task-number`,
    mutationPolicy: "read-only",
    intent:
      "Critique mode without TASK_NUMBER asks for the task number and writes nothing",
    prompt: () =>
      `Use ${SKILL}. TICKET_KEY=${CLARIFICATION_FACTS.key} MODE=critique.`,
    check: (observation) => {
      assertNoMutation(observation);
      checkInputsUnchanged(observation);
      assertFileAbsent(observation, CLARIFICATION_FACTS.critiquePath);
      assert.ok(
        !observation.toolCalls.some((call) =>
          ["Agent", "Task"].includes(call.name),
        ),
        "dispatched before task selection",
      );
      assertNoPublicStatusLine(
        observation.finalText,
        "RE_PLAN_NEEDED",
        "BLOCKERS_PRESENT",
        "Blocking verdict",
        "INPUT",
      );
      assert.ok(
        replyAsksFor(
          observation.finalText,
          /TASK_NUMBER|task number|which task/i,
        ),
        "missing task-number request",
      );
      return "missing task number requested; no writes or critique dispatch";
    },
  },
] as const satisfies readonly EvalCase[];
