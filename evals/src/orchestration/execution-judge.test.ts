import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/analyzing-recent-project-state.ts";
import { judgeLive } from "#/observation/judge.ts";
import { scripted, success } from "#/observation/observation-test-support.ts";
import {
  executeCase,
  FAILURE_ARTIFACT_DIRECTORY,
} from "#/orchestration/execution.ts";

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
const CASE_ID = `judge-${process.pid}`;
const COST = 0.2;
const JUDGE_COST = 9;
const JUDGE_TURNS = 1;
const ONE_ARTIFACT = 1;
function artifacts(): string[] {
  return existsSync(FAILURE_ARTIFACT_DIRECTORY)
    ? readdirSync(FAILURE_ARTIFACT_DIRECTORY).filter((name) =>
        name.startsWith(CASE_ID),
      )
    : [];
}
function selectedCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: CASE_ID,
    tier: 2,
    fixture: "clean",
    intent: "judge ordering",
    prompt: () => "observe",
    budgetUsd: 1,
    wallClockMs: 30_000,
    check: () => "check passed",
    ...overrides,
  };
}
beforeEach(() => {
  sdk.query
    .mockReset()
    .mockImplementation(() => scripted(success("observed", COST)));
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const name of artifacts()) {
    rmSync(join(FAILURE_ARTIFACT_DIRECTORY, name));
  }
});

test.each([false, true])(
  "only FAIL persists the observed final text: %s",
  async (fails) => {
    const check = () => {
      if (fails) throw new Error("check failed");
      return "check passed";
    };
    await executeCase(selectedCase({ check }));
    const files = artifacts();
    expect(files).toHaveLength(Number(fails));
    for (const name of files) {
      expect(readFileSync(join(FAILURE_ARTIFACT_DIRECTORY, name), "utf8")).toBe(
        "observed",
      );
    }
  },
);

test("judge follows the mechanical check and joins its verdict without billing its query", async () => {
  const order: string[] = [];
  sdk.query.mockImplementation((request) => {
    if (request.options?.maxTurns === JUDGE_TURNS) {
      order.push("judge query");
      return scripted(success('{"violations":[]}', JUDGE_COST));
    }
    order.push("observation");
    return scripted(success("observed", COST));
  });
  const run = await executeCase(
    selectedCase({
      check: () => {
        order.push("check");
        return "check passed";
      },
      judge: async (observation) => {
        await judgeLive({
          artifact: observation.finalText,
          knownFacts: "facts",
          rubric: [],
        });
        return "judge: clean";
      },
    }),
  );
  expect(order).toStrictEqual(["observation", "check", "judge query"]);
  expect(run.result).toMatchObject({
    status: "PASS",
    observed: "check passed; judge: clean",
    costUsd: COST,
  });
  expect(run.result.durationMs).toBe(run.observation.durationMs);
  expect(artifacts()).toStrictEqual([]);
});

test("judge failure becomes a FAIL attempt and persists the observed text", async () => {
  const run = await executeCase(
    selectedCase({
      judge: async () => {
        await Promise.resolve();
        throw new Error("judge: grounding violated");
      },
    }),
  );
  expect(run.result).toMatchObject({
    status: "FAIL",
    observed: "judge: grounding violated",
  });
  expect(artifacts()).toHaveLength(ONE_ARTIFACT);
});

test("mechanical failure skips the judge", async () => {
  const judge = vi.fn<NonNullable<EvalCase["judge"]>>();
  const run = await executeCase(
    selectedCase({
      judge,
      check: () => {
        throw new Error("mechanical check failed");
      },
    }),
  );
  expect(run.result.status).toBe("FAIL");
  expect(judge).not.toHaveBeenCalled();
});

test.each([
  { configured: undefined, expected: "sonnet" },
  { configured: "", expected: "sonnet" },
  { configured: "custom-model", expected: "custom-model" },
])(
  "captures EVAL_MODEL=$configured at import",
  async ({ configured, expected }) => {
    vi.stubEnv("EVAL_MODEL", configured);
    vi.resetModules();
    try {
      const { executeCase: executeCaptured } =
        await import("#/orchestration/execution.ts");
      vi.stubEnv("EVAL_MODEL", "changed-after-import");
      await executeCaptured(selectedCase());
      const [request] = sdk.query.mock.lastCall ?? [];
      expect(request?.options?.model).toBe(expected);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  },
);
