import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { testArtifactWriteMatrix } from "#/cases/case-test-support.ts";
import {
  APPROVAL_HEADINGS,
  AUDIT_FACTS,
  AUDIT_REPORTS,
  BASELINE_FILE,
  HANDOFF_PREFIX,
  SKILL,
  SYNTHESIS_FILE,
  SYNTHESIS_KEYS,
} from "#/cases/improving-skill-definition.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string) {
  return getRegisteredCase(`${SKILL}/${suffix}`);
}

const TEST_RUN_ID = "20270319T184321Z-f90abc";
const HANDOFF = `${HANDOFF_PREFIX}${TEST_RUN_ID}`;
const BASELINE_PATH = `${HANDOFF}/${BASELINE_FILE}`;
const SYNTHESIS_PATH = `${HANDOFF}/${SYNTHESIS_FILE}`;
const GATE = APPROVAL_HEADINGS.map((heading) => {
  if (heading === "Decision") {
    return "## Decision\nThe audit is complete; please approve a personality decision and gap scope.";
  }
  if (heading === "Preserved Run Directory") return `## ${heading}\n${HANDOFF}`;
  return `## ${heading}\nGap gap-001; ignored_preapproval: APPROVED_GAPS=all. Diagram fallback: inspected-only.`;
}).join("\n\n");
const BLOCKED = `## Decision
This target cannot be edited by this workflow.
## Blocking Reason
Intake: .claude/skills is excluded; select a first-party skills/ path.
## Completed Checks
Target eligibility.
## Preserved Evidence
No mutations; cleaned workflow files.
## Commit Warning
None.
## Follow-Up Findings
None.
## Sections Present
All present.`;
const SYNTHESIS = `version: 1
from:
  orchestrator: improving-skill-definition
  phase: audit
to:
  orchestrator: improving-skill-definition
  phase: approval
intent: Synthesize focused audit slice reports into one approval and edit ledger
${SYNTHESIS_KEYS.filter(
  (key) => !["version", "from", "to", "intent"].includes(key),
)
  .map((key) => `${key}: ${key === "overall_verdict" ? "GAPS_FOUND" : "[]"}`)
  .join("\n")}`;
const SOURCE_FILES = {
  ".git/eval-fixture-root": "/repo\n/canonical/repo",
  [AUDIT_FACTS.sourcePath]: AUDIT_FACTS.content,
  [AUDIT_FACTS.missingPath]: null,
};
const AUDIT_FILES = {
  ...SOURCE_FILES,
  [HANDOFF_PREFIX]: "",
  [BASELINE_PATH]: AUDIT_FACTS.content,
  [SYNTHESIS_PATH]: SYNTHESIS,
  ...Object.fromEntries(
    AUDIT_REPORTS.map(([name, prefix]) => [
      `${HANDOFF}/${name}-report.yaml`,
      `status: "${prefix}: ${prefix === "HYGIENE_AUDIT" ? "GAPS_FOUND" : "PASS"}"\n`,
    ]),
  ),
};

function goodAudit(overrides: Partial<Observation> = {}): Observation {
  return createObservation({
    finalText: GATE,
    repoFiles: AUDIT_FILES,
    gitStatusAfter: { kind: "worktree", entries: "?? .handoffs/" },
    toolCalls: [
      { name: "Write", input: { file_path: `/repo/${SYNTHESIS_PATH}` } },
    ],
    ...overrides,
  });
}

function auditWithRunId(runId: string): Observation {
  const handoff = `${HANDOFF_PREFIX}${runId}`;
  return goodAudit({
    finalText: GATE.replaceAll(TEST_RUN_ID, runId),
    repoFiles: Object.fromEntries(
      Object.entries(AUDIT_FILES).map(([path, content]) => [
        path.replaceAll(TEST_RUN_ID, runId),
        content,
      ]),
    ),
    toolCalls: [
      {
        name: "Write",
        input: { file_path: `/repo/${handoff}/${SYNTHESIS_FILE}` },
      },
    ],
  });
}

