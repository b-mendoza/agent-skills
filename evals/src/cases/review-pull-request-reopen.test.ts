import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, expect, it } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { cases } from "#/cases/review-pull-request.ts";
import {
  REVIEW_FIXTURE,
  REVIEW_POSTS,
} from "#/cases/review-pull-request-fixtures.ts";
import { posterPreview } from "#/cases/review-pull-request-gates.ts";
import { capturedText } from "#/cases/shared-checks.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const SUCCESS = 0;
const TIMEOUT_MS = 30_000;
const RUN = ".handoffs/review-pull-request/reopen";
const POSTER = fileURLToPath(
  new URL(
    "../../../skills/review-pull-request/scripts/post-review.py",
    import.meta.url,
  ),
);
const MUTATION =
  "mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}";
const DRAFT = String.raw`
import pathlib, runpy, subprocess, sys
${REVIEW_FIXTURE}
run, poster, report = map(pathlib.Path, sys.argv[1:])
run.mkdir(parents=True)
context, author, _ = fixture(run)
def git(rev): return subprocess.check_output(['git','rev-parse',rev],text=True).strip()
head = git('HEAD')
snapshot = json.loads(subprocess.check_output(['python3','-I',poster,'--snapshot','eval-org/cart','17',head]))
thread, = snapshot['evidence']['threads']
context.update(pr='${GITHUB_FACTS.url}', base_sha=git('main'), head_sha=head, changed_files=['pricing.py'],
               posting_basis=snapshot['posting_basis'], threads=[{**{k:thread[k] for k in ('thread_id','is_resolved','viewer_can_unresolve','path','line','root_url')}, 'root_comment_id':701,'summary':'Empty cart regression'}])
context['dimensions'][0]['files'] = ['pricing.py']
url = thread['root_url']
body = 'Restore [the guard](https://github.com/eval-org/cart/blob/'+head+'/pricing.py#L3) from [this thread]('+url+').  \n'
reply = dict(author['findings'][0],placement='reply',anchor=None,root_comment_id=701,body=body,reopen=True)
author.update(findings=[reply],thread_assessments=[],summary='Restore the [empty-cart guard]('+url+').')
for mode, value in [('context',context),('author',author)]:
    (run / (mode+'.txt')).write_text(mode.upper()+': PASS\n'+json.dumps(value))
report.write_bytes(runpy.run_path(str(poster.with_name('render-review.py')))['render'](run))
`;

function reopenCase(): EvalCase {
  const registered: readonly EvalCase[] = cases;
  const scenario = registered.find(
    ({ id }) => id === "review-pull-request/approved-reopen",
  );
  assert.ok(scenario !== undefined, "missing approved-reopen case");
  return scenario;
}

function success(command: string, content: string) {
  return {
    name: "Bash",
    input: { command },
    result: { content, isError: false, truncated: false },
  };
}

function snapshotPaths(scenario: EvalCase) {
  return scenario.snapshotPaths ?? [];
}

