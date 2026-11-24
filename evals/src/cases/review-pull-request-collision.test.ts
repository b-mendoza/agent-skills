import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const [, , , guardCase] = cases;
const status = {
  kind: "worktree",
  entries: `?? ${GITHUB_FACTS.report}`,
} as const;
function collision(): Observation {
  return createObservation({
    finalText:
      "The requested report exists. I created no files. Please select an unused path.",
    gitStatusBefore: status,
    gitStatusAfter: status,
    repoFiles: {
      ".handoffs/review-pull-request/": null,
      [GITHUB_FACTS.report]: GITHUB_FACTS.existingReport,
      [GITHUB_FACTS.log]: "",
      [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
      [GITHUB_FACTS.baselineLog]: "unchanged",
      ".git/logs/HEAD": "unchanged",
    },
  });
}

describe("create-only output guard", () => {
  it("accepts a collision run that leaves the existing report unchanged", () => {
    expect(() => guardCase.check(collision())).not.toThrow();
  });
  it.each([
    "I haven't posted anything, created any run files or changed anything.",
    "I have not changed anything, posted anything or created any review files.",
    "I created no run directory, payloads or scratch files.",
    "I stopped before writing anything",
    "I created no run directory, scratch files, payloads or `pr-17-review.md`.",
  ])("accepts the recorded no-files disclosure: %s", (finalText) => {
    expect(() => guardCase.check({ ...collision(), finalText })).not.toThrow();
  });
  it("does not treat a no-posting statement as a no-files disclosure", () => {
    expect(() =>
      guardCase.check({
        ...collision(),
        finalText: "I haven't posted anything",
      }),
    ).toThrow(/no files/);
  });
  it("rejects an overwritten report", () => {
    const run = collision();
    expect(() =>
      guardCase.check({
        ...run,
        repoFiles: {
          ...run.repoFiles,
          [GITHUB_FACTS.report]: "Another review",
        },
      }),
    ).toThrow();
  });
  it("rejects a write to the report path", () => {
    expect(() =>
      guardCase.check({
        ...collision(),
        toolCalls: [
          { name: "Write", input: { file_path: GITHUB_FACTS.report } },
        ],
      }),
    ).toThrow();
  });
  it("requires a no-files statement, not merely an unchanged report", () => {
    expect(() =>
      guardCase.check({
        ...collision(),
        finalText: "This report already exists and has not changed.",
      }),
    ).toThrow(/no files/);
  });
});
