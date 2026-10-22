import { mkdtempSync, rmSync } from "node:fs";
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
import { EXIT_CODES, runCli } from "#/orchestration/cli.ts";
import * as execution from "#/orchestration/execution.ts";

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
const stdout: string[] = [];
const stderr: string[] = [];
const ONE_LINE = 1;
const FIRST_LINE = 0;
const args = ["--case=trigger-positive", "--attempts=1"];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "failure-"));
  stdout.length = 0;
  stderr.length = 0;
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.spyOn(console, "log").mockImplementation((text: string) => {
    stdout.push(text);
  });
  vi.spyOn(console, "error").mockImplementation((text: string) => {
    stderr.push(text);
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
});

test.each([
  { rejection: new Error("executor broke"), message: "executor broke" },
  { rejection: "bare failure", message: "bare failure" },
])(
  "executor rejection is contained: $message",
  async ({ rejection, message }) => {
    vi.spyOn(execution, "executeCase").mockRejectedValueOnce(rejection);
    expect(await runCli(args, join(root, "report.md"))).toBe(
      EXIT_CODES.SUITE_ERROR,
    );
    expect(stderr).toStrictEqual([`eval suite error: ${message}`]);
    expect(stdout.join("\n")).not.toContain("Report written");
  },
);

test("observation cleanup rejection exits as infrastructure failure", async () => {
  sdk.query.mockImplementation(() => ({
    [Symbol.asyncIterator]: () => ({
      next: vi
        .fn<AsyncIterator<unknown>["next"]>()
        .mockResolvedValue({ done: true, value: undefined }),
      return: vi
        .fn<NonNullable<AsyncIterator<unknown>["return"]>>()
        .mockRejectedValue(new Error("observation cleanup failed")),
    }),
  }));
  expect(await runCli(args, join(root, "report.md"))).toBe(
    EXIT_CODES.SUITE_ERROR,
  );
  expect(stderr).toStrictEqual([
    "eval suite error: observation cleanup failed",
  ]);
  expect(stdout.join("\n")).not.toContain("Report written");
});

test("a report write failure overrides a successful run without a success confirmation", async () => {
  expect(await runCli(args, root)).toBe(EXIT_CODES.SUITE_ERROR);
  expect(stderr).toHaveLength(ONE_LINE);
  expect(stderr[FIRST_LINE]).toMatch(/^eval suite error: EISDIR:/);
  expect(stdout.join("\n")).not.toContain("Report written");
});

test("an unprintable rejection still produces a printable diagnostic", async () => {
  vi.spyOn(execution, "executeCase").mockRejectedValueOnce({
    toString: () => {
      throw new Error("coercion broke");
    },
  });
  expect(await runCli(args, join(root, "report.md"))).toBe(
    EXIT_CODES.SUITE_ERROR,
  );
  expect(stderr).toHaveLength(ONE_LINE);
  expect(stderr[FIRST_LINE]).toMatch(/^eval suite error: .+$/);
});

test("a broken diagnostic channel cannot replace the infrastructure exit code", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("output broke");
  });
  expect(await runCli(["--tier=x"], join(root, "report.md"))).toBe(
    EXIT_CODES.SUITE_ERROR,
  );
  expect(sdk.query).not.toHaveBeenCalled();
});
