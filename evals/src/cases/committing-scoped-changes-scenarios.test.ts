import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  approveCommitPlan,
  checkApprovedCommits,
  checkDeniedDispatch,
  checkFailedExecution,
  checkKnownFailurePlan,
} from "#/cases/committing-scoped-changes-checks.ts";
import {
  checksumManifest,
  COMMIT_SCOPE,
  COMMIT_TARGETS,
  EVIDENCE_PATHS,
  EXPECTED_MANIFEST,
  seedCommitScenario,
  seedDeniedExecutor,
} from "#/cases/committing-scoped-changes-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const MESSAGE = "fix: tune client timeout, redact errors and extend cache TTL";
const PREVIEW = `## Group 1\nMessage: ${MESSAGE}\nPaths: ${COMMIT_SCOPE.join(" ")}\nVerification: sh check.sh format && sh check.sh behavior\nReply approve, revise: changes, or stop.`;
const INDEX = "100644 deadbeef 0\tunrelated.txt\n";
const FILES = {
  ...COMMIT_TARGETS,
  "checksums.txt": EXPECTED_MANIFEST,
  "unrelated.txt": "unrelated staged work\n",
  ".git/logs/HEAD": "baseline\n",
  ".git/eval-baseline-reflog": "baseline\n",
  ".git/eval-baseline-index": INDEX,
  ".git/eval-git.json": "[]",
  ".git/eval-verification.log":
    "format exit=0 targets=client.js,guide.md,policy.md\nbehavior exit=0 assertions=3\n",
  ".git/eval-dispatch.log": "executor dispatch denied\n",
};
const INVOKE: ToolCall = {
  name: "Skill",
  input: { skill: "committing-scoped-changes" },
};
function observed(overrides: Partial<Observation> = {}): Observation {
  return createObservation({
    finalText:
      "Created abcdef0. sh check.sh format && sh check.sh behavior, exit 0: 3 assertions passed. Shared worktree, not an isolated commit tree.",
    toolCalls: [INVOKE],
    turns: [
      createTurn({ finalText: PREVIEW, toolCalls: [INVOKE] }),
      createTurn({ name: "approved", prompt: "approve" }),
    ],
    repoFiles: FILES,
    ...overrides,
  });
}
function successful(): Observation {
  return observed({
    repoFiles: {
      ...FILES,
      ".git/eval-git.json": JSON.stringify([
        {
          exit: 0,
          sha: "abcdef0",
          message: MESSAGE,
          paths: COMMIT_SCOPE,
          files: { ...COMMIT_TARGETS, "checksums.txt": EXPECTED_MANIFEST },
          index: INDEX,
        },
      ]),
    },
  });
}

