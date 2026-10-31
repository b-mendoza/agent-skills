import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EvalCase, SeedContext } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER, routingDefaults } from "#/cases/case-contract.ts";
import {
  assertFileAbsent,
  assertFileExists,
  assertNoMutation,
  assertNoPublicStatusLine,
  checkNegativeRouting,
  checkPositiveRouting,
  normalizeReplyText,
  replyAsksFor,
} from "#/cases/shared-checks.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { judgeLive } from "#/observation/judge.ts";

export const CV_FACTS = {
  cvPath: "cv.txt",
  jobPath: "job-posting.txt",
  cv: `Alex River
Software engineer
2021-2023: Software Engineer, Cedar Apps
Built React components and TypeScript forms for an internal billing dashboard.
Fixed PostgreSQL queries in the billing service.
Wrote unit tests and collaborated with two other engineers.
Skills: TypeScript, React, PostgreSQL, Git.
Source limitation: employment history after 2023 is missing from this export.
No metrics, production Go, Kubernetes, on-call ownership, or technical leadership are documented.
`,
  job: `Backend Software Engineer, Harbor Tools
Must have production Go experience, PostgreSQL query tuning, Kubernetes operations, and ownership of an on-call rotation.
Responsibilities: build backend APIs, investigate latency regressions, and support service reliability.
TypeScript familiarity is a nice-to-have. Provide evidence of measured performance improvements when available.
`,
} as const;

const SKILL = "review-software-engineer-cv";
const NO_REWRITES = 0;
const REQUIRED_EVIDENCE_LABELS = 1;
const REVIEW_HEADINGS = [
  "Partial Output Note",
  "Executive Summary",
  "Role Target Profile",
  "CV To Job Match Matrix",
  "Highest-Impact CV Updates",
  "Suggested Rewrites",
  "Skills Section Guidance",
  "Applicant Questions",
  "Realism And Interview Defensibility Check",
  "Final Tailoring Checklist",
] as const;
const behavioralDefaults = {
  tier: BEHAVIORAL_TIER,
  fixture: "clean",
  mutationPolicy: "read-only",
  budgetUsd: 2.0,
  wallClockMs: 600_000,
  snapshotPaths: [CV_FACTS.cvPath, CV_FACTS.jobPath],
} as const;

function seedSources({ repoPath }: SeedContext, includeJob = true): void {
  writeFileSync(join(repoPath, CV_FACTS.cvPath), CV_FACTS.cv);
  const paths: string[] = [CV_FACTS.cvPath];
  if (includeJob) {
    writeFileSync(join(repoPath, CV_FACTS.jobPath), CV_FACTS.job);
    paths.push(CV_FACTS.jobPath);
  }
  execFileSync("git", ["add", "--", ...paths], { cwd: repoPath });
  execFileSync("git", ["commit", "-qm", "seed candidate sources"], {
    cwd: repoPath,
  });
}

function assertCandidateUnchanged(observation: Observation): void {
  assertNoMutation(observation);
  assertNoPublicStatusLine(
    observation.finalText,
    "SOURCE_INTAKE",
    "ROLE_FIT",
    "TAILORING_DRAFT",
    "CV_REVIEW",
  );
  assertFileExists(observation, CV_FACTS.cvPath);
  assert.equal(
    observation.repoFiles?.[CV_FACTS.cvPath],
    CV_FACTS.cv,
    "CV source was changed",
  );
}

function assertLabeledRewrite(rewrite: string): void {
  const evidenceLine = /^Evidence:[^\n]+/m.exec(rewrite);
  assert.ok(evidenceLine !== null, "rewrite lacks an evidence label");
  const [evidence] = evidenceLine;
  assert.match(
    evidence,
    /^Evidence:\s*(?:Supported|Likely but unconfirmed|Unsupported until verified)\b/i,
    "rewrite lacks a valid evidence label",
  );
  assert.equal(
    [
      ...evidence.matchAll(
        /\b(?:Supported|Likely but unconfirmed|Unsupported until verified)\b/gi,
      ),
    ].length,
    REQUIRED_EVIDENCE_LABELS,
    "rewrite must carry exactly one evidence label",
  );
  assert.match(
    rewrite,
    /^Verify:\s*\S.+$/m,
    "rewrite lacks verification guidance",
  );
}

