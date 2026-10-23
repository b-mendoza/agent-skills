import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, expect, test } from "vitest";

import { cases, SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { observe, VALIDATOR_CALL } from "#/cases/case-test-support.ts";

import config, { evalModel } from "../../promptfooconfig.ts";

const EVAL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = fileURLToPath(
  new URL("./entrypoint.js", import.meta.resolve("promptfoo")),
);
const TIMEOUT_MS = 30_000;
const FIRST = 0;
const MAX_CONCURRENCY = 5;
const ONE_RUN = 1;
const ROUTING_TIER = 1;
const EXIT = { PASS: 0, FAIL: 100, ERROR: 1 };
let root = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "promptfoo-offline-"));
  // Only this local provider is loaded. No scenario can call a model.
  writeFileSync(
    join(root, "provider.mjs"),
    `export default class {
    id() { return "offline"; }
    async callApi(_prompt, context) {
      const scenario = process.env.OFFLINE_SCENARIO;
      if (scenario === "provider-error") return { error: "offline provider error" };
      const observation = ${JSON.stringify(observe({ subtype: "error_max_budget_usd", isError: true }))};
      if (context.vars.caseId === "trigger-positive" && scenario !== "failure") {
        observation.toolCalls = [{ name: "Skill", input: { skill: ${JSON.stringify(SKILL)} } }];
      }
      if (context.vars.caseId === "path-error") {
        observation.finalText = "RECENT_STATE: PATH_ERROR\\nReason: missing\\nNext step: fix it";
        observation.toolCalls = [${JSON.stringify(VALIDATOR_CALL)}];
        if (scenario === "mutation") observation.toolCalls.push({ name: "Write", input: {} });
      }
      return { output: observation.finalText, metadata: {
        observation, repeatIndex: context.repeatIndex
      } };
    }
  }`,
  );
  writeFileSync(
    join(root, "promptfooconfig.mjs"),
    `import config from ${JSON.stringify(join(EVAL_ROOT, "promptfooconfig.ts"))};
    const absoluteAssert = assertion => ({ ...assertion,
      value: assertion.value.replace("file://", ${JSON.stringify(`file://${EVAL_ROOT}/`)})
    });
    export default { ...config,
      providers: [${JSON.stringify(`file://${join(root, "provider.mjs")}`)}],
      outputPath: config.outputPath.map(path => path.replace(${JSON.stringify(join(EVAL_ROOT, "outputs"))}, ${JSON.stringify(root)})),
      defaultTest: { assert: config.defaultTest.assert.map(absoluteAssert) },
      tests: config.tests.map(test => ({ ...test, assert: test.assert.map(absoluteAssert) }))
    };`,
  );
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function runOffline(args: string[], scenario: string) {
  return spawnSync(
    process.execPath,
    [CLI, "eval", "-c", join(root, "promptfooconfig.mjs"), ...args],
    {
      // Config and artifact paths must not depend on the caller's directory.
      cwd: root,
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      env: {
        ...process.env,
        IS_TESTING: "false",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        PROMPTFOO_FAILED_TEST_EXIT_CODE: undefined,
        PROMPTFOO_PASS_RATE_THRESHOLD: undefined,
        PROMPTFOO_CONFIG_DIR: join(root, "state"),
        OFFLINE_SCENARIO: scenario,
      },
    },
  );
}

function evaluateOffline(args: string[], scenario: string) {
  const runs = join(root, "runs");
  const previous = existsSync(runs) ? readdirSync(runs) : [];
  const child = runOffline(args, scenario);
  expect(child.error).toBeUndefined();
  expect(child.stderr).toBe("");
  const added = readdirSync(runs).filter((path) => !previous.includes(path));
  expect(added).toHaveLength(ONE_RUN);
  const directory = join(runs, String(added[FIRST]));
  expect(added[FIRST]).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-.+$/,
  );
  expect(existsSync(join(directory, "results.html"))).toBe(true);
  expect(existsSync(join(root, "state", "promptfoo.db"))).toBe(true);
  const exported: unknown = JSON.parse(
    readFileSync(join(directory, "results.json"), "utf8"),
  );
  return { child, exported };
}

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
  "native CLI filters tier 1 with $count repeats and no mutation metric",
  ({ args, count }) => {
    const { child, exported } = evaluateOffline(
      ["--filter-metadata", "tier=1", ...args],
      "pass",
    );
    expect(child.status).toBe(EXIT.PASS);
    const selected = cases.filter((evalCase) => evalCase.tier === ROUTING_TIER);
    expect(exported).toHaveProperty(
      "results.results.length",
      selected.length * count,
    );
    for (const { id } of selected) {
      expect(exported).toHaveProperty(
        "results.results",
        expect.arrayContaining([
          expect.objectContaining({
            success: true,
            testCase: expect.objectContaining({
              vars: { caseId: id },
              metadata: { tier: ROUTING_TIER },
            }) as unknown,
            namedScores: { [`case/${id}`]: 1 },
            gradingResult: expect.objectContaining({
              componentResults: [expect.objectContaining({ pass: true })],
            }) as unknown,
          }),
        ]),
      );
    }
  },
  TIMEOUT_MS,
);

test.each([
  {
    scenario: "pass",
    code: 0,
    pass: true,
    score: 1,
    reason: "1 behavioral run(s) left no trace",
  },
  {
    scenario: "mutation",
    code: 100,
    pass: false,
    score: 0,
    reason: "read-only contract violated:",
  },
])(
  "native CLI grades the tier-2 mutation metric: $scenario exits $code",
  ({ scenario, code, pass, score, reason }) => {
    const { child, exported } = evaluateOffline(
      [
        "--filter-metadata",
        "tier=2",
        "--filter-pattern",
        "^path-error$",
        "--repeat",
        "1",
      ],
      scenario,
    );
    expect(child.status).toBe(code);
    expect(exported).toMatchObject({
      results: {
        results: [
          {
            success: pass,
            testCase: { vars: { caseId: "path-error" }, metadata: { tier: 2 } },
            namedScores: { "case/path-error": 1, "mutation-scope": score },
            gradingResult: {
              componentResults: [
                { pass: true, reason: "PATH_ERROR, 3-line envelope" },
                { pass, score, reason },
              ],
            },
          },
        ],
      },
    });
  },
  TIMEOUT_MS,
);

test.each([
  {
    scenario: "failure",
    expected: { failureReason: 1 },
  },
  {
    scenario: "provider-error",
    expected: { failureReason: 2, error: "offline provider error" },
  },
])(
  "native CLI exits 100 for $scenario",
  ({ scenario, expected }) => {
    const { child, exported } = evaluateOffline(
      ["--filter-pattern", "^trigger-positive$", "--repeat", "1"],
      scenario,
    );
    expect(child.status).toBe(EXIT.FAIL);
    expect(exported).toMatchObject({
      results: { results: [{ success: false, ...expected }] },
    });
  },
  TIMEOUT_MS,
);

test(
  "native CLI rejects an invalid option with exit 1",
  () => {
    const child = runOffline(["--offline-invalid-option"], "pass");
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(EXIT.ERROR);
    expect(child.stderr).toContain("unknown option");
    const empty = runOffline(["--filter-pattern", "^does-not-exist$"], "pass");
    expect(empty.status).toBe(EXIT.PASS);
  },
  TIMEOUT_MS,
);