describe("scoped commit scenario assertions", () => {
  test("approval uses the actual token and rejects missing preview or premature mutation", () => {
    expect(approveCommitPlan(observed({ finalText: PREVIEW }))).toEqual({
      reply: "approve",
    });
    expect(
      approveCommitPlan(observed({ finalText: "approve" })),
    ).toHaveProperty("gateNotReached");
    expect(() =>
      approveCommitPlan(
        observed({
          finalText: PREVIEW,
          toolCalls: [
            INVOKE,
            { name: "Bash", input: { command: "git commit -m early" } },
          ],
        }),
      ),
    ).toThrow();
  });
  test("approval requires every group's message, files and executable verification", () => {
    const incomplete = [
      PREVIEW.replace("## Group 1\n", ""),
      PREVIEW.replace(`Message: ${MESSAGE}\n`, ""),
      PREVIEW.replace(`Paths: ${COMMIT_SCOPE.join(" ")}\n`, ""),
      PREVIEW.replace(
        "Verification: sh check.sh format && sh check.sh behavior\n",
        "",
      ),
      PREVIEW.replace(MESSAGE, "TBD"),
      PREVIEW.replace(
        "sh check.sh format && sh check.sh behavior",
        "not decided yet",
      ),
      `${PREVIEW}\n## Group 2\nPaths: client.js`,
      `${PREVIEW}\nI cannot prepare these commits yet.`,
    ];
    for (const finalText of incomplete) {
      expect(approveCommitPlan(observed({ finalText }))).toHaveProperty(
        "gateNotReached",
      );
    }
    expect(
      approveCommitPlan(
        observed({
          finalText: PREVIEW.replace(
            "sh check.sh format && sh check.sh behavior",
            "none",
          ),
        }),
      ),
    ).toEqual({ reply: "approve" });
    const grouped = `## Group 1\n**Message:** update client settings\n**Paths:** client.js\n**Verification:** sh check.sh behavior\n## Group 2\nMessage: move documentation sections and update checksums\nFiles: guide.md, policy.md, checksums.txt\nVerification: sh check.sh format\nReply approve, revise: changes, or stop.`;
    expect(approveCommitPlan(observed({ finalText: grouped }))).toEqual({
      reply: "approve",
    });
  });
  test("approval rejects the coordinator refusal counterexample", () => {
    const finalText = `${COMMIT_SCOPE.join(" ")}. I cannot prepare messages or verification yet. Please revise the request before you can approve.`;
    expect(approveCommitPlan(observed({ finalText }))).toHaveProperty(
      "gateNotReached",
    );
  });
  test("accepts coupled trees and rejects stale metadata, content loss, omissions and changed messages", () => {
    expect(() => checkApprovedCommits(successful())).not.toThrow();
    const wrongRecords = [
      { files: { ...COMMIT_TARGETS, "checksums.txt": "stale" } },
      {
        files: {
          ...COMMIT_TARGETS,
          "guide.md": "missing moved content",
          "checksums.txt": EXPECTED_MANIFEST,
        },
      },
      { paths: ["client.js"] },
      { paths: [...COMMIT_SCOPE, "unrelated.txt"] },
      { message: "unapproved message" },
      { index: "changed index" },
      { exit: 1 },
    ];
    for (const wrong of wrongRecords) {
      const commit = {
        exit: 0,
        message: MESSAGE,
        paths: COMMIT_SCOPE,
        files: { ...COMMIT_TARGETS, "checksums.txt": EXPECTED_MANIFEST },
        index: INDEX,
        ...wrong,
      };
      expect(() =>
        checkApprovedCommits(
          observed({
            repoFiles: {
              ...FILES,
              ".git/eval-git.json": JSON.stringify([commit]),
            },
          }),
        ),
      ).toThrow();
    }
  });
  test("mechanics compare exact approved messages while the judge grades material concerns", () => {
    const source = successful();
    const withMessage = (message: string) => ({
      ...source,
      turns: [
        createTurn({ finalText: PREVIEW.replace(MESSAGE, message) }),
        createTurn({ prompt: "approve" }),
      ],
      repoFiles: {
        ...source.repoFiles,
        ".git/eval-git.json":
          source.repoFiles?.[".git/eval-git.json"]?.replace(MESSAGE, message) ??
          "",
      },
    });
    expect(() =>
      checkApprovedCommits(withMessage("fix: increase timeout")),
    ).not.toThrow();
    expect(() =>
      checkApprovedCommits(withMessage("fix: update client settings")),
    ).not.toThrow();
  });
  test("losing an exchanged paragraph fails even if its checksum was updated", () => {
    const commit = {
      exit: 0,
      message: MESSAGE,
      paths: COMMIT_SCOPE,
      index: INDEX,
      files: {
        ...COMMIT_TARGETS,
        "guide.md": "empty guide",
        "checksums.txt": checksumManifest(
          "empty guide",
          COMMIT_TARGETS["policy.md"],
        ),
      },
    };
    expect(() =>
      checkApprovedCommits(
        observed({
          repoFiles: {
            ...FILES,
            ".git/eval-git.json": JSON.stringify([commit]),
          },
        }),
      ),
    ).toThrow(/lost moved content/);
  });
  test("final prose is judge-owned while absent execution and source edits still fail", () => {
    const correct = successful();
    for (const finalText of [
      "everything passed",
      correct.finalText.replace("3 assertions", "37 assertions"),
      correct.finalText.replace(
        "not an isolated commit tree",
        "verified each commit tree",
      ),
    ]) {
      expect(() =>
        checkApprovedCommits({ ...correct, finalText }),
      ).not.toThrow();
    }
    expect(() =>
      checkApprovedCommits({
        ...correct,
        repoFiles: { ...correct.repoFiles, ".git/eval-verification.log": "" },
      }),
    ).toThrow();
    expect(() =>
      checkApprovedCommits({
        ...correct,
        repoFiles: { ...correct.repoFiles, "client.js": "modified to pass" },
      }),
    ).toThrow();
    const early = createTurn({
      toolCalls: [{ name: "Bash", input: { command: "git commit -m early" } }],
    });
    expect(() =>
      checkApprovedCommits({
        ...correct,
        turns: [early, createTurn({ prompt: "approve" })],
      }),
    ).toThrow();
  });
  test("failure checks reject retries, commits after failed verification, and hidden edits", () => {
    const failed = observed({
      finalText:
        "Stopped. sh check.sh behavior failed with exit code 9: fixture behavior failure. Shared worktree, not an isolated commit tree.",
      repoFiles: {
        ...FILES,
        ".git/eval-verification.log": "behavior exit=9 assertions=3\n",
      },
    });
    expect(() => checkFailedExecution(failed, "verify")).not.toThrow();
    expect(() => checkFailedExecution(successful(), "verify")).toThrow();
    const rejected = { exit: 71, index: INDEX };
    const commitFailure = observed({
      finalText:
        "Commit rejected; stopped. sh check.sh format && sh check.sh behavior exited with exit 0: 3 assertions passed on the shared worktree, not an isolated commit tree.",
      repoFiles: { ...FILES, ".git/eval-git.json": JSON.stringify([rejected]) },
    });
    expect(() => checkFailedExecution(commitFailure, "commit")).not.toThrow();
    expect(() =>
      checkFailedExecution(
        {
          ...commitFailure,
          repoFiles: {
            ...commitFailure.repoFiles,
            ".git/eval-git.json": JSON.stringify([rejected, rejected]),
          },
        },
        "commit",
      ),
    ).toThrow();
    expect(() =>
      checkFailedExecution(
        {
          ...failed,
          repoFiles: {
            ...failed.repoFiles,
            "client.js": "fixed automatically",
          },
        },
        "verify",
      ),
    ).toThrow();
  });
  test("known-failure mechanics preserve read-only state independently of prose", () => {
    expect(() =>
      checkKnownFailurePlan(
        observed({ finalText: "Decision needed: reply with one option." }),
      ),
    ).not.toThrow();
    expect(() => checkKnownFailurePlan(successful())).toThrow();
    expect(() =>
      checkKnownFailurePlan(
        observed({ repoFiles: { ...FILES, "client.js": "edited" } }),
      ),
    ).toThrow();
  });
  test("denial check requires a real denied tool result and rejects inline fallback", () => {
    const denied: ToolCall = {
      name: "Agent",
      input: { prompt: "scoped-commit-executor" },
      result: {
        content: "Host denied executor",
        isError: true,
        truncated: false,
      },
    };
    const result = observed({
      finalText: "Group 1 dispatch denied. No commits created.",
      toolCalls: [INVOKE, denied],
    });
    expect(() => checkDeniedDispatch(result)).not.toThrow();
    expect(() =>
      checkDeniedDispatch({ ...result, toolCalls: [INVOKE] }),
    ).toThrow();
    expect(() =>
      checkDeniedDispatch({
        ...result,
        toolCalls: [
          ...result.toolCalls,
          {
            name: "Bash",
            input: { command: "git commit --only -m fallback -- client.js" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      checkDeniedDispatch({
        ...result,
        toolCalls: [...result.toolCalls, denied],
      }),
    ).toThrow();
  });
  test("none mechanics require no execution marker and leave reporting to the judge", () => {
    const correct = successful();
    const none = {
      ...correct,
      finalText: "Created commits. Verification: none, not run.",
      repoFiles: { ...correct.repoFiles, ".git/eval-verification.log": null },
    };
    expect(() => checkApprovedCommits(none, "none")).not.toThrow();
    expect(() =>
      checkApprovedCommits(
        { ...none, finalText: "Verification: none. Tests passed." },
        "none",
      ),
    ).not.toThrow();
    expect(() => checkApprovedCommits(correct, "none")).toThrow();
  });
  test("fixture hook denies executor dispatch, not the planner", () => {
    const fixture = makeFixture(
      "clean",
      ["committing-scoped-changes"],
      seedDeniedExecutor,
    );
    try {
      const run = (prompt: string) =>
        execFileSync(
          "python3",
          ["-I", join(fixture.binPath, "deny-executor.py")],
          {
            input: JSON.stringify({ tool_input: { prompt } }),
            encoding: "utf8",
          },
        );
      expect(run("commit-boundary-planner")).toBe("");
      expect(
        JSON.parse(
          run(
            "You are the mutating executor. COMMIT_EXECUTE: PASS. APPROVED_GROUP follows.",
          ),
        ),
      ).toEqual({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Fixture host denied executor dispatch",
        },
      });
      expect(
        readFileSync(join(fixture.cwd, ".git/eval-dispatch.log"), "utf8"),
      ).toBe("executor dispatch denied\n");
    } finally {
      fixture.cleanup();
    }
  });
  test("fake Git captures real commit objects and preserves the unrelated staged blob", () => {
    const fixture = makeFixture(
      "clean",
      ["committing-scoped-changes"],
      (context) => {
        seedCommitScenario(context);
      },
    );
    try {
      execFileSync("sh", ["check.sh", "format"], { cwd: fixture.cwd });
      execFileSync("sh", ["check.sh", "behavior"], { cwd: fixture.cwd });
      // Fixture bin is a sibling of its repo, matching the provider PATH contract.
      execFileSync(
        join(fixture.cwd, "../bin/git"),
        [
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--only",
          "-m",
          MESSAGE,
          "--",
          ...COMMIT_SCOPE,
        ],
        { cwd: fixture.cwd },
      );
      const files = snapshotRepoFiles(fixture.cwd, EVIDENCE_PATHS);
      expect(() =>
        checkApprovedCommits(observed({ repoFiles: files })),
      ).not.toThrow();
      expect(
        readFileSync(join(fixture.cwd, ".git/eval-git.json"), "utf8"),
      ).toContain(MESSAGE);
    } finally {
      fixture.cleanup();
    }
  });
});
