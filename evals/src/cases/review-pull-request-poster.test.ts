import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
import { approvalReply } from "#/cases/review-pull-request-gates.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const SHA_LENGTH = 40;
// Each shipped-script row seeds a git fixture and runs several Python
// processes; under parallel suite load that exceeds vitest's 5 s default.
const PREFLIGHT_TIMEOUT_MS = 30_000;
const POSTER = fileURLToPath(
  new URL(
    "../../../skills/review-pull-request/scripts/post-review.py",
    import.meta.url,
  ),
);
// The posting basis only digests collected threads, so one minimal thread is enough.
const LIVE_THREAD = { root_comment_id: "7", comments: [{ body: "Original" }] };

// One fake GitHub for every in-process row: it answers by endpoint from
// `live`, records each POST with the receipts saved on disk at that moment,
// and raises on any call whose "METHOD endpoint" contains live["fail"].
const POSTER_SETUP = String.raw`
from unittest.mock import patch
post = runpy.run_path(str(scripts / "post-review.py"))
execute, plan_for, history_snapshot = post["execute"], post["plan_for"], post["history_snapshot"]
context["threads"].append(dict(context["threads"][0], thread_id="thread2", root_comment_id=8,
                              root_url="https://github.com/cli/cli/pull/1#discussion_r8"))
finding = author["findings"][0]
author["findings"] = [finding, dict(finding, id="R1", placement="reply", root_comment_id=7),
                      dict(finding, id="R2", placement="reply", root_comment_id=8)]
live = dict(state="open", head=context["head_sha"], base_ref=context["base"],
            merge_base=context["base_sha"], viewer="reviewer", reviews=[], discussion=[],
            threads=[json.loads(${JSON.stringify(JSON.stringify(LIVE_THREAD))})], fail=None)
calls, posts = [], []
def github(args, data=None):
    endpoint = next(a for a in args if a in ("user", "graphql") or a.startswith("repos/"))
    method = "POST" if "--method" in args else "GET"
    calls.append(key := method + " " + endpoint)
    if method == "POST": posts.append((endpoint, json.loads(data), json.loads(receipts_bytes() or "null")))
    if live["fail"] and live["fail"] in key: raise ValueError("simulated gh failure")
    if method == "POST": return dict(id=len(posts), html_url="https://github.com/receipt/" + str(len(posts)))
    if endpoint == "user": return dict(login=live["viewer"])
    if endpoint == "graphql": return live["threads"]
    if endpoint.endswith("/reviews"): return [[review] for review in live["reviews"]]
    if endpoint.endswith("/comments"): return [[comment] for comment in live["discussion"]]
    if "/compare/" in endpoint: return dict(merge_base_commit=dict(sha=live["merge_base"]))
    return dict(state=live["state"], head=dict(sha=live["head"]), base=dict(ref=live["base_ref"]))
def invoke(args, runner=github):
    with (contextlib.redirect_stdout(io.StringIO()) as output,
          contextlib.redirect_stderr(io.StringIO()) as error):
        code = execute(args, runner)
    return code, output.getvalue(), error.getvalue()
def preview_sha():
    code, output, error = invoke(["--dry-run", "."])
    assert code == 0, error
    return output.split("approval-sha256: ")[-1].strip()
def receipts_bytes():
    return (run / "receipts.json").read_bytes() if (run / "receipts.json").exists() else None
def save():
    put("context", context)
    put("author", author)
execute.__globals__["collect_threads"] = lambda repo, number: github(["api", "graphql"])
context["posting_basis"] = history_snapshot("cli/cli", 1, context["head_sha"], github)["posting_basis"]
save()
calls.clear()
`;

function verified(source: string): string {
  return python(`${POSTER_SETUP}${source}\nprint("verified")\n`).trim();
}

// Every refusal exits 3 with its diagnostic, posts nothing and leaves receipts as they were.
function refused(invocation: string, family: string): string {
  return String.raw`
before = receipts_bytes()
code, _, error = invoke(${invocation})
assert (code, posts, receipts_bytes()) == (3, [], before), (code, error)
assert ${JSON.stringify(family)} in error, error
`;
}

