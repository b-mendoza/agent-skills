import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import type { CallApiContextParams } from "promptfoo";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import type { EvalCase } from "#/cases/case-contract.ts";
import {
  FULL_REPORT_SNAPSHOT,
  VALIDATOR_CALL,
} from "#/cases/case-test-support.ts";
import * as caseLookup from "#/cases/registry.ts";
import { getCase } from "#/cases/registry.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

import { evalModel } from "../../promptfooconfig.ts";
import {
  decodeMetadata,
  grade,
  MAX_OBSERVED_CHARS,
  mutationScope,
} from "./assertion.ts";
import EvalProvider from "./provider.ts";

vi.mock(import("#/observation/agent-query.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  observeClaude: vi.fn(),
}));

const context: CallApiContextParams = {
  vars: { caseId: "analyzing-recent-project-state/trigger-positive" },
  prompt: { raw: "{{caseId}}", label: "pilot" },
};

beforeEach(() => {
  vi.mocked(observeClaude).mockReset();
});

describe("eval provider", () => {
  test("provider installs the case's skills, seeds its repo, prefixes PATH, and captures files before cleanup", async () => {
    let repoPath = "";
    let binPath = "";
    const evalCase: EvalCase = {
      id: "review-pull-request/writes-report",
      skill: "review-pull-request",
      extraSkills: ["analyzing-recent-project-state"],
      tier: 2,
      mutationPolicy: "allowed",
      fixture: "clean",
      intent: "Offline provider contract",
      seed: (context) => {
        ({ repoPath, binPath } = context);
        writeFileSync(join(repoPath, "seed.txt"), "planted");
        writeFileSync(join(binPath, "gh"), "#!/bin/sh\nexit 0\n", {
          mode: 0o755,
        });
      },
      snapshotPaths: ["report.md", "deleted.txt"],
      prompt: () => "Write a report",
      budgetUsd: 1,
      wallClockMs: 1000,
      check: (observation) => {
        expect(existsSync(repoPath)).toBe(false);
        expect(observation.repoFiles).toEqual({
          "report.md": "result",
          "deleted.txt": null,
        });
        return "report captured";
      },
    };
    const observation = createObservation({
      subtype: "error_max_budget_usd",
      isError: true,
      finalText: "budget reached",
      costUsd: 0.06,
    });
    vi.spyOn(caseLookup, "getCase").mockReturnValue(evalCase);
    vi.mocked(observeClaude).mockImplementation(async (options) => {
      expect(options.pathPrefix).toBe(binPath);
      expect(readFileSync(join(options.cwd, "seed.txt"), "utf8")).toBe(
        "planted",
      );
      for (const skill of [evalCase.skill, ...(evalCase.extraSkills ?? [])]) {
        expect(
          existsSync(join(options.cwd, ".claude", "skills", skill, "SKILL.md")),
        ).toBe(true);
      }
      writeFileSync(join(options.cwd, "report.md"), "result");
      return Promise.resolve(observation);
    });
    const seededContext: CallApiContextParams = {
      vars: { caseId: evalCase.id },
      prompt: { raw: "{{caseId}}", label: "test" },
    };
    const provider = new EvalProvider();
    expect(provider.handlesOwnRetries).toBe(true);
    const result = await provider.callApi("ignored", seededContext);
    expect(result).toMatchObject({
      output: observation.finalText,
      cost: observation.costUsd,
    });
    expect(observeClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: repoPath,
        gitRepo: repoPath,
        prompt: evalCase.prompt({ missingPath: "", notGitPath: "" }),
        budgetUsd: evalCase.budgetUsd,
        model: evalModel,
        wallClockMs: evalCase.wallClockMs,
      }),
    );
    expect(result.error).toBeUndefined();
    const metadata = decodeMetadata(result.metadata);
    expect(metadata).toMatchObject({ repeatIndex: 0 });
    expect(existsSync(repoPath)).toBe(false);
    expect(existsSync(binPath)).toBe(false);
    expect(
      await grade(result.output, { vars: seededContext.vars, metadata }),
    ).toMatchObject({
      pass: true,
      reason: "report captured",
    });
  });

  test("a snapshot failure retains the completed observation and cost, then removes the fixture", async () => {
    const existingCase = caseLookup.getCase(
      "analyzing-recent-project-state/trigger-positive",
    );
    vi.spyOn(caseLookup, "getCase").mockReturnValue({
      ...existingCase,
      snapshotPaths: ["../outside"],
    });
    const observation = createObservation({
      finalText: "Report complete",
      toolCalls: [{ name: "Write", input: { file_path: "report.md" } }],
      gitStatusBefore: { kind: "worktree", entries: "" },
      gitStatusAfter: { kind: "worktree", entries: "?? report.md\n" },
      costUsd: 0.06,
      durationMs: 1250,
    });
    let repoPath = "";
    vi.mocked(observeClaude).mockImplementation(async (options) => {
      repoPath = options.cwd;
      return Promise.resolve(observation);
    });
    const result = await new EvalProvider().callApi("", {
      vars: { caseId: existingCase.id },
      prompt: { raw: "", label: "offline" },
      repeatIndex: 2,
    });
    expect(result.error).toContain("repo-relative");
    expect(repoPath).not.toBe("");
    expect(existsSync(repoPath)).toBe(false);
    expect(result).toMatchObject({ output: "Report complete", cost: 0.06 });
    expect(decodeMetadata(result.metadata)).toStrictEqual({
      observation,
      repeatIndex: 2,
    });
  });

  test("reports runner failure and removes the fixture", async () => {
    let fixturePath = "";
    vi.mocked(observeClaude).mockImplementation(async (options) => {
      fixturePath = options.cwd;
      return Promise.reject(new Error("SDK failed"));
    });
    expect(await new EvalProvider().callApi("", context)).toMatchObject({
      error: "SDK failed",
    });
    expect(fixturePath).not.toBe("");
    expect(existsSync(fixturePath)).toBe(false);
  });

  test("rejects an unknown case before starting the runner", async () => {
    const result = await new EvalProvider().callApi("", {
      ...context,
      vars: { caseId: "unknown" },
    });
    expect(result.error).toContain("Unknown caseId");
    expect(observeClaude).not.toHaveBeenCalled();
  });

  test("records repeat indexes and isolates concurrent fixtures", async () => {
    const paths: string[] = [];
    vi.mocked(observeClaude).mockImplementation(async (options) => {
      paths.push(options.cwd);
      return Promise.resolve(createObservation());
    });
    const firstRepeat = 0;
    const secondRepeat = 1;
    const repeatIndexes = [firstRepeat, secondRepeat];
    const results = await Promise.all(
      repeatIndexes.map(async (repeatIndex) =>
        new EvalProvider().callApi("", { ...context, repeatIndex }),
      ),
    );
    expect(new Set(paths).size).toBe(repeatIndexes.length);
    expect(paths.every((path) => !existsSync(path))).toBe(true);
    expect(
      results.map((result) => Number(result.metadata?.["repeatIndex"])),
    ).toEqual(repeatIndexes);
  });
});

