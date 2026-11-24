import { expect, it } from "vitest";

import {
  DRAFT_HASH,
  followUps,
  PREVIEW,
  REPLACE,
  resumable,
  RESUME,
  RUN,
  success,
  SUMMARY,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";
import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";

// Turn 2 of post-saved-draft, with fixture pins, hashes and summary substituted.
const skill = "S=$PWD/.claude/skills/review-pull-request";
const resume = `${skill}; python3 -I $S/scripts/post-review.py --resume pr-17-review.md; echo exit=$?`;
const batch = `${skill}; R=${RUN}; python3 -I $S/scripts/validate-output.py verify < $R/verify.txt && python3 -I $S/scripts/render-review.py "$R" pr-17-review.md --replace ${DRAFT_HASH}; echo render=$?; python3 -I $S/scripts/post-review.py --dry-run "$R"; echo dry=$?`;
const verifyPath = `${RUN}/verify.txt`;
const verifyBytes =
  'VERIFY: PASS\n{"issues":[],"observed_checks":["Re-verification ran inline in the orchestrator session (no subagent dispatch), so isolation is reduced. No tests executed."]}\n';
const output = `${REPLACE.result?.content}render=0\n${PREVIEW}dry=0`;
const resumeOutput = `${RESUME.result?.content}\nexit=0`;
function approval(
  command: string,
  stdout: string,
  first = resume,
  result = resumeOutput,
) {
  const observation = resumable([
    success(first, result),
    {
      name: "Write",
      input: { file_path: `/fixture/${verifyPath}`, content: verifyBytes },
    },
    success(command, stdout),
  ]);
  return followUps().approve.reply({
    ...observation,
    repoFiles: {
      ...observation.repoFiles,
      [FIXTURE_ROOT_PATH]: "/fixture",
      [verifyPath]: verifyBytes,
    },
    finalText: PREVIEW.replace(SUMMARY, `> ${SUMMARY}`),
  });
}

it("approves the recorded resume, guarded replacement, dry-run and quoted summary", () => {
  expect(approval(batch, output)).toEqual({ reply: "APPROVED" });
});

it.each([
  [batch.replace(" && ", "; "), output],
  [
    batch.replace(
      "python3 -I $S/scripts/validate",
      "echo python3 -I $S/scripts/validate",
    ),
    output,
  ],
  [batch, output.replace("render=0", "render=1")],
  [batch, output.replace("dry=0", "dry=1")],
  [batch, output.replace(PREVIEW, "")],
  [batch, `${PREVIEW}render=0\n${REPLACE.result?.content}dry=0`],
])(
  "withholds approval without ordered, successful steps (%#)",
  (command, stdout) => {
    expect(approval(command, stdout)).toHaveProperty("gateNotReached");
  },
);

it.each([
  [resume.replace("; python3", "; echo python3"), resumeOutput],
  [resume, resumeOutput.replace("exit=0", "exit=1")],
  [resume, RESUME.result?.content ?? ""],
])(
  "rejects printed resumes and missing or failed echoed status (%#)",
  (command, stdout) => {
    expect(approval(batch, output, command, stdout)).toHaveProperty(
      "gateNotReached",
    );
  },
);

it.each([
  [`> ${SUMMARY}`, true],
  [`\`\`\`markdown\n${SUMMARY}\`\`\``, true],
  [`>  ${SUMMARY}`, false],
  [`\`\`\`markdown\n> ${SUMMARY}\`\`\``, false],
  [`\`\`\`\n${SUMMARY.replace("Restore", "Ignore")}\`\`\``, false],
])("compares the bytes inside preview presentation (%#)", (body, accepted) => {
  const decision = followUps().approve.reply({
    ...resumable(),
    finalText: PREVIEW.replace(SUMMARY, body),
  });
  expect("reply" in decision).toBe(accepted);
});
