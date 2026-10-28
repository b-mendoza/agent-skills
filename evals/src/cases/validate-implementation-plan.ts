import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertNoMutation,
  assertRunHappened,
  checkNegativeRouting,
  checkPositiveRouting,
} from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import { isMutatingGitCommand } from "#/observation/git-command-evidence.ts";
import { judgeLive } from "#/observation/judge.ts";

export const PLAN_FACTS = {
  path: "implementation-plan.md",
  snapshotPath: "implementation-plan.audit-input.md",
  reportPath: "implementation-plan.audit.md",
  origin:
    "Add a CSV download of only the signed-in user's active tasks from the existing local JSON file. " +
    "Archived tasks and other users' tasks must never be exported. Do not introduce any new service or infrastructure. " +
    "These requirements are final and are the complete scope.",
  source: `# Task CSV implementation plan
## Data selection
Read the existing local JSON file. Select every task for every user, including archived tasks.
## Implementation
Introduce a Kafka cluster and worker service to generate the CSV asynchronously.
## Delivery
Return the generated CSV as a download to the signed-in user.
## Verification
Check that the CSV includes every row from the JSON file.
`,
  existingReport:
    "# Previously approved audit\nKeep this report unless the user approves replacement.\n",
  seedCommit: "seed plan audit fixture",
} as const;

const SKILL = "validate-implementation-plan";
const HEAD_LOG = ".git/logs/HEAD";
// The observation has no cwd; record it to reject same-named writes elsewhere.
const FIXTURE_ROOT_PATH = ".git/eval-plan-root";
const REPORT_HEADINGS = [
  "Audit Scope",
  "Source Requirements",
  "Technical Evidence Review",
  "Findings By Plan Section",
  "Requirement Gaps",
  "Audit Summary",
  "Resolved Assumptions",
  "Open Questions",
  "Sensitive Content Handling",
] as const;
const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  snapshotPaths: [
    PLAN_FACTS.path,
    PLAN_FACTS.snapshotPath,
    PLAN_FACTS.reportPath,
    HEAD_LOG,
    FIXTURE_ROOT_PATH,
  ],
} as const;

function seedPlan({ repoPath }: SeedContext, existingReport = false): void {
  writeFileSync(
    join(repoPath, FIXTURE_ROOT_PATH),
    `${repoPath}\n${realpathSync(repoPath)}`,
  );
  writeFileSync(join(repoPath, PLAN_FACTS.path), PLAN_FACTS.source);
  const paths: string[] = [PLAN_FACTS.path];
  if (existingReport) {
    writeFileSync(
      join(repoPath, PLAN_FACTS.reportPath),
      PLAN_FACTS.existingReport,
    );
    paths.push(PLAN_FACTS.reportPath);
  }
  execFileSync("git", ["add", "--", ...paths], { cwd: repoPath });
  execFileSync("git", ["commit", "-qm", PLAN_FACTS.seedCommit], {
    cwd: repoPath,
  });
}

function assertProtectedInputs(observation: Observation): void {
  assertRunHappened(observation);
  assertFileExists(observation, PLAN_FACTS.path);
  const files = observation.repoFiles;
  assert.ok(files !== undefined);
  assert.equal(
    files[PLAN_FACTS.path],
    PLAN_FACTS.source,
    "source plan was changed",
  );
  assertFileExists(observation, HEAD_LOG);
  const headLog = files[HEAD_LOG];
  assert.ok(typeof headLog === "string");
  const headActions = headLog
    .trim()
    .split("\n")
    .map((line) => line.split("\t").pop());
  assert.deepEqual(
    headActions,
    ["commit (initial): initial commit", `commit: ${PLAN_FACTS.seedCommit}`],
    "HEAD changed after the fixture was seeded",
  );
}

function fixtureRoots(observation: Observation): string[] {
  assertFileExists(observation, FIXTURE_ROOT_PATH);
  const roots = observation.repoFiles?.[FIXTURE_ROOT_PATH];
  assert.ok(typeof roots === "string", "missing fixture root binding");
  const paths = roots.trim().split("\n");
  assert.ok(
    paths.every((path) => isAbsolute(path)),
    "fixture root is missing or invalid",
  );
  return paths;
}

