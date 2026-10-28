import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import {
  cases,
  FIXTURE_ROOT_PATH,
  HANDOFF_FACTS,
  HANDOFF_PATHS,
} from "#/cases/generate-handoff-document.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

function getCase(suffix: string): EvalCase {
  const found = cases.find((evalCase) => evalCase.id.endsWith(`/${suffix}`));
  assert.ok(found !== undefined, `missing case: ${suffix}`);
  return found;
}

const fixtureRoots = ["/fixture", "/private/fixture"];

const skillCall = {
  name: "Skill",
  input: { skill: "generate-handoff-document" },
};
const context = {
  subject: HANDOFF_FACTS.subject,
  mandate: {
    summary: HANDOFF_FACTS.mandate,
    status: "active",
    evidence: [HANDOFF_FACTS.mandate],
  },
  original_instructions: [
    {
      instruction: HANDOFF_FACTS.mandate,
      source: "transcript",
      speaker: "user",
      evidence: HANDOFF_FACTS.mandate,
      status: "active",
    },
  ],
  qa_log: [],
  amendments: [],
  source_summary: {
    transcript_file: HANDOFF_PATHS.transcript,
    prior_handoff_file: null,
    chunked: false,
    line_count: 10,
    instruction_blocks: 1,
    qa_exchanges: 0,
    amendments: 0,
    warnings: [],
  },
};
const insights = {
  subject: HANDOFF_FACTS.subject,
  insights: [
    {
      title: "Rejected approach",
      claim: HANDOFF_FACTS.failedApproach,
      rationale: "Avoid extra upstream requests.",
      evidence: [HANDOFF_FACTS.failedApproach],
      verification_status: "unverified",
      verification_notes: "Reported in the session; not independently rerun.",
      category: "failed_approach",
      priority: "important",
    },
    {
      title: "Proposed change",
      claim: HANDOFF_FACTS.proposal,
      rationale: "Keep cache entries tenant-specific.",
      evidence: [HANDOFF_FACTS.proposal],
      verification_status: "unverified",
      verification_notes: "Proposal only, not implemented.",
      category: "decision",
      priority: "important",
    },
  ],
  summary: { insights: 2, critical: 0, unverified_or_partial: 2, warnings: [] },
};
const document = `# Handoff Document: ${HANDOFF_FACTS.subject}
## Session Metadata
Generated: 2026-10-23T10:00Z
Status: In Progress
CLAIMS: SKIPPED
Working artifacts:
- ${HANDOFF_PATHS.transcript}
- ${HANDOFF_PATHS.context}
- ${HANDOFF_PATHS.insights}
- Claims: none
- Backup: none
## 1. Original Instructions & Scope
**Fulfills:** Preserve the mandate.
${HANDOFF_FACTS.mandate}
## 2. Q&A Log
**Fulfills:** Preserve clarifications.
No clarifying Q&A exchanges occurred in the supplied transcript.
## 3. Observations & Insights
**Fulfills:** Transfer findings.
${HANDOFF_FACTS.failedApproach}
${HANDOFF_FACTS.proposal}
Secret in log: [REDACTED]
## 4. Unverified Claims & Validation Checklist
**Fulfills:** Separate unsupported claims.
No tracking files were supplied; independent claim validation was skipped.
## 5. Open Questions & Recommended Next Steps
**Fulfills:** Give concrete next steps.
${HANDOFF_FACTS.openQuestion}`;

function writtenObservation(): Observation {
  const writtenPaths = [
    HANDOFF_PATHS.target,
    HANDOFF_PATHS.transcript,
    HANDOFF_PATHS.context,
    HANDOFF_PATHS.insights,
  ];
  return createObservation({
    finalText: `Completed: review pass\n${writtenPaths.join("\n")}\nEXTERNAL: SKIPPED\nCONTEXT: PASS\nINSIGHTS: PASS\nCLAIMS: SKIPPED\nHANDOFF: PASS\nREVIEW: PASS\nOpen questions: 1\nWarnings: 0\nRepair cycles: 0`,
    toolCalls: [skillCall],
    gitStatusAfter: {
      kind: "worktree",
      entries: writtenPaths.map((path) => `?? ${path}`).join("\n"),
    },
    repoFiles: {
      [FIXTURE_ROOT_PATH]: fixtureRoots.join("\n"),
      [HANDOFF_PATHS.target]: document,
      [HANDOFF_PATHS.transcript]: `${HANDOFF_FACTS.mandate}\n${HANDOFF_FACTS.failedApproach}\n${HANDOFF_FACTS.proposal}\n${HANDOFF_FACTS.openQuestion}\nAPI_KEY=[REDACTED]`,
      [HANDOFF_PATHS.context]: JSON.stringify(context),
      [HANDOFF_PATHS.insights]: JSON.stringify(insights),
      [HANDOFF_PATHS.claims]: null,
      [HANDOFF_PATHS.backup]: null,
      "a.txt": "hello\n",
    },
  });
}

