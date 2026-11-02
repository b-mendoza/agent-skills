import { describe, expect, test } from "vitest";

import { getCase as getRegisteredCase } from "#/cases/registry.ts";
import { CV_FACTS } from "#/cases/review-software-engineer-cv.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

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
  "Please provide the job posting or paste the job description so I can review the CV against it.";

function getCase(suffix: string) {
  return getRegisteredCase(`${skill}/${suffix}`);
}

function capturedSources(suffix: string) {
  return {
    [CV_FACTS.cvPath]: CV_FACTS.cv,
    [CV_FACTS.jobPath]: suffix === "missing-job-posting" ? null : CV_FACTS.job,
  };
}

function behavioralObservation(suffix: string, finalText: string): Observation {
  return createObservation({ finalText, repoFiles: capturedSources(suffix) });
}

describe("review-software-engineer-cv behavior", () => {
  test("accepts a partial review with supported rewrites and explicit gaps", () => {
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", review),
      ),
    ).not.toThrow();
  });

  test.each([
    [
      "a concise match heading",
      review.replace("| Match strength |", "| Match |"),
    ],
    [
      "label explanation",
      review.replace(
        "Evidence: Supported\nVerify:",
        "Evidence: `Supported`, limited to the documented 2021-2023 work.\nVerify:",
      ),
    ],
  ])("accepts %s", (_label, finalText) => {
    expect(() =>
      getCase("review-planted-gaps").check(
        behavioralObservation("review-planted-gaps", finalText),
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
    [
      "a label borrowed from a later section",
      review
        .replace("Evidence: Supported\nVerify:", "Verify:")
        .replace(
          "## Skills Section Guidance",
          "## Skills Section Guidance\nEvidence: Supported",
        ),
    ],
    ["an internal status leak", `${review}\nCV_REVIEW: PASS`],
    [
      "a second evidence label",
      review.replace(
        "Evidence: Supported\nVerify:",
        "Evidence: Supported and Likely but unconfirmed\nVerify:",
      ),
    ],
    [
      "an unlabelled safe-now rewrite",
      review
        .replace("Improved:", "Improved (safe now):")
        .replace("Evidence: Supported\nVerify:", "Verify:"),
    ],
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
    ["the wrong missing source", "Please provide your CV?"],
    ["a leaked phase status", `SOURCE_INTAKE: BLOCKED\n${blockedText}`],
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
