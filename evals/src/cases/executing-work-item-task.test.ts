import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { SKILL } from "#/cases/executing-work-item-task.ts";
import {
  DECISIONS_PATH,
  EXECUTION_ARTIFACTS,
  EXECUTION_FACTS,
  seedExecutionArtifacts,
} from "#/cases/executing-work-item-task-fixtures.ts";
import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const REFUSED_COMMAND = 1;
const initialHead = "initial\thead\tcommit (initial): initial commit\n";
function getCase(name: string) {
  return getRegisteredCase(`${SKILL}/${name}`);
}

function finalReport(missingDecisions: boolean): string {
  return `## Final Task Report
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
  const missingDecisions = name === "missing-decisions";
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

describe("executing-work-item-task", () => {
  test("approval-before-kickoff rejects incorrect report boundaries", () => {
    const observation = validObservation("approval-before-kickoff");
    for (const replacement of [
      `${observation.finalText}\n### Status\nSTOPPED_FOR_USER_INPUT`,
      `${observation.finalText}\nFINAL_TASK_REPORT: BLOCKED`,
      observation.finalText.replace("### Evidence Checked", "### Evidence"),
      observation.finalText.replace("- Task: `1`", "- Task: `2`"),
      observation.finalText.replace("acme-app-42", "other-app-9"),
      observation.finalText.replace("Platform: github", "Platform: jira"),
      observation.finalText.replace(
        "Requirements fixes: 0",
        "Requirements fixes: 1",
      ),
      `${observation.finalText}\n## Final Task Report\n`,
    ]) {
      expect(() =>
        getCase("approval-before-kickoff").check({
          ...observation,
          finalText: replacement,
        }),
      ).toThrow();
    }
  });

  test("missing decisions must name the artifact and recovery phase", () => {
    const observation = validObservation("missing-decisions");
    expect(() =>
      getCase("missing-decisions").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, [DECISIONS_PATH]: "invented" },
      }),
    ).toThrow();
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

  test("missing decisions accepts post-critique decision-confirmation recovery", () => {
    const observation = validObservation("missing-decisions");
    expect(() =>
      getCase("missing-decisions").check({
        ...observation,
        finalText: observation.finalText.replace(
          "Run clarifying-assumptions Phase 6 to create the missing decisions artifact.",
          `Re-run the post-critique decision-confirmation step to produce ${DECISIONS_PATH}.`,
        ),
      }),
    ).not.toThrow();
  });

  test("approval request can omit question punctuation and use Markdown", () => {
    const observation = validObservation("approval-before-kickoff");
    expect(() =>
      getCase("approval-before-kickoff").check({
        ...observation,
        finalText: observation.finalText.replace(
          "Work item:",
          "**Work item:**",
        ),
      }),
    ).not.toThrow();
  });

  test("approval-before-kickoff rejects mutations and uncaptured evidence", () => {
    const observation = validObservation("approval-before-kickoff");
    for (const overrides of [
      {
        toolCalls: [
          { name: "Write", input: { file_path: "a.txt", content: "Hello" } },
        ],
      },
      { toolCalls: [{ name: "Agent", input: { prompt: "Start kickoff" } }] },
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
          [DECISIONS_PATH]: null,
        },
      },
    ] satisfies Array<Partial<Observation>>) {
      expect(() =>
        getCase("approval-before-kickoff").check({
          ...observation,
          ...overrides,
        }),
      ).toThrow();
    }
  });

  test("the approval gate rejects altered handoff files", () => {
    const observation = validObservation("approval-before-kickoff");
    expect(() =>
      getCase("approval-before-kickoff").check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [`docs/${EXECUTION_FACTS.key}-tasks.md`]: "changed",
        },
      }),
    ).toThrow();
  });

  test("seed exposes untracked handoffs and a logged, read-only fake gh", () => {
    const fixture = makeFixture("clean", [], seedExecutionArtifacts);
    try {
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
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toContain(`?? ${DECISIONS_PATH}`);
    } finally {
      fixture.cleanup();
    }
  });
});
