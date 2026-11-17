// Pins the skill's deterministic validator, which is the normative shape
// definition shared by the subagents (pre-return), the orchestrator (gates),
// and the eval checks. These run the real script offline and token-free.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  FULL_REPORT_SNAPSHOT,
  QUIET_STATE_SNAPSHOT,
} from "#/cases/case-test-support.ts";

const PROJECT_PATH = fileURLToPath(new URL("../../", import.meta.url));
const VALIDATOR_PATH = fileURLToPath(
  new URL(
    "../../../skills/analyzing-recent-project-state/scripts/validate-output.sh",
    import.meta.url,
  ),
);
const SUCCESS_EXIT_STATUS = 0;
const FAILURE_EXIT_STATUS = 1;
const USAGE_EXIT_STATUS = 2;

const GOOD_DRAFT = `SNAPSHOT_WRITE: PASS

${QUIET_STATE_SNAPSHOT}

The project has a manifest [confirmed: path package.json].`;

const GOOD_VERDICT =
  "SNAPSHOT_VERIFY: PASS\nRequired fixes: none\nReason: all checks passed\nDecision needed: none";

const GOOD_NON_PASS_EVIDENCE =
  "GIT_EVIDENCE: ERROR\nReason: Could not determine the repository state.";

const FULL_EVIDENCE = [
  "GIT_EVIDENCE: PASS",
  "Project path: /repo/app",
  "Branch/upstream: main -> origin/main",
  "Repo state: normal",
  "Evidence window: working tree + origin/main-to-HEAD; 0 commits",
  "Working tree: clean",
  "Base branch: origin/main",
  "Base comparison: no ahead/behind delta",
  "Recent commits reviewed: none",
  "Changed-file groups: none",
  "Diff stats: 0 files changed",
  "Preliminary themes: quiet state",
  "Risk signals: none",
  "Test signals: none",
  "Dependency/config/tooling signals: none",
  "Context limitations: none",
  "Commands run: git -C /repo/app status --porcelain=v1",
  "Reason: clean tree and empty evidence window",
].join("\n");

