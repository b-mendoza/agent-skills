import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type { EvalCase } from "#/cases/case-contract.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import {
  FEEDBACK_URL,
  REVIEW_POSTS,
  SENTINEL,
} from "#/cases/review-pull-request-fixtures.ts";
import { approvalCheckpoint } from "#/cases/review-pull-request-retention-test-support.ts";
import { SAVED_FILES } from "#/cases/review-pull-request-saved-files.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const HASH_LENGTH = 64;
const LAST = -1;
const BASE = "a".repeat(SHA_LENGTH);
const HEAD = "b".repeat(SHA_LENGTH);
const HASH = "c".repeat(HASH_LENGTH);
const RUN = ".handoffs/review-pull-request/run";
const SOURCE = `https://github.com/${GITHUB_FACTS.repository}/blob/${HEAD}/pricing.py#L3`;
const SAVED = `Please post the saved draft at ${GITHUB_FACTS.report}.`;
const SUMMARY = `Restore the [empty-cart guard](${SOURCE}); the regression was [already reported](${FEEDBACK_URL.review}).\n`;
const RECEIPT_URL = `${GITHUB_FACTS.url}#pullrequestreview-900`;
const DRAFT = `# PR review: simplify unit price

PR: ${GITHUB_FACTS.url}

Dimensions reviewed: correctness

Reviewed base: ${BASE}

Reviewed head: ${HEAD}

## Findings

### Empty carts regress

ID: empty-cart
Confidence: high
Placement: summary

## Review decision

REQUEST_CHANGES

## Review summary

${SUMMARY}

## Posting

Not posted.
Saved package: ${RUN}\n`;
const DRAFT_HASH = createHash("sha256").update(DRAFT).digest("hex");
const REFRESHED_DRAFT = DRAFT.replace(
  "## Posting",
  "## Verification notes\n\nRechecked the saved findings on the pinned head.\n\n## Posting",
);
const REFRESHED_HASH = createHash("sha256")
  .update(REFRESHED_DRAFT)
  .digest("hex");
const PREVIEW = `${[
  "POST review to eval-org/cart#17",
  "Submit a new review as reviewer (not an author-response workflow).",
  "Inline comments: 0; thread replies: 0",
  "base: main",
  `merge-base: ${BASE}`,
  `commit_id: ${HEAD}`,
  "event: REQUEST_CHANGES",
  "Summary body:",
  SUMMARY,
].join("\n\n")}\napproval-sha256: ${HASH}\n`;
const POST = JSON.stringify({
  endpoint: "repos/eval-org/cart/pulls/17/reviews",
  payload: {
    body: SUMMARY,
    comments: [],
    commit_id: HEAD,
    event: "REQUEST_CHANGES",
  },
});
const DRAFT_FILES = {
  ".handoffs/review-pull-request/": "",
  [GITHUB_FACTS.report]: DRAFT,
  [GITHUB_FACTS.log]: '["api","user"]\n',
  [GITHUB_FACTS.source]: GITHUB_FACTS.headSource,
  [GITHUB_FACTS.sourceBaseline]: GITHUB_FACTS.headSource,
  [GITHUB_FACTS.baselineLog]: `${BASE} ${HEAD} Eval\tcommit: simplify unit price\n`,
  ".git/logs/HEAD": `${BASE} ${HEAD} Eval\tcommit: simplify unit price\n`,
  [REVIEW_POSTS]: "",
  [SENTINEL]: "unrelated run: preserve me\n",
};
const RETAINED = {
  [`${RUN}/context.txt`]:
    'CONTEXT: PASS\n{"dimensions":[{"name":"correctness"}]}\n',
  [`${RUN}/chunk-correctness.txt`]: "CHUNK: PASS\n{}\n",
  [`${RUN}/author.txt`]: "AUTHOR: PASS\n{}\n",
  [`${RUN}/verify.txt`]: "VERIFY: PASS\n{}\n",
};

function success(command: string, content = ""): ToolCall {
  return {
    name: "Bash",
    input: { command },
    result: { content, isError: false, truncated: false },
  };
}

