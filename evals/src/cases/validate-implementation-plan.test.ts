import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/validate-implementation-plan.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const skill = "validate-implementation-plan";
const report = `## Audit Scope
Audit the supplied plan against the user's baseline.
## Source Requirements
R1: Export only the signed-in user's active tasks from local JSON.
R2: No new services.
## Technical Evidence Review
No local technical claims require external proof.
## Findings By Plan Section
Critical: exporting all users' tasks violates R1. Kafka violates R2.
## Requirement Gaps
The plan has neither an ownership filter nor an active-task filter.
## Audit Summary
critical=2, warning=0, info=0.
## Resolved Assumptions
None.
## Open Questions
None.
## Sensitive Content Handling
None.`;
const finalText = `AUDIT: FAIL
Output: implementation-plan.audit.md
Sections covered: 9
Findings: critical=2, warning=0, info=0
Open questions: 0
Reason: The plan violates the data scope and no-new-services requirements.`;
const blockedText =
  "implementation-plan.audit.md already exists. May I overwrite it, or should I use another path?";

function getCase(suffix: string): EvalCase {
  const evalCase = cases.find(
    (candidate) => candidate.id === `${skill}/${suffix}`,
  );
  assert.ok(evalCase !== undefined, `Missing eval case: ${suffix}`);
  return evalCase;
}

function behavioralObservation(suffix: string): Observation {
  const evalCase = getCase(suffix);
  const fixture = makeFixture("clean", [], evalCase.seed);
  try {
    const files = snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths ?? []);
    if (suffix === "audit-planted-defects") {
      files["implementation-plan.audit-input.md"] =
        "# Sanitized plan\nExport every user's tasks and add Kafka.\n";
      files["implementation-plan.audit.md"] = report;
    }
    if (suffix === "audit-planted-defects") {
      return createObservation({
        finalText,
        repoFiles: files,
        gitStatusAfter: {
          kind: "worktree",
          entries:
            "?? implementation-plan.audit-input.md\n?? implementation-plan.audit.md",
        },
      });
    }
    return createObservation({ finalText: blockedText, repoFiles: files });
  } finally {
    fixture.cleanup();
  }
}

describe("validate-implementation-plan routing", () => {
  test("requires an invocation for audit requests", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  test("does not claim a request to draft a new execution plan", () => {
    const evalCase = getCase("trigger-negative-create-plan");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).toThrow();
  });
});

describe("validate-implementation-plan artifacts", () => {
  test("plants the flawed plan in a clean committed fixture", () => {
    const fixture = makeFixture(
      "clean",
      [],
      getCase("audit-planted-defects").seed,
    );
    try {
      expect(
        readFileSync(join(fixture.cwd, "implementation-plan.md"), "utf8"),
      ).toContain("Kafka");
      expect(
        readFileSync(join(fixture.cwd, "implementation-plan.md"), "utf8"),
      ).toContain("every user");
      expect(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("");
    } finally {
      fixture.cleanup();
    }
  });

  test("accepts the standalone report and sanitized snapshot without source changes", () => {
    expect(() =>
      getCase("audit-planted-defects").check(
        behavioralObservation("audit-planted-defects"),
      ),
    ).not.toThrow();
  });

  test.each([
    ["missing snapshot", "implementation-plan.audit-input.md", null],
    ["missing report", "implementation-plan.audit.md", null],
    ["overwritten source", "implementation-plan.md", "rewritten plan"],
    [
      "missing required report section",
      "implementation-plan.audit.md",
      report.replace("## Requirement Gaps", "## Other"),
    ],
    [
      "out-of-order sections",
      "implementation-plan.audit.md",
      report
        .replace("## Audit Scope", "## Open Questions")
        .replace("## Open Questions\nNone.", "## Audit Scope\nNone."),
    ],
  ])("rejects %s", (_label, path, content) => {
    const observation = behavioralObservation("audit-planted-defects");
    expect(() =>
      getCase("audit-planted-defects").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [path]: content },
      }),
    ).toThrow();
  });

  test.each([
    [
      "incorrect passing verdict",
      finalText.replace("AUDIT: FAIL", "AUDIT: PASS"),
    ],
    ["no critical findings", finalText.replace("critical=2", "critical=0")],
    [
      "wrong output path",
      finalText.replace("implementation-plan.audit.md", "other.md"),
    ],
    [
      "wrong section count",
      finalText.replace("Sections covered: 9", "Sections covered: 8"),
    ],
    [
      "unresolved decision question",
      finalText.replace("Open questions: 0", "Open questions: 1"),
    ],
    [
      "missing envelope field",
      finalText.replace(
        "\nReason: The plan violates the data scope and no-new-services requirements.",
        "",
      ),
    ],
  ])("rejects %s", (_label, invalidText) => {
    expect(() =>
      getCase("audit-planted-defects").check({
        ...behavioralObservation("audit-planted-defects"),
        finalText: invalidText,
      }),
    ).toThrow();
  });

  test("rejects unexpected tracked or untracked changes and git mutations", () => {
    const observation = behavioralObservation("audit-planted-defects");
    const evalCase = getCase("audit-planted-defects");
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusAfter: {
          kind: "worktree",
          entries: `${observation.gitStatusAfter.kind === "worktree" ? observation.gitStatusAfter.entries : ""}\n?? surprise.txt`,
        },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        toolCalls: [
          {
            name: "Bash",
            input: { command: "git commit --allow-empty -m surprise" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        toolCalls: [
          { name: "Write", input: { file_path: "surprise.txt", content: "x" } },
        ],
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          ".git/logs/HEAD": `${observation.repoFiles?.[".git/logs/HEAD"] ?? ""}another commit\n`,
        },
      }),
    ).toThrow();
  });

  test("rejects a same-named report written outside the fixture", () => {
    const observation = behavioralObservation("audit-planted-defects");
    expect(() =>
      getCase("audit-planted-defects").check({
        ...observation,
        toolCalls: [
          {
            name: "Write",
            input: {
              file_path: "/outside/implementation-plan.audit.md",
              content: report,
            },
          },
        ],
      }),
    ).toThrow();
  });

  test("leaves existing report and source untouched while requesting approval", () => {
    expect(() =>
      getCase("existing-report-gate").check(
        behavioralObservation("existing-report-gate"),
      ),
    ).not.toThrow();
  });

  test.each([
    ["no permission question", "The report exists."],
    ["a premature success", `AUDIT: PASS\n${blockedText}`],
  ])("rejects %s at the collision gate", (_label, invalidText) => {
    expect(() =>
      getCase("existing-report-gate").check({
        ...behavioralObservation("existing-report-gate"),
        finalText: invalidText,
      }),
    ).toThrow();
  });

  test("rejects overwriting the existing report or creating a snapshot before approval", () => {
    const observation = behavioralObservation("existing-report-gate");
    const evalCase = getCase("existing-report-gate");
    expect(() =>
      evalCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          "implementation-plan.audit.md": report,
        },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          "implementation-plan.audit-input.md": "snapshot",
        },
      }),
    ).toThrow();
  });

  test.each(["audit-planted-defects", "existing-report-gate"])(
    "%s rejects timed-out runs",
    (suffix) => {
      expect(() =>
        getCase(suffix).check({
          ...behavioralObservation(suffix),
          timedOut: true,
        }),
      ).toThrow();
    },
  );
});

