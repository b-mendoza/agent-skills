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

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { BEHAVIORAL_TIER, ROUTING_TIER } from "#/cases/case-contract.ts";
import { cases } from "#/cases/registry.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { getCase } from "#/promptfoo/observation.ts";

import config from "../../promptfooconfig.ts";

const EVAL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CLI = fileURLToPath(
  new URL("./entrypoint.js", import.meta.resolve("promptfoo")),
);
const TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 5;
const ONE_RUN = 1;
const EXIT = { PASS: 0, FAIL: 100 };
const BEHAVIORAL_CASE_ID = "diagnosing-root-causes/missing-resources";
let root = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "promptfoo-offline-"));
  writeFileSync(
    join(root, "provider.mjs"),
    `export default class {
    id() { return "offline"; }
    async callApi(_prompt, context) {
      const scenario = process.env.OFFLINE_SCENARIO;
      if (scenario === "provider-error") return { error: "offline provider error" };
      const observation = ${JSON.stringify(createObservation({ subtype: "error_max_budget_usd", isError: true }))};
      if (context.vars.caseId.endsWith("/trigger-positive")) {
        const [skill] = context.vars.caseId.split("/");
        observation.toolCalls = [{ name: "Skill", input: { skill } }];
      }
      if (context.vars.caseId === ${JSON.stringify(BEHAVIORAL_CASE_ID)}) {
        observation.finalText = "Please provide logs and reproduction steps.";
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
  // A fake provider does not prevent assertions from invoking a paid judge.
  for (const evalCase of [
    ...cases.filter((entry) => entry.tier === ROUTING_TIER),
    getCase(BEHAVIORAL_CASE_ID),
  ]) {
    expect(evalCase, `Offline case ${evalCase.id}`).not.toHaveProperty("judge");
  }
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
  const added = readdirSync(runs).filter((path) => !previous.includes(path));
  expect(added).toHaveLength(ONE_RUN);
  const [run] = added;
  const directory = join(runs, String(run));
  expect(readFileSync(join(directory, "results.html"), "utf8")).not.toBe("");
  const exported: unknown = JSON.parse(
    readFileSync(join(directory, "results.json"), "utf8"),
  );
  return { child, exported };
}

test(
  "native CLI filters tier 1 with default repeats, routing metrics and capped concurrency",
  () => {
    expect(config.evaluateOptions.maxConcurrency).toBe(MAX_CONCURRENCY);
    const { child, exported } = evaluateOffline(
      ["--filter-metadata", `tier=${String(ROUTING_TIER)}`],
      "pass",
    );
    expect(child.status).toBe(EXIT.PASS);
    const selected = cases.filter((evalCase) => evalCase.tier === ROUTING_TIER);
    expect(exported).toHaveProperty(
      "results.results.length",
      selected.length * config.evaluateOptions.repeat,
    );
    for (const { id } of selected) {
      expect(exported).toHaveProperty(
        "results.results",
        expect.arrayContaining([
          expect.objectContaining({
            success: true,
            namedScores: { [`case/${id}`]: 1 },
          }),
        ]),
      );
    }
  },
  TIMEOUT_MS,
);

test.each([
  { scenario: "pass", code: 0, pass: true, score: 1 },
  { scenario: "mutation", code: 100, pass: false, score: 0 },
])(
  "native CLI grades the tier-2 mutation metric: $scenario exits $code",
  ({ scenario, code, pass, score }) => {
    const { child, exported } = evaluateOffline(
      [
        "--filter-metadata",
        `tier=${String(BEHAVIORAL_TIER)}`,
        "--filter-pattern",
        `^${BEHAVIORAL_CASE_ID}$`,
        "--repeat",
        "1",
      ],
      scenario,
    );
    expect(child.status).toBe(code);
    expect(exported).toHaveProperty("results.results.length", ONE_RUN);
    expect(exported).toHaveProperty(
      "results.results",
      expect.arrayContaining([
        expect.objectContaining({
          success: pass,
          namedScores: {
            [`case/${BEHAVIORAL_CASE_ID}`]: score,
            "mutation-scope": score,
          },
        }),
      ]),
    );
  },
  TIMEOUT_MS,
);

test(
  "native CLI exports a provider error as a failed run",
  () => {
    const { child, exported } = evaluateOffline(
      [
        "--filter-pattern",
        "^analyzing-recent-project-state/trigger-positive$",
        "--repeat",
        "1",
      ],
      "provider-error",
    );
    expect(child.status).toBe(EXIT.FAIL);
    expect(exported).toHaveProperty(
      "results.results",
      expect.arrayContaining([
        expect.objectContaining({
          success: false,
          error: "offline provider error",
        }),
      ]),
    );
  },
  TIMEOUT_MS,
);

test(
  "native CLI filters by skill metadata",
  () => {
    const { child, exported } = evaluateOffline(
      [
        "--filter-metadata",
        `skill=${SKILL}`,
        "--filter-pattern",
        `^${SKILL}/trigger-positive$`,
        "--repeat",
        "1",
      ],
      "pass",
    );
    expect(child.status).toBe(EXIT.PASS);
    expect(exported).toHaveProperty("results.results.length", ONE_RUN);
  },
  TIMEOUT_MS,
);