const READ = success(`git show ${HEAD}:pricing.py`, GITHUB_FACTS.headSource);
const RENDER = success(
  `python3 -I .claude/skills/review-pull-request/scripts/render-review.py ${RUN} ${GITHUB_FACTS.report}`,
  `sha256: ${DRAFT_HASH}\n`,
);
const VERIFY = success(
  `python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify < ${RUN}/verify.txt`,
);
const REVERIFY: ToolCall = {
  name: "Agent",
  input: { prompt: `Apply review-verifier. PAYLOAD_FILE=${RUN}/verify.txt.` },
  result: {
    content: `VERIFY: PASS\n${RUN}/verify.txt`,
    isError: false,
    truncated: false,
  },
};
const RESUME = success(
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --resume ${GITHUB_FACTS.report}`,
  JSON.stringify({
    run_dir: RUN,
    pr: GITHUB_FACTS.url,
    base: "main",
    base_sha: BASE,
    head_sha: HEAD,
    output_sha256: DRAFT_HASH,
    history: "unchanged",
    refreshed: false,
  }),
);
const REPLACE = success(
  `python3 -I .claude/skills/review-pull-request/scripts/render-review.py ${RUN} ${GITHUB_FACTS.report} --replace ${DRAFT_HASH}`,
  `sha256: ${REFRESHED_HASH}\n`,
);
const DRY_RUN = success(
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run ${RUN}`,
  PREVIEW,
);
const APPROVED = success(
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN}`,
  `Review posted: ${RECEIPT_URL}`,
);
const REPORT_STATUS = {
  kind: "worktree",
  entries: `?? ${GITHUB_FACTS.report}`,
} as const;

function scenario(name = "post-saved-draft") {
  const registered: readonly EvalCase[] = cases;
  const item = registered.find(
    ({ id }) => id === `review-pull-request/${name}`,
  );
  assert.ok(item !== undefined, `missing ${name} case`);
  return item;
}

function followUps(name?: string) {
  const [request, approve] = scenario(name).followUps ?? [];
  assert.ok(
    request !== undefined && approve !== undefined,
    "expected separate request and approval turns",
  );
  return { request, approve };
}

function terminalDraft(
  calls: readonly ToolCall[] = [READ, VERIFY, RENDER],
  report = DRAFT,
): Observation {
  return createObservation({
    finalText: `Saved ${GITHUB_FACTS.report}. Run files: ${RUN}. Nothing was posted.`,
    toolCalls: [...calls],
    turns: [
      createTurn({ toolCalls: [...calls], gitStatusAfter: REPORT_STATUS }),
    ],
    repoFiles: {
      ...DRAFT_FILES,
      ...RETAINED,
      [GITHUB_FACTS.report]: report,
      [SAVED_FILES]: JSON.stringify(
        Object.fromEntries(
          Object.entries(RETAINED).map(([path, bytes]) => [
            path,
            createHash("sha256").update(bytes).digest("hex"),
          ]),
        ),
      ),
    },
    gitStatusAfter: REPORT_STATUS,
  });
}

function visiblePreview(calls: readonly ToolCall[]): string {
  return `${calls.at(LAST)?.result?.content ?? ""}\nChoose APPROVED, REVISE, or ABORT.`;
}

function resumable(
  calls: readonly ToolCall[] = [RESUME, REVERIFY, VERIFY, REPLACE, DRY_RUN],
  draft = terminalDraft(),
): Observation {
  return {
    ...draft,
    repoFiles: { ...draft.repoFiles, [GITHUB_FACTS.report]: REFRESHED_DRAFT },
    finalText: visiblePreview(calls),
    toolCalls: [...draft.toolCalls, ...calls],
    turns: [
      ...(draft.turns ?? []),
      createTurn({
        prompt: SAVED,
        toolCalls: [...calls],
        gitStatusBefore: REPORT_STATUS,
        gitStatusAfter: REPORT_STATUS,
      }),
    ],
  };
}

function posted(
  approved = APPROVED,
  body = POST,
  preview = resumable(),
): Observation {
  assert.ok(preview.turns !== undefined);
  const report = capturedText(preview, GITHUB_FACTS.report);
  return {
    ...preview,
    finalText: `Posted ${RECEIPT_URL}. Review: ${GITHUB_FACTS.report}. Run files: ${RUN}.`,
    repoFiles: {
      ...preview.repoFiles,
      ...approvalCheckpoint(preview.repoFiles),
      [`${RUN}/receipts.json`]: JSON.stringify({
        review: { id: 900, url: RECEIPT_URL },
        replies: [],
        reopened: [],
        failed: [],
        inline: null,
        inline_error: null,
        complete: true,
      }),
      [GITHUB_FACTS.report]: report.replace(
        "Not posted.",
        `Review: {"id":900,"url":"${RECEIPT_URL}"}`,
      ),
      [GITHUB_FACTS.log]:
        '["api","--method","POST","repos/eval-org/cart/pulls/17/reviews","--input","-"]\n',
      [REVIEW_POSTS]: `${body}\n`,
    },
    toolCalls: [...preview.toolCalls, approved],
    turns: [
      ...preview.turns,
      createTurn({
        prompt: "APPROVED",
        toolCalls: [approved],
        gitStatusBefore: REPORT_STATUS,
        gitStatusAfter: REPORT_STATUS,
      }),
    ],
  };
}

export {
  APPROVED,
  DRAFT,
  DRAFT_HASH,
  DRY_RUN,
  followUps,
  HASH,
  POST,
  posted,
  PREVIEW,
  READ,
  REFRESHED_DRAFT,
  RENDER,
  REPLACE,
  resumable,
  RESUME,
  REVERIFY,
  RUN,
  SAVED,
  scenario,
  success,
  SUMMARY,
  terminalDraft,
  VERIFY,
};
