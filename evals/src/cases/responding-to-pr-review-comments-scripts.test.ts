import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cases } from "#/cases/responding-to-pr-review-comments.ts";
import {
  APPROVED_BODY,
  APPROVED_BODY_FILE,
  POST_LOG,
  READBACK_LOG,
  REPLY_ENDPOINT,
  REPLY_URL,
} from "#/cases/responding-to-pr-review-comments-fixtures.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";

const SCRIPT = fileURLToPath(
  new URL(
    "../../../skills/responding-to-pr-review-comments/scripts/post-review-reply.py",
    import.meta.url,
  ),
);
const [, , , , , , postingCase] = cases;
const ENDPOINT = "repos/eval-org/cart/pulls/17/comments/701/replies";
const READBACK_ENDPOINT = "repos/eval-org/cart/pulls/comments/901";
const USAGE = "<owner>/<repo> <pr-number> <comment-id> <body-file>";
const EXACT_BODY =
  "Quotes: \"yes\", 'yes'. Unicode: café, 日本語.\r\nInterior line.\n\n";
const SUCCESS = 0;
const ONE_CALL = 1;
const TWO_CALLS = 2;
const FIRST_CALL = 0;
const SECOND_CALL = 1;
const READBACK_FAILURE = 74;
const USAGE_ERROR = 64;
const MISSING_FILE = 66;
const DEPENDENCY_MISSING = 2;
const POST_FAILURE = 1;
const STUB = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const endpoint = args.find(arg => arg.startsWith('repos/'));
fs.appendFileSync(process.env.ARG_LOG, JSON.stringify(args) + '\\n');
if (args.includes('GET')) {
  if (process.env.READBACK_MODE === 'missing') process.exit(1);
  const body = fs.readFileSync(process.env.BODY_LOG).toString('utf8');
  console.log(JSON.stringify({ id: 901, html_url: 'https://github.com/eval-org/cart/pull/17#discussion_r901',
    body: process.env.READBACK_MODE === 'mismatch' ? body.trimEnd() : body }));
  process.exit(0);
}
if (process.env.READBACK_MODE === 'post-failed') process.exit(1);
if (process.env.READBACK_MODE === 'invalid-post-json') { console.log('not json'); process.exit(0); }
const fieldIndex = args.findIndex(arg => ['-f', '-F', '--field', '--raw-field'].includes(arg));
const field = args[fieldIndex + 1];
let body;
if (args[fieldIndex] === '-F' || args[fieldIndex] === '--field') {
  body = field.startsWith('body=@') ? fs.readFileSync(field.slice(6)) : Buffer.from(field.slice(5));
} else {
  body = Buffer.from(field.slice(5));
}
fs.writeFileSync(process.env.BODY_LOG, body);
console.log(JSON.stringify({ id: 901, html_url: 'https://github.com/eval-org/cart/pull/17#discussion_r901' }));
`;

function withStub(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "review-reply-script-"));
  try {
    writeFileSync(join(root, "gh"), STUB, { mode: 0o755 });
    writeFileSync(join(root, "args.jsonl"), "");
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function invoke(root: string, args: string[], mode = "match") {
  return spawnSync("python3", ["-I", SCRIPT, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${root}:${process.env["PATH"] ?? ""}`,
      ARG_LOG: join(root, "args.jsonl"),
      BODY_LOG: join(root, "body.bin"),
      READBACK_MODE: mode,
    },
  });
}