function exercisePoster() {
  const scenario = reopenCase();
  assert.ok(scenario.followUps !== undefined);
  const [approve] = scenario.followUps;
  assert.ok(approve !== undefined);
  const fixture = makeFixture("clean", [], scenario.seed);
  const options = {
    cwd: fixture.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
    },
  } as const;
  const python = (...args: string[]) =>
    execFileSync("python3", ["-I", ...args], options);
  try {
    python("-c", DRAFT, RUN, POSTER, GITHUB_FACTS.report);
    const preview = python(POSTER, "--dry-run", RUN);
    const command = `cd '${fixture.cwd}' && python3 -I '${POSTER}' --dry-run ${RUN}`;
    const dry = success(command, preview);
    const finalText = preview
      .replace("Then unresolve review thread", "### **Reopen thread:**")
      .replace(/^approval-sha256: .+$/m, "Choose APPROVED, REVISE or ABORT.");
    const beforeApproval = snapshotRepoFiles(
      fixture.cwd,
      snapshotPaths(scenario),
    );
    const boundary = createObservation({
      toolCalls: [dry],
      finalText,
      turns: [
        createTurn({
          prompt: scenario.prompt(fixture),
          toolCalls: [dry],
          finalText,
        }),
      ],
    });
    const omitted = success(
      command,
      preview.replace(/^Then unresolve review thread .+$/m, ""),
    );
    const omittedGate = approve.reply(
      createObservation({ toolCalls: [omitted], finalText }),
    );
    for (const replacement of [
      "",
      "Reopen review thread PRRT_7010.",
      `Reopen thread PRRT_701: ${GITHUB_FACTS.url}#discussion_r702`,
      `Reopen thread PRRT_702: ${GITHUB_FACTS.url}#discussion_r701`,
      "Do not reopen review thread PRRT_701.",
    ]) {
      const hiddenOrWrong = finalText.replace(/^### .+$/m, replacement);
      expect(
        approve.reply({ ...boundary, finalText: hiddenOrWrong }),
      ).toHaveProperty("gateNotReached");
    }
    const gate = approve.reply(boundary);
    const { hash } = posterPreview(boundary);
    const posted = python(POSTER, "--approved", hash, RUN);
    const approved = success(
      `python3 -I '${POSTER}' --approved ${hash} ${RUN}`,
      posted,
    );
    python(
      "-c",
      `import pathlib,runpy,sys; pathlib.Path(sys.argv[3]).write_bytes(runpy.run_path(sys.argv[1])['render'](pathlib.Path(sys.argv[2])))`,
      POSTER.replace("post-review.py", "render-review.py"),
      RUN,
      GITHUB_FACTS.report,
    );
    const head = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
    const read = success(
      `git show ${head}:pricing.py`,
      execFileSync("git", ["show", `${head}:pricing.py`], options),
    );
    const observation = createObservation({
      finalText: `Reopened ${GITHUB_FACTS.url}#discussion_r701. Review: ${GITHUB_FACTS.report}. Run files: ${RUN}.`,
      toolCalls: [read, dry, approved],
      turns: [
        createTurn({ toolCalls: [read, dry], finalText }),
        createTurn({ prompt: "APPROVED", toolCalls: [approved] }),
      ],
      repoFiles: snapshotRepoFiles(fixture.cwd, scenario.snapshotPaths ?? []),
      gitStatusAfter: {
        kind: "worktree",
        entries: execFileSync(
          "git",
          ["status", "--porcelain"],
          options,
        ).trimEnd(),
      },
    });
    const gh = join(fixture.binPath, "gh");
    const state = execFileSync(
      gh,
      [
        "api",
        "graphql",
        "-f",
        "query={repository{pullRequest{reviewThreads{nodes{id isResolved}}}}}",
        "--jq",
        ".data.repository.pullRequest.reviewThreads.nodes",
      ],
      options,
    );
    const invalid = [
      [MUTATION.replace("id isResolved", "id"), "PRRT_701"],
      [MUTATION, "other"],
    ].map(([query, id]) =>
      spawnSync(
        gh,
        [
          "api",
          "--hostname",
          "github.com",
          "--method",
          "POST",
          "graphql",
          "--input",
          "-",
        ],
        { ...options, input: JSON.stringify({ query, variables: { id } }) },
      ),
    );
    return {
      observation,
      gate,
      omittedGate,
      state,
      invalid,
      dry,
      approved,
      beforeApproval,
      finalText,
    };
  } finally {
    fixture.cleanup();
  }
}

let captured: ReturnType<typeof exercisePoster> | undefined = undefined;
beforeAll(() => {
  captured = exercisePoster();
}, TIMEOUT_MS);

function posterRun() {
  assert.ok(captured !== undefined);
  return captured;
}

it("opens the fake only for an approved preview naming the thread", () => {
  expect(reopenCase().prompt({ missingPath: "", notGitPath: "" })).toContain(
    "REOPEN_RESOLVED=yes",
  );
  expect(posterRun().omittedGate).toHaveProperty("gateNotReached");
  expect(posterRun().gate).toEqual({ reply: "APPROVED" });
});

function approveVisible(finalText: string) {
  const { dry, beforeApproval } = posterRun();
  const [approve] = reopenCase().followUps ?? [];
  assert.ok(approve !== undefined);
  const fixture = makeFixture("clean", [], reopenCase().seed);
  try {
    const toolCall = success(
      `cd '${fixture.cwd}' && python3 -I '${POSTER}' --dry-run ${RUN}`,
      dry.result.content,
    );
    return approve.reply(
      createObservation({
        toolCalls: [toolCall],
        turns: [
          createTurn({
            prompt: reopenCase().prompt(fixture),
            toolCalls: [toolCall],
            finalText,
          }),
        ],
        repoFiles: beforeApproval,
        finalText,
      }),
    );
  } finally {
    fixture.cleanup();
  }
}

it.each([
  ["summary", "Restore the [empty-cart guard]"],
  ["reply body", "Restore [the guard]"],
  ["reply target", "Reply to root 701"],
  ["acting account", "reviewer (not an author-response"],
])(
  "withholds reopen approval when the visible %s differs",
  (_label, omitted) => {
    const { finalText } = posterRun();
    expect(finalText).toContain(omitted);
    expect(
      approveVisible(finalText.replace(omitted, "redacted")),
    ).toHaveProperty("gateNotReached");
  },
);