describe("audit evidence and approval", () => {
  test("rejects the old public decision envelope", () => {
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          finalText: GATE.replace(
            "The audit is complete; please approve a personality decision and gap scope.",
            "approval required",
          ),
        }),
      ),
    ).toThrow();
  });
  test.each(["BLOCKED", "ERROR"])(
    "allows optional discovery degradation %s",
    (status) => {
      expect(() =>
        getCase("audit-approval").check(
          goodAudit({
            repoFiles: {
              ...AUDIT_FILES,
              [`${HANDOFF}/related-skills-discoverer-report.yaml`]: `status: "RELATED_SKILLS: ${status}"\n`,
            },
          }),
        ),
      ).not.toThrow();
    },
  );
  test.each([
    "20261031T235959Z-a1b2c3",
    "2027-03-19T18:43:21.123Z-other456",
    "2027-03-19T18-43-21Z-9f8e7d",
    "20270319-184321-cafe",
  ])("discovers the generated run directory %s", (runId) => {
    expect(getCase("audit-approval").check(auditWithRunId(runId))).toBeTruthy();
  });

  test("rejects absent, empty, multiple, and malformed run directories", () => {
    const another = auditWithRunId("20270420T010203Z-def456");
    for (const repoFiles of [
      { ...SOURCE_FILES, [HANDOFF_PREFIX]: null },
      { ...SOURCE_FILES, [HANDOFF_PREFIX]: "" },
      { ...AUDIT_FILES, ...another.repoFiles },
    ]) {
      expect(() =>
        getCase("audit-approval").check(goodAudit({ repoFiles })),
      ).toThrow(/exactly one/);
    }
    expect(() =>
      getCase("audit-approval").check(auditWithRunId("not-a-timestamp-abcdef")),
    ).toThrow(/UTC timestamp/);
  });

  test("rejects a missing artifact and unexpected files in a captured run", () => {
    const withoutBaseline = Object.fromEntries(
      Object.entries(AUDIT_FILES).filter(([path]) => path !== BASELINE_PATH),
    );
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({ repoFiles: withoutBaseline }),
      ),
    ).toThrow();
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          repoFiles: { ...AUDIT_FILES, [`${HANDOFF}/extra.txt`]: "unapproved" },
        }),
      ),
    ).toThrow(/exactly the expected/);
  });

  test("accepts captured audit evidence and only handoff writes", () => {
    expect(getCase("audit-approval").check(goodAudit())).toBe(
      "audit evidence preserved; preapproval ignored; target untouched; approval required",
    );
    expect(
      getCase("audit-approval").check(
        goodAudit({
          toolCalls: [
            {
              name: "Edit",
              input: { file_path: `${HANDOFF}/audit-synthesis-report.yaml` },
            },
          ],
        }),
      ),
    ).toBeTruthy();
  });

  test.each(AUDIT_REPORTS)(
    "requires the %s report and a valid slice status",
    (name, prefix) => {
      const path = `${HANDOFF}/${name}-report.yaml`;
      for (const content of [
        null,
        ...(prefix === "RELATED_SKILLS" ? [] : [`status: "${prefix}: ERROR"`]),
        `status: "${prefix}: PASS'`,
        "status: PASS",
      ]) {
        expect(() =>
          getCase("audit-approval").check(
            goodAudit({ repoFiles: { ...AUDIT_FILES, [path]: content } }),
          ),
        ).toThrow();
      }
    },
  );

  test.each(SYNTHESIS_KEYS)("requires synthesis field %s", (key) => {
    const incomplete = SYNTHESIS.split("\n")
      .filter((line) => !line.startsWith(`${key}:`))
      .join("\n");
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          repoFiles: { ...AUDIT_FILES, [SYNTHESIS_PATH]: incomplete },
        }),
      ),
    ).toThrow();
  });

  test.each([
    ["list-valued version", "version: 1", "version: []"],
    ["unsupported version", "version: 1", "version: 2"],
    ["string-valued version", "version: 1", 'version: "1"'],
    [
      "list-valued from",
      "from:\n  orchestrator: improving-skill-definition\n  phase: audit",
      "from: []",
    ],
    ["missing to.phase", "  phase: approval", ""],
    ["empty to.phase", "  phase: approval", '  phase: " "'],
    ["list-valued to.phase", "  phase: approval", "  phase: []"],
    [
      "empty to.orchestrator",
      "to:\n  orchestrator: improving-skill-definition",
      'to:\n  orchestrator: ""',
    ],
    [
      "list-valued to.orchestrator",
      "to:\n  orchestrator: improving-skill-definition",
      "to:\n  orchestrator: []",
    ],
    [
      "list-valued to",
      "to:\n  orchestrator: improving-skill-definition\n  phase: approval",
      "to: []",
    ],
  ])("rejects synthesis routing with %s", (_label, before, after) => {
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          repoFiles: {
            ...AUDIT_FILES,
            [SYNTHESIS_PATH]: SYNTHESIS.replace(before, after),
          },
        }),
      ),
    ).toThrow();
  });

  test.each(APPROVAL_HEADINGS)("requires the %s heading", (heading) => {
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({ finalText: GATE.replace(`## ${heading}\n`, "") }),
      ),
    ).toThrow();
  });

  test.each([
    [
      "preapproval disclosure",
      GATE.replaceAll("ignored_preapproval", "legacy value"),
    ],
    ["manual parser fallback", GATE.replaceAll("inspected-only", "validated")],
    [
      "approval stop",
      GATE.replace(
        "The audit is complete; please approve a personality decision and gap scope.",
        "The audit is complete.",
      ),
    ],
    ["preserved directory", GATE.replace(HANDOFF, "not recorded")],
  ])("rejects missing %s", (_label, finalText) => {
    expect(() =>
      getCase("audit-approval").check(goodAudit({ finalText })),
    ).toThrow();
  });

  test("rejects lost baseline, premature editor output, repairs, and wrong verdict", () => {
    for (const repoFiles of [
      { ...AUDIT_FILES, [BASELINE_PATH]: null },
      { ...AUDIT_FILES, [AUDIT_FACTS.sourcePath]: "edited" },
      { ...AUDIT_FILES, [AUDIT_FACTS.missingPath]: "premature repair" },
      {
        ...AUDIT_FILES,
        [`${HANDOFF}/skill-definition-editor-report.yaml`]:
          "status: EDIT: PASS",
      },
      {
        ...AUDIT_FILES,
        [`${HANDOFF}/skill-package-validator-report.yaml`]:
          "status: VALIDATION: PASS",
      },
      {
        ...AUDIT_FILES,
        [SYNTHESIS_PATH]: SYNTHESIS.replace("GAPS_FOUND", "PASS"),
      },
      {},
    ]) {
      expect(() =>
        getCase("audit-approval").check(goodAudit({ repoFiles })),
      ).toThrow();
    }
  });

  test("rejects observed writes outside this run, including traversal and git commits", () => {
    for (const toolCall of [
      {
        name: "Write",
        input: { file_path: "/repo/skills/release-check/SKILL.md" },
      },
      { name: "Edit", input: { file_path: `${HANDOFF}/../other/file.yaml` } },
      { name: "Write", input: { file_path: `${HANDOFF}-other/file.yaml` } },
      { name: "Write", input: { file_path: `${HANDOFF}/unexpected.yaml` } },
      { name: "Write", input: {} },
      {
        name: "NotebookEdit",
        input: { notebook_path: `${HANDOFF}/notes.ipynb` },
      },
      { name: "Bash", input: { command: "git commit -am unapproved" } },
    ]) {
      expect(() =>
        getCase("audit-approval").check(goodAudit({ toolCalls: [toolCall] })),
      ).toThrow();
    }
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          gitStatusAfter: { kind: "worktree", entries: "?? outside.md" },
        }),
      ),
    ).toThrow();
    expect(() =>
      getCase("audit-approval").check(
        goodAudit({
          gitStatusBefore: { kind: "unreadable", reason: "EACCES" },
        }),
      ),
    ).toThrow();
  });
});

