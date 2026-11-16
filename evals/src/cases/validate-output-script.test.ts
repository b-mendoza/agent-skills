// Pins the skill's deterministic validator, which is the normative shape
// definition shared by the subagents (pre-return), the orchestrator (gates),
// and the eval checks. These run the real script through the same wrapper the
// checks use, offline and token-free.

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

import { afterEach, describe, expect, test } from "vitest";

import { runOutputValidator } from "#/cases/analyzing-recent-project-state-checks.ts";
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

const START_INDEX = 0;
const fixtures: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

// A repository with a three-line committed file, a committed file named "-"
// (to awk, "-" alone means stdin), a committed-then-deleted file, and an
// empty directory: one resolution target per locator kind.
function createFixture(): string {
  const path = mkdtempSync(join(tmpdir(), "validate-output-"));
  fixtures.push(path);
  git(path, "init", "-q");
  git(path, "config", "user.name", "Fixture");
  git(path, "config", "user.email", "fixture@example.invalid");
  git(path, "config", "commit.gpgsign", "false");
  writeFileSync(join(path, "kept.txt"), "one\ntwo\nthree\n");
  writeFileSync(join(path, "-"), "dash\n");
  writeFileSync(join(path, "gone.txt"), "gone\n");
  git(path, "add", ".");
  git(path, "commit", "-qm", "initial");
  git(path, "rm", "-q", "gone.txt");
  git(path, "commit", "-qm", "delete gone.txt");
  mkdirSync(join(path, "docs"));
  return path;
}

function draftCiting(locator: string): string {
  return GOOD_DRAFT.replace("path package.json", locator);
}