function validate(mode: string, payload: string, ...projectPath: string[]) {
  return spawnSync("sh", [VALIDATOR_PATH, mode, ...projectPath], {
    input: payload,
    encoding: "utf8",
  });
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function draftCiting(locator: string): string {
  return GOOD_DRAFT.replace("path package.json", locator);
}

describe("output validator CLI", () => {
  test.each([
    {
      label: "a quiet-state report",
      mode: "report",
      payload: QUIET_STATE_SNAPSHOT,
    },
    {
      label: "a full ten-section report",
      mode: "report",
      payload: FULL_REPORT_SNAPSHOT,
    },
    { label: "a PASS draft", mode: "draft", payload: GOOD_DRAFT },
    {
      label: "a NEEDS_CONTEXT draft",
      mode: "draft",
      payload:
        "SNAPSHOT_WRITE: NEEDS_CONTEXT\nReason: two bases fit\nDecision needed: pick origin/main or origin/release",
    },
    { label: "a PASS verdict", mode: "verdict", payload: GOOD_VERDICT },
    {
      label: "a FAIL verdict with section-targeted bullets",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: FAIL\nRequired fixes:\n- Risks: add a locator.\n- Git State: name the base.\nReason: two sections fail\nDecision needed: none",
    },
    {
      label: "a NEEDS_CONTEXT verdict",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: NEEDS_CONTEXT\nRequired fixes: none\nReason: depends on the base\nDecision needed: confirm the comparison base",
    },
    {
      label: "ERROR evidence",
      mode: "evidence",
      payload: GOOD_NON_PASS_EVIDENCE,
    },
    {
      label: "PASS evidence with all 17 fields",
      mode: "evidence",
      payload: FULL_EVIDENCE,
    },
  ])("accepts $label", ({ mode, payload }) => {
    const result = validate(mode, payload, PROJECT_PATH);
    expect(result.status).toBe(SUCCESS_EXIT_STATUS);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test.each<{
    label: string;
    mode: string;
    payload: string;
    projectPath: string[];
  }>([
    {
      label: "an unknown mode",
      mode: "envelope",
      payload: "RECENT_STATE: PATH_ERROR\nReason: missing\nNext step: fix it",
      projectPath: [],
    },
    {
      label: "a draft without a project path",
      mode: "draft",
      payload: GOOD_DRAFT,
      projectPath: [],
    },
    {
      label: "an existing file as the draft project path",
      mode: "draft",
      payload: GOOD_DRAFT,
      projectPath: [join(PROJECT_PATH, "package.json")],
    },
  ])("rejects $label with usage", ({ mode, payload, projectPath }) => {
    const result = validate(mode, payload, ...projectPath);
    expect(result.status).toBe(USAGE_EXIT_STATUS);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/usage: validate-output\.sh/);
  });

  test("fails closed without findings when required tools are unavailable", () => {
    const emptyPath = mkdtempSync(join(tmpdir(), "validate-output-path-"));
    try {
      const result = spawnSync("/bin/sh", [VALIDATOR_PATH, "evidence"], {
        input: "total garbage\n",
        encoding: "utf8",
        env: { PATH: emptyPath },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBeGreaterThan(SUCCESS_EXIT_STATUS);
      expect(result.stdout).toBe("");
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  test.each([
    { label: "a leading parent traversal", locator: "../evals/package.json" },
    { label: "an embedded parent traversal", locator: "src/../package.json" },
    { label: "an absolute path", locator: "/package.json" },
  ])("rejects $label even when its relative target exists", ({ locator }) => {
    expect(existsSync(join(PROJECT_PATH, locator))).toBe(true);
    const result = validate(
      "draft",
      draftCiting(`path ${locator}`),
      PROJECT_PATH,
    );
    expect(result.status).toBe(FAILURE_EXIT_STATUS);
    expect(result.stdout).toContain(
      `malformed claim label: [confirmed: path ${locator}]`,
    );
    expect(result.stderr).toBe("");
  });

  test.each([
    {
      label: "a draft missing its Assumptions: line",
      mode: "draft",
      payload: GOOD_DRAFT.replace("Assumptions: none\n", ""),
      finding: /exactly one Assumptions: line in the body, found 0/,
    },
    {
      label: "a draft with a non-enum Execution mode",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "Execution mode: isolated",
        "Execution mode: inline",
      ),
      finding: /isolated or inline enum literal/,
    },
    {
      label: "a draft missing a canonical section",
      mode: "draft",
      payload: GOOD_DRAFT.replace("## Ranked Next Actions", "## Next Actions"),
      finding:
        /section set is neither the full form nor the quiet-state short form/,
    },
    {
      label: "an incoherent FAIL verdict with no fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: FAIL\nRequired fixes: none\nReason: x\nDecision needed: none",
      finding: /FAIL requires at least one section-targeted required fix/,
    },
    {
      label: "a PASS verdict carrying required fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: PASS\nRequired fixes:\n- Risks: address the finding.\nReason: x\nDecision needed: none",
      finding: /PASS requires Required fixes: none/,
    },
    {
      label: "an evidence payload missing a field",
      mode: "evidence",
      payload: "GIT_EVIDENCE: PASS\nProject path: /repo/app\nReason: partial",
      finding: /missing field: Repo state/,
    },
    {
      label: "a non-PASS evidence payload missing its Reason",
      mode: "evidence",
      payload: "GIT_EVIDENCE: ERROR",
      finding: /line 2 must be Reason: with non-empty content/,
    },
    {
      label: "a non-PASS evidence payload with an extra line",
      mode: "evidence",
      payload: `${GOOD_NON_PASS_EVIDENCE}\nNext step: nope`,
      finding: /non-PASS payload must be exactly 2 lines/,
    },
    {
      label: "an evidence payload with a duplicated field",
      mode: "evidence",
      payload: FULL_EVIDENCE.replace(
        "Repo state: normal",
        "Repo state: normal\nBranch/upstream: dev -> origin/dev",
      ),
      finding: /line 5: duplicate field: Branch\/upstream/,
    },
    {
      label: "a verdict with its fields reordered",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: PASS\nReason: x\nRequired fixes: none\nDecision needed: none",
      finding: /line 2: expected Required fixes: line/,
    },
    {
      label: "a verdict with a line after Decision needed:",
      mode: "verdict",
      payload: `${GOOD_VERDICT}\nNext step: nope`,
      finding: /line 5: unexpected line after Decision needed:/,
    },
    {
      label: "a verdict status line hiding text behind a NUL byte",
      mode: "verdict",
      payload: GOOD_VERDICT.replace(
        "SNAPSHOT_VERIFY: PASS",
        "SNAPSHOT_VERIFY: PASS\u0000 junk",
      ),
      finding: /line 1: line 1 must be SNAPSHOT_VERIFY:/,
    },
    {
      label: "a six-digit commit locator",
      mode: "report",
      payload: `${QUIET_STATE_SNAPSHOT}\n[confirmed: commit abcdef]`,
      finding: /malformed claim label: \[confirmed: commit abcdef\]/,
    },
    {
      label: "an uppercase commit locator",
      mode: "report",
      payload: `${QUIET_STATE_SNAPSHOT}\n[confirmed: commit ABCDEF1]`,
      finding: /malformed claim label: \[confirmed: commit ABCDEF1\]/,
    },
  ])("rejects $label", ({ mode, payload, finding }) => {
    const result = validate(mode, payload, PROJECT_PATH);
    expect(result.status).toBe(FAILURE_EXIT_STATUS);
    expect(result.stdout).toMatch(finding);
    expect(result.stderr).toBe("");
  });

  describe("draft locator resolution", () => {
    let fixture = "";
    let originalListing = new Set<string>();

    // A repository with a three-line committed file, a committed-then-deleted
    // file, and an uncommitted empty directory: one target per locator kind.
    beforeAll(() => {
      fixture = mkdtempSync(join(tmpdir(), "validate-output-"));
      git(fixture, "init", "-q");
      git(fixture, "config", "user.name", "Fixture");
      git(fixture, "config", "user.email", "fixture@example.invalid");
      git(fixture, "config", "commit.gpgsign", "false");
      writeFileSync(join(fixture, "kept.txt"), "one\ntwo\nthree\n");
      writeFileSync(join(fixture, "gone.txt"), "gone\n");
      git(fixture, "add", ".");
      git(fixture, "commit", "-qm", "initial");
      git(fixture, "rm", "-q", "gone.txt");
      git(fixture, "commit", "-qm", "delete gone.txt");
      mkdirSync(join(fixture, "docs"));
      originalListing = new Set(readdirSync(fixture));
    });
    afterAll(() => {
      if (fixture !== "") rmSync(fixture, { recursive: true, force: true });
    });

    test("resolves the current short commit", () => {
      const head = git(fixture, "rev-parse", "--short", "HEAD").trim();
      const result = validate("draft", draftCiting(`commit ${head}`), fixture);
      expect(result.status).toBe(SUCCESS_EXIT_STATUS);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    });

    test.each([
      { label: "a deleted path", locator: "path gone.txt" },
      { label: "a directory", locator: "path docs" },
      { label: "an in-range line span", locator: "path kept.txt:1-2" },
    ])("resolves $label", ({ locator }) => {
      const result = validate("draft", draftCiting(locator), fixture);
      expect(result.status).toBe(SUCCESS_EXIT_STATUS);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    });

    test.each([
      { label: "an unknown commit", locator: "commit 0000000" },
      {
        label: "a line span past the end of the file",
        locator: "path kept.txt:2-9",
      },
      { label: "a line span on a directory", locator: "path docs:1" },
      { label: "a line span on a deleted file", locator: "path gone.txt:1" },
      {
        label: "a never-existing path",
        locator: "path missing-output-validator-fixture.txt",
      },
    ])("rejects unresolved $label", ({ locator }) => {
      const result = validate("draft", draftCiting(locator), fixture);
      expect(result.status).toBe(FAILURE_EXIT_STATUS);
      expect(result.stdout).toContain(`locator does not resolve: ${locator}`);
      expect(result.stderr).toBe("");
    });

    // The path reaches a shell command, so each row is a would-be injection
    // that must leave the fixture untouched. MARKER becomes an absolute path
    // inside the fixture, so an injection lands there whatever the cwd; each
    // row has its own marker so one row's write cannot mask another's.
    test.each([
      {
        label: "a command substitution",
        path: "x$(touch MARKER)",
        markerName: "INJECTED-substitution",
        findingPrefix: "locator does not resolve:",
      },
      {
        label: "a ranged command substitution",
        path: "x$(touch MARKER):1",
        markerName: "INJECTED-range",
        findingPrefix: "locator does not resolve:",
      },
      {
        label: "a leading option",
        path: "--output=MARKER",
        markerName: "INJECTED-option",
        findingPrefix: "locator does not resolve:",
      },
      {
        label: "a closing single quote",
        path: "x'; touch MARKER; '",
        markerName: "INJECTED-quote",
        findingPrefix: "malformed claim label:",
      },
    ])(
      "treats $label as untrusted path data",
      ({ path, markerName, findingPrefix }) => {
        const marker = join(fixture, markerName);
        const locator = `path ${path.replace("MARKER", marker)}`;
        expect(existsSync(marker)).toBe(false);
        const result = validate("draft", draftCiting(locator), fixture);
        expect(existsSync(marker)).toBe(false);
        expect(new Set(readdirSync(fixture))).toEqual(originalListing);
        expect(result.status).toBe(FAILURE_EXIT_STATUS);
        expect(result.stdout).toContain(findingPrefix);
        expect(result.stdout).toContain(locator);
      },
    );
  });
});
