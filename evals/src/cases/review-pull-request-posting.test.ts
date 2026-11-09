import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { assertPosting } from "#/cases/review-pull-request-checks.ts";
import {
  REVIEW_POSTS,
  seedReviewFixture,
} from "#/cases/review-pull-request-fixtures.ts";
import { approvalReply } from "#/cases/review-pull-request-gates.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
// Each case runs the real poster against the fake gh several times; under
// parallel suite load that exceeds vitest's 5 s default.
const PREFLIGHT_TIMEOUT_MS = 30_000;
const HEAD = "b".repeat(SHA_LENGTH);
const SUMMARY_BODY = "Restore the empty-cart guard before merging.\n";
const REPLY_BODY = `Restore [the guard](https://github.com/eval-org/cart/blob/${HEAD}/pricing.py#L3) because empty carts otherwise divide by zero.\n`;
const PREVIEW = `${[
  "POST review to eval-org/cart#17",
  "Submit a new review as reviewer",
  "Inline comments: 0; thread replies: 1",
  `commit_id: ${HEAD}`,
  "event: REQUEST_CHANGES",
  "Summary body:",
  SUMMARY_BODY,
  `Reply to root 701: ${GITHUB_FACTS.url}#discussion_r701`,
  REPLY_BODY,
].join(
  "\n\n",
)}\napproval-sha256: ${"c".repeat(DIGEST_LENGTH)}\nAPPROVED, REVISE, ABORT`;
const DRY_TOOL = {
  name: "Bash",
  input: { command: "python3 -I post-review.py --dry-run run" },
  result: { content: PREVIEW, isError: false, truncated: false },
};
const APPROVED_TOOL = {
  name: "Bash",
  input: {
    command: `python3 -I post-review.py --approved ${"c".repeat(DIGEST_LENGTH)} run`,
  },
};

it("rejects posting before reply, changed bytes, new inline duplicates, and effects on drift", () => {
  const good = createObservation({ repoFiles: { [REVIEW_POSTS]: "" } });
  const writes = [
    JSON.stringify({
      endpoint: "repos/eval-org/cart/pulls/17/reviews",
      payload: {
        body: SUMMARY_BODY,
        comments: [],
        commit_id: HEAD,
        event: "REQUEST_CHANGES",
      },
    }),
    JSON.stringify({
      endpoint: "repos/eval-org/cart/pulls/17/comments/701/replies",
      payload: {
        body: REPLY_BODY,
      },
    }),
  ].join("\n");
  const observation = {
    ...good,
    turns: [
      createTurn({
        finalText: "The prepared review is ready; waiting for your reply.",
        toolCalls: [DRY_TOOL],
      }),
      createTurn({ prompt: "APPROVED", toolCalls: [APPROVED_TOOL] }),
    ],
    repoFiles: { ...good.repoFiles, [REVIEW_POSTS]: writes },
  };
  expect(() => {
    assertPosting(observation, false);
  }).not.toThrow();
  expect(() => {
    assertPosting(
      {
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [REVIEW_POSTS]: writes.replace('\\n"', '"'),
        },
      },
      false,
    );
  }).toThrow(/differs/);
  expect(() => {
    assertPosting(
      {
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [REVIEW_POSTS]: writes.replace("/comments/701/", "/comments/999/"),
        },
      },
      false,
    );
  }).toThrow(/target/);
  expect(() => {
    assertPosting(
      {
        ...observation,
        turns: [
          createTurn({
            finalText: PREVIEW,
            toolCalls: [DRY_TOOL, APPROVED_TOOL],
          }),
          createTurn({ prompt: "APPROVED", toolCalls: [APPROVED_TOOL] }),
        ],
      },
      false,
    );
  }).toThrow(/before reply/);
  expect(() => {
    assertPosting(
      {
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [REVIEW_POSTS]: writes.replace(
            "Restore the empty-cart",
            "Changed the empty-cart",
          ),
        },
      },
      false,
    );
  }).toThrow(/differs/);
  expect(() => {
    assertPosting(
      {
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [REVIEW_POSTS]: writes.replace('"comments":[]', '"comments":[{}]'),
        },
      },
      false,
    );
  }).toThrow(/duplicate/);
  expect(() => {
    assertPosting(observation, true);
  }).toThrow(/stale/);
  expect(() => {
    assertPosting(
      {
        ...observation,
        finalText: "A semantically graded explanation.",
        turns: [
          createTurn({ toolCalls: [DRY_TOOL] }),
          createTurn({
            prompt: "APPROVED",
            toolCalls: [
              {
                ...APPROVED_TOOL,
                result: {
                  content:
                    "live account/history changed; approval invalid; re-assess and preview anew\npost_exit=3",
                  isError: true,
                  truncated: false,
                },
              },
            ],
          }),
        ],
        repoFiles: { ...observation.repoFiles, [REVIEW_POSTS]: "" },
      },
      true,
    );
  }).not.toThrow();
});

it.each([
  { drift: undefined, code: 0, posts: 2 },
  { drift: "thread", code: 3, posts: 0 },
  { drift: "head", code: 3, posts: 0 },
] as const)(
  "runs real posting preflight through the multi-turn fake: $drift",
  ({ drift, code, posts }) => {
    const fixture = makeFixture("clean", [], (context) => {
      seedReviewFixture(context, {
        threads: true,
        ...(drift === undefined ? {} : { drift }),
      });
    });
    const script = fileURLToPath(
      new URL(
        "../../../skills/review-pull-request/scripts/post-review.py",
        import.meta.url,
      ),
    );
    const env = {
      ...process.env,
      PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
    };
    try {
      execFileSync(
        "python3",
        [
          "-I",
          "-c",
          `
