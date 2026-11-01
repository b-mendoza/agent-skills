import { execFileSync } from "node:child_process";
import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  ARTIFACT_PATH,
  cases,
  REPORT_SECTIONS,
  seedLayeredProject,
  STRUCTURE_FILES,
} from "#/cases/planning-codebase-restructuring.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { sampleGitStatus } from "#/observation/mutation-evidence.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const [, , plan, missing] = cases;
const REPORT = `${REPORT_SECTIONS.map(
  (section) => `## ${section}\nLocal evidence or no issue found.\n`,
).join("\n")}
REFERENCE_ASSESSMENT: SKIPPED
EVIDENCE_PRECEDENCE_DECISION: not-applicable
CONTRACT_NOTE: ARCHITECTURE_MAP | pass | checked
CONTRACT_NOTE: DOMAIN_ANALYSIS | pass | checked
CONTRACT_NOTE: RESTRUCTURING_PLAN | pass | checked
PLAN_REVIEW: PASS`;
const READY = `I saved the reviewed plan to ${ARTIFACT_PATH}. Source and tests are unchanged; implementation and test execution remain unapproved.`;
const INPUT_REQUEST = `I stopped before inspection or report creation. Please choose the scope and business goals for the plan.
\`\`\`yaml
phase_reached: Preflight
pending_question: Choose the scope and goals.
validated_summaries: []
contract_notes: []
counters:
  review_repair_count: 0
  per_phase_repair_flags: {}
decisions:
  evidence_precedence_decision: null
  artifact_path: ${ARTIFACT_PATH}
  clone_path: null
  dispatch_mode: inline
\`\`\``;
const readyObservation = createObservation({
  finalText: READY,
  repoFiles: {
    ...STRUCTURE_FILES,
    [ARTIFACT_PATH]: REPORT,
    [FIXTURE_ROOT_PATH]: "/fixture",
  },
  gitStatusAfter: { kind: "worktree", entries: `?? ${ARTIFACT_PATH}` },
  toolCalls: [
    { name: "Write", input: { file_path: `/fixture/${ARTIFACT_PATH}` } },
  ],
});
const inputObservation = createObservation({
  finalText: INPUT_REQUEST,
  repoFiles: { ...STRUCTURE_FILES, [ARTIFACT_PATH]: null },
});

describe("persisted decision report", () => {
  test("accepts the reviewed report as the only write", () => {
    expect(plan.check(readyObservation)).toContain("report persisted");
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: {
          ...readyObservation.repoFiles,
          [ARTIFACT_PATH]: `${REPORT}\nStatus: READY`,
        },
      }),
    ).not.toThrow();
  });
  test.each(REPORT_SECTIONS)(
    "rejects a missing report section: %s",
    (section) => {
      expect(() =>
        plan.check({
          ...readyObservation,
          repoFiles: {
            ...readyObservation.repoFiles,
            [ARTIFACT_PATH]: REPORT.replace(section, "Omitted"),
          },
        }),
      ).toThrow(/section/);
    },
  );
  test("rejects sections in the wrong order", () => {
    const reversed = [...REPORT_SECTIONS].reverse().join("\n");
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: { ...readyObservation.repoFiles, [ARTIFACT_PATH]: reversed },
      }),
    ).toThrow(/out-of-order/);
  });
  test.each([
    ["old status", `${READY}\nStatus: READY`],
    ["Markdown status", `${READY}\n**Status:** READY`],
    ["artifact path", READY.replace(ARTIFACT_PATH, "elsewhere.md")],
    ["routing envelope", `${READY}\nPLAN_REVIEW: PASS`],
  ])("rejects wrong public %s", (_label, finalText) => {
    expect(() => plan.check({ ...readyObservation, finalText })).toThrow();
  });
  test.each([
    [
      "skip marker",
      REPORT.replace("REFERENCE_ASSESSMENT: SKIPPED", "reference absent"),
    ],
    ["precedence", REPORT.replace("not-applicable", "reference-authorized")],
    [
      "map contract",
      REPORT.replace("CONTRACT_NOTE: ARCHITECTURE_MAP", "unvalidated map"),
    ],
    [
      "domain contract",
      REPORT.replace("CONTRACT_NOTE: DOMAIN_ANALYSIS", "unvalidated domain"),
    ],
    [
      "plan contract",
      REPORT.replace("CONTRACT_NOTE: RESTRUCTURING_PLAN", "unvalidated plan"),
    ],
    ["review", REPORT.replace("PLAN_REVIEW: PASS", "PLAN_REVIEW: FAIL")],
  ])("rejects wrong persisted %s", (_label, report) => {
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: { ...readyObservation.repoFiles, [ARTIFACT_PATH]: report },
      }),
    ).toThrow();
  });
  test("accepts equivalent reference and risk headings", () => {
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: {
          ...readyObservation.repoFiles,
          [ARTIFACT_PATH]: REPORT.replace(
            "Reference assessment or limitation",
            "Reference assessment",
          ).replace(
            "open questions, and security notes",
            "open questions, security notes",
          ),
        },
      }),
    ).not.toThrow();
  });
  test("accepts the recorded preflight reference mention before the actual reference section", () => {
    const report = REPORT.replace(
      "## Preflight summary\n",
      "## 1. Preflight summary\nReference assessment: SKIPPED (set by orchestrator).\n",
    ).replace(
      "open questions, and security notes",
      "open questions, security notes",
    );
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: { ...readyObservation.repoFiles, [ARTIFACT_PATH]: report },
      }),
    ).not.toThrow();
  });

  test("rejects report section names mentioned only in body text", () => {
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: {
          ...readyObservation.repoFiles,
          [ARTIFACT_PATH]: REPORT.replaceAll("## ", "Topics: "),
        },
      }),
    ).toThrow(/section/);
  });

  test("rejects a claimed report with no saved file", () => {
    expect(() =>
      plan.check({
        ...readyObservation,
        repoFiles: { ...readyObservation.repoFiles, [ARTIFACT_PATH]: null },
      }),
    ).toThrow(/absent/);
  });
  test("rejects missing file capture", () => {
    expect(() => plan.check({ ...readyObservation, repoFiles: {} })).toThrow(
      /not captured/,
    );
  });
});