const PLAN_INVALID =
  "posting requires an open PR, complete history and recorded posting basis";
const PR_CHANGED = "live PR state/head/base changed; approval invalid";
const HISTORY_CHANGED = "live account/history changed; approval invalid";
const MERGE_BASE_CHANGED = "live merge-base changed; approval invalid";

const HASH_INPUTS = [
  ["base branch", 'context["base"] = "release"'],
  ["merge-base", 'context["base_sha"] = "c" * 40'],
  ["posting basis", 'context["posting_basis"]["history_sha256"] = "0" * 64'],
  ["summary", 'author["summary"] += "changed"'],
  ["inline body", 'finding["body"] += "changed"'],
  ["inline target", 'finding["anchor"]["line"] = 3'],
  ["event", 'author["decision"] = "COMMENT"'],
  ["reply body", 'author["findings"][1]["body"] += "changed"'],
] as const;

const RUN_FILE_REFUSALS = [
  ["collected PR is not open", 'context["state"] = "closed"', PLAN_INVALID],
  ["history is partial", 'context["history"] = "partial"', PLAN_INVALID],
  ["posting basis is missing", 'context["posting_basis"] = None', PLAN_INVALID],
  [
    "finding placement is unknown",
    'author["findings"] = [{key: value for key, value in finding.items() if key != "body"} | dict(placement="unknown")]',
    "unknown placement disables posting",
  ],
  [
    "reply targets an uncollected thread",
    'author["findings"][1]["root_comment_id"] = 99',
    "reply target absent from context threads",
  ],
] as const;

const LIVE_CHANGES = [
  ["the live head moved", { head: "c".repeat(SHA_LENGTH) }, PR_CHANGED],
  ["the live PR closed", { state: "closed" }, PR_CHANGED],
  ["the live base branch changed", { base_ref: "release" }, PR_CHANGED],
  [
    "the merge-base moved",
    { merge_base: "c".repeat(SHA_LENGTH) },
    MERGE_BASE_CHANGED,
  ],
  ["the compare read fails", { fail: "/compare/" }, "simulated gh failure"],
  ["the account changed", { viewer: "other" }, HISTORY_CHANGED],
  ["a review was added", { reviews: [{ body: "LGTM" }] }, HISTORY_CHANGED],
  [
    "a discussion comment was added",
    { discussion: [{ body: "New discussion" }] },
    HISTORY_CHANGED,
  ],
  [
    "a thread reply's text changed",
    { threads: [{ ...LIVE_THREAD, comments: [{ body: "Changed claim" }] }] },
    HISTORY_CHANGED,
  ],
] as const;

const GATE_REFUSALS = [
  ["with a wrong approval hash", 'args[1] = "0" * 64', "sha256 mismatch"],
  [
    "when receipts already exist",
    '(run / "receipts.json").write_text("{}")',
    "receipts already exist; never retry a posting run",
  ],
  [
    "when gh is missing",
    'os.environ["PATH"] = ""\nrunner = post["gh"]',
    "No such file or directory: 'gh'",
  ],
  [
    "for an absolute run directory",
    "args[2] = str(Path.cwd())",
    "expected workspace-relative path",
  ],
] as const;