function capturedArgs(root: string): unknown[] {
  return readFileSync(join(root, "args.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}

describe("shipped reply helper", () => {
  it("posts the approved bytes once to the PR-nested reply endpoint and prints the verified reply", () => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, EXACT_BODY);
      const result = invoke(root, ["eval-org/cart", "17", "701", body]);
      expect(result.status).toBe(SUCCESS);
      const calls = capturedArgs(root);
      expect(calls).toHaveLength(TWO_CALLS);
      expect(calls[FIRST_CALL]).toEqual(
        expect.arrayContaining(["api", "--method", "POST", ENDPOINT]),
      );
      expect(calls[SECOND_CALL]).toEqual([
        "api",
        "--method",
        "GET",
        READBACK_ENDPOINT,
      ]);
      expect(JSON.parse(result.stdout)).toEqual({
        id: 901,
        html_url: "https://github.com/eval-org/cart/pull/17#discussion_r901",
      });
      expect(readFileSync(join(root, "body.bin"))).toEqual(
        Buffer.from(EXACT_BODY),
      );
    });
  });

  it.each([
    { name: "returns different bytes", mode: "mismatch" },
    { name: "exits non-zero", mode: "missing" },
  ])("fails closed without retrying when the read-back $name", ({ mode }) => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.\n\n");
      const result = invoke(root, ["eval-org/cart", "17", "701", body], mode);
      expect(result.status).toBe(READBACK_FAILURE);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("do not retry");
      expect(result.stderr).toContain("901");
      expect(capturedArgs(root)).toHaveLength(TWO_CALLS);
      expect(capturedArgs(root)[SECOND_CALL]).toEqual([
        "api",
        "--method",
        "GET",
        READBACK_ENDPOINT,
      ]);
    });
  });

  it.each([
    { name: "failed POST", mode: "post-failed", exit: POST_FAILURE },
    {
      name: "live POST with an unparseable receipt",
      mode: "invalid-post-json",
      exit: READBACK_FAILURE,
    },
  ])("exits $exit without reading back after a $name", ({ mode, exit }) => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.");
      const result = invoke(root, ["eval-org/cart", "17", "701", body], mode);
      expect(result.status).toBe(exit);
      expect(capturedArgs(root)).toHaveLength(ONE_CALL);
    });
  });

  it("exits 2 before posting when gh is unavailable", () => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.");
      const python = execFileSync(
        "python3",
        ["-I", "-c", "import sys; print(sys.executable)"],
        {
          encoding: "utf8",
        },
      ).trim();
      const result = spawnSync(
        python,
        ["-I", SCRIPT, "eval-org/cart", "17", "701", body],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: join(root, "missing-bin") },
        },
      );
      expect(result.status).toBe(DEPENDENCY_MISSING);
      expect(result.stderr).toContain("gh CLI required");
    });
  });

  it.each([
    {
      name: "a wrong argument count",
      args: [],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a repository with an extra path segment",
      args: ["eval-org/cart/other", "17", "701", "approved.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a repository with a query character",
      args: ["eval-org/cart?other", "17", "701", "approved.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a repository with a fragment character",
      args: ["eval-org/cart#other", "17", "701", "approved.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a repository with a dot segment before reading the body",
      args: ["../cart", "17", "701", "missing.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a PR number carrying a path segment",
      args: ["eval-org/cart", "17/other", "701", "approved.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a non-numeric comment ID",
      args: ["eval-org/cart", "17", "abc", "approved.txt"],
      exit: USAGE_ERROR,
      stderr: USAGE,
    },
    {
      name: "a missing body file",
      args: ["eval-org/cart", "17", "701", "missing.txt"],
      exit: MISSING_FILE,
      stderr: "cannot read UTF-8 approved body",
    },
    {
      name: "a non-UTF-8 body file",
      args: ["eval-org/cart", "17", "701", "invalid.txt"],
      exit: MISSING_FILE,
      stderr: "cannot read UTF-8 approved body",
    },
  ])("refuses $name before calling gh", ({ args, exit, stderr }) => {
    withStub((root) => {
      writeFileSync(join(root, "approved.txt"), "Approved reply.");
      writeFileSync(join(root, "invalid.txt"), Buffer.from("ff", "hex"));
      const result = invoke(root, args);
      expect(result.status).toBe(exit);
      expect(result.stderr).toContain(stderr);
      expect(capturedArgs(root)).toEqual([]);
    });
  });
});

describe("eval posting fake", () => {
  it("logs one exact POST and one separate read-back when the shipped helper posts", () => {
    const fixture = makeFixture("clean", [], postingCase.seed);
    try {
      const result = spawnSync(
        "python3",
        ["-I", SCRIPT, "eval-org/cart", "17", "701", APPROVED_BODY_FILE],
        {
          cwd: fixture.cwd,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fixture.binPath}:${process.env["PATH"] ?? ""}`,
          },
        },
      );
      expect(result.status).toBe(SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({
        id: 901,
        html_url: REPLY_URL,
      });
      expect(readFileSync(join(fixture.cwd, POST_LOG), "utf8")).toBe(
        `${JSON.stringify({ endpoint: REPLY_ENDPOINT, body: APPROVED_BODY })}\n`,
      );
      const readbacks = readFileSync(join(fixture.cwd, READBACK_LOG), "utf8")
        .trim()
        .split("\n")
        .map((line): unknown => JSON.parse(line));
      expect(readbacks).toEqual([
        expect.objectContaining({ id: 901, body: APPROVED_BODY }),
      ]);
    } finally {
      fixture.cleanup();
    }
  });
});
