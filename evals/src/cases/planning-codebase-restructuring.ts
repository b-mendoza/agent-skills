import assert from "node:assert/strict";
import { basename, join, resolve } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { behavioralDefaults, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertFilesUnchanged,
  assertNoMutation,
  assertNoPublicStatusLine,
  assertRunHappened,
  checkNegativeRouting,
  checkPositiveRouting,
  FIXTURE_ROOT_PATH,
  hasNodeTestOption,
  normalizeReplyText,
  replyAsksFor,
  seedFixtureRoot,
  withoutAllowedChanges,
} from "#/cases/shared-checks.ts";
import { commitRepoFiles } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";
import { mutationEvidence } from "#/observation/mutation-evidence.ts";

export const SKILL = "planning-codebase-restructuring";
export const ARTIFACT_PATH = "restructuring-plan.md";
export const STRUCTURE_FILES = {
  "package.json": `${JSON.stringify({ name: "orders-monolith", private: true, type: "module", scripts: { test: "node --test tests/order.test.mjs" } })}\n`,
  "src/controllers/order.mjs": `import { placeOrder } from "../services/order.mjs";
export const checkout = (request) => placeOrder(request.sku, request.price);
`,
  "src/services/order.mjs": `import { saveOrder } from "../repositories/store.mjs";
import { scheduleShipment } from "./shipping.mjs";
export function placeOrder(sku, price) {
  const order = saveOrder({ sku, total: price + 5, shipment: "pending" });
  scheduleShipment(order.id);
  return order;
}
`,
  "src/services/shipping.mjs": `import { findOrder } from "../repositories/store.mjs";
export function scheduleShipment(id) { findOrder(id).shipment = "scheduled"; }
`,
  "src/repositories/store.mjs": `const orders = [];
export function saveOrder(order) { order.id = orders.length + 1; orders.push(order); return order; }
export function findOrder(id) { return orders.find((order) => order.id === id); }
`,
  "tests/order.test.mjs": `import assert from "node:assert/strict";
import test from "node:test";
import { checkout } from "../src/controllers/order.mjs";
test("checkout persists a total and schedules shipment", () => {
  const order = checkout({ sku: "book", price: 20 });
  assert.equal(order.total, 25);
  assert.equal(order.shipment, "scheduled");
});
`,
} as const;

export function seedLayeredProject({ repoPath }: SeedContext): void {
  // Bind absolute write-tool paths to this fixture, not any same-named file.
  seedFixtureRoot(repoPath);
  commitRepoFiles(
    repoPath,
    STRUCTURE_FILES,
    "seed layered order and shipping project",
  );
}

export const REPORT_SECTIONS = [
  "Preflight summary",
  "Current architecture map",
  "Domain model observations",
  "DDD alignment gaps",
  "Screaming Architecture folder proposal",
  "Complexity reduction opportunities",
  "Reference assessment or limitation",
  "Migration strategy",
  "Validation plan",
  "Implementation handoff",
  "Document references consulted",
  "Risks, assumptions, blockers, open questions, and security notes",
] as const;

const REPORT_SECTION_ALIASES: Readonly<Record<string, RegExp>> = {
  "Reference assessment or limitation":
    /reference (?:assessment(?: or limitation)?|limitation)/i,
  "Risks, assumptions, blockers, open questions, and security notes":
    /risks, assumptions, blockers, open questions, (?:and )?security notes/i,
};

const REPORT_SECTION_PATTERNS = REPORT_SECTIONS.map((section) => {
  const title = REPORT_SECTION_ALIASES[section]?.source ?? section;
  return new RegExp(`^#{1,6}[\\t ]+(?:\\d+\\.[\\t ]+)?${title}`, "im");
});

function fencedResumePacket(finalText: string): string | undefined {
  return /^```[^\r\n]*\r?\n(?<packet>[\s\S]*?)^```/m.exec(finalText)?.groups?.[
    "packet"
  ];
}

function reportWrite(call: ToolCall, repoPaths: readonly string[]): boolean {
  if (!["Write", "Edit"].includes(call.name)) return false;
  const path = call.input["file_path"];
  return (
    typeof path === "string" &&
    repoPaths.some(
      (repoPath) => resolve(repoPath, path) === join(repoPath, ARTIFACT_PATH),
    )
  );
}

