import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  python,
  REVIEW_FIXTURE,
  REVIEW_POSTS,
  type ReviewFixtureOptions,
  seedReviewFixture,
} from "#/cases/review-pull-request-fixtures.ts";
import {
  approvalReply,
  fixturePrompt,
} from "#/cases/review-pull-request-gates.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import {
  createObservation,
  createTurn,
} from "#/observation/observation-test-support.ts";

// Each shipped-script row seeds a git fixture and runs several Python
// processes; under parallel suite load that exceeds vitest's 5 s default.
const POSSIBLE_EFFECT = 1;
const PREFLIGHT_TIMEOUT_MS = 30_000;
const POSTER = fileURLToPath(
  new URL(
    "../../../skills/review-pull-request/scripts/post-review.py",
    import.meta.url,
  ),
);

const RUN_DIR = ".handoffs/review-pull-request/offline";
// Writes passing run files for the seeded PR, recording the posting basis from
// the shipped --snapshot, and renders the report the approval gate requires.
const RUN_SETUP = String.raw`
import json, pathlib, runpy, subprocess, sys
${REVIEW_FIXTURE}
script, run = pathlib.Path(sys.argv[1]), pathlib.Path("${RUN_DIR}")
run.mkdir(parents=True)
ctx, author, body = fixture(run)
head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
base = json.loads(pathlib.Path(".git/fake-gh-state.json").read_text())["base"]
snapshot = json.loads(subprocess.check_output(["python3", "-I", str(script), "--snapshot", "eval-org/cart", "17", head], text=True))
threads = [{**{key: thread[key] for key in ("thread_id", "is_resolved", "viewer_can_unresolve", "path", "line", "root_url")},
            "root_comment_id": int(thread["root_comment_id"]), "summary": "Collected claim"}
           for thread in snapshot["evidence"]["threads"]]
ctx.update(pr="${GITHUB_FACTS.url}", head_sha=head, base_sha=base, posting_basis=snapshot["posting_basis"], threads=threads)
if sys.argv[2] in ("self-comment", "copied-approve", "copied-request"):
    state_path = pathlib.Path(".git/fake-gh-state.json")
    state = json.loads(state_path.read_text())
    state["pr"]["user"]["login"] = "ReViEwEr"
    state_path.write_text(json.dumps(state))
    if sys.argv[2] == "self-comment":
        ctx["author"] = "REVIEWER"
        author["decision"] = "COMMENT"
    elif sys.argv[2] == "copied-approve":
        author["decision"] = "APPROVE"
finding = author["findings"][0]
author["findings"] = [dict(finding, id="R1", placement="reply", root_comment_id=701)]
if sys.argv[2] == "with-inline":
    author["findings"] += [dict(finding, anchor=dict(path="pricing.py", side="RIGHT", line=3, start_line=2)), dict(finding, id="F2", anchor=dict(path="pricing.py", side="LEFT", line=4))]
author["thread_assessments"] = [dict(root_comment_id=thread["root_comment_id"], status="still-valid",
                                     evidence="Fixture evidence") for thread in ctx["threads"]]
for mode, value in [("context", ctx), ("author", author)]:
    (run / (mode + ".txt")).write_text(mode.upper() + ": PASS\n" + json.dumps(value))
renderer = runpy.run_path(str(script.with_name("render-review.py")))
pathlib.Path("${GITHUB_FACTS.report}").write_bytes(renderer["render"](run))
`;
const COMPLETE_COMMENTS =
  '"comments":{"totalCount":1,"pageInfo":{"hasNextPage":false';

function shippedFixture(seed: ReviewFixtureOptions, hasNextPage = false) {
  const fixture = makeFixture("clean", [], (context) => {
    seedReviewFixture(context, seed);
  });
  const statePath = join(fixture.cwd, ".git/fake-gh-state.json");
  if (hasNextPage) {
    const state = readFileSync(statePath, "utf8");
    const truncated = COMPLETE_COMMENTS.replace("false", "true");
    writeFileSync(statePath, state.replaceAll(COMPLETE_COMMENTS, truncated));
  }
  const PATH = `${fixture.binPath}:${process.env["PATH"] ?? ""}`;
  const env = { ...process.env, PATH };
  const options = { cwd: fixture.cwd, env, encoding: "utf8" } as const;
  return { ...fixture, options };
}

const REVIEW_RECEIPT = {
  id: 900,
  url: `${GITHUB_FACTS.url}#pullrequestreview-900`,
};
const COMPLETE_RECEIPTS = {
  review: REVIEW_RECEIPT,
  replies: [
    { finding: "R1", id: 1001, url: `${GITHUB_FACTS.url}#discussion_r1001` },
  ],
  reopened: [],
  failed: [],
  complete: true,
  inline_error: null,
};
const COMMENT_READ = [
  "api",
  "--hostname",
  "github.com",
  "--paginate",
  "--slurp",
  "repos/eval-org/cart/pulls/17/reviews/900/comments",
];

