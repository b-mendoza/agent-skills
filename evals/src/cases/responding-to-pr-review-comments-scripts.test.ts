import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
  new URL(
    "../../../skills/responding-to-pr-review-comments/scripts/post-review-reply.sh",
    import.meta.url,
  ),
);
const ENDPOINT = "repos/eval-org/cart/pulls/17/comments/701/replies";
const SUCCESS = 0;
const TWO_CALLS = 2;
const SECOND_CALL = 1;
const READBACK_FAILURE = 74;
const READBACK_ENDPOINT = "repos/eval-org/cart/pulls/comments/901";
const FIRST_CALL = 0;
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
  if (process.env.READBACK_MODE === 'invalid-json') { console.log('not json'); process.exit(0); }
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
  return spawnSync("bash", [SCRIPT, ...args], {
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
  it("posts once to the PR-nested root-comment reply endpoint", () => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.");
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
    });
  });

  it.each([
    "Approved reply.",
    "Approved reply.\n",
    "Approved reply.\n\n",
    "Quotes: \"yes\", apostrophe: 'yes'.\n\nInterior blank line.\n",
    "Unicode: café, 日本語.\n\n",
    "CRLF\r\n\r\n",
  ])("posts the approved bytes unchanged: %j", (text) => {
    withStub((root) => {
      const body = join(root, "approved body.txt");
      writeFileSync(body, text);
      const result = invoke(root, ["eval-org/cart", "17", "701", body]);
      expect(result.status).toBe(SUCCESS);
      expect(capturedArgs(root)).toHaveLength(TWO_CALLS);
      expect(readFileSync(join(root, "body.bin"))).toEqual(Buffer.from(text));
    });
  });

  it.each(["mismatch", "missing", "invalid-json"])(
    "fails closed after a live POST when read-back is %s, without retrying",
    (mode) => {
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
    },
  );

  it.each([
    { mode: "post-failed", exit: POST_FAILURE },
    { mode: "invalid-post-json", exit: READBACK_FAILURE },
  ])("does not retry or fetch after $mode", ({ mode, exit }) => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.");
      const result = invoke(root, ["eval-org/cart", "17", "701", body], mode);
      expect(result.status).toBe(exit);
      expect(capturedArgs(root)).toHaveLength(SECOND_CALL);
    });
  });

  it("fails before posting when python3 is unavailable", () => {
    withStub((root) => {
      const body = join(root, "approved.txt");
      writeFileSync(body, "Approved reply.");
      const result = spawnSync(
        "/bin/bash",
        [SCRIPT, "eval-org/cart", "17", "701", body],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: root },
        },
      );
      expect(result.status).toBe(DEPENDENCY_MISSING);
      expect(result.stderr).toContain("python3 required");
      expect(capturedArgs(root)).toEqual([]);
    });
  });

  it.each([
    [],
    ["eval-org/cart", "701", "approved.txt"],
    ["eval-org/cart", "", "701", "approved.txt"],
    ["eval-org/cart", "0", "701", "approved.txt"],
    ["eval-org/cart", "-1", "701", "approved.txt"],
    ["eval-org/cart", "17/other", "701", "approved.txt"],
    ["eval-org/cart", "abc", "701", "approved.txt"],
    ["eval-org/cart", "17", "0", "approved.txt"],
    ["eval-org/cart", "17", "abc", "approved.txt"],
  ])("rejects invalid arguments without calling gh: %j", (...args) => {
    withStub((root) => {
      writeFileSync(join(root, "approved.txt"), "Approved reply.");
      const result = invoke(root, args);
      expect(result.status).toBe(USAGE_ERROR);
      expect(result.stderr).toContain(
        "<owner>/<repo> <pr-number> <comment-id> <body-file>",
      );
      expect(capturedArgs(root)).toEqual([]);
    });
  });

  it("rejects a missing body file without calling gh", () => {
    withStub((root) => {
      const result = invoke(root, [
        "eval-org/cart",
        "17",
        "701",
        "missing.txt",
      ]);
      expect(result.status).toBe(MISSING_FILE);
      expect(result.stderr).toContain("body file not found");
      expect(capturedArgs(root)).toEqual([]);
    });
  });
});