describe("planning-only mutation boundary", () => {
  test.each(Object.keys(STRUCTURE_FILES))(
    "rejects changed source %s even if status is forged clean",
    (path) => {
      expect(() =>
        plan.check({
          ...readyObservation,
          repoFiles: { ...readyObservation.repoFiles, [path]: "rewritten" },
        }),
      ).toThrow(/codebase was changed/);
    },
  );
  test.each([
    "",
    `?? ${ARTIFACT_PATH}\n?? extra.md`,
    `M src/services/order.mjs\n?? ${ARTIFACT_PATH}`,
  ])("rejects unexpected post-run status %s", (entries) => {
    expect(() =>
      plan.check({
        ...readyObservation,
        gitStatusAfter: { kind: "worktree", entries },
      }),
    ).toThrow(/only the requested report/);
  });
  test.each([
    { name: "Write", input: { file_path: "/fixture/extra.md" } },
    { name: "Write", input: { file_path: "/outside/restructuring-plan.md" } },
    { name: "Edit", input: { file_path: "src/services/order.mjs" } },
    { name: "NotebookEdit", input: { notebook_path: "notes.ipynb" } },
    { name: "Bash", input: { command: "git commit -am implementation" } },
  ])("rejects unauthorized tool $name", (toolCall) => {
    expect(() =>
      plan.check({ ...readyObservation, toolCalls: [toolCall] }),
    ).toThrow(/write outside/);
  });
  test.each([
    "npm test",
    "CI=1 npm test",
    "CI=1 FOO=bar npm test",
    "env CI=1 FOO='two words' npm test",
    "cd /fixture && CI=1 pnpm run build",
    "cd /fixture && npm install",
    "node --test tests/order.test.mjs",
    "/usr/local/bin/node --test tests/order.test.mjs",
    '"/usr/local/bin/node" --test tests/order.test.mjs',
    "'/usr/local/bin/node' --test tests/order.test.mjs",
    "node --no-warnings --test tests/order.test.mjs",
    "node --require node:assert --test tests/order.test.mjs",
    "node -r node:assert --test tests/order.test.mjs",
    "node --import tsx --test tests/order.test.mjs",
    "node --loader tsx --test tests/order.test.mjs",
    "node --experimental-loader tsx --test tests/order.test.mjs",
    "node --test-reporter spec --test tests/order.test.mjs",
    "node --test-reporter-destination stdout --test tests/order.test.mjs",
    "node --conditions development --test tests/order.test.mjs",
    "node -C development --test tests/order.test.mjs",
    "node --env-file .env --test tests/order.test.mjs",
    "node --test-name-pattern checkout --test tests/order.test.mjs",
    "node --test-concurrency 1 --test tests/order.test.mjs",
    'env CI=1 node --no-warnings --require node:assert --test-name-pattern "checkout persists" --test-reporter spec --test tests/order.test.mjs',
    "node --test-name-pattern 'checkout persists' --test tests/order.test.mjs",
    "env CI=1 node --no-warnings --test-reporter=spec --test tests/order.test.mjs",
    "git status\npnpm run build",
    "npx prettier .",
    "yarn test",
  ])("rejects forbidden execution %s", (command) => {
    expect(() =>
      plan.check({
        ...readyObservation,
        toolCalls: [{ name: "Bash", input: { command } }],
      }),
    ).toThrow(/must not execute/);
  });
  test.each([
    "cat package.json && git status --short",
    "node --version",
    "CI=1 node --version",
    "env CI=1 FOO='two words' node --version",
    "node --test-reporter=spec --version",
    "node --test-reporter spec --version",
    "node scripts/inspect.mjs --test",
    "node --require node:assert scripts/inspect.mjs --test",
    "node -- --test",
    "/usr/local/bin/node scripts/inspect.mjs --test",
    '"/usr/local/bin/node" -- --test',
    "cat tests/order.test.mjs",
    "git log --oneline",
  ])("allows read-only inspection %s and report writes", (command) => {
    expect(
      plan.check({
        ...readyObservation,
        toolCalls: [
          { name: "Bash", input: { command } },
          { name: "Write", input: { file_path: ARTIFACT_PATH } },
        ],
      }),
    ).toContain("READY");
  });
});