import json, pathlib, runpy, subprocess, sys
script=pathlib.Path(sys.argv[1])
run=pathlib.Path('.handoffs/review-pull-request/offline')
run.mkdir(parents=True)
renderer=runpy.run_path(str(script.with_name('render-review.py')))
ctx, author, body=renderer['fixture'](run)
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
state=json.loads(pathlib.Path('.git/fake-gh-state.json').read_text())
snapshot=json.loads(subprocess.check_output(['python3','-I',str(script),'--snapshot','eval-org/cart','17',head],text=True))
ctx.update(pr='${GITHUB_FACTS.url}',head_sha=head,base_sha=state['base'],posting_basis=snapshot['posting_basis'],threads=[{**{k:t[k] for k in ('thread_id','is_resolved','path','line','root_url')},'root_comment_id':int(t['root_comment_id']),'summary':'Collected claim'} for t in snapshot['evidence']['threads']])
author['findings'][0].update(placement='reply',root_comment_id=701)
author['thread_assessments']=[dict(root_comment_id=t['root_comment_id'],status='still-valid',evidence='Fixture evidence') for t in ctx['threads']]
for mode, value in [('context',ctx),('author',author)]:
 (run/(mode+'.txt')).write_text(mode.upper()+': PASS\\n'+json.dumps(value))