const REAL_POSTER_RUNS = [
  {
    label: "posts a self-review COMMENT with its approved reply",
    seed: { threads: true },
    mode: "self-comment",
    labels: ["Self-review: reviewer authored this PR; event is COMMENT."],
    events: ["COMMENT"],
    status: 0,
    posts: 2,
    stderr: /^$/,
    reads: [],
    receipts: { ...COMPLETE_RECEIPTS, inline: null },
  },
  ...(["copied-approve", "copied-request"] as const).map((mode) => ({
    label: `refuses ${mode} when live PR author matches the viewer`,
    seed: { threads: true },
    mode,
    labels: [],
    events: [],
    status: 3,
    posts: 0,
    stderr: /self-review.*COMMENT/i,
    reads: [],
    receipts: null,
  })),
  {
    label: "zero approved inlines skip the review-comments GET",
    seed: { threads: true },
    mode: "replies-only",
    labels: [],
    events: ["REQUEST_CHANGES"],
    status: 0,
    posts: 2,
    stderr: /^$/,
    reads: [],
    receipts: { ...COMPLETE_RECEIPTS, inline: null },
  },
  {
    label: "paginated inline results in reverse order map by anchor",
    seed: { threads: true },
    mode: "with-inline",
    labels: [],
    events: ["REQUEST_CHANGES"],
    status: 0,
    posts: 2,
    stderr: /^$/,
    reads: [COMMENT_READ],
    receipts: {
      ...COMPLETE_RECEIPTS,
      inline: [
        { finding: "F1", id: 901, url: `${GITHUB_FACTS.url}#discussion_r901` },
        { finding: "F2", id: 902, url: `${GITHUB_FACTS.url}#discussion_r902` },
      ],
    },
  },
  {
    label: "refuses posting after a review thread is resolved",
    seed: { threads: true, drift: "thread" },
    mode: "replies-only",
    labels: [],
    events: [],
    status: 3,
    posts: 0,
    stderr: /live account\/history changed; approval invalid/,
    reads: [],
    receipts: null,
  },
] as const;

