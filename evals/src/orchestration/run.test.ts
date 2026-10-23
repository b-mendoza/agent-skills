import * as childProcess from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { observe } from "#/cases/case-test-support.ts";

import { runCli } from "./run.ts";

vi.mock(import("node:child_process"), async (original) => ({
  ...(await original()),
  spawnSync: vi.fn(),
}));

const EXIT = { PASS: 0, FAIL: 1, EMPTY: 2, ERROR: 3 };
const SECOND = 1;
const OPTIONS_INDEX = 2;
const LAST_ARGUMENT_INDEX = -1;
const PROMPTFOO_FAILURE = 100;
const RUN_COUNT = 2;
const EXPORT_ARGUMENTS_START = -4;

let root = "";
let data: unknown = undefined;
let status = EXIT.PASS;
let writeOutput = true;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "promptfoo-run-"));
  data = { results: { results: [] } };
  status = EXIT.PASS;
  writeOutput = true;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(childProcess.spawnSync)
    .mockReset()
    .mockImplementation((_command, args = []) => {
      const resultPath = args[args.indexOf("-o") + SECOND];
      const htmlPath = args.at(LAST_ARGUMENT_INDEX);
      if (writeOutput) {
        writeFileSync(String(resultPath), JSON.stringify(data));
      }
      writeFileSync(String(htmlPath), "offline");
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
  rmSync(root, { recursive: true, force: true });
});

function result(success: boolean, caseId = "trigger-positive") {
  return {
    testCase: { vars: { caseId } },
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
])(
  "maps success=$success to exit $code without writing Markdown",
  (scenario) => {
    data = { results: { results: [result(scenario.success)] } };
    ({ status } = scenario);
    expect(runCli([], root)).toBe(scenario.code);
    expect(
      readdirSync(root, { recursive: true, encoding: "utf8" }).filter((path) =>
        path.endsWith(".md"),
      ),
    ).toEqual([]);
  },
);

test("creates unique timestamped run directories and prints both artifacts and the viewer command", () => {
  vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
    "2026-10-22T12:00:00.000Z",
  );
  data = { results: { results: [result(true)] } };

  expect(runCli([], root)).toBe(EXIT.PASS);
  expect(runCli([], root)).toBe(EXIT.PASS);
  const runs = readdirSync(join(root, "runs"));
  expect(runs).toHaveLength(RUN_COUNT);
  for (const run of runs) {
    expect(run).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-.+$/);
    const directory = join(root, "runs", run);
    expect(
      readdirSync(directory).sort((left, right) => left.localeCompare(right)),
    ).toEqual(["results.html", "results.json"]);
    for (const path of [
      directory,
      join(directory, "results.json"),
      join(directory, "results.html"),
    ]) {
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(path));
    }
  }
  expect(console.log).toHaveBeenCalledWith(
    "History viewer: pnpm eval:view (from evals/)",
  );
});

test("forwards selectors, repeat and concurrency with isolated artifacts and shared history", () => {
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
  expect(runCli(args, root)).toBe(EXIT.EMPTY);
  expect(console.error).toHaveBeenCalledWith("No cases matched.");
  expect(childProcess.spawnSync).toHaveBeenCalledWith(
    process.execPath,
    expect.arrayContaining(args),
    expect.objectContaining({ stdio: "inherit" }),
  );
  const call = vi.mocked(childProcess.spawnSync).mock.lastCall;
  if (call === undefined) throw new Error("promptfoo was not spawned");
  const options = call[OPTIONS_INDEX];
  expect(options?.env).toMatchObject({
    PROMPTFOO_DISABLE_TELEMETRY: "1",
    PROMPTFOO_FAILED_TEST_EXIT_CODE: "100",
    PROMPTFOO_CONFIG_DIR: join(root, "promptfoo-state"),
  });
  const command = call[SECOND] ?? [];
  const jsonPath = command[command.indexOf("-o") + SECOND];
  expect(jsonPath).toEqual(expect.any(String));
  const directory = dirname(String(jsonPath));
  expect(dirname(directory)).toBe(join(root, "runs"));
  expect(command).toEqual(expect.arrayContaining(["--no-cache", "--no-share"]));
  expect(command).not.toContain("--no-write");
  expect(command.slice(EXPORT_ARGUMENTS_START)).toEqual([
    "-o",
    join(directory, "results.json"),
    "-o",
    join(directory, "results.html"),
  ]);
});

test("prints failed, degraded and unexecuted case summaries but not passing cases", () => {
  const failed = result(false);
  data = {
    results: {
      results: [result(true), failed, result(false, "trigger-negative-review")],
    },
  };
  status = PROMPTFOO_FAILURE;
  expect(runCli([], root)).toBe(EXIT.FAIL);
  expect(console.log).toHaveBeenCalledWith(
    "trigger-positive DEGRADED 1/2 check failed",
  );
  expect(console.log).toHaveBeenCalledWith(
    "trigger-negative-review FAIL 0/1 check failed",
  );
  expect(console.log).toHaveBeenCalledWith(
    expect.stringMatching(/^snapshot-dirty NOT_RUN 0\/0 /),
  );
  expect(console.log).not.toHaveBeenCalledWith(expect.stringMatching(/ PASS /));
});

test("explains a derived mutation-scope failure even when promptfoo passes", () => {
  const dirty = result(true, "snapshot-dirty");
  dirty.response.metadata.observation.toolCalls = [
    { name: "Write", input: {} },
  ];
  data = { results: { results: [dirty] } };
  expect(runCli([], root)).toBe(EXIT.FAIL);
  expect(console.log).toHaveBeenCalledWith(
    expect.stringMatching(
      /^mutation-scope FAIL 0\/1 read-only contract violated:/,
    ),
  );
  expect(console.log).not.toHaveBeenCalledWith(
    expect.stringMatching(/^snapshot-dirty PASS /),
  );
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
])("$label exits 3", ({ output }) => {
  writeOutput = output !== undefined;
  data = output;
  expect(runCli([], root)).toBe(EXIT.ERROR);
});

test("broken diagnostics still exit 3", () => {
  vi.mocked(childProcess.spawnSync).mockImplementation(() => {
    throw new Error("subprocess unavailable");
  });
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("broken stderr");
  });
  expect(runCli([], root)).toBe(EXIT.ERROR);
});

test("output directory errors exit 3", () => {
  const file = join(root, "not-a-directory");
  writeFileSync(file, "occupied");
  expect(runCli([], file)).toBe(EXIT.ERROR);
});

test("a killed or failed subprocess cannot report success from partial JSON", () => {
  data = { results: { results: [result(true)] } };
  status = EXIT.FAIL;
  expect(runCli([], root)).toBe(EXIT.ERROR);
});