afterEach(() => {
  for (const path of fixtures.splice(START_INDEX)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("validate-output.sh", () => {
  test.each([
    { mode: "report", payload: QUIET_STATE_SNAPSHOT },
    { mode: "draft", payload: GOOD_DRAFT },
    { mode: "verdict", payload: GOOD_VERDICT },
    { mode: "evidence", payload: GOOD_NON_PASS_EVIDENCE },
  ] as const)("$mode accepts a conformant payload", ({ mode, payload }) => {
    expect(runOutputValidator(mode, payload, PROJECT_PATH)).toBe("");
  });

  test("rejects the retired envelope mode with usage exit code 2", () => {
    const result = spawnSync("sh", [VALIDATOR_PATH, "envelope"], {
      input: "RECENT_STATE: PATH_ERROR\nReason: missing\nNext step: fix it",
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(USAGE_EXIT_STATUS);
    expect(result.stderr).toMatch(/usage: validate-output\.sh/);
    expect(result.stdout).toBe("");
  });

  test("throws an operational error when draft validation lacks a project path", () => {
    expect(() => runOutputValidator("draft", GOOD_DRAFT)).toThrow(
      /output validator could not run: validator exited with status 2 without findings/,
    );
  });

  test.each(["kept.txt", "missing-directory"])(
    "throws an operational error when the draft project path %s is not a directory",
    (name) => {
      const fixture = createFixture();
      expect(() =>
        runOutputValidator("draft", GOOD_DRAFT, join(fixture, name)),
      ).toThrow(/validator exited with status 2 without findings/);
    },
  );

  test("fails closed with no findings when awk cannot run", () => {
    const emptyPath = mkdtempSync(join(tmpdir(), "validate-output-path-"));
    fixtures.push(emptyPath);
    const result = spawnSync("/bin/sh", [VALIDATOR_PATH, "evidence"], {
      input: "total garbage\n",
      encoding: "utf8",
      env: { PATH: emptyPath },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBeGreaterThan(SUCCESS_EXIT_STATUS);
    expect(result.stdout).toBe("");
  });

  test.each(["../evals/package.json", "src/../package.json"])(
    "lexically rejects parent traversal in locator %s even when its target exists",
    (locator) => {
      expect(existsSync(join(PROJECT_PATH, locator))).toBe(true);
      const findings = runOutputValidator(
        "draft",
        GOOD_DRAFT.replace("path package.json", `path ${locator}`),
        PROJECT_PATH,
      );
      expect(findings).toContain(
        `malformed claim label: [confirmed: path ${locator}]`,
      );
    },
  );

  test.each([
    {
      label: "a draft with an unresolved path locator",
      mode: "draft",
      payload: GOOD_DRAFT.replace(
        "path package.json",
        "path missing-output-validator-fixture.txt",
      ),
      finding:
        /locator does not resolve: path missing-output-validator-fixture.txt/,
    },
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
      label: "a NEEDS_CONTEXT verdict carrying fixes",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: NEEDS_CONTEXT\nRequired fixes:\n- Git State: fix.\nReason: x\nDecision needed: pick a base",
      finding: /NEEDS_CONTEXT requires Required fixes: none/,
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
  ] as const)("rejects $label", ({ mode, payload, finding }) => {
    expect(runOutputValidator(mode, payload, PROJECT_PATH)).toMatch(finding);
  });

  test.each([
    {
      label: "a full ten-section report",
      mode: "report",
      payload: FULL_REPORT_SNAPSHOT,
    },
    {
      label: "a PASS evidence payload with all 17 fields",
      mode: "evidence",
      payload: FULL_EVIDENCE,
    },
    {
      label: "a three-line NEEDS_CONTEXT draft",
      mode: "draft",
      payload:
        "SNAPSHOT_WRITE: NEEDS_CONTEXT\nReason: two bases fit\nDecision needed: pick origin/main or origin/release",
    },
    {
      label: "a FAIL verdict with section-targeted bullets",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: FAIL\nRequired fixes:\n- Risks: add a locator.\n- Git State: name the base.\nReason: two sections fail\nDecision needed: none",
    },
    {
      label: "a NEEDS_CONTEXT verdict naming one decision",
      mode: "verdict",
      payload:
        "SNAPSHOT_VERIFY: NEEDS_CONTEXT\nRequired fixes: none\nReason: depends on the base\nDecision needed: confirm the comparison base",
    },
  ] as const)("accepts $label", ({ mode, payload }) => {
    expect(runOutputValidator(mode, payload, PROJECT_PATH)).toBe("");
  });

  describe("draft locator resolution against a fixture repository", () => {
    test.each([
      {
        label: "the short HEAD commit",
        locator: (fixture: string) =>
          `commit ${git(fixture, "rev-parse", "--short", "HEAD").trim()}`,
      },
      { label: "a deleted path", locator: () => "path gone.txt" },
      { label: "a directory", locator: () => "path docs" },
      { label: "an in-range line span", locator: () => "path kept.txt:1-2" },
      { label: "a line span in a file named -", locator: () => "path -:1" },
    ])("resolves $label", ({ locator }) => {
      const fixture = createFixture();
      expect(
        runOutputValidator("draft", draftCiting(locator(fixture)), fixture),
      ).toBe("");
    });

    test.each([
      { label: "an unknown commit", locator: "commit 0000000" },
      {
        label: "a line span past the end of the file",
        locator: "path kept.txt:2-9",
      },
      { label: "a line span on a directory", locator: "path docs:1" },
      { label: "a line span on a deleted file", locator: "path gone.txt:1" },
    ])("does not resolve $label", ({ locator }) => {
      const fixture = createFixture();
      expect(
        runOutputValidator("draft", draftCiting(locator), fixture),
      ).toContain(`locator does not resolve: ${locator}`);
    });

    // Built from the full HEAD hash, which git would accept in either form, so
    // only the grammar rejects them. Forty hex digits all but surely hold a
    // letter, so uppercasing changes the text.
    const SHORT_HASH_LENGTH = 6;
    test.each([
      { label: "uppercase hex", hash: (head: string) => head.toUpperCase() },
      {
        label: "six hex digits",
        hash: (head: string) => head.slice(START_INDEX, SHORT_HASH_LENGTH),
      },
    ])("rejects a commit locator with $label", ({ hash }) => {
      const fixture = createFixture();
      const head = git(fixture, "rev-parse", "HEAD").trim();
      const locator = `commit ${hash(head)}`;
      expect(
        runOutputValidator("draft", draftCiting(locator), fixture),
      ).toContain(`malformed claim label: [confirmed: ${locator}]`);
    });

    const unresolved = (locator: string) =>
      `locator does not resolve: ${locator}`;
    const malformed = (locator: string) =>
      `malformed claim label: [confirmed: ${locator}]`;

    // The path reaches a shell command, so each row is a would-be injection
    // that must leave the fixture untouched. MARKER becomes an absolute path
    // inside the fixture, so an injection lands there whatever the cwd.
    test.each([
      {
        label: "a command substitution",
        path: "x$(touch MARKER)",
        finding: unresolved,
      },
      {
        label: "a backtick command",
        path: "x`touch MARKER`",
        finding: unresolved,
      },
      {
        label: "a command list",
        path: "x; touch MARKER",
        finding: unresolved,
      },
      {
        label: "a leading option",
        path: "--output=MARKER",
        finding: unresolved,
      },
      {
        label: "a closing single quote",
        path: "x'; touch MARKER; '",
        finding: malformed,
      },
    ])("treats $label in a path as data", ({ path, finding }) => {
      const fixture = createFixture();
      const before = new Set(readdirSync(fixture));
      const locator = `path ${path.replace("MARKER", join(fixture, "INJECTED"))}`;
      expect(
        runOutputValidator("draft", draftCiting(locator), fixture),
      ).toContain(finding(locator));
      expect(new Set(readdirSync(fixture))).toEqual(before);
    });
  });
});