describe("eval assertion", () => {
  test.each([
    {
      toolCalls: [{ name: "Skill", input: { skill: SKILL } }],
      pass: true,
      score: 1,
      reason: "Skill invoked",
    },
    { toolCalls: [], pass: false, score: 0, reason: "skill never triggered" },
  ])(
    "grades observed routing evidence despite a budget stop: $pass",
    async ({ toolCalls, pass, score, reason }) => {
      const result = await grade("", {
        vars: context.vars,
        metadata: {
          observation: createObservation({
            subtype: "error_max_budget_usd",
            isError: true,
            toolCalls,
          }),
          repeatIndex: 0,
        },
      });
      expect(result).toMatchObject({ pass, score });
      expect(result.reason).toContain(reason);
    },
  );

  test("reports only the bounded first line of a check failure", async () => {
    vi.spyOn(
      getCase("analyzing-recent-project-state/trigger-positive"),
      "check",
    ).mockImplementation(() => {
      throw new Error(`${"x".repeat(MAX_OBSERVED_CHARS)}x\nsecond line`);
    });
    expect(
      await grade("", {
        vars: context.vars,
        metadata: { observation: createObservation(), repeatIndex: 0 },
      }),
    ).toStrictEqual({
      pass: false,
      score: 0,
      reason: "x".repeat(MAX_OBSERVED_CHARS),
    });
  });

  test.each([
    { value: "bare string", reason: "judge: bare string" },
    {
      value: {
        toString: () => {
          throw new Error("cannot stringify");
        },
      },
      reason: "judge: An unknown error occurred",
    },
  ])(
    "normalizes foreign judge failures: $reason",
    async ({ value, reason }) => {
      vi.spyOn(
        getCase("analyzing-recent-project-state/snapshot-dirty"),
        "judge",
      ).mockRejectedValue(value);
      expect(
        await grade("", {
          vars: { caseId: "analyzing-recent-project-state/snapshot-dirty" },
          metadata: {
            observation: createObservation({
              finalText: FULL_REPORT_SNAPSHOT,
              toolCalls: [VALIDATOR_CALL],
            }),
            repeatIndex: 0,
          },
        }),
      ).toStrictEqual({ pass: false, score: 0, reason });
    },
  );

  test("calls the judge only after the real mechanical check passes and appends its verdict", async () => {
    const judge = vi
      .spyOn(getCase("analyzing-recent-project-state/snapshot-dirty"), "judge")
      .mockResolvedValue("judge accepted");
    const observation = createObservation({
      finalText: "bad",
      toolCalls: [VALIDATOR_CALL],
    });
    const assertionContext = {
      vars: { caseId: "analyzing-recent-project-state/snapshot-dirty" },
      metadata: { observation, repeatIndex: 0 },
    };
    expect(await grade("", assertionContext)).toMatchObject({ pass: false });
    expect(judge).not.toHaveBeenCalled();

    observation.finalText = FULL_REPORT_SNAPSHOT;
    expect(await grade("", assertionContext)).toStrictEqual({
      pass: true,
      score: 1,
      reason: "full report; disclosures present; judge accepted",
    });
    expect(judge).toHaveBeenCalledWith(observation);
  });

  test.each([
    { message: "ECONNRESET", reason: "judge: ECONNRESET" },
    {
      message: "judge: planted-facts violated -- missing fact",
      reason: "judge: planted-facts violated -- missing fact",
    },
  ])(
    "judge failures name the judge without duplicate prefixes: $message",
    async ({ message, reason }) => {
      vi.spyOn(
        getCase("analyzing-recent-project-state/snapshot-dirty"),
        "judge",
      ).mockRejectedValue(new Error(message));
      expect(
        await grade("", {
          vars: { caseId: "analyzing-recent-project-state/snapshot-dirty" },
          metadata: {
            observation: createObservation({
              finalText: FULL_REPORT_SNAPSHOT,
              toolCalls: [VALIDATOR_CALL],
            }),
            repeatIndex: 0,
          },
        }),
      ).toStrictEqual({ pass: false, score: 0, reason });
    },
  );

  const malformedMetadata = [
    { name: "missing metadata", metadata: undefined },
    {
      name: "incomplete observation",
      metadata: { observation: { finalText: "" }, repeatIndex: 0 },
    },
    {
      name: "invalid git-status tag",
      metadata: {
        observation: {
          ...createObservation(),
          gitStatusAfter: { kind: "invalid" },
        },
        repeatIndex: 0,
      },
    },
  ];

  test.each(malformedMetadata)(
    "grade rejects $name with a decoding error",
    async ({ metadata }) => {
      await expect(grade("", { vars: context.vars, metadata })).rejects.toThrow(
        Schema.SchemaError,
      );
    },
  );

  test("mutationScope rejects missing metadata with a decoding error", () => {
    expect(() => mutationScope("", { vars: context.vars })).toThrow(
      Schema.SchemaError,
    );
  });
});