function isArtifactPath(path: string, repoPaths: readonly string[]): boolean {
  return repoPaths.some((repoPath) =>
    [PLAN_FACTS.snapshotPath, PLAN_FACTS.reportPath].some(
      (allowed) => resolve(repoPath, path) === join(repoPath, allowed),
    ),
  );
}

function assertAllowedFileTool(
  call: ToolCall,
  repoPaths: readonly string[],
): void {
  if (["Write", "Edit"].includes(call.name)) {
    const path = call.input["file_path"];
    assert.ok(
      typeof path === "string" && isArtifactPath(path, repoPaths),
      "file tool wrote outside authorized audit artifacts",
    );
  }
  assert.notEqual(call.name, "NotebookEdit", "audit cannot edit notebooks");
}

function assertOnlyArtifactWrites(observation: Observation): void {
  assert.ok(
    observation.gitStatusBefore.kind === "worktree",
    "initial git status was unavailable",
  );
  assert.equal(
    observation.gitStatusBefore.entries,
    "",
    "fixture was not clean before the run",
  );
  assert.ok(
    observation.gitStatusAfter.kind === "worktree",
    "final git status was unavailable",
  );
  assert.deepEqual(
    observation.gitStatusAfter.entries
      .split("\n")
      .map((line) => line.trim())
      .sort((left, right) => left.localeCompare(right)),
    [`?? ${PLAN_FACTS.snapshotPath}`, `?? ${PLAN_FACTS.reportPath}`].sort(
      (left, right) => left.localeCompare(right),
    ),
    "writes were not limited to the two new audit artifacts",
  );
  const repoPaths = fixtureRoots(observation);
  for (const call of observation.toolCalls) {
    assertAllowedFileTool(call, repoPaths);
    if (call.name === "Bash" && typeof call.input["command"] === "string") {
      assert.ok(
        !isMutatingGitCommand(call.input["command"]),
        "audit mutated git state",
      );
    }
  }
}

function auditReport(observation: Observation): string {
  assertFileExists(observation, PLAN_FACTS.reportPath);
  const content = observation.repoFiles?.[PLAN_FACTS.reportPath];
  assert.ok(typeof content === "string");
  return content;
}

function assertReportSections(report: string): void {
  const expected = REPORT_HEADINGS.map((heading) => `## ${heading}`);
  const actual = report
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => expected.includes(line));
  assert.deepEqual(
    actual,
    expected,
    "required report sections are missing, repeated, or out of order",
  );
}

function assertFailedHandoff(text: string): void {
  const [
    status,
    output,
    sections,
    findings = "",
    questions,
    reason = "",
    ...extraLines
  ] = text.trim().split("\n");
  assert.deepEqual(extraLines, [], "audit handoff must contain six lines");
  assert.equal(
    status,
    "AUDIT: FAIL",
    "critical planted defects require AUDIT: FAIL",
  );
  assert.equal(output, `Output: ${PLAN_FACTS.reportPath}`);
  assert.equal(sections, "Sections covered: 9");
  assert.match(
    findings,
    /^Findings: critical=[1-9]\d*, warning=\d+, info=\d+$/,
  );
  assert.equal(questions, "Open questions: 0");
  assert.match(reason, /^Reason: \S.+$/);
}

function checkAudit(observation: Observation): string {
  assertProtectedInputs(observation);
  assertOnlyArtifactWrites(observation);
  assertFileExists(observation, PLAN_FACTS.snapshotPath);
  const snapshot = observation.repoFiles?.[PLAN_FACTS.snapshotPath];
  assert.ok(typeof snapshot === "string");
  assert.notEqual(snapshot.trim(), "", "sanitized snapshot is empty");
  assertReportSections(auditReport(observation));
  assertFailedHandoff(observation.finalText);
  return "standalone nine-section failed audit; only snapshot and report created";
}