function checkReview(observation: Observation): string {
  assertCandidateUnchanged(observation);
  assertFileExists(observation, CV_FACTS.jobPath);
  assert.equal(
    observation.repoFiles?.[CV_FACTS.jobPath],
    CV_FACTS.job,
    "job posting was changed",
  );
  const text = normalizeReplyText(observation.finalText);
  for (const heading of REVIEW_HEADINGS) {
    assert.match(
      text,
      new RegExp(`^(?:\\d+[.)]\\s+)?${heading}\\s*$`, "im"),
      `missing review section: ${heading}`,
    );
  }
  assert.match(
    text,
    /\|\s*Job requirement\s*\|\s*Evidence in current CV\s*\|\s*Match(?: strength)?\s*\|\s*Recommended action\s*\|\s*Integrity risk\s*\|/i,
    "missing role-fit matrix columns",
  );
  const rewrites = [
    ...text.matchAll(
      /^Improved(?: \([^\n)]*\))?:[^\n]*(?:\n(?!Original:|Improved\b|Skills Section Guidance).*)*/gm,
    ),
  ];
  assert.ok(
    rewrites.length > NO_REWRITES,
    "review must include a suggested rewrite",
  );
  for (const [rewrite] of rewrites) {
    assertLabeledRewrite(rewrite);
  }
  return "partial role-specific review with evidence-labeled rewrites and unchanged inputs";
}

function checkMissingJob(observation: Observation): string {
  assertCandidateUnchanged(observation);
  assertFileAbsent(observation, CV_FACTS.jobPath);
  assert.ok(
    replyAsksFor(
      observation.finalText,
      /job posting|job description|JOB_POSTING/i,
    ),
    "missing request for the job posting",
  );
  assert.doesNotMatch(
    normalizeReplyText(observation.finalText),
    /^(?:Executive Summary|Suggested Rewrites|Submission Checklist|Rewritten Summary)\s*$/im,
    "generated deliverable without the required job source",
  );
  return "asks for the job posting and stops without a review";
}

export const cases = [
  {
    id: "review-software-engineer-cv/trigger-positive",
    ...routingDefaults,
    skill: SKILL,
    intent: "A CV-versus-job tailoring request triggers the review skill",
    prompt: () =>
      "Review my software engineer CV against this backend job posting. Tell me which requirements lack evidence and suggest truthful bullet rewrites I can defend in an interview.",
    check: (observation) => checkPositiveRouting(observation, SKILL),
  },
  {
    // prompt-structurer owns turning recruiter instructions into XML contracts.
    id: "review-software-engineer-cv/trigger-negative-prompt-contract",
    ...routingDefaults,
    skill: SKILL,
    extraSkills: ["prompt-structurer"],
    intent: "Structuring a recruiter email prompt is not a candidate CV review",
    prompt: () =>
      "Convert these prose instructions into a compact XML prompt contract: summarize each recruiter email in two bullets and preserve the sender's name. Do not execute the prompt or review a candidate.",
    check: (observation) => checkNegativeRouting(observation, SKILL),
  },
  {
    id: "review-software-engineer-cv/review-planted-gaps",
    ...behavioralDefaults,
    skill: SKILL,
    intent:
      "A partial CV yields a candid role-fit review rather than fabricated backend credentials",
    seed: seedSources,
    prompt: () =>
      "Use review-software-engineer-cv in OUTPUT_MODE=review. CV is cv.txt; JOB_POSTING is job-posting.txt. These are the complete sources available for this review. Identify gaps and give truthful, interview-defensible wording in chat; do not edit the files. You may carry missing career details as questions rather than inventing answers.",
    check: checkReview,
    judge: async (observation) =>
      judgeLive({
        artifact: observation.finalText,
        knownFacts: `CV:\n${CV_FACTS.cv}\nJob posting:\n${CV_FACTS.job}\nNo other candidate facts or applicant context were supplied.`,
        rubric: [
          {
            id: "honest-fit",
            requirement:
              "The review identifies lack of documented production Go, Kubernetes operations, and on-call ownership as gaps, not as demonstrated strengths. It distinguishes the limited PostgreSQL query-fix evidence from proven tuning expertise.",
          },
          {
            id: "no-fabrication",
            requirement:
              "Suggested publishable CV wording does not invent candidate facts, including metrics, skills, leadership, seniority, on-call ownership, diagnostic work, or relationships between separately documented projects. A candidate rewrite labeled Likely but unconfirmed with a concrete verification question is permitted, including a possible diagnostic contribution; do not reject it merely for introducing the fact being asked about. It must not also be described as safe now, ready to use, or Supported. Judge every rewrite, not just the first conditional one: a Supported label or no-verification-needed claim must be grounded in the supplied candidate sources.",
          },
          {
            id: "partial-source",
            requirement:
              "The partial-output note identifies the missing employment history after 2023, and the review asks for details needed to close material evidence gaps.",
          },
          {
            id: "useful-tailoring",
            requirement:
              "At least one suggested rewrite improves the supplied billing/dashboard experience using facts actually in the CV and explains its relevance to the backend posting.",
          },
        ],
      }),
  },
  {
    id: "review-software-engineer-cv/missing-job-posting",
    ...behavioralDefaults,
    skill: SKILL,
    intent:
      "A missing required job posting blocks review rather than producing generic tailoring",
    seed: (context) => {
      seedSources(context, false);
    },
    prompt: () =>
      "Use review-software-engineer-cv to review my CV in cv.txt for a new backend job. I have not supplied the job posting yet.",
    check: checkMissingJob,
  },
] as const satisfies readonly EvalCase[];
