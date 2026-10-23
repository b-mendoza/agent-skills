import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CallApiContextParams } from "promptfoo";
import { afterEach, expect, test, vi } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { grade } from "#/promptfoo/assertion.ts";
import * as caseLookup from "#/promptfoo/observation.ts";
import { decodeMetadata } from "#/promptfoo/observation.ts";
import EvalProvider from "#/promptfoo/provider.ts";

vi.mock(import("#/observation/agent-query.ts"), async (original) => ({
  ...(await original()),
  observeClaude: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

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
  vi.spyOn(caseLookup, "getCase").mockReturnValue(evalCase);
  vi.mocked(observeClaude).mockImplementation(async (options) => {
    expect(options.pathPrefix).toBe(binPath);
    expect(readFileSync(join(options.cwd, "seed.txt"), "utf8")).toBe("planted");
    for (const skill of [evalCase.skill, ...(evalCase.extraSkills ?? [])]) {
      expect(
        existsSync(join(options.cwd, ".claude", "skills", skill, "SKILL.md")),
      ).toBe(true);
    }
    writeFileSync(join(options.cwd, "report.md"), "result");
    return Promise.resolve(createObservation());
  });
  const context: CallApiContextParams = {
    vars: { caseId: evalCase.id },
    prompt: { raw: "{{caseId}}", label: "test" },
  };
  const result = await new EvalProvider().callApi("", context);
  expect(result.error).toBeUndefined();
  const metadata = decodeMetadata(result.metadata);
  expect(existsSync(repoPath)).toBe(false);
  expect(existsSync(binPath)).toBe(false);
  expect(
    await grade(result.output, { vars: context.vars, metadata }),
  ).toMatchObject({
    pass: true,
    reason: "report captured",
  });
});

test("a snapshot failure still removes the fixture", async () => {
  const existingCase = caseLookup.getCase(
    "analyzing-recent-project-state/trigger-positive",
  );
  vi.spyOn(caseLookup, "getCase").mockReturnValue({
    ...existingCase,
    snapshotPaths: ["../outside"],
  });
  let repoPath = "";
  vi.mocked(observeClaude).mockImplementation(async (options) => {
    repoPath = options.cwd;
    return Promise.resolve(createObservation());
  });
  const result = await new EvalProvider().callApi("", {
    vars: { caseId: existingCase.id },
    prompt: { raw: "", label: "offline" },
  });
  expect(result.error).toContain("repo-relative");
  expect(repoPath).not.toBe("");
  expect(existsSync(repoPath)).toBe(false);
});