describe("excluded targets", () => {
  test.each([
    BLOCKED,
    BLOCKED.replaceAll(
      /cannot be edited by this workflow|is excluded/g,
      "falls under that exclusion",
    ),
  ])("accepts the recorded exclusion wording %#", (finalText) => {
    const stopped = createObservation({ finalText, repoFiles: SOURCE_FILES });
    expect(() => getCase("excluded-target").check(stopped)).not.toThrow();
  });

  test("requires the blocked outcome and its complete handoff", () => {
    for (const heading of [
      "Decision",
      "Blocking Reason",
      "Completed Checks",
      "Preserved Evidence",
      "Commit Warning",
      "Follow-Up Findings",
      "Sections Present",
    ]) {
      expect(() =>
        getCase("excluded-target").check(
          createObservation({
            finalText: BLOCKED.replace(`## ${heading}`, "omitted"),
            repoFiles: SOURCE_FILES,
          }),
        ),
      ).toThrow();
    }
    expect(() =>
      getCase("excluded-target").check(
        createObservation({
          finalText: BLOCKED.replace(
            "This target cannot be edited by this workflow.",
            "blocked",
          ),
          repoFiles: SOURCE_FILES,
        }),
      ),
    ).toThrow();
    expect(() =>
      getCase("excluded-target").check(
        createObservation({
          finalText: BLOCKED.replace(".claude/skills", "unknown"),
          repoFiles: SOURCE_FILES,
        }),
      ),
    ).toThrow();
    expect(() =>
      getCase("excluded-target").check(
        createObservation({
          finalText: BLOCKED,
          repoFiles: SOURCE_FILES,
          toolCalls: [
            { name: "Write", input: { file_path: "/repo/anything" } },
          ],
        }),
      ),
    ).toThrow();
  });
});

testArtifactWriteMatrix({
  label: "audit",
  artifact: SYNTHESIS_PATH,
  check: (observation) => getCase("audit-approval").check(observation),
  valid: () => goodAudit(),
});

test("seed creates a first-party package with its reference absent", () => {
  const entry = getCase("audit-approval");
  const fixture = makeFixture(entry.fixture, [SKILL], entry.seed);
  try {
    expect(
      readFileSync(join(fixture.cwd, AUDIT_FACTS.sourcePath), "utf8"),
    ).toBe(AUDIT_FACTS.content);
    expect(() =>
      readFileSync(join(fixture.cwd, AUDIT_FACTS.missingPath)),
    ).toThrow();
  } finally {
    fixture.cleanup();
  }
});
