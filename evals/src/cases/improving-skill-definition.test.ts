import { describe, expect, test } from "vitest";

import { testArtifactWriteMatrix } from "#/cases/case-test-support.ts";
import {
  APPROVAL_HEADINGS,
  AUDIT_FACTS,
  AUDIT_REPORTS,
  HANDOFF_PREFIX,
  SIBLING_PATH,
  SIBLING_TEXT,
  SKILL,
} from "#/cases/improving-skill-definition.ts";
import {
  AUDIT_FILES,
  auditWithRunId,
  BASELINE_PATH,
  BLOCKED,
  GATE,
  getCase,
  goodAudit,
  HANDOFF,
  ignoreProbe,
  SOURCE_FILES,
  SYNTHESIS,
  SYNTHESIS_PATH,
  TEST_RUN_ID,
  testSynthesisFields,
} from "#/cases/improving-skill-definition-test-support.ts";
import { makeFixture, writeRepoFiles } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { sampleGitStatus } from "#/observation/mutation-evidence.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

describe("audit evidence and approval", () => {
  function checkAudit(overrides: Partial<Observation> = {}) {
    return getCase("audit-approval").check(goodAudit(overrides));
  }

  test("accepts one new audit beside the unchanged seeded run", () => {
    expect(() =>
      checkAudit({
        repoFiles: { ...AUDIT_FILES, [SIBLING_PATH]: SIBLING_TEXT },
      }),
    ).not.toThrow();
  });

  test("rejects the loss of the seeded sibling", () => {
    expect(() =>
      checkAudit({ repoFiles: { ...AUDIT_FILES, [SIBLING_PATH]: null } }),
    ).toThrow();
  });

  const write = { name: "Write", input: { file_path: SYNTHESIS_PATH } };
  const failed = {
    ...ignoreProbe(),
    result: { content: "", truncated: false, isError: true },
  };
  test.each([
    ["missing", [write]],
    ["after first write", [write, ignoreProbe()]],
    ["wrong directory", [ignoreProbe(`${HANDOFF}-other`), write]],
    ["failed", [failed, write]],
  ] as const)("rejects an ignore probe that is %s", (_label, calls) => {
    expect(() => checkAudit({ toolCalls: [...calls] })).toThrow(/ignore probe/);
  });

  test("rejects the real run directory plus a suffix", () => {
    expect(() =>
      checkAudit({ finalText: GATE.replace(HANDOFF, `${HANDOFF}-other`) }),
    ).toThrow();
  });

  test("rejects a Bash write before the probe", () => {
    const copy = {
      name: "Bash",
      input: { command: `cp ${AUDIT_FACTS.sourcePath} ${BASELINE_PATH}` },
    };
    expect(() => checkAudit({ toolCalls: [copy, ignoreProbe()] })).toThrow(
      /before successful ignore probe/,
    );
  });
  test.each([
    `mkdir -p ${HANDOFF} && git check-ignore -q -- ${HANDOFF}/`,
    `echo 'git check-ignore -q -- ${HANDOFF}/'`,
    `git check-ignore -q -- ${HANDOFF}/ || true`,
    `true ||\n git check-ignore -q -- ${HANDOFF}/`,
  ])("rejects a late, quoted or masked shell probe %s", (command) => {
    expect(() =>
      checkAudit({ toolCalls: [{ ...ignoreProbe(), input: { command } }] }),
    ).toThrow(/ignore probe/);
  });

  test("accepts a successful shell probe guarding the inline write", () => {
    const command = `git check-ignore --quiet -- '${HANDOFF}/' && mkdir -p '${HANDOFF}'`;
    expect(() =>
      checkAudit({ toolCalls: [{ ...ignoreProbe(), input: { command } }] }),
    ).not.toThrow();
  });

  test("permits checking a run-name collision without reading its contents", () => {
    const sibling = SIBLING_PATH.replace(/\/sentinel\.txt$/, "");
    expect(() =>
      checkAudit({
        toolCalls: [
          { name: "Bash", input: { command: `test -e ${sibling}` } },
          ...goodAudit().toolCalls,
        ],
      }),
    ).not.toThrow();
  });

  test("rejects reading a sibling sentinel during the audit", () => {
    expect(() =>
      checkAudit({
        toolCalls: [
          { name: "Bash", input: { command: `cat ${SIBLING_PATH}` } },
          ...goodAudit().toolCalls,
        ],
      }),
    ).toThrow();
  });

  test("rejects the old public decision envelope", () => {
    const finalText = GATE.replace(
      "The audit is complete; please approve a personality decision and gap scope.",
      "approval required",
    );
    expect(() => checkAudit({ finalText })).toThrow();
  });
  test.each(["BLOCKED", "ERROR"])(
    "allows optional discovery degradation %s",
    (status) => {
      const repoFiles = {
        ...AUDIT_FILES,
        [`${HANDOFF}/related-skills-discoverer-report.yaml`]: `status: "RELATED_SKILLS: ${status}"\n`,
      };
      expect(() => checkAudit({ repoFiles })).not.toThrow();
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
      ).toThrow(/sibling|exactly one/);
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
    expect(checkAudit()).toBe(
      "audit evidence preserved; preapproval ignored; target untouched; approval required",
    );
    const toolCalls = [
      ignoreProbe(),
      { name: "Edit", input: { file_path: SYNTHESIS_PATH } },
    ];
    expect(checkAudit({ toolCalls })).toBeTruthy();
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
        const repoFiles = { ...AUDIT_FILES, [path]: content };
        expect(() => checkAudit({ repoFiles })).toThrow();
      }
    },
  );

  testSynthesisFields();

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
    [
      "actual run directory",
      GATE.replace(TEST_RUN_ID, "20270420T010203Z-def456"),
    ],
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
        getCase("audit-approval").check(
          goodAudit({ toolCalls: [ignoreProbe(), toolCall] }),
        ),
      ).toThrow();
    }
  });

  test.each<{ label: string; overrides: Partial<Observation> }>([
    {
      label: "outside file",
      overrides: {
        gitStatusAfter: { kind: "worktree", entries: "?? outside.md" },
      },
    },
    {
      label: "visible handoff",
      overrides: {
        gitStatusAfter: { kind: "worktree", entries: "?? .handoffs/" },
      },
    },
    {
      label: "unreadable sample",
      overrides: { gitStatusBefore: { kind: "unreadable", reason: "EACCES" } },
    },
    {
      label: "dirty turn with clean final tree",
      overrides: {
        turns: [
          createTurn({
            gitStatusAfter: { kind: "worktree", entries: "?? outside.md" },
          }),
        ],
      },
    },
  ])("rejects git status evidence: $label", ({ overrides }) => {
    expect(() =>
      getCase("audit-approval").check(goodAudit(overrides)),
    ).toThrow();
  });
});