const EXECUTION_PATTERNS = [
  /^(?:npm|pnpm|yarn)\s+(?:test|install|add|build)\b/,
  /^(?:npm|pnpm|yarn)\s+run\s+(?:test|build|lint)\b/,
  /^npx\s+(?:vitest|jest|prettier|eslint)\b/,
];
function executableBasename(executable = ""): string {
  return basename(executable.replace(/^["']|["']$/g, ""));
}

function forbiddenExecution(call: ToolCall): boolean {
  if (call.name !== "Bash") return false;
  const { command } = call.input;
  if (typeof command !== "string") return false;
  return command.split(/&&|\|\||[;\n]/).some((part) => {
    const withoutEnvironment = part
      .trimStart()
      .replace(/^env\s+/, "")
      .replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/, "");
    const [executable, ...args] =
      withoutEnvironment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    return (
      EXECUTION_PATTERNS.some((pattern) => pattern.test(withoutEnvironment)) ||
      (executableBasename(executable) === "node" && hasNodeTestOption(args))
    );
  });
}

function checkPlanningOnly(observation: Observation): void {
  assertRunHappened(observation);
  assert.deepEqual(
    observation.gitStatusBefore,
    { kind: "worktree", entries: "" },
    "planning fixture must start clean",
  );
  assert.deepEqual(
    observation.gitStatusAfter,
    { kind: "worktree", entries: `?? ${ARTIFACT_PATH}` },
    "only the requested report may change git status",
  );
  assertFilesUnchanged(observation, STRUCTURE_FILES, "codebase was changed");
  assertFileExists(observation, FIXTURE_ROOT_PATH);
  const roots = observation.repoFiles?.[FIXTURE_ROOT_PATH];
  assert.ok(typeof roots === "string", "missing fixture root binding");
  const repoPaths = roots.split("\n");
  const unexpected = mutationEvidence(
    withoutAllowedChanges(observation, (call) => reportWrite(call, repoPaths)),
  );
  assert.deepEqual(
    unexpected,
    [],
    "observed write outside the report or mutating git command",
  );
  // Lexical evidence only; filesystem snapshots and git checks cover code changes separately.
  assert.deepEqual(
    observation.toolCalls.filter(forbiddenExecution),
    [],
    "planning must not execute tests, builds, installs, or formatters",
  );
}

const suiteDefaults = {
  ...behavioralDefaults,
  skill: SKILL,
  seed: seedLayeredProject,
  snapshotPaths: [
    ...Object.keys(STRUCTURE_FILES),
    ARTIFACT_PATH,
    FIXTURE_ROOT_PATH,
  ],
} as const;

export const cases = [
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-positive`,
    skill: SKILL,
    intent: "Evidence-backed restructuring planning invokes this skill",
    prompt: () =>
      "Plan how to reorganize this repo so orders and shipping ownership are clear instead of hiding under controllers, services, and repositories. Inspect the current architecture, but do not move or refactor files.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    ...routingDefaults,
    id: `${SKILL}/trigger-negative-refactor`,
    skill: SKILL,
    extraSkills: ["refactoring-code"],
    // Sibling boundary: refactoring-code owns approved behavior-preserving implementation.
    intent:
      "An approved, bounded implementation request does not invoke planning",
    prompt: () =>
      "Refactor the duplicated calculation in src/services/order.mjs into a private helper now. The exact scope is approved; preserve behavior and public exports. I need the implementation, not an architecture plan.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    ...suiteDefaults,
    id: `${SKILL}/persist-local-plan`,
    mutationPolicy: "allowed",
    intent:
      "A local-only plan is persisted at the requested path while source and tests remain untouched",
    prompt: () =>
      `Use ${SKILL}. CODEBASE_PATH_OR_REPOSITORY_URL=.; TARGET_SCOPE=whole repo; BUSINESS_GOALS_AND_PAIN_POINTS=make order placement and shipment scheduling ownership visible, replacing technical-layer navigation; KNOWN_DOMAIN_LANGUAGE=Order, Shipment, Checkout; CONSTRAINTS=one small process, no public API changes, no new dependencies, at most two migration PRs; SUCCESS_CRITERIA=capability ownership and safe incremental migration are explicit; ARTIFACT_PATH=${ARTIFACT_PATH}. No external reference is supplied or required. Do not run tests or implement the plan.`,
    check: (observation) => {
      checkPlanningOnly(observation);
      assertFileExists(observation, ARTIFACT_PATH);
      const report = observation.repoFiles?.[ARTIFACT_PATH];
      assert.ok(typeof report === "string");
      let previousSection = -1;
      for (const [index, sectionPattern] of REPORT_SECTION_PATTERNS.entries()) {
        const position = report.search(sectionPattern);
        assert.ok(
          position > previousSection,
          `missing or out-of-order report section: ${REPORT_SECTIONS[index]}`,
        );
        previousSection = position;
      }
      assertNoPublicStatusLine(
        observation.finalText,
        "Status",
        "PLAN_REVIEW",
        "CONTRACT_NOTE",
        "REFERENCE_ASSESSMENT",
        "EVIDENCE_PRECEDENCE_DECISION",
      );
      assert.ok(
        observation.finalText.includes(ARTIFACT_PATH),
        "handoff omits artifact path",
      );
      const combined = `${normalizeReplyText(observation.finalText)}\n${report}`;
      assert.match(
        combined,
        /REFERENCE_ASSESSMENT:\s*SKIPPED\b/,
        "no-reference route not recorded",
      );
      assert.match(
        combined,
        /EVIDENCE_PRECEDENCE_DECISION:\s*not-applicable\b/,
        "missing local-evidence precedence",
      );
      for (const phase of [
        "Architecture[ _-]?Map",
        "Domain[ _-]?Analysis",
        "Restructuring[ _-]?Plan",
      ]) {
        assert.match(
          combined,
          new RegExp(`CONTRACT_NOTE:\\s*${phase}\\s*\\|\\s*pass\\s*\\|`, "i"),
          `missing validated ${phase} note`,
        );
      }
      assert.match(combined, /PLAN_REVIEW:\s*PASS\b/, "no passed plan review");
      return "READY; report persisted; source unchanged; local-only reviewed plan";
    },
    judge: async (observation) =>
      judgeLive({
        artifact: observation.repoFiles?.[ARTIFACT_PATH] ?? "",
        knownFacts:
          "This is a single-process ES module app. src/controllers/order.mjs delegates to services/order.mjs. placeOrder calculates price+5, saves an order in the in-memory store, then calls scheduleShipment; services/shipping.mjs imports findOrder from the same store and mutates shipment. Existing tests verify total=25 for price=20 and shipment='scheduled'. Technical folders hide Order and Shipment capabilities. No external reference was provided. Constraints: no public API changes, no dependencies, at most two migration PRs. No code change or test execution was authorized.",
        rubric: [
          {
            id: "local-grounding",
            requirement:
              "Architecture and domain findings trace to the actual order/shipping workflow and paths, without inventing databases, queues, microservices, or observed runtime test results.",
          },
          {
            id: "bounded-migration",
            requirement:
              "The proposal makes domain ownership visible and gives small migration increments within two PRs, validation, stopping points and rollback, preserving public APIs and avoiding new dependencies.",
          },
          {
            id: "handoff-gates",
            requirement:
              "Implementation actions have exact targets, rationale, benefit, risk/reversibility, validation, and a smaller or safer alternative, and are proposed rather than reported as already done.",
          },
        ],
      }),
  },
  {
    ...suiteDefaults,
    id: `${SKILL}/missing-goal`,
    mutationPolicy: "read-only",
    intent:
      "Missing non-inferable scope and business goals return a resumable input request without a report",
    prompt: () =>
      `Use ${SKILL}. CODEBASE_PATH_OR_REPOSITORY_URL=.; ARTIFACT_PATH=${ARTIFACT_PATH}. I have not decided which scope or business problem to address. Do not infer those choices from the toy codebase. This is a headless run with no follow-up answer.`,
    check: (observation) => {
      assertNoMutation(observation);
      assertFileAbsent(observation, ARTIFACT_PATH);
      assertFilesUnchanged(observation, STRUCTURE_FILES, "source changed");
      assertNoPublicStatusLine(observation.finalText, "Status");
      const reply = normalizeReplyText(observation.finalText);
      assert.ok(
        replyAsksFor(reply, /scope|goals?|pain points?/i),
        "no request for missing scope or goals",
      );
      const packet = fencedResumePacket(observation.finalText);
      assert.ok(typeof packet === "string", "missing fenced resume packet");
      for (const field of [
        "phase_reached:",
        "pending_question:",
        "validated_summaries:",
        "contract_notes:",
        "counters:",
        "review_repair_count:",
        "per_phase_repair_flags:",
        "decisions:",
        "evidence_precedence_decision:",
        "artifact_path:",
        "clone_path:",
        "dispatch_mode:",
      ]) {
        assert.ok(packet.includes(field), `resume packet omits ${field}`);
      }
      assert.match(
        reply,
        /\b(?:scope|goals?|pain points?)\b/i,
        "no question about missing inputs",
      );
      return "NEEDS_INPUT; resume packet; no report or source mutations";
    },
  },
] as const satisfies readonly EvalCase[];
