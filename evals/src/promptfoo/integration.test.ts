import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { observe } from "#/cases/case-test-support.ts";

import config, { evalModel } from "../../promptfooconfig.ts";
import { readResults } from "./results.ts";

const EVAL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = fileURLToPath(
  new URL("./entrypoint.js", import.meta.resolve("promptfoo")),
);
const TIMEOUT_MS = 30_000;
const SUCCESS = 0;
const FIRST = 0;
const MAX_CONCURRENCY = 5;

test("caps concurrent attempts at five and labels cases without changing the dataset", () => {
  expect(config.evaluateOptions.maxConcurrency).toBe(MAX_CONCURRENCY);
  expect(config.defaultTest.assert).toEqual([
    expect.objectContaining({ metric: "case/{{caseId}}" }),
  ]);
  expect(config.description).toBe(`Agent skills evals (${evalModel})`);
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
          tests: config.tests,
          defaultTest: {
            assert: [
              {
                ...config.defaultTest.assert[FIRST],
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
          "--no-share",
          "--filter-metadata",
          "tier=1",
          "--filter-pattern",
          "^trigger-positive$",
          "-o",
          output,
          "-o",
          join(root, "results.html"),
          ...args,
        ],
        {
          cwd: EVAL_ROOT,
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          env: {
            ...process.env,
            IS_TESTING: "false",
            PROMPTFOO_DISABLE_TELEMETRY: "1",
            PROMPTFOO_CONFIG_DIR: join(root, "state"),
          },
        },
      );
      expect(child.stderr).toBe("");
      expect(child.status).toBe(SUCCESS);
      expect(existsSync(join(root, "results.html"))).toBe(true);
      expect(existsSync(join(root, "state", "promptfoo.db"))).toBe(true);
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
