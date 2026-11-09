import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  checkDeniedDispatch,
  checkFailedExecution,
} from "#/cases/committing-scoped-changes-checks.ts";
import {
  COMMIT_SCOPE,
  EVIDENCE_PATHS,
  seedCommitScenario,
} from "#/cases/committing-scoped-changes-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const SUCCESS = 0;
const VERIFY_FAILED = 9;
const REJECTED = 71;
const MESSAGE =
  "update client settings and exchange documentation with checksums";
const FINAL =
  "Commit rejected; stopped. sh check.sh format && sh check.sh behavior exited 0: 3 assertions passed on the shared worktree, not an isolated commit tree.";
const SKILL_CALL = {
  name: "Skill",
  input: { skill: "committing-scoped-changes" },
};
function toolObservation(finalText: string) {
  return createObservation({
    finalText,
    toolCalls: [SKILL_CALL],
    turns: [createTurn(), createTurn({ prompt: "approve" })],
  });
}

describe("scoped commit live-runtime fixture regressions", () => {
  test("verification failure appears only at executor dispatch, not during read-only planning", () => {
    const fixture = makeFixture(
      "clean",
      ["committing-scoped-changes"],
      (context) => {
        seedCommitScenario(context, "verify-fail");
      },
    );
    try {
      const flag = join(fixture.cwd, ".git/eval-fail-verification");
      const hook = join(fixture.binPath, "deny-executor.py");
      expect(existsSync(flag)).toBe(false);
      const run = (prompt: string) =>
        execFileSync("python3", ["-I", hook], {
          input: JSON.stringify({ tool_input: { prompt } }),
          encoding: "utf8",
        });
      run("commit-boundary-planner");
      expect(existsSync(flag)).toBe(false);
      expect(
        spawnSync("sh", ["check.sh", "behavior"], { cwd: fixture.cwd }).status,
      ).toBe(SUCCESS);
      run(
        "You are the mutating executor. COMMIT_EXECUTE: PASS. APPROVED_GROUP follows.",
      );
      expect(readFileSync(flag, "utf8")).toBe("failure injected after preview");
      expect(
        spawnSync("sh", ["check.sh", "behavior"], { cwd: fixture.cwd }).status,
      ).toBe(VERIFY_FAILED);
    } finally {
      fixture.cleanup();
    }
  });
  test("commit rejection occurs on a topic branch and branch switches remain failures", () => {
    const fixture = makeFixture(
      "clean",
      ["committing-scoped-changes"],
      (context) => {
        seedCommitScenario(context, "commit-fail");
      },
    );
    try {
      expect(
        execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }).trim(),
      ).toBe("eval/scoped-changes");
      execFileSync("sh", ["check.sh", "format"], { cwd: fixture.cwd });
      execFileSync("sh", ["check.sh", "behavior"], { cwd: fixture.cwd });
      expect(
        spawnSync(
          join(fixture.binPath, "git"),
          ["commit", "--only", "-m", MESSAGE, "--", ...COMMIT_SCOPE],
          { cwd: fixture.cwd },
        ).status,
      ).toBe(REJECTED);
      const observation = {
        ...toolObservation(FINAL),
        repoFiles: snapshotRepoFiles(fixture.cwd, EVIDENCE_PATHS),
      };
      expect(() => checkFailedExecution(observation, "commit")).not.toThrow();
      execFileSync("git", ["switch", "-c", "unapproved"], { cwd: fixture.cwd });
      expect(() =>
        checkFailedExecution(
          {
            ...observation,
            repoFiles: snapshotRepoFiles(fixture.cwd, EVIDENCE_PATHS),
          },
          "commit",
        ),
      ).toThrow(/HEAD changed/);
    } finally {
      fixture.cleanup();
    }
  });
  test("denial checker still requires captured errors and accepts head-tail truncation", () => {
    const files = {
      "client.js":
        "export const timeout = 30;\nexport const redactErrors = true;\nexport const cacheTtl = 60;\n",
      "guide.md": "# Guide\n\nUnique policy paragraph.\n",
      "policy.md": "# Policy\n\nUnique guide paragraph.\n",
    };
    const observation = toolObservation(
      "Group 1 dispatch denied. No commits created.",
    );
    // Reuse the actual seeded file bytes rather than relying on a compliance claim.
    const fixture = makeFixture(
      "clean",
      ["committing-scoped-changes"],
      (context) => {
        seedCommitScenario(context);
      },
    );
    try {
      const repoFiles = {
        ...snapshotRepoFiles(fixture.cwd, EVIDENCE_PATHS),
        ".git/eval-dispatch.log": "executor dispatch denied\n",
      };
      expect(repoFiles).toMatchObject(files);
      const dispatch = {
        name: "Agent",
        input: {
          prompt:
            "You are the mutating executor. COMMIT_EXECUTE: PASS. APPROVED_GROUP follows.",
        },
      };
      expect(() =>
        checkDeniedDispatch({
          ...observation,
          repoFiles,
          toolCalls: [SKILL_CALL, dispatch],
        }),
      ).toThrow(/missing actual denied/);
      expect(() =>
        checkDeniedDispatch({
          ...observation,
          repoFiles,
          toolCalls: [
            SKILL_CALL,
            {
              ...dispatch,
              result: {
                content:
                  "[head] ... truncated ... Fixture host denied executor dispatch",
                isError: true,
                truncated: true,
              },
            },
          ],
        }),
      ).not.toThrow();
    } finally {
      fixture.cleanup();
    }
  });
});
