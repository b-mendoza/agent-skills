import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { cases, SKILL } from "#/cases/executing-work-item-task.ts";
import {
  DECISIONS_PATH,
  EXECUTION_ARTIFACTS,
  EXECUTION_FACTS,
  seedExecutionArtifacts,
} from "#/cases/executing-work-item-task-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const REFUSED_COMMAND = 1;
const initialHead = "initial\thead\tcommit (initial): initial commit\n";
function getCase(name: string) {
  const testCase = cases.find((entry) => entry.id === `${SKILL}/${name}`);
  assert.ok(testCase !== undefined);
  return testCase;
}

function finalReport(missingDecisions: boolean): string {
  return `## Final Task Report
### Status
${missingDecisions ? "BLOCKED" : "STOPPED_FOR_USER_INPUT"}
### Task
- Work item: \`${EXECUTION_FACTS.key}\`
- Platform: github
- Task: \`1\` - ${EXECUTION_FACTS.title}
### Summary
Stopped before kickoff.
### Evidence Checked
- Kickoff: Not attempted
- Execution: Not attempted
- Documentation/tracking: Not attempted
- Requirements verification: Not attempted
- Clean code review: Not attempted
- Architecture review: Not attempted
- Security audit: Not attempted
- Final tracker completion: Not attempted
### Retry Counts
- Requirements fixes: 0
- Clean-code fixes: 0
- Architecture fixes: 0
- Security fixes: 0
### Implementation Artifacts
None
### Category A Tracking
None
### Tracker Updates
None
### Blockers or Unresolved Items
${missingDecisions ? `${DECISIONS_PATH} is missing.` : "Explicit execution approval is pending."}
### Next Required Action
${missingDecisions ? "Run clarifying-assumptions Phase 6 to create the missing decisions artifact." : "Please confirm approval for real execution."}
`;
}

function validObservation(name: string): Observation {
  if (name === "trigger-positive") {
    return createObservation({
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
    });
  }
  if (name === "trigger-negative-planning") return createObservation();
  return behavioralObservation(name === "missing-decisions");
}

function behavioralObservation(missingDecisions: boolean): Observation {
  return createObservation({
    finalText: finalReport(missingDecisions),
    repoFiles: {
      ...EXECUTION_ARTIFACTS,
      ...(missingDecisions ? { [DECISIONS_PATH]: null } : {}),
      [EXECUTION_FACTS.sourcePath]: EXECUTION_FACTS.sourceContent,
      [EXECUTION_FACTS.logPath]: "",
      [EXECUTION_FACTS.headPath]: initialHead,
    },
  });
}

const caseNames = [
  "trigger-positive",
  "trigger-negative-planning",
  "approval-before-kickoff",
  "missing-decisions",
];