describe("missing required inputs", () => {
  test("returns a resume packet without creating the report", () => {
    expect(missing.check(inputObservation)).toContain("NEEDS_INPUT");
  });
  test.each([
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
  ])("rejects omitted %s", (field) => {
    expect(() =>
      missing.check({
        ...inputObservation,
        finalText: INPUT_REQUEST.replace(field, "missing"),
      }),
    ).toThrow();
  });
  test.each([
    `Status: NEEDS_INPUT\n${INPUT_REQUEST}`,
    `**Status:** NEEDS_INPUT\n${INPUT_REQUEST}`,
    INPUT_REQUEST.replaceAll("```", ""),
    INPUT_REQUEST.replace(/\n```$/, ""),
  ])("rejects public status framing or an unfenced packet", (finalText) => {
    expect(() => missing.check({ ...inputObservation, finalText })).toThrow();
  });
  test("rejects a premature report", () => {
    expect(() =>
      missing.check({
        ...inputObservation,
        repoFiles: {
          ...STRUCTURE_FILES,
          [ARTIFACT_PATH]: REPORT,
          [FIXTURE_ROOT_PATH]: "/fixture",
        },
      }),
    ).toThrow(/file exists/);
  });
  test("rejects mutation before clarification", () => {
    expect(() =>
      missing.check({
        ...inputObservation,
        toolCalls: [{ name: "Write", input: { file_path: ARTIFACT_PATH } }],
      }),
    ).toThrow(/read-only/);
  });
});

test("seeded architecture is runnable and committed without a pre-existing report", () => {
  const fixture = makeFixture("clean", [], seedLayeredProject);
  try {
    expect(
      snapshotRepoFiles(fixture.cwd, [
        ...Object.keys(STRUCTURE_FILES),
        ARTIFACT_PATH,
      ]),
    ).toEqual({ ...STRUCTURE_FILES, [ARTIFACT_PATH]: null });
    expect(sampleGitStatus(fixture.cwd)).toEqual({
      kind: "worktree",
      entries: "",
    });
    const output = execFileSync(
      process.execPath,
      ["--test", "--test-reporter=tap", "tests/order.test.mjs"],
      { cwd: fixture.cwd, encoding: "utf8" },
    );
    expect(output).toMatch(/# pass 1/);
    expect(output).toMatch(/# fail 0/);
    writeFileSync(join(fixture.cwd, ARTIFACT_PATH), REPORT);
    const repoFiles = snapshotRepoFiles(fixture.cwd, plan.snapshotPaths);
    for (const root of [fixture.cwd, realpathSync(fixture.cwd)]) {
      expect(
        plan.check(
          createObservation({
            finalText: READY,
            repoFiles,
            gitStatusAfter: sampleGitStatus(fixture.cwd),
            toolCalls: [
              {
                name: "Write",
                input: { file_path: join(root, ARTIFACT_PATH) },
              },
            ],
          }),
        ),
      ).toContain("report persisted");
    }
  } finally {
    fixture.cleanup();
  }
});