describe("audit mutation boundaries", () => {
  test("accepts the two authorized file writes, including an absolute fixture path", () => {
    const observation = behavioralObservation("audit-planted-defects");
    const [root] =
      observation.repoFiles?.[".git/eval-plan-root"]?.split("\n") ?? [];
    assert.ok(root !== undefined);
    expect(() =>
      getCase("audit-planted-defects").check({
        ...observation,
        toolCalls: [
          {
            name: "Write",
            input: {
              file_path: join(root, "implementation-plan.audit.md"),
              content: report,
            },
          },
          {
            name: "Write",
            input: {
              file_path: "./implementation-plan.audit-input.md",
              content: "snapshot",
            },
          },
          { name: "Bash", input: { command: "git status --short" } },
        ],
      }),
    ).not.toThrow();
  });

  test("accepts canonical absolute writes to both audit artifacts", () => {
    const evalCase = getCase("audit-planted-defects");
    const fixture = makeFixture("clean", [], (context) => {
      const repoPath = join(context.binPath, "repo-link");
      symlinkSync(context.repoPath, repoPath, "dir");
      evalCase.seed?.({ ...context, repoPath });
    });
    try {
      const root = realpathSync(fixture.cwd);
      const files = snapshotRepoFiles(
        fixture.cwd,
        evalCase.snapshotPaths ?? [],
      );
      files["implementation-plan.audit-input.md"] = "snapshot";
      files["implementation-plan.audit.md"] = report;
      const observation = createObservation({
        finalText,
        repoFiles: files,
        gitStatusAfter: {
          kind: "worktree",
          entries:
            "?? implementation-plan.audit-input.md\n?? implementation-plan.audit.md",
        },
        toolCalls: [
          "implementation-plan.audit-input.md",
          "implementation-plan.audit.md",
        ].map((path) => ({
          name: "Write",
          input: { file_path: join(root, path) },
        })),
      });
      expect(() => evalCase.check(observation)).not.toThrow();
    } finally {
      fixture.cleanup();
    }
  });

  test.each([
    ["empty sanitized snapshot", "implementation-plan.audit-input.md", "  \n"],
    ["uncaptured source", "implementation-plan.md", null],
    ["missing HEAD evidence", ".git/logs/HEAD", null],
    ["missing cwd evidence", ".git/eval-plan-root", null],
    [
      "repeated report section",
      "implementation-plan.audit.md",
      `${report}\n## Audit Summary\nNone.`,
    ],
  ])("rejects %s", (_label, path, content) => {
    const observation = behavioralObservation("audit-planted-defects");
    expect(() =>
      getCase("audit-planted-defects").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [path]: content },
      }),
    ).toThrow();
  });

  test.each([
    { name: "NotebookEdit", input: { notebook_path: "analysis.ipynb" } },
    {
      name: "Write",
      input: { file_path: "../implementation-plan.audit.md", content: report },
    },
    {
      name: "Edit",
      input: {
        file_path: "implementation-plan.md",
        old_string: "old",
        new_string: "new",
      },
    },
  ])("rejects unauthorized $name", (call) => {
    const observation = behavioralObservation("audit-planted-defects");
    expect(() =>
      getCase("audit-planted-defects").check({
        ...observation,
        toolCalls: [call],
      }),
    ).toThrow();
  });

  test("requires a readable clean baseline and a readable final git sample", () => {
    const observation = behavioralObservation("audit-planted-defects");
    const evalCase = getCase("audit-planted-defects");
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusBefore: { kind: "worktree", entries: "?? unrelated.txt" },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusBefore: { kind: "unreadable", reason: "failed" },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusAfter: { kind: "unreadable", reason: "failed" },
      }),
    ).toThrow();
  });

  test("a gate still rejects source edits, file writes, and git deltas", () => {
    const observation = behavioralObservation("existing-report-gate");
    const evalCase = getCase("existing-report-gate");
    expect(() =>
      evalCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          "implementation-plan.md": "changed",
        },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        toolCalls: [
          { name: "Write", input: { file_path: "other.txt", content: "x" } },
        ],
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusAfter: { kind: "worktree", entries: "?? other.txt" },
      }),
    ).toThrow();
  });
});