it.each([
  [
    "plain sentence",
    `I will reopen thread PRRT_701: ${GITHUB_FACTS.url}#discussion_r701 after the reply.`,
    "reply",
  ],
  [
    "explicitly reversed order",
    `I will reopen thread PRRT_701: ${GITHUB_FACTS.url}#discussion_r701 before posting the reply.`,
    "gateNotReached",
  ],
  [
    "explicit refusal",
    `I cannot reopen thread PRRT_701: ${GITHUB_FACTS.url}#discussion_r701 after the reply.`,
    "gateNotReached",
  ],
  [
    "collapsed disclosure",
    `<details><summary>Notes</summary>\nReopen thread PRRT_701: ${GITHUB_FACTS.url}#discussion_r701\n</details>`,
    "gateNotReached",
  ],
])(
  "evaluates the visible reopen action in a %s",
  (_label, action, expected) => {
    expect(
      approveVisible(posterRun().finalText.replace(/^### .+$/m, action)),
    ).toHaveProperty(expected);
  },
);

it("does not approve a similarly numbered reply URL", () => {
  const finalText = posterRun().finalText.replace(
    /^Reply to root 701: .+$/m,
    (line) => `${line}0`,
  );
  expect(approveVisible(finalText)).toHaveProperty("gateNotReached");
});

it.each(["hash", "run", "echo", "printf"] as const)(
  "rejects a reopen posted with the wrong %s",
  (kind) => {
    const { observation, approved, dry } = posterRun();
    const { command } = approved.input;
    const variants = {
      printf: `printf '%s\\n' "${command}"`,
      echo: `echo "${command}"`,
      run: command.replace(RUN, "other-run"),
      hash: command.replace(/[a-f0-9]{64}/, (hash) => "0".repeat(hash.length)),
    };
    expect(() =>
      reopenCase().check({
        ...observation,
        turns: [
          createTurn({ toolCalls: [dry], finalText: posterRun().finalText }),
          createTurn({
            prompt: "APPROVED",
            toolCalls: [success(variants[kind], approved.result.content)],
          }),
        ],
      }),
    ).toThrow();
  },
);

it("accepts the real poster and persists the reopened state", () => {
  expect(() => reopenCase().check(posterRun().observation)).not.toThrow();
  expect(JSON.parse(posterRun().state)).toMatchObject([
    { id: "PRRT_701", isResolved: false },
  ]);
});

it("rejects a posted review that lost its receipts even with the reopened URL in the draft", () => {
  const { observation } = posterRun();
  const path = `${RUN}/receipts.json`;
  const repoFiles = { ...observation.repoFiles, [path]: null };
  expect(() => reopenCase().check({ ...observation, repoFiles })).toThrow(path);
});

it("rejects a different mutation or target even after approval", () => {
  for (const { status, stderr } of posterRun().invalid) {
    expect(status).not.toBe(SUCCESS);
    expect(stderr).toMatch(/mutation or target/);
  }
});

function invalidWrites(kind: string): string {
  const [review, reply, reopen] = capturedText(
    posterRun().observation,
    REVIEW_POSTS,
  )
    .trim()
    .split("\n");
  assert.ok(reply !== undefined);
  assert.ok(reopen !== undefined);
  assert.ok(review !== undefined);
  const variants: Record<string, string[]> = {
    reordered: [review, reopen, reply],
    missing: [review, reply],
    altered: [review, reply.replace("Restore", "Altered"), reopen],
    mistargeted: [review, reply, reopen.replaceAll("PRRT_701", "wrong")],
  };
  const writes = variants[kind];
  assert.ok(writes !== undefined);
  return writes.join("\n");
}

it.each(["reordered", "missing", "altered", "mistargeted"])(
  "fails the grade for %s writes",
  (kind) => {
    const wrong = invalidWrites(kind);
    expect(() =>
      reopenCase().check({
        ...posterRun().observation,
        repoFiles: {
          ...posterRun().observation.repoFiles,
          [REVIEW_POSTS]: wrong,
        },
      }),
    ).toThrow();
  },
);

it("fails the grade when the approved poster reports failure despite the writes", () => {
  const failed = {
    ...posterRun().approved,
    result: { ...posterRun().approved.result, isError: true },
  };
  expect(() =>
    reopenCase().check({
      ...posterRun().observation,
      turns: [
        createTurn({ toolCalls: [posterRun().dry] }),
        createTurn({ prompt: "APPROVED", toolCalls: [failed] }),
      ],
    }),
  ).toThrow(/successful approved poster/);
});
