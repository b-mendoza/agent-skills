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

import type {
  CaseTier,
  EvalCase,
} from "#/cases/analyzing-recent-project-state.ts";
import { scripted, success } from "#/observation/observation-test-support.ts";
import { parseArgs, selectCases } from "#/orchestration/cli.ts";
import { FAILURE_ARTIFACT_DIRECTORY } from "#/orchestration/execution.ts";
import { executeSuite } from "#/orchestration/suite.ts";

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
const ROUTING = 1;
const BEHAVIORAL = 2;
const ONE_ATTEMPT = 1;
const TWO_ATTEMPTS = 2;
const PASS_COST = 0.25;
const FAIL_COST = 0.5;
const START = 0n;
const PASS_END = 1_500_000_000n;
const FAIL_END = 3_000_000_000n;
const FAIL_ID = `suite-failing-${process.pid}`;
let root = "";
let reportPath = "";
const stdout: string[] = [];
function evalCase(id: string, tier: CaseTier): EvalCase {
  return {
    id,
    tier,
    fixture: "clean",
    intent: "suite test",
    prompt: () => id,
    budgetUsd: 1,
    wallClockMs: 30_000,
    check: () => "ok",
  };
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "suite-"));
  reportPath = join(root, "report.md");
  stdout.length = 0;
  vi.spyOn(process.stdout, "write").mockImplementation((text) => {
    stdout.push(String(text));
    return true;
  });
  vi.spyOn(console, "log").mockImplementation((text: string) => {
    stdout.push(`${text}\n`);
  });
  sdk.query.mockReset().mockImplementation(() => scripted(success("observed")));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
  if (existsSync(FAILURE_ARTIFACT_DIRECTORY)) {
    for (const name of readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter((file) =>
      file.startsWith(FAIL_ID),
    )) {
      rmSync(join(FAILURE_ARTIFACT_DIRECTORY, name));
    }
  }
});

test.each([
  { args: [], ids: ["one-a", "one-b", "two-a", "two-b"] },
  { args: ["--tier=1"], ids: ["one-a", "one-b"] },
  { args: ["--case=two-a"], ids: ["two-a"] },
  { args: ["--tier=2", "--case=two-b"], ids: ["two-b"] },
])(
  "selection executes the requested cases in registry order: $args",
  async ({ args, ids }) => {
    const cases = [
      evalCase("one-a", ROUTING),
      evalCase("one-b", ROUTING),
      evalCase("two-a", BEHAVIORAL),
      evalCase("two-b", BEHAVIORAL),
    ];
    const selected = selectCases(cases, parseArgs(args));
    const results = await executeSuite(
      cases,
      selected,
      ONE_ATTEMPT,
      reportPath,
    );
    expect(
      sdk.query.mock.calls.map(([request]) => request.prompt),
    ).toStrictEqual(ids);
    expect(results.filter((result) => result.status === "FAIL")).toStrictEqual(
      [],
    );
  },
);

test("cases and attempts finish sequentially before the report is written", async () => {
  const order: string[] = [];
  sdk.query.mockImplementation((request) =>
    (async function* () {
      expect(existsSync(reportPath)).toBe(false);
      order.push(
        `start:${typeof request.prompt === "string" ? request.prompt : "unexpected stream prompt"}`,
      );
      await Promise.resolve();
      order.push(
        `finish:${typeof request.prompt === "string" ? request.prompt : "unexpected stream prompt"}`,
      );
      yield success("observed");
    })(),
  );
  const cases = [evalCase("first", ROUTING), evalCase("second", ROUTING)];
  await executeSuite(cases, cases, TWO_ATTEMPTS, reportPath);
  expect(order).toStrictEqual([
    "start:first",
    "finish:first",
    "start:first",
    "finish:first",
    "start:second",
    "finish:second",
    "start:second",
    "finish:second",
  ]);
  expect(existsSync(reportPath)).toBe(true);
});

test("a mixed run prints exact attempt, detail, summary, and confirmation lines", async () => {
  const passing = evalCase("passing", ROUTING);
  const failing = {
    ...evalCase(FAIL_ID, ROUTING),
    check: () => {
      throw new Error("assertion failed");
    },
  };
  sdk.query
    .mockImplementationOnce(() => scripted(success("passed", PASS_COST)))
    .mockImplementationOnce(() => scripted(success("failed", FAIL_COST)));
  vi.spyOn(process.hrtime, "bigint")
    .mockReturnValueOnce(START)
    .mockReturnValueOnce(PASS_END)
    .mockReturnValueOnce(START)
    .mockReturnValueOnce(FAIL_END);
  const results = await executeSuite(
    [passing, failing],
    [passing, failing],
    ONE_ATTEMPT,
    reportPath,
  );
  expect(results.map((result) => result.status)).toStrictEqual([
    "PASS",
    "FAIL",
    "NOT_RUN",
  ]);
  expect(stdout.join("")).toBe(
    [
      "· passing (tier 1) attempt 1/1 ... PASS 2s $0.25",
      "· passing (tier 1) ... PASS score 100 (1/1 passed) 2s $0.25",
      `· ${FAIL_ID} (tier 1) attempt 1/1 ... FAIL 3s $0.50`,
      "    assertion failed",
      `· ${FAIL_ID} (tier 1) ... FAIL score 0 (0/1 passed) 3s $0.50`,
      "· mutation-scope (derived) ... NOT_RUN",
      "",
      "Report written to evals/report.md",
      "",
    ].join("\n"),
  );
});

test("an unselected case remains NOT_RUN while a selected case passes", async () => {
  const selected = evalCase("selected", ROUTING);
  await executeSuite(
    [selected, evalCase("unselected", BEHAVIORAL)],
    [selected],
    ONE_ATTEMPT,
    reportPath,
  );
  expect(sdk.query).toHaveBeenCalledOnce();
  const report = readFileSync(reportPath, "utf8");
  expect(report).toContain("| selected | 1 | PASS | 100 | 1/1 |");
  expect(report).toContain(
    "| unselected | 2 | NOT_RUN | — | — | not executed by this run |",
  );
});