describe("post-review.py preview", () => {
  it("prints a deterministic preview of the account, counts, event, pins, exact bodies and targets without calling GitHub", () => {
    expect(
      verified(String.raw`
code, output, _ = invoke(["--dry-run", "."])
assert code == 0 and invoke(["--dry-run", "."])[1] == output and calls == []
assert output == "\n\n".join([
    "POST review to cli/cli#1", "Submit a new review as reviewer (not an author-response workflow).",
    "Inline comments: 1; thread replies: 2", "base: main", "merge-base: " + "a" * 40,
    "commit_id: " + "b" * 40, "event: REQUEST_CHANGES", "Summary body:", body,
    'Inline: {"line":2,"path":"file.py","side":"RIGHT","start_line":1,"start_side":"RIGHT"}', body,
    "Reply to root 7: https://github.com/cli/cli/pull/1#discussion_r7", body,
    "Reply to root 8: https://github.com/cli/cli/pull/1#discussion_r8", body,
]) + "\napproval-sha256: " + plan_for(run)[3] + "\n", output
`),
    ).toBe("verified");
  });

  it("warns when this account already approved this head", () => {
    expect(
      verified(String.raw`
context["posting_basis"]["approval_urls"] = ["https://github.com/approval"]
author["decision"] = "APPROVE"
save()
output = invoke(["--dry-run", "."])[1]
assert "This account already approved this head: https://github.com/approval" in output
assert "APPROVED explicitly confirms submitting another approval; otherwise choose ABORT." in output
`),
    ).toBe("verified");
  });

  it.each(HASH_INPUTS)(
    "changes the approval hash when the %s changes",
    (_label, statement) => {
      expect(
        verified(String.raw`
before = plan_for(run)[3]
${statement}
save()
assert plan_for(run)[3] != before
`),
      ).toBe("verified");
    },
  );
});

describe("post-review.py refusals before any effect", () => {
  it.each(RUN_FILE_REFUSALS)(
    "refuses to preview a run whose %s",
    (_label, statement, family) => {
      expect(
        verified(String.raw`
${statement}
save()
${refused('["--dry-run", "."]', family)}`),
      ).toBe("verified");
    },
  );

  it.each(LIVE_CHANGES)(
    "refuses an approved run when %s after the preview",
    (_label, override, family) => {
      expect(
        verified(String.raw`
sha = preview_sha()
live.update(json.loads(${JSON.stringify(JSON.stringify(override))}))
${refused('["--approved", sha, "."]', family)}`),
      ).toBe("verified");
    },
  );

  it.each(GATE_REFUSALS)(
    "refuses an approved run %s",
    (_label, statement, family) => {
      expect(
        verified(String.raw`
args, runner = ["--approved", preview_sha(), "."], github
${statement}
${refused("args, runner", family)}`),
      ).toBe("verified");
    },
  );
});

const REVIEWS = "repos/cli/cli/pulls/1/reviews";
const REPLY_7 = "repos/cli/cli/pulls/1/comments/7/replies";

const POSTING_RUNS = [
  [
    "posts the review then each reply with exact bytes, saving receipts before every POST",
    String.raw`
code, _, error = invoke(["--approved", preview_sha(), "."])
assert code == 0 and "GET repos/cli/cli/compare/main..." + "b" * 40 in calls, error
assert [post[0] for post in posts] == ["${REVIEWS}", "${REPLY_7}", "repos/cli/cli/pulls/1/comments/8/replies"]
assert posts[0][1] == dict(commit_id="b" * 40, event="REQUEST_CHANGES", body=body,
                           comments=[dict(finding["anchor"], body=body, start_side="RIGHT")])
assert posts[1][1] == posts[2][1] == dict(body=body)
review = dict(id=1, url="https://github.com/receipt/1")
first = dict(finding="R1", id=2, url="https://github.com/receipt/2")
second = dict(finding="R2", id=3, url="https://github.com/receipt/3")
saved = dict(review=None, replies=[], failed=[], complete=False)
assert [post[2] for post in posts] == [saved, dict(saved, review=review),
                                       dict(saved, review=review, replies=[first])]
assert json.loads(receipts_bytes()) == dict(saved, review=review, replies=[first, second], complete=True)
`,
  ],
  [
    "exits 1 and records the review as failed when the review POST fails",
    String.raw`
sha = preview_sha()
live["fail"] = "POST ${REVIEWS}"
code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and [post[0] for post in posts] == ["${REVIEWS}"], (code, error)
assert json.loads(receipts_bytes()) == dict(review=None, replies=[], complete=False, failed=[
    dict(review="review", detail="simulated gh failure; stop, never retry")])
`,
  ],
  [
    "records a failed reply, exits 1 and posts nothing after it",
    String.raw`
sha = preview_sha()
live["fail"] = "POST ${REPLY_7}"
code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and [post[0] for post in posts] == ["${REVIEWS}", "${REPLY_7}"], error
assert json.loads(receipts_bytes()) == dict(
    review=dict(id=1, url="https://github.com/receipt/1"), replies=[], complete=False,
    failed=[dict(finding="R1", detail="simulated gh failure; stop, never retry")])
`,
  ],
  [
    "exits 1 and says never retry when the completion receipt cannot be saved",
    String.raw`
sha = preview_sha()
replace = os.replace
def replace_unless_complete(source, target):
    if json.loads(Path(source).read_bytes())["complete"]:
        raise OSError("simulated completion receipt failure")
    return replace(source, target)
with patch.object(os, "replace", replace_unless_complete):
    code, _, error = invoke(["--approved", sha, "."])
assert code == 1 and len(posts) == 3, (code, error)
assert "All GitHub actions posted; local completion receipt write failed" in error
assert "never retry" in error and not (run / "render.tmp").exists()
assert json.loads(receipts_bytes())["complete"] is False
`,
  ],
] as const;