function replaceCaptured(path: string, content: string | null): Observation {
  const observation = writtenObservation();
  return {
    ...observation,
    repoFiles: { ...observation.repoFiles, [path]: content },
  };
}

function gateObservation(): Observation {
  return createObservation({
    finalText: `The target ${HANDOFF_PATHS.target} already exists. Should I overwrite it, update it, or use a new path?`,
    toolCalls: [skillCall],
    repoFiles: {
      [HANDOFF_PATHS.target]: HANDOFF_FACTS.existingDocument,
      [HANDOFF_PATHS.transcript]: null,
      [HANDOFF_PATHS.context]: null,
      [HANDOFF_PATHS.insights]: null,
      [HANDOFF_PATHS.claims]: null,
      [HANDOFF_PATHS.backup]: null,
      "a.txt": "hello\n",
    },
  });
}

describe("handoff routing", () => {
  it("accepts an invoked skill, but not a missed trigger", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  it("leaves a git-state report to its sibling", () => {
    const evalCase = getCase("trigger-negative-git-state");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(createObservation({ toolCalls: [skillCall] })),
    ).toThrow();
  });
});

describe("conversation handoff package", () => {
  it("accepts the complete package with a redacted transcript and no claims file", () => {
    expect(() =>
      getCase("conversation-package").check(writtenObservation()),
    ).not.toThrow();
  });

  it.each([
    HANDOFF_PATHS.target,
    HANDOFF_PATHS.transcript,
    HANDOFF_PATHS.context,
    HANDOFF_PATHS.insights,
    FIXTURE_ROOT_PATH,
  ])("rejects missing %s", (path) => {
    expect(() =>
      getCase("conversation-package").check(replaceCaptured(path, null)),
    ).toThrow();
  });

  it.each([
    ["invalid JSON", HANDOFF_PATHS.context, "{"],
    ["missing required context keys", HANDOFF_PATHS.context, "{}"],
    [
      "invalid mandate status",
      HANDOFF_PATHS.context,
      JSON.stringify({
        ...context,
        mandate: { ...context.mandate, status: "done" },
      }),
    ],
    [
      "missing insight summary",
      HANDOFF_PATHS.insights,
      JSON.stringify({ subject: HANDOFF_FACTS.subject, insights: [] }),
    ],
    [
      "invalid insight array",
      HANDOFF_PATHS.insights,
      JSON.stringify({ ...insights, insights: "done" }),
    ],
    [
      "missing section",
      HANDOFF_PATHS.target,
      document.replace("## 2. Q&A Log", "### 2. Q&A Log"),
    ],
    [
      "missing Fulfills line",
      HANDOFF_PATHS.target,
      document.replace("**Fulfills:** Preserve clarifications.\n", ""),
    ],
    [
      "missing manifest",
      HANDOFF_PATHS.target,
      document.replace("Working artifacts:", "Files:"),
    ],
    [
      "placeholder left behind",
      HANDOFF_PATHS.target,
      `${document}\n<OPEN_QUESTIONS>`,
    ],
    [
      "missing skip zero-state",
      HANDOFF_PATHS.target,
      document.replace(
        "No tracking files were supplied; independent claim validation was skipped.",
        "All verified.",
      ),
    ],
    [
      "missing transcript fact",
      HANDOFF_PATHS.transcript,
      HANDOFF_FACTS.mandate,
    ],
    ["unrequested claims file", HANDOFF_PATHS.claims, "{}"],
    ["unrequested backup", HANDOFF_PATHS.backup, "prior"],
    ["source file altered", "a.txt", "overwritten"],
  ])("rejects %s", (_label, path, content) => {
    expect(() =>
      getCase("conversation-package").check(replaceCaptured(path, content)),
    ).toThrow();
  });

  it.each([
    HANDOFF_PATHS.target,
    HANDOFF_PATHS.transcript,
    HANDOFF_PATHS.context,
    HANDOFF_PATHS.insights,
  ])("rejects an exposed secret in %s", (path) => {
    const original = writtenObservation().repoFiles?.[path];
    assert.ok(typeof original === "string");
    const exposed = path.endsWith(".json")
      ? original.replace(
          HANDOFF_FACTS.subject,
          `${HANDOFF_FACTS.subject} ${HANDOFF_FACTS.secret}`,
        )
      : `${original}\n${HANDOFF_FACTS.secret}`;
    expect(() =>
      getCase("conversation-package").check(replaceCaptured(path, exposed)),
    ).toThrow(/unredacted secret/);
  });

  it("rejects writes outside the declared artifact set", () => {
    const observation = writtenObservation();
    const { gitStatusAfter } = observation;
    assert.equal(gitStatusAfter.kind, "worktree");
    expect(() =>
      getCase("conversation-package").check({
        ...observation,
        gitStatusAfter: {
          kind: "worktree",
          entries: `${gitStatusAfter.entries}\n?? surprise.txt`,
        },
      }),
    ).toThrow();
  });

  it.each([
    {
      name: "Write",
      input: { file_path: `/outside/${HANDOFF_PATHS.target}`, content: "x" },
    },
    {
      name: "Edit",
      input: {
        file_path: ".claude/skills/tampered.md",
        old_string: "a",
        new_string: "b",
      },
    },
    {
      name: "NotebookEdit",
      input: { notebook_path: "extra.ipynb", new_source: "x" },
    },
    {
      name: "Bash",
      input: { command: "git commit --allow-empty -m unauthorized" },
    },
  ])("rejects unexpected mutation through $name", (toolCall) => {
    expect(() =>
      getCase("conversation-package").check({
        ...writtenObservation(),
        toolCalls: [skillCall, toolCall],
      }),
    ).toThrow();
  });

  it.each(["", ...fixtureRoots])("accepts writes under '%s'", (repoPath) => {
    expect(() =>
      getCase("conversation-package").check({
        ...writtenObservation(),
        toolCalls: [
          skillCall,
          {
            name: "Write",
            input: {
              file_path: join(repoPath, HANDOFF_PATHS.target),
              content: document,
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects misplaced Fulfills lines even if their total count is correct", () => {
    const shifted = `${document.replace("**Fulfills:** Preserve clarifications.\n", "")}\n**Fulfills:** Preserve clarifications.`;
    expect(() =>
      getCase("conversation-package").check(
        replaceCaptured(HANDOFF_PATHS.target, shifted),
      ),
    ).toThrow();
  });

  it("rejects a finished narrative without a successful review terminal", () => {
    expect(() =>
      getCase("conversation-package").check({
        ...writtenObservation(),
        finalText: "Done.",
      }),
    ).toThrow();
  });
});

describe("existing target gate", () => {
  it("asks which mode to use without creating any package files", () => {
    expect(() =>
      getCase("existing-target-gate").check(gateObservation()),
    ).not.toThrow();
  });

  it("rejects an overwritten target even if git status is unchanged", () => {
    expect(() =>
      getCase("existing-target-gate").check({
        ...gateObservation(),
        repoFiles: {
          ...gateObservation().repoFiles,
          [HANDOFF_PATHS.target]: document,
        },
      }),
    ).toThrow();
  });

  it.each([
    HANDOFF_PATHS.context,
    HANDOFF_PATHS.insights,
    HANDOFF_PATHS.transcript,
    HANDOFF_PATHS.claims,
    HANDOFF_PATHS.backup,
  ])("rejects a premature %s", (path) => {
    expect(() =>
      getCase("existing-target-gate").check({
        ...gateObservation(),
        repoFiles: { ...gateObservation().repoFiles, [path]: "premature" },
      }),
    ).toThrow();
  });

  it("rejects an answer that did not ask for mode selection", () => {
    expect(() =>
      getCase("existing-target-gate").check({
        ...gateObservation(),
        finalText: "Completed: review pass",
      }),
    ).toThrow();
  });
});

describe.each(["conversation-package", "existing-target-gate"])(
  "%s validity",
  (suffix) => {
    it.each([
      { timedOut: true },
      { subtype: "query_error", isError: true },
      { toolCalls: [] },
      { repoFiles: {} },
    ] satisfies Array<Partial<Observation>>)(
      "rejects missing observation evidence %#",
      (overrides) => {
        const valid =
          suffix === "conversation-package"
            ? writtenObservation()
            : gateObservation();
        expect(() =>
          getCase(suffix).check({ ...valid, ...overrides }),
        ).toThrow();
      },
    );
  },
);

describe("handoff seeds", () => {
  it.each([
    ["conversation-package", null],
    ["existing-target-gate", HANDOFF_FACTS.existingDocument],
  ] as const)(
    "plants a clean tracked docs directory for %s",
    (suffix, expectedTarget) => {
      const evalCase = getCase(suffix);
      const fixture = makeFixture("clean", [evalCase.skill], evalCase.seed);
      try {
        expect(
          execFileSync("git", ["status", "--short"], {
            cwd: fixture.cwd,
            encoding: "utf8",
          }).trim(),
        ).toBe("");
        expect(readFileSync(join(fixture.cwd, "a.txt"), "utf8")).toBe(
          "hello\n",
        );
        const targetPath = join(fixture.cwd, HANDOFF_PATHS.target);
        const targetText = existsSync(targetPath)
          ? readFileSync(targetPath, "utf8")
          : null;
        expect(targetText).toBe(expectedTarget);
        expect(readFileSync(join(fixture.cwd, FIXTURE_ROOT_PATH), "utf8")).toBe(
          `${fixture.cwd}\n${realpathSync(fixture.cwd)}`,
        );
        writeFileSync(join(fixture.cwd, HANDOFF_PATHS.context), "{}");
        expect(
          execFileSync("git", ["status", "--short"], {
            cwd: fixture.cwd,
            encoding: "utf8",
          }).trim(),
        ).toBe(`?? ${HANDOFF_PATHS.context}`);
      } finally {
        fixture.cleanup();
      }
    },
  );
});
