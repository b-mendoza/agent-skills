import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { PLAN_FACTS } from "#/cases/validate-implementation-plan.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const skill = "validate-implementation-plan";
const snapshot = `## Source Metadata
- Source path: implementation-plan.md
- Artifact action: create
- Redactions applied: no
- Sensitive categories: none
## Section Inventory
1. Data selection
2. Implementation
3. Delivery
4. Verification
## Sanitized Section Summaries
### Data selection
- Read the existing local JSON file.
- Select every task for every user, including archived tasks.
### Implementation
- Introduce a Kafka cluster.
- Generate the CSV asynchronously with a worker service.
### Delivery
- Return the generated CSV as a download.
- Deliver it to the signed-in user.
### Verification
- Check that the CSV includes every row from the JSON file.
- Compare the export against the source rows.
## Technical Claims
- plan_section: Implementation claim: Kafka and a worker service generate the CSV asynchronously. confidence: explicit
## Sensitive Content Handling
- No sensitive literals detected.
`;
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
const finalText =
  "The plan violates the data scope and no-new-services requirements. I wrote implementation-plan.audit.md covering 9 sections, with 2 critical findings, 0 warnings, 0 informational findings, and 0 open questions. The source plan is unchanged.";
const blockedText =
  "implementation-plan.audit.md already exists. May I overwrite it, or should I use another path?";

function getCase(suffix: string) {
  return getRegisteredCase(`${skill}/${suffix}`);
}

function behavioralObservation(suffix: string): Observation {
  const files: Record<string, string | null> = {
    [PLAN_FACTS.path]: PLAN_FACTS.source,
    [PLAN_FACTS.snapshotPath]: null,
    [PLAN_FACTS.reportPath]: PLAN_FACTS.existingReport,
    ".git/logs/HEAD": `seed\tcommit (initial): initial commit\nseed\tcommit: ${PLAN_FACTS.seedCommit}\n`,
    ".git/eval-plan-root": "/fixture\n/canonical/fixture",
  };
  if (suffix === "audit-planted-defects") {
    files[PLAN_FACTS.snapshotPath] = snapshot;
    files[PLAN_FACTS.reportPath] = report;
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
}

function checkAudit(overrides: Partial<Observation> = {}): string {
  const observation = behavioralObservation("audit-planted-defects");
  return getCase("audit-planted-defects").check({
    ...observation,
    ...overrides,
    repoFiles: { ...observation.repoFiles, ...overrides.repoFiles },
  });
}

describe("validate-implementation-plan artifacts", () => {
  test("accepts the standalone report and sanitized snapshot without source changes", () => {
    expect(() => checkAudit()).not.toThrow();
  });

  test.each([
    ...[
      "JSON",
      "every user",
      "archived",
      "Kafka",
      "worker service",
      "## Source Metadata",
    ].map((required) => [
      `missing ${required}`,
      snapshot.replaceAll(required, "omitted"),
    ]),
  ])("rejects a snapshot with %s", (_label, invalidSnapshot) => {
    expect(() =>
      checkAudit({
        repoFiles: { "implementation-plan.audit-input.md": invalidSnapshot },
      }),
    ).toThrow();
  });

  test.each([
    ["uncaptured source", "implementation-plan.md", null],
    ["missing HEAD evidence", ".git/logs/HEAD", null],
    ["missing cwd evidence", ".git/eval-plan-root", null],
    [
      "repeated report section",
      "implementation-plan.audit.md",
      `${report}\n## Audit Summary\nNone.`,
    ],
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
    expect(() => checkAudit({ repoFiles: { [path]: content } })).toThrow();
  });

  test.each([
    ["old public status line", `AUDIT: FAIL\n${finalText}`],
    ["no critical findings", finalText.replace("2 critical", "0 critical")],
    [
      "wrong output path",
      finalText.replace("implementation-plan.audit.md", "other.md"),
    ],
    ["wrong section count", finalText.replace("9 sections", "8 sections")],
    [
      "unresolved decision question",
      finalText.replace("0 open questions", "1 open question"),
    ],
  ])("rejects %s", (_label, invalidText) => {
    expect(() => checkAudit({ finalText: invalidText })).toThrow();
  });

  test.each([
    `${finalText}\n\n- Critical: exporting all users' tasks exposes other users' data. Restore ownership and active-task filters.\n- Critical: Kafka and a worker service violate the no-new-services constraint. Generate CSV locally instead.`,
  ])("leaves handoff compactness to the judge %#", (text) => {
    expect(() => checkAudit({ finalText: text })).not.toThrow();
  });

  test("rejects unexpected tracked or untracked changes and git mutations", () => {
    const observation = behavioralObservation("audit-planted-defects");
    for (const overrides of [
      {
        gitStatusAfter: {
          kind: "worktree",
          entries:
            "?? implementation-plan.audit-input.md\n?? implementation-plan.audit.md\n?? surprise.txt",
        },
      },
      {
        toolCalls: [
          {
            name: "Bash",
            input: { command: "git commit --allow-empty -m surprise" },
          },
        ],
      },
      {
        toolCalls: [
          { name: "Write", input: { file_path: "surprise.txt", content: "x" } },
        ],
      },
      {
        repoFiles: {
          ".git/logs/HEAD": `${observation.repoFiles?.[".git/logs/HEAD"] ?? ""}another commit\n`,
        },
      },
    ] satisfies Array<Partial<Observation>>) {
      expect(() => checkAudit(overrides)).toThrow();
    }
  });

  test("rejects a same-named report written outside the fixture", () => {
    expect(() =>
      checkAudit({
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

  test.each([
    ["missing colliding path", "The report exists. May I overwrite it?"],
    ["a premature success", `AUDIT: PASS\n${blockedText}`],
  ])("rejects %s at the collision gate", (_label, invalidText) => {
    expect(() =>
      getCase("existing-report-gate").check({
        ...behavioralObservation("existing-report-gate"),
        finalText: invalidText,
      }),
    ).toThrow();
  });

  test("accepts the collision handoff without authorizing writes", () => {
    expect(() =>
      getCase("existing-report-gate").check(
        behavioralObservation("existing-report-gate"),
      ),
    ).not.toThrow();
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
              content: snapshot,
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
      expect(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("");
      const root = realpathSync(fixture.cwd);
      const files = snapshotRepoFiles(
        fixture.cwd,
        evalCase.snapshotPaths ?? [],
      );
      files["implementation-plan.audit-input.md"] = snapshot;
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
    expect(() => checkAudit({ toolCalls: [call] })).toThrow();
  });

  test.each([
    { gitStatusBefore: { kind: "worktree", entries: "?? unrelated.txt" } },
    { gitStatusBefore: { kind: "unreadable", reason: "failed" } },
    { gitStatusAfter: { kind: "unreadable", reason: "failed" } },
  ] as const)("rejects unreadable or dirty git evidence: %j", (overrides) => {
    expect(() => checkAudit(overrides)).toThrow();
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
