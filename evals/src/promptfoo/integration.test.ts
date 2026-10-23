import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { observe } from "#/cases/case-test-support.ts";

import config from "../../promptfooconfig.ts";
import { readResults } from "./results.ts";

const EVAL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = fileURLToPath(
  new URL("./entrypoint.js", import.meta.resolve("promptfoo")),
);
const TIMEOUT_MS = 30_000;
const SUCCESS = 0;
const FIRST = 0;

test("default concurrency uses the machine's available parallelism", () => {
  expect(config.evaluateOptions.maxConcurrency).toBe(availableParallelism());
});

test.each([
  { args: [], count: 5 },
  { args: ["--repeat", "1", "-j", "2"], count: 1 },
])(
  "real promptfoo uses $count repeats and preserves canonical assertion output offline",
  ({ args, count }) => {
    const root = mkdtempSync(join(tmpdir(), "promptfoo-offline-"));
    try {
      const provider = join(root, "provider.mjs");
      const configPath = join(root, "promptfooconfig.json");
      const output = join(root, "results.json");
      const observation = observe({
        subtype: "error_max_budget_usd",
        isError: true,
        toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
      });
      // The only provider in this config is a local value, never a model call.
      writeFileSync(
        provider,
        `export default class {
      id() { return "offline"; }
      async callApi(_prompt, context) {
        return { output: "offline", metadata: {
          observation: ${JSON.stringify(observation)}, repeatIndex: context.repeatIndex
        } };
      }
    }`,
      );
      writeFileSync(
        configPath,
        JSON.stringify({
          prompts: config.prompts,
          evaluateOptions: config.evaluateOptions,
          providers: [`file://${provider}`],
          tests: `file://${join(EVAL_ROOT, "src/promptfoo/tests.ts")}`,
          defaultTest: {
            assert: [
              {
                type: "javascript",
                value: `file://${join(EVAL_ROOT, "src/promptfoo/assertion.ts")}`,
              },
            ],
          },
        }),
      );
      const child = spawnSync(
        process.execPath,
        [
          CLI,
          "eval",
          "-c",
          configPath,
          "--no-cache",
          "--no-write",
          "--no-share",
          "--filter-metadata",
          "tier=1",
          "--filter-pattern",
          "^trigger-positive$",
          "-o",
          output,
          ...args,
        ],
        {
          cwd: EVAL_ROOT,
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          env: {
            ...process.env,
            IS_TESTING: "true",
            PROMPTFOO_DISABLE_TELEMETRY: "1",
          },
        },
      );
      expect(child.stderr).toBe("");
      expect(child.status).toBe(SUCCESS);
      const exported: unknown = JSON.parse(readFileSync(output, "utf8"));
      expect(readResults(exported)[FIRST]).toMatchObject({
        id: "trigger-positive",
        status: "PASS",
        attemptsRun: count,
        attemptsPassed: count,
        observed: "Skill invoked",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  TIMEOUT_MS,
);
