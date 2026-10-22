import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import {
  assistant,
  scripted,
  success,
  toolUse,
} from "#/observation/observation-test-support.ts";
import { EXIT_CODES, runCli, USAGE } from "#/orchestration/cli.ts";
import { FAILURE_ARTIFACT_DIRECTORY } from "#/orchestration/execution.ts";
import { DEFAULT_ATTEMPTS_PER_CASE } from "#/orchestration/suite.ts";

const sdk = vi.hoisted(() => ({
  query:
    vi.fn<(request: Parameters<typeof query>[0]) => AsyncIterable<unknown>>(),
}));
vi.mock(
  import("@anthropic-ai/claude-agent-sdk"),
  async (original): Promise<Record<string, unknown>> => ({
    ...(await original()),
    query: sdk.query,
  }),
);
let root = "";
let reportPath = "";
let existingArtifacts: string[] = [];
const stdout: string[] = [];
const stderr: string[] = [];
function artifacts(): string[] {
  return existsSync(FAILURE_ARTIFACT_DIRECTORY)
    ? readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter((name) =>
        name.startsWith("trigger-positive-"),
      )
    : [];
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cli-"));
  reportPath = join(root, "report.md");
  existingArtifacts = artifacts();
  stdout.length = 0;
  stderr.length = 0;
  vi.spyOn(process.stdout, "write").mockImplementation((text) => {
    stdout.push(String(text));
    return true;
  });
  vi.spyOn(console, "log").mockImplementation((text: string) => {
    stdout.push(`${text}\n`);
  });
  vi.spyOn(console, "error").mockImplementation((text: string) => {
    stderr.push(`${text}\n`);
  });
  sdk.query
    .mockReset()
    .mockImplementation(() =>
      scripted(
        assistant(toolUse("Skill", { skill: SKILL })),
        success("observed"),
      ),
    );
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
  for (const name of artifacts().filter(
    (file) => !existingArtifacts.includes(file),
  )) {
    rmSync(join(FAILURE_ARTIFACT_DIRECTORY, name));
  }
});

test("usage errors preserve exact stderr lines and never run or write", async () => {
  expect(await runCli(["--tier=abc", "--unknown"], reportPath)).toBe(
    EXIT_CODES.USAGE_ERROR,
  );
  expect(stderr).toStrictEqual([
    "unrecognized or malformed argument: --tier=abc\n",
    "unrecognized or malformed argument: --unknown\n",
    `${USAGE}\n`,
  ]);
  expect(stdout).toStrictEqual([]);
  expect(sdk.query).not.toHaveBeenCalled();
  expect(existsSync(reportPath)).toBe(false);
});

test.each([
  ["--tier=0"],
  ["--case=does-not-exist"],
  ["--tier=2", "--case=trigger-positive"],
])("unmatched selectors never run or write: %s", async (...args) => {
  expect(await runCli(args, reportPath)).toBe(EXIT_CODES.NO_CASES_MATCHED);
  expect(stderr).toStrictEqual(["No cases matched.\n"]);
  expect(stdout).toStrictEqual([]);
  expect(sdk.query).not.toHaveBeenCalled();
  expect(existsSync(reportPath)).toBe(false);
});

test("the CLI defaults to five attempts and skipped rows do not gate", async () => {
  expect(await runCli(["--case=trigger-positive"], reportPath)).toBe(
    EXIT_CODES.ALL_PASSED,
  );
  expect(sdk.query).toHaveBeenCalledTimes(DEFAULT_ATTEMPTS_PER_CASE);
  const report = readFileSync(reportPath, "utf8");
  expect(report).toContain("| trigger-positive | 1 | PASS | 100 | 5/5 |");
  expect(report).toContain("| mutation-scope | 2* | NOT_RUN | — | — |");
  expect(report).toContain("| quiet-state | 2 | NOT_RUN | — | — |");
  expect(stderr).toStrictEqual([]);
});

test.each([
  { firstPass: true, status: "DEGRADED", score: 50, runs: "1/2" },
  { firstPass: false, status: "FAIL", score: 0, runs: "0/2" },
])(
  "$status gates the CLI after writing the report",
  async ({ firstPass, status, score, runs }) => {
    if (!firstPass) {
      sdk.query.mockImplementationOnce(() =>
        scripted(success("not triggered")),
      );
    }
    sdk.query.mockImplementationOnce(() => scripted(success("not triggered")));
    expect(
      await runCli(["--case=trigger-positive", "--attempts=2"], reportPath),
    ).toBe(EXIT_CODES.CASE_FAILED);
    expect(readFileSync(reportPath, "utf8")).toContain(
      `| trigger-positive | 1 | ${status} | ${score} | ${runs} |`,
    );
    expect(stdout.join("")).toContain("Report written to evals/report.md");
  },
);