pathlib.Path('${GITHUB_FACTS.report}').write_bytes(renderer['render'](run))
`,
          script,
        ],
        { cwd: fixture.cwd, env, encoding: "utf8" },
      );
      const preview = execFileSync(
        "python3",
        ["-I", script, "--dry-run", ".handoffs/review-pull-request/offline"],
        { cwd: fixture.cwd, env, encoding: "utf8" },
      );
      const hash = /approval-sha256: (?<hash>[a-f0-9]{64})/.exec(preview)
        ?.groups?.["hash"];
      assert.ok(hash !== undefined);
      const boundary = createObservation({
        finalText: `${preview}\nAPPROVED`,
        toolCalls: [
          {
            name: "Bash",
            input: {
              command: `cd '${fixture.cwd}' && python3 -I '${script}' --dry-run .handoffs/review-pull-request/offline`,
            },
            result: { content: preview, isError: false, truncated: false },
          },
        ],
      });
      expect(approvalReply(boundary)).toEqual({ reply: "APPROVED" });
      const authorPath = join(
        fixture.cwd,
        ".handoffs/review-pull-request/offline/author.txt",
      );
      const retainedAuthor = readFileSync(authorPath);
      unlinkSync(authorPath);
      expect(approvalReply(boundary)).toHaveProperty("gateNotReached");
      writeFileSync(authorPath, retainedAuthor);
      const result = execFileSync(
        "python3",
        [
          "-I",
          "-c",
          `import subprocess,sys; r=subprocess.run(['python3','-I',sys.argv[1],'--approved',sys.argv[2],'.handoffs/review-pull-request/offline'],capture_output=True,text=True); print(r.returncode)`,
          script,
          hash,
        ],
        { cwd: fixture.cwd, env, encoding: "utf8" },
      );
      expect(Number(result.trim())).toBe(code);
      expect(
        readFileSync(join(fixture.cwd, REVIEW_POSTS), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean),
      ).toHaveLength(posts);
    } finally {
      fixture.cleanup();
    }
  },
  PREFLIGHT_TIMEOUT_MS,
);

it("serves pinned PR code separately from the divergent checkout", () => {
  const fixture = makeFixture("clean", [], (context) => {
    seedReviewFixture(context, { divergent: true });
  });
  try {
    const head = readFileSync(
      join(fixture.cwd, ".git/reviewed-pr-head"),
      "utf8",
    );
    expect(head).not.toBe(
      readFileSync(join(fixture.cwd, ".git/checkout-head"), "utf8"),
    );
    expect(readFileSync(join(fixture.cwd, GITHUB_FACTS.source), "utf8")).toBe(
      GITHUB_FACTS.baseSource,
    );
    const source = execFileSync(
      "gh",
      [
        "api",
        `repos/eval-org/cart/contents/pricing.py?ref=${head}`,
        "-H",
        "Accept: application/vnd.github.raw",
      ],
      {
        cwd: fixture.cwd,
        env: {
          ...process.env,
          PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
        },
        encoding: "utf8",
      },
    );
    expect(source).toBe(GITHUB_FACTS.headSource);
  } finally {
    fixture.cleanup();
  }
});

it.each([false, true])(
  "runs the shipped snapshot against the fake authenticated history, prior approval=%s",
  (clean) => {
    const fixture = makeFixture("clean", [], (context) => {
      seedReviewFixture(context, { threads: true, clean });
    });
    try {
      const head = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.cwd,
        encoding: "utf8",
      }).trim();
      const script = fileURLToPath(
        new URL(
          "../../../skills/review-pull-request/scripts/post-review.py",
          import.meta.url,
        ),
      );
      const output = execFileSync(
        "python3",
        ["-I", script, "--snapshot", "eval-org/cart", "17", head],
        {
          cwd: fixture.cwd,
          env: {
            ...process.env,
            PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
          },
          encoding: "utf8",
        },
      );
      expect(output).toContain('"viewer":"reviewer"');
      expect(output).toContain('"is_resolved":false');
      expect(output).toContain('"root_comment_id":"701"');
      expect(
        readFileSync(join(fixture.cwd, ".git/fake-gh-state.json"), "utf8"),
      ).toContain('"totalCount": 3');
      expect(output.includes("pullrequestreview-88")).toBe(clean);
      const log = readFileSync(join(fixture.cwd, GITHUB_FACTS.log), "utf8");
      expect(log).toContain('"--slurp"');
      expect(log).toContain('"--paginate"');
      expect(log).toContain("repos/eval-org/cart/pulls/17/reviews");
      expect(log).toContain("repos/eval-org/cart/issues/17/comments");
    } finally {
      fixture.cleanup();
    }
  },
);