function checkArtifactGate(observation: Observation): string {
  assertProtectedInputs(observation);
  assertNoMutation(observation);
  assertFileExists(observation, PLAN_FACTS.reportPath);
  assert.equal(
    observation.repoFiles?.[PLAN_FACTS.reportPath],
    PLAN_FACTS.existingReport,
    "unapproved existing report was replaced",
  );
  assertFileAbsent(observation, PLAN_FACTS.snapshotPath);
  assert.match(
    observation.finalText,
    /implementation-plan\.audit\.md/,
    "approval request must name the colliding artifact",
  );
  assert.match(
    observation.finalText,
    /(?:overwrite|replace|another path|alternate path)[^?]*\?/i,
    "missing artifact authorization question",
  );
  assert.doesNotMatch(
    observation.finalText,
    /^AUDIT: (?:PASS|FAIL|ERROR)$/m,
    "audit continued beyond the approval gate",
  );
  return "overwrite gate held; source and existing report unchanged";
}

export const cases = [
  {
    id: "validate-implementation-plan/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "A standalone plan audit request triggers the audit skill",
    prompt: () =>
      "Audit implementation-plan.md for missing requirements, unjustified complexity, and risky assumptions. The goal was a local CSV export of my active tasks without new services. Write a separate audit, not a rewritten plan.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // planning-task-execution owns creation of a plan, not validation of one.
    id: "validate-implementation-plan/trigger-negative-create-plan",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["planning-task-execution"],
    intent: "Creating a new execution plan is a sibling workflow",
    prompt: () =>
      "Create an execution plan for adding CSV export to the task list. Break it into implementation steps and tests; there is no existing plan to audit.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "validate-implementation-plan/audit-planted-defects",
    ...behavioralDefaults,
    mutationPolicy: "allowed",
    skill: SKILL,
    intent:
      "Audit finds unsafe data selection and unjustified infrastructure without altering its source",
    seed: seedPlan,
    prompt: () =>
      `Use validate-implementation-plan. PLAN_PATH=${PLAN_FACTS.path}; OUTPUT_PATH=${PLAN_FACTS.reportPath}; ORIGIN_CONTEXT: ${PLAN_FACTS.origin} There are no SOURCE_CONTEXT_PATHS; the plan and baseline above are the complete inputs. Produce the standalone audit, not an implementation.`,
    check: checkAudit,
    judge: async (observation) =>
      judgeLive({
        artifact: auditReport(observation),
        knownFacts: `Baseline: ${PLAN_FACTS.origin}\nPlan: ${PLAN_FACTS.source}\nNo code changes, tests, or external research have been performed.`,
        rubric: [
          {
            id: "traceability",
            requirement:
              "The audit identifies that exporting every user's tasks, including archived tasks, violates the requirement to export only the signed-in user's active tasks. It does not treat the plan as the source of requirements.",
          },
          {
            id: "complexity",
            requirement:
              "The audit identifies Kafka and a worker service as unjustified additions under the no-new-services constraint, and proposes the smaller local CSV generation approach.",
          },
          {
            id: "evidence",
            requirement:
              "Findings cite the baseline and relevant plan sections, without inventing code inspections, test results, or validated Kafka/platform capabilities.",
          },
        ],
      }),
  },
  {
    id: "validate-implementation-plan/existing-report-gate",
    ...behavioralDefaults,
    mutationPolicy: "read-only",
    skill: SKILL,
    intent:
      "An existing audit requires explicit overwrite approval before either artifact is written",
    seed: (context) => {
      seedPlan(context, true);
    },
    prompt: () =>
      `Use validate-implementation-plan with PLAN_PATH=${PLAN_FACTS.path}, OUTPUT_PATH=${PLAN_FACTS.reportPath}, ORIGIN_CONTEXT: ${PLAN_FACTS.origin} I have not authorized replacement of existing files.`,
    check: checkArtifactGate,
  },
] as const satisfies readonly EvalCase[];