describe("excluded targets", () => {
  function checkBlocked(overrides: Partial<Observation>) {
    return getCase("excluded-target").check(
      createObservation({
        finalText: BLOCKED,
        repoFiles: SOURCE_FILES,
        ...overrides,
      }),
    );
  }

  test.each([
    BLOCKED,
    BLOCKED.replaceAll(
      /cannot be edited by this workflow|is excluded/g,
      "falls under that exclusion",
    ),
  ])("accepts the recorded exclusion wording %#", (finalText) => {
    expect(() => checkBlocked({ finalText })).not.toThrow();
  });

  test("accepts a pre-write stop with an untouched sibling run", () => {
    expect(() => checkBlocked({ repoFiles: SOURCE_FILES })).not.toThrow();
  });

  test("rejects reading then deleting the sibling during intake", () => {
    expect(() =>
      checkBlocked({
        toolCalls: [
          {
            name: "Bash",
            input: { command: `cat ${SIBLING_PATH} && rm ${SIBLING_PATH}` },
          },
        ],
        repoFiles: { ...SOURCE_FILES, [SIBLING_PATH]: null },
      }),
    ).toThrow();
  });

  test("rejects a visible shell write at a pre-write stop even if the new directory is empty", () => {
    expect(() =>
      checkBlocked({
        toolCalls: [
          { name: "Bash", input: { command: `mkdir -p ${HANDOFF}` } },
        ],
      }),
    ).toThrow();
  });

  test("rejects an empty pre-write evidence disclosure", () => {
    expect(() =>
      checkBlocked({
        finalText: BLOCKED.replace(
          "No audit run started; no run files were created.",
          "",
        ),
      }),
    ).toThrow();
  });

  test("rejects a blocked reply that claims a preserved run directory", () => {
    const finalText = BLOCKED.replace(
      "No audit run started; no run files were created.",
      `Preserved run directory: \`${HANDOFF}/\`.`,
    );
    expect(() => checkBlocked({ finalText })).toThrow(
      /must not name a run directory/,
    );
  });

  test.each([{ ...SOURCE_FILES, [SIBLING_PATH]: null }, AUDIT_FILES])(
    "rejects an empty or populated handoff directory in a pre-write block %#",
    (repoFiles) => {
      expect(() => checkBlocked({ repoFiles })).toThrow(/sibling|file exists/);
    },
  );

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
      const finalText = BLOCKED.replace(`## ${heading}`, "omitted");
      expect(() => checkBlocked({ finalText })).toThrow();
    }
    for (const finalText of [
      BLOCKED.replace(
        "This target cannot be edited by this workflow.",
        "blocked",
      ),
      BLOCKED.replace(".claude/skills", "unknown"),
    ]) {
      expect(() => checkBlocked({ finalText })).toThrow();
    }
    const toolCalls = [
      { name: "Write", input: { file_path: "/repo/anything" } },
    ];
    expect(() => checkBlocked({ toolCalls })).toThrow();
  });
});

testArtifactWriteMatrix({
  label: "audit",
  artifact: SYNTHESIS_PATH,
  check: (observation) => getCase("audit-approval").check(observation),
  valid: () => goodAudit(),
});

test("captures seeded package facts and keeps only workflow handoffs out of git status", () => {
  const entry = getCase("audit-approval");
  const blocked = getCase("excluded-target");
  const fixture = makeFixture(entry.fixture, [SKILL], entry.seed);
  try {
    expect(
      snapshotRepoFiles(fixture.cwd, blocked.snapshotPaths ?? []),
    ).toMatchObject({
      [AUDIT_FACTS.sourcePath]: AUDIT_FACTS.content,
      [AUDIT_FACTS.missingPath]: null,
      [HANDOFF_PREFIX]: "",
      [SIBLING_PATH]: SIBLING_TEXT,
    });
    writeRepoFiles(fixture.cwd, { [SYNTHESIS_PATH]: SYNTHESIS });
    expect(sampleGitStatus(fixture.cwd)).toEqual({
      kind: "worktree",
      entries: "",
    });
    expect(
      snapshotRepoFiles(fixture.cwd, entry.snapshotPaths ?? []),
    ).toMatchObject({
      [SYNTHESIS_PATH]: SYNTHESIS,
    });
    writeRepoFiles(fixture.cwd, { ".handoffs/unrelated/report.yaml": "extra" });
    expect(sampleGitStatus(fixture.cwd)).toEqual({
      kind: "worktree",
      entries: "?? .handoffs/",
    });
  } finally {
    fixture.cleanup();
  }
});
