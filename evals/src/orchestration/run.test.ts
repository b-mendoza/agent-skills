import * as childProcess from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { observe } from "#/cases/case-test-support.ts";

import { runCli } from "./run.ts";

vi.mock(import("node:child_process"), async (original) => ({
  ...(await original()),
  spawnSync: vi.fn(),
}));

vi.mock(import("node:os"), async (original) => {
  const os = await original();
  return { ...os, tmpdir: vi.fn(os.tmpdir) };
});

const EXIT = { PASS: 0, FAIL: 1, EMPTY: 2, ERROR: 3 };
const SECOND = 1;
const OPTIONS_INDEX = 2;
const LAST_ARGUMENT_INDEX = -1;
const PROMPTFOO_FAILURE = 100;

let root = "";
let outputPath = "";
let reportPath = "";
let data: unknown = undefined;
let status = EXIT.PASS;
let writeOutput = true;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "promptfoo-run-"));
  outputPath = join(root, "latest.json");
  reportPath = join(root, "report.md");
  data = { results: { results: [] } };
  status = EXIT.PASS;
  writeOutput = true;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(childProcess.spawnSync)
    .mockReset()
    .mockImplementation((_command, args) => {
      const resultPath = args?.at(LAST_ARGUMENT_INDEX);
      if (writeOutput && typeof resultPath === "string") {
        writeFileSync(resultPath, JSON.stringify(data));
      }
      return {
        status,
        signal: null,
        pid: 1,
        output: [],
        stdout: "",
        stderr: "",
      };
    });
});
afterEach(() => {
  vi.mocked(tmpdir).mockReset();
  rmSync(root, { recursive: true, force: true });
});

function result(success: boolean) {
  return {
    testCase: { vars: { caseId: "trigger-positive" } },
    success,
    failureReason: success ? EXIT.PASS : EXIT.FAIL,
    response: { metadata: { observation: observe(), repeatIndex: 0 } },
    gradingResult: {
      componentResults: [
        { reason: success ? "Skill invoked" : "check failed" },
      ],
    },
  };
}

test.each([
  { success: true, status: 0, code: 0 },
  { success: false, status: 100, code: 1 },
])("writes reports and maps success=$success to exit $code", (scenario) => {
  data = { results: { results: [result(scenario.success)] } };
  ({ status } = scenario);
  expect(runCli([], reportPath, outputPath)).toBe(scenario.code);
  expect(readFileSync(reportPath, "utf8")).toContain(
    "| trigger-positive | 1 |",
  );
});

test("default output paths are unique per invocation and printed for diagnosis", async () => {
  // Redirect even the old fixed path so this regression test cannot touch a live run.
  vi.mocked(tmpdir).mockReturnValue(root);
  vi.resetModules();
  const { runCli: runWithDefaultOutput } = await import("./run.ts");
  data = { results: { results: [result(false)] } };
  status = PROMPTFOO_FAILURE;

  expect(runWithDefaultOutput([], reportPath)).toBe(EXIT.FAIL);
  expect(runWithDefaultOutput([], reportPath)).toBe(EXIT.FAIL);
  const [firstPath, secondPath] = vi
    .mocked(childProcess.spawnSync)
    .mock.calls.map((call) => call[SECOND]?.at(LAST_ARGUMENT_INDEX));

  expect(firstPath).toEqual(expect.any(String));
  expect(secondPath).toEqual(expect.any(String));
  expect(firstPath).not.toBe(secondPath);
  expect(console.log).toHaveBeenCalledWith(
    expect.stringContaining(String(firstPath)),
  );
  expect(console.log).toHaveBeenCalledWith(
    expect.stringContaining(String(secondPath)),
  );
});

test("forwards selectors, repeat and concurrency with fixed offline-storage flags", () => {
  const args = [
    "--repeat",
    "1",
    "--filter-metadata",
    "tier=1",
    "--filter-pattern",
    "^trigger-positive$",
    "-j",
    "2",
  ];
  expect(runCli(args, reportPath, outputPath)).toBe(EXIT.EMPTY);
  expect(childProcess.spawnSync).toHaveBeenCalledWith(
    process.execPath,
    expect.arrayContaining(args),
    expect.objectContaining({ stdio: "inherit" }),
  );
  const call = vi.mocked(childProcess.spawnSync).mock.lastCall;
  const options = call?.[OPTIONS_INDEX];
  expect(options?.env).toMatchObject({ PROMPTFOO_DISABLE_TELEMETRY: "1" });
  const command = call?.[SECOND];
  expect(command).toEqual(
    expect.arrayContaining([
      "--no-cache",
      "--no-write",
      "--no-share",
      "-o",
      outputPath,
    ]),
  );
  expect(existsSync(reportPath)).toBe(false);
});

test.each([
  { label: "missing output", output: undefined },
  { label: "invalid output", output: null },
  {
    label: "provider error",
    output: {
      results: {
        results: [{ ...result(false), failureReason: 2, error: "SDK failed" }],
      },
    },
  },
])("$label exits 3 and preserves the report", ({ output }) => {
  writeFileSync(reportPath, "previous report");
  writeFileSync(outputPath, "stale output");
  writeOutput = output !== undefined;
  data = output;
  expect(runCli([], reportPath, outputPath)).toBe(EXIT.ERROR);
  expect(readFileSync(reportPath, "utf8")).toBe("previous report");
});

test("report write errors and broken diagnostics still exit 3", () => {
  data = { results: { results: [result(true)] } };
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("broken stderr");
  });
  expect(runCli([], root, outputPath)).toBe(EXIT.ERROR);
});

test("a killed or failed subprocess cannot report success from partial JSON", () => {
  data = { results: { results: [result(true)] } };
  status = EXIT.FAIL;
  expect(runCli([], reportPath, outputPath)).toBe(EXIT.ERROR);
  expect(existsSync(reportPath)).toBe(false);
});