function savedReceipts(cwd: string): unknown {
  const path = join(cwd, RUN_DIR, "receipts.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

const COLLECTOR_HISTORIES = [
  {
    label: "an empty thread history",
    threads: false,
    hasNextPage: false,
    status: 0,
    stdout: /"threads":\[\]/,
    stderr: /^$/,
  },
  {
    label: "truncated thread comments",
    threads: true,
    hasNextPage: true,
    status: 3,
    stdout: /^$/,
    stderr: /fresh thread read failed or truncated/,
  },
] as const;

const SUCCEEDED = { isError: false, truncated: false };

describe("self-review drafts", () => {
  it.each(["APPROVE", "REQUEST_CHANGES"])(
    "refuses self-review %s without writing a draft",
    (event) => {
      expect(
        python(`
context["author"] = "ReViEwEr"
author["decision"] = "${event}"
put("context", context)
put("author", author)
result = subprocess.run([sys.executable, "-I", scripts / "render-review.py", ".", "review.md"], capture_output=True)
assert result.returncode == 1 and not pathlib.Path("review.md").exists(), result
print(result.stderr.decode())
`),
      ).toMatch(/self-review.*COMMENT/i);
    },
  );

  it("adds only the self-review field to the COMMENT draft and treats a null basis as ordinary", () => {
    expect(
      python(`
author["decision"] = "COMMENT"
put("author", author)
ordinary = render["render"](run)
context["author"] = "REVIEWER"
put("context", context)
report = render["render"](run)
field = b"Review type: self-review by reviewer\\n\\n"
assert field in report and report.replace(field, b"", 1) == ordinary
context["posting_basis"] = None
put("context", context)
assert render["render"](run) == ordinary
print("verified")
`).trim(),
    ).toBe("verified");
  });
});

describe("shipped poster and collector through the fake gh", () => {
  it.each(REAL_POSTER_RUNS)(
    "$label",
    ({
      seed,
      mode,
      status,
      posts,
      stderr,
      reads,
      receipts,
      labels,
      events,
    }) => {
      const fixture = shippedFixture(seed);
      const { options } = fixture;
      try {
        execFileSync("python3", ["-I", "-c", RUN_SETUP, POSTER, mode], options);
        const apiLog = join(fixture.cwd, GITHUB_FACTS.log);
        const beforePreview = readFileSync(apiLog, "utf8");
        const dryRun = ["-I", POSTER, "--dry-run", RUN_DIR];
        const preview = execFileSync("python3", dryRun, options);
        const previewLabels = preview
          .split("\n")
          .filter((line) => line.startsWith("Self-review:"));
        expect(previewLabels).toEqual(labels);
        expect(readFileSync(apiLog, "utf8")).toBe(beforePreview);
        const command = `cd '${fixture.cwd}' && python3 ${dryRun.join(" ")}`;
        const result = { content: preview, ...SUCCEEDED };
        const toolCalls = [{ name: "Bash", input: { command }, result }];
        expect(
          approvalReply(
            createObservation({
              toolCalls,
              finalText: preview,
              turns: [
                createTurn({
                  prompt: fixturePrompt("Review", fixture.notGitPath),
                  toolCalls,
                }),
              ],
            }),
          ),
        ).toEqual({
          reply: "APPROVED",
        });
        const hash = /approval-sha256: (?<hash>[a-f0-9]{64})/.exec(preview)
          ?.groups?.["hash"];
        assert.ok(hash !== undefined, "preview printed no approval hash");
        const approved = ["-I", POSTER, "--approved", hash, RUN_DIR];
        const run = spawnSync("python3", approved, options);
        expect(run.status).toBe(status);
        expect(run.stderr).toMatch(stderr);
        const postsLog = readFileSync(join(fixture.cwd, REVIEW_POSTS), "utf8");
        expect(postsLog.split("\n").filter(Boolean)).toHaveLength(posts);
        const reviewEvents = [
          ...postsLog.matchAll(/"event": "(?<event>[A-Z_]+)"/g),
        ].map((match) => match.groups?.["event"]);
        expect(reviewEvents).toEqual(events);
        const commentReads = readFileSync(apiLog, "utf8")
          .split("\n")
          .filter((line) => /\/reviews\/\d+\/comments/.test(line))
          .map((line): unknown => JSON.parse(line));
        expect(commentReads).toEqual(reads);
        expect(savedReceipts(fixture.cwd)).toEqual(receipts);
      } finally {
        fixture.cleanup();
      }
    },
    PREFLIGHT_TIMEOUT_MS,
  );

  it(
    "keeps the completed receipts and exits 1 if stdout closes before result delivery",
    () => {
      const fixture = shippedFixture({ threads: true });
      try {
        const { options } = fixture;
        execFileSync(
          "python3",
          ["-I", "-c", RUN_SETUP, POSTER, "replies-only"],
          options,
        );
        const preview = execFileSync(
          "python3",
          ["-I", POSTER, "--dry-run", RUN_DIR],
          options,
        );
        const hash = /approval-sha256: (?<hash>[a-f0-9]{64})/.exec(preview)
          ?.groups?.["hash"];
        assert.ok(hash !== undefined);
        const closedPipe = `
import os, subprocess, sys
reader, writer = os.pipe()
os.close(reader)
sys.exit(subprocess.run([sys.executable, "-I", *sys.argv[1:]], stdout=writer).returncode)
`;
        const result = spawnSync(
          "python3",
          ["-I", "-c", closedPipe, POSTER, "--approved", hash, RUN_DIR],
          options,
        );
        expect(result.status).toBe(POSSIBLE_EFFECT);
        expect(savedReceipts(fixture.cwd)).toEqual({
          ...COMPLETE_RECEIPTS,
          inline: null,
        });
      } finally {
        fixture.cleanup();
      }
    },
    PREFLIGHT_TIMEOUT_MS,
  );

  it.each(COLLECTOR_HISTORIES)(
    "snapshots $label through the shipped collector",
    ({ threads, hasNextPage, status, stdout, stderr }) => {
      const fixture = shippedFixture({ threads }, hasNextPage);
      const { options } = fixture;
      try {
        const head = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
        const snapshot = ["-I", POSTER, "--snapshot", "eval-org/cart", "17"];
        const run = spawnSync("python3", [...snapshot, head], options);
        expect(run.status).toBe(status);
        expect(run.stdout).toMatch(stdout);
        expect(run.stderr).toMatch(stderr);
      } finally {
        fixture.cleanup();
      }
    },
    PREFLIGHT_TIMEOUT_MS,
  );
});

it(
  "collects a root available only on the second outer thread page",
  () => {
    const fixture = shippedFixture({ threads: true });
    try {
      const { options } = fixture;
      const query =
        'query { repository(owner:"eval-org", name:"cart") {pullRequest(number:17) {reviewThreads(first:100) {nodes {id}}}}}';
      const first = execFileSync(
        "gh",
        [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "--jq",
          ".data.repository.pullRequest.reviewThreads.nodes[].id",
        ],
        options,
      );
      expect(first).toContain("PRRT_701");
      expect(first).not.toContain("PRRT_703");
      const collector = join(POSTER, "..", "collect-pr-review-comments.sh");
      const result = execFileSync(
        "sh",
        [collector, "eval-org", "cart", "17"],
        options,
      );
      expect(
        result
          .split("\n")
          .filter(Boolean)
          .map((line): unknown => JSON.parse(line)),
      ).toContainEqual(
        expect.objectContaining({
          thread_id: "PRRT_703",
          root_comment_id: "703",
        }),
      );
    } finally {
      fixture.cleanup();
    }
  },
  PREFLIGHT_TIMEOUT_MS,
);
