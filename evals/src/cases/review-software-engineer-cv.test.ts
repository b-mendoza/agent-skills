import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { cases } from "#/cases/review-software-engineer-cv.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const skill = "review-software-engineer-cv";
const review = `## Partial Output Note
Employment after 2023 is missing; no Go, Kubernetes, on-call ownership, or measured latency results are evidenced.
## Executive Summary
TypeScript and PostgreSQL are supported, production Go is not.
## Role Target Profile
The posting requires Go, PostgreSQL, Kubernetes and on-call ownership.
## CV To Job Match Matrix
| Job requirement | Evidence in current CV | Match strength | Recommended action | Integrity risk |
| --- | --- | --- | --- | --- |
| PostgreSQL | Query fixes | Partial | Clarify scope | Low |
| Go | None | Missing | Ask about experience | High |
## Highest-Impact CV Updates
Clarify the PostgreSQL work. Evidence: Supported.
## Suggested Rewrites
Original: Fixed PostgreSQL queries in the billing service.
Improved: Fixed PostgreSQL queries supporting the billing service.
Evidence: Supported
Verify: No verification needed
Why stronger: Names a backend contribution without inventing scale.
## Skills Section Guidance
Keep TypeScript and PostgreSQL. Do not add Go or Kubernetes without evidence.
## Applicant Questions
What have you worked on after 2023? Any production Go or on-call experience?
## Realism And Interview Defensibility Check
No invented metrics, leadership, or tooling.
## Final Tailoring Checklist
Confirm missing employment and actual backend scope before submitting.`;
const blockedText =
  "Please provide the job posting or paste the job description so I can review the CV against it?";

function getCase(suffix: string): EvalCase {
  const evalCase = cases.find(
    (candidate) => candidate.id === `${skill}/${suffix}`,
  );
  assert.ok(evalCase !== undefined, `Missing eval case: ${suffix}`);
  return evalCase;
}

function behavioralObservation(suffix: string, finalText: string): Observation {
  const evalCase = getCase(suffix);
  const fixture = makeFixture("clean", [], evalCase.seed);
  try {
    return createObservation({
      finalText,
      repoFiles: snapshotRepoFiles(fixture.cwd, evalCase.snapshotPaths ?? []),
    });
  } finally {
    fixture.cleanup();
  }
}

describe("review-software-engineer-cv routing", () => {
  test("requires invocation when comparing a CV with a role", () => {
    const evalCase = getCase("trigger-positive");
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).not.toThrow();
    expect(() => evalCase.check(createObservation())).toThrow();
  });

  test("leaves prompt conversion to prompt-structurer", () => {
    const evalCase = getCase("trigger-negative-prompt-contract");
    expect(() => evalCase.check(createObservation())).not.toThrow();
    expect(() =>
      evalCase.check(
        createObservation({ toolCalls: [{ name: "Skill", input: { skill } }] }),
      ),
    ).toThrow();
  });
});

describe("review-software-engineer-cv behavior", () => {
  test("seeds an incomplete CV and a demanding backend posting", () => {
    const fixture = makeFixture(
      "clean",
      [],
      getCase("review-planted-gaps").seed,
    );
    try {
      expect(readFileSync(join(fixture.cwd, "cv.txt"), "utf8")).toContain(
        "after 2023",
      );
      expect(
        readFileSync(join(fixture.cwd, "job-posting.txt"), "utf8"),
      ).toContain("Kubernetes");
    } finally {
      fixture.cleanup();
    }
  });

  test("accepts a partial review with supported rewrites and explicit gaps", () => {
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", review),
      ),
    ).not.toThrow();
  });

  test.each([
    [
      "a missing report section",
      review.replace("## Applicant Questions", "## Other"),
    ],
    [
      "a hidden source limitation",
      review.replace("## Partial Output Note", "## Other"),
    ],
    [
      "an unlabeled rewrite",
      review.replace("Evidence: Supported\nVerify:", "Verify:"),
    ],
    [
      "an invalid evidence label",
      review.replace(
        "Evidence: Supported\nVerify:",
        "Evidence: Probably\nVerify:",
      ),
    ],
    [
      "no verification field",
      review.replace("Verify: No verification needed", "Unchecked"),
    ],
    ["no actual rewrite", review.replace("Improved:", "Suggestion:")],
    ["an internal status leak", `${review}\nCV_REVIEW: PASS`],
  ])("rejects %s", (_label, finalText) => {
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", finalText),
      ),
    ).toThrow();
  });

  test("asks for the absent job posting without generating a review", () => {
    expect(() =>
      getCase("missing-job-posting").check(
        behavioralObservation("missing-job-posting", blockedText),
      ),
    ).not.toThrow();
  });

  test.each([
    ["generic advice without asking", "You should strengthen your CV."],
    ["the wrong missing source", "Please provide your CV?"],
    ["a completed review after the question", `${blockedText}\n${review}`],
  ])("rejects %s at intake", (_label, finalText) => {
    expect(() =>
      getCase("missing-job-posting").check(
        behavioralObservation("missing-job-posting", finalText),
      ),
    ).toThrow();
  });

  test.each([
    ["review-planted-gaps", review],
    ["missing-job-posting", blockedText],
  ])("%s protects source files and rejects mutations", (suffix, finalText) => {
    const evalCase = getCase(suffix);
    const observation = behavioralObservation(suffix, finalText);
    expect(() =>
      evalCase.check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          "cv.txt": "invented experience",
        },
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        toolCalls: [
          {
            name: "Edit",
            input: { file_path: "cv.txt", old_string: "x", new_string: "y" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      evalCase.check({
        ...observation,
        gitStatusAfter: { kind: "worktree", entries: "?? rewritten-cv.txt" },
      }),
    ).toThrow();
    expect(() => evalCase.check({ ...observation, timedOut: true })).toThrow();
  });
});

describe("CV review evidence boundaries", () => {
  test("each rewrite needs its own label, not a label on an earlier rewrite", () => {
    const invalid = review.replace(
      "## Skills Section Guidance",
      "Original: Added invented Go work.\nImproved: Led Go services.\nVerify: Ask the applicant.\n## Skills Section Guidance",
    );
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", invalid),
      ),
    ).toThrow();
  });

  test("requires the full match matrix contract", () => {
    const invalid = review.replace(
      "| Job requirement | Evidence in current CV | Match strength | Recommended action | Integrity risk |",
      "| Requirement | Claim |",
    );
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", invalid),
      ),
    ).toThrow();
  });

  test("protects the supplied posting and refuses a fabricated missing posting", () => {
    const observation = behavioralObservation("review-planted-gaps", review);
    expect(() =>
      getCase("review-planted-gaps").check({
        ...observation,
        repoFiles: { ...observation.repoFiles, "job-posting.txt": "changed" },
      }),
    ).toThrow();
    const missingJob = behavioralObservation(
      "missing-job-posting",
      blockedText,
    );
    expect(() =>
      getCase("missing-job-posting").check({
        ...missingJob,
        repoFiles: {
          ...missingJob.repoFiles,
          "job-posting.txt": "invented posting",
        },
      }),
    ).toThrow();
  });
});

test("CV field labels may use ordinary Markdown emphasis", () => {
  const emphasized = review
    .replace("Improved:", "**Improved:**")
    .replace(
      "Evidence: Supported\nVerify:",
      "**Evidence:** `Supported`\n**Verify:**",
    );
  expect(() =>
    getCase("review-planted-gaps").check(
      behavioralObservation("review-planted-gaps", emphasized),
    ),
  ).not.toThrow();
});