describe("post-review.py posting", () => {
  it.each(POSTING_RUNS)("%s", (_label, source) => {
    expect(verified(source)).toBe("verified");
  });

  it("snapshots only this account's approvals at this head from paginated history", () => {
    expect(
      verified(String.raw`
head = context["head_sha"]
live["reviews"] = [
    dict(state="APPROVED", commit_id=head, user=dict(login="reviewer"), html_url="https://github.com/mine"),
    dict(state="APPROVED", commit_id=head, user=dict(login="other"), html_url="https://github.com/other"),
    dict(state="COMMENTED", commit_id=head, user=dict(login="reviewer"), html_url="https://github.com/note"),
    dict(state="APPROVED", commit_id="c" * 40, user=dict(login="reviewer"), html_url="https://github.com/old")]
reads = []
snapshot = history_snapshot("cli/cli", 1, head, lambda args: reads.append(args) or github(args))
assert snapshot["posting_basis"]["approval_urls"] == ["https://github.com/mine"]
assert snapshot["evidence"]["reviews"] == live["reviews"]
assert all("--paginate" in args and "--slurp" in args
           for args in reads if args[-1].endswith(("/reviews", "/comments")))
`),
    ).toBe("verified");
  });
});

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
threads = [{**{key: thread[key] for key in ("thread_id", "is_resolved", "path", "line", "root_url")},
            "root_comment_id": int(thread["root_comment_id"]), "summary": "Collected claim"}
           for thread in snapshot["evidence"]["threads"]]
ctx.update(pr="${GITHUB_FACTS.url}", head_sha=head, base_sha=base, posting_basis=snapshot["posting_basis"], threads=threads)
author["findings"][0].update(placement="reply", root_comment_id=701)
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

const REAL_POSTER_RUNS = [
  {
    label: "nothing drifted",
    drift: undefined,
    status: 0,
    posts: 2,
    stderr: /^$/,
  },
  {
    label: "a review thread was resolved after the preview",
    drift: "thread",
    status: 3,
    posts: 0,
    stderr: /live account\/history changed; approval invalid/,
  },
] as const;

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

describe("shipped poster and collector through the fake gh", () => {
  it.each(REAL_POSTER_RUNS)(
    "posts through the real poster only when nothing drifted: $label",
    ({ drift, status, posts, stderr }) => {
      const fixture = shippedFixture({
        threads: true,
        ...(drift === undefined ? {} : { drift }),
      });
      const { options } = fixture;
      try {
        execFileSync("python3", ["-I", "-c", RUN_SETUP, POSTER], options);
        const dryRun = ["-I", POSTER, "--dry-run", RUN_DIR];
        const preview = execFileSync("python3", dryRun, options);
        const command = `cd '${fixture.cwd}' && python3 ${dryRun.join(" ")}`;
        const result = { content: preview, ...SUCCEEDED };
        const toolCalls = [{ name: "Bash", input: { command }, result }];
        expect(approvalReply(createObservation({ toolCalls }))).toEqual({
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