describe("executing-work-item-task", () => {
  test.each(caseNames)(
    "%s accepts a correct observation and rejects invalid runs",
    (name) => {
      const testCase = getCase(name);
      const observation = validObservation(name);
      expect(testCase.check(observation)).toBeTypeOf("string");
      expect(() =>
        testCase.check({ ...observation, timedOut: true }),
      ).toThrow();
      expect(() =>
        testCase.check({ ...observation, subtype: "query_error" }),
      ).toThrow();
    },
  );

  test("routing rejects absent positive and present negative invocations", () => {
    expect(() =>
      getCase("trigger-positive").check(createObservation()),
    ).toThrow(/never triggered/);
    expect(() =>
      getCase("trigger-negative-planning").check(
        validObservation("trigger-positive"),
      ),
    ).toThrow(/unexpectedly triggered/);
  });

  test.each(["approval-before-kickoff", "missing-decisions"])(
    "%s rejects incorrect report boundaries",
    (name) => {
      const observation = validObservation(name);
      for (const replacement of [
        observation.finalText.replace(
          /^### Status\n[^\n]+/m,
          "### Status\nCOMPLETE",
        ),
        observation.finalText.replace("### Evidence Checked", "### Evidence"),
        observation.finalText.replace("- Task: `1`", "- Task: `2`"),
        observation.finalText.replace("acme-app-42", "other-app-9"),
        observation.finalText.replace("Platform: github", "Platform: jira"),
        observation.finalText.replace(
          "Requirements fixes: 0",
          "Requirements fixes: 1",
        ),
        observation.finalText.replace(
          "Clean-code fixes: 0",
          "Clean-code fixes: 1",
        ),
        observation.finalText.replace(
          "Architecture fixes: 0",
          "Architecture fixes: 1",
        ),
        observation.finalText.replace("Security fixes: 0", "Security fixes: 1"),
        `${observation.finalText}\n## Final Task Report\n`,
      ]) {
        expect(() =>
          getCase(name).check({ ...observation, finalText: replacement }),
        ).toThrow();
      }
    },
  );

  test("missing decisions must name the artifact and recovery phase", () => {
    const observation = validObservation("missing-decisions");
    for (const finalText of [
      observation.finalText.replaceAll(DECISIONS_PATH, "a file"),
      observation.finalText.replace(
        "clarifying-assumptions Phase 6",
        "somewhere",
      ),
    ]) {
      expect(() =>
        getCase("missing-decisions").check({ ...observation, finalText }),
      ).toThrow();
    }
  });

  test.each(["approval-before-kickoff", "missing-decisions"])(
    "%s rejects mutations and uncaptured evidence",
    (name) => {
      const observation = validObservation(name);
      for (const overrides of [
        { gitStatusAfter: { kind: "worktree", entries: " M a.txt" } },
        {
          toolCalls: [
            { name: "Write", input: { file_path: "a.txt", content: "Hello" } },
          ],
        },
        {
          toolCalls: [
            { name: "Bash", input: { command: "git switch new-task" } },
          ],
        },
        { repoFiles: undefined },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.sourcePath]: "Hello\n",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.headPath]: `${initialHead}extra commit\n`,
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [EXECUTION_FACTS.logPath]: "issue close 101\n",
          },
        },
        {
          repoFiles: {
            ...observation.repoFiles,
            [DECISIONS_PATH]: name === "missing-decisions" ? "invented" : null,
          },
        },
      ] satisfies Array<Partial<Observation>>) {
        expect(() =>
          getCase(name).check({ ...observation, ...overrides }),
        ).toThrow();
      }
    },
  );

  test("the approval gate rejects altered handoff files", () => {
    const observation = validObservation("approval-before-kickoff");
    for (const path of Object.keys(EXECUTION_ARTIFACTS)) {
      expect(() =>
        getCase("approval-before-kickoff").check({
          ...observation,
          repoFiles: { ...observation.repoFiles, [path]: "changed" },
        }),
      ).toThrow();
    }
  });

  test("seeds all handoffs and a logged, read-only fake gh", () => {
    const fixture = makeFixture("clean", [], seedExecutionArtifacts);
    try {
      for (const [path, content] of Object.entries(EXECUTION_ARTIFACTS)) {
        expect(readFileSync(join(fixture.cwd, path), "utf8")).toBe(content);
      }
      const gh = join(fixture.binPath, "gh");
      expect(execFileSync(gh, ["--version"], { encoding: "utf8" })).toContain(
        "fixture",
      );
      expect(
        execFileSync(gh, ["auth", "status"], { encoding: "utf8" }),
      ).toContain("Logged in");
      expect(
        execFileSync(
          gh,
          [
            "issue",
            "view",
            "42",
            "--repo",
            "acme/app",
            "--json",
            "title,state",
          ],
          { encoding: "utf8" },
        ),
      ).toContain(EXECUTION_FACTS.title);
      expect(
        spawnSync(gh, ["issue", "close", "101"], { encoding: "utf8" }).status,
      ).toBe(REFUSED_COMMAND);
      expect(
        spawnSync(gh, ["api", "-X", "POST", "repos/acme/app/issues"], {
          encoding: "utf8",
        }).status,
      ).toBe(REFUSED_COMMAND);
      expect(
        readFileSync(join(fixture.cwd, EXECUTION_FACTS.logPath), "utf8"),
      ).toContain("issue close 101\n");
      expect(
        execFileSync("git", ["config", "status.showUntrackedFiles"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }).trim(),
      ).toBe("all");
    } finally {
      fixture.cleanup();
    }
  });

  test("missing-decisions seed removes only the missing handoff", () => {
    const testCase = getCase("missing-decisions");
    assert.ok("seed" in testCase);
    const fixture = makeFixture("clean", [], testCase.seed);
    try {
      expect(() => readFileSync(join(fixture.cwd, DECISIONS_PATH))).toThrow();
      expect(readFileSync(join(fixture.cwd, "a.txt"), "utf8")).toBe(
        EXECUTION_FACTS.sourceContent,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
