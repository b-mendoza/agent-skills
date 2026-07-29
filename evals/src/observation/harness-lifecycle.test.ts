// Pins `runClaude`'s child-process lifecycle: what a run observes when the
// stream ends abnormally, and what it must still observe when the stream ends
// normally but untidily.
//
// The rest of the offline suite tests pure functions. This file needs a real
// child process, so it puts a fake `claude` on PATH -- `runClaude` spawns that
// name unconditionally -- and drives the actual stdout reader, timeout timer,
// and settle path. No token is spent: the fake is a shell script.
//
//   pnpm test

import type * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, expect, test, vi } from "vitest";

import type { Observation } from "#/observation/harness.ts";
import { runClaude } from "#/observation/harness.ts";

// `spawn` is faked only for the tests that install a child; everything else
// delegates to the real one so the PATH-based cases stay end-to-end.
let nextChild: FakeChild | null = null;

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The dynamic-import form types the factory against `spawn`'s full overload set, and a stand-in returning one fake child satisfies none of those signatures; taking the suggestion would require an `as` cast, which is a worse trade than this one line.
vi.mock("node:child_process", async (importOriginal) => {
  const real = await importOriginal<typeof childProcess>();
  return {
    ...real,
    spawn: (command: string, args: readonly string[], options: object) => {
      const fake = nextChild;
      nextChild = null;
      return fake ?? real.spawn(command, args, options);
    },
  };
});

const WALL_CLOCK_MS = 30_000;
/** Short enough to exercise SIGKILL without slowing the offline suite. */
const SHORT_WALL_CLOCK_MS = 25;
const BUDGET_USD = 0.01;
/** Executable by owner, readable and executable by everyone. */
const EXECUTABLE_MODE = 0o755;
/** Distinct costs, so a test names which event a value came from. */
const COST_FULL = 0.5;
const COST_PARTIAL = 0.25;
const COST_CLOSE = 0.33;
const COST_NONZERO_EXIT = 0.1;
const EXIT_CODE = 7;

const temps: string[] = [];
const realPath = process.env["PATH"];

afterEach(() => {
  process.env["PATH"] = realPath;
  nextChild = null;
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A child process whose lifecycle events fire on command.
 *
 * The interleaving that matters -- stdout arrives, then `error` and `close`
 * both fire -- cannot be provoked from a real process on demand, so the two
 * ordering tests below drive the harness's own handlers directly.
 */
class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  /** The harness kills on timeout; these tests end the stream themselves. */
  killed = false;
  kill = (): boolean => {
    this.killed = true;
    return true;
  };
}

function installChild(): FakeChild {
  const child = new FakeChild();
  nextChild = child;
  return child;
}

/** Puts a `claude` on PATH whose stdout is `body`, and returns its directory. */
function fakeClaude(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  temps.push(dir);
  const bin = join(dir, "claude");
  writeFileSync(bin, `#!/bin/sh\n${body}\n`);
  chmodSync(bin, EXECUTABLE_MODE);
  process.env["PATH"] = `${dir}:${realPath ?? ""}`;
  return dir;
}

async function run(wallClockMs = WALL_CLOCK_MS): Promise<Observation> {
  return runClaude({
    cwd: tmpdir(),
    prompt: "unused",
    budgetUsd: BUDGET_USD,
    model: "haiku",
    wallClockMs,
  });
}

const resultEvent = (text: string, cost: number): string =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    result: text,
    total_cost_usd: cost,
  });

const toolEvent = (name: string): string =>
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input: {} }] },
  });

test("a normal stream yields the result and its tool calls", async () => {
  fakeClaude(
    `printf '%s\\n' '${toolEvent("Skill")}'\nprintf '%s\\n' '${resultEvent("done", COST_FULL)}'`,
  );

  const o = await run();

  expect(o.exitCode).toBe(0);
  expect(o.subtype).toBe("success");
  expect(o.isError).toBe(false);
  expect(o.finalText).toBe("done");
  expect(o.costUsd).toBe(COST_FULL);
  expect(o.toolCalls.map((c) => c.name)).toStrictEqual(["Skill"]);
  expect(o.timedOut).toBe(false);
});

test("a final line with no trailing newline is still a real event", async () => {
  // The settle guard must not cost us this: `printf` without `\n` is exactly
  // what a CLI killed mid-flush produces, and that last line is often the
  // result event carrying the whole run's outcome.
  fakeClaude(`printf '%s' '${resultEvent("unterminated", COST_PARTIAL)}'`);

  const o = await run();

  expect(o.finalText).toBe("unterminated");
  expect(o.costUsd).toBe(COST_PARTIAL);
});

test("a stream of pure noise degrades to an empty observation", async () => {
  fakeClaude('printf \'not json\\n[1,2,3]\\n{"type":"other"}\\n\'');

  const o = await run();

  expect(o.exitCode).toBe(0);
  expect(o.subtype).toBe("");
  expect(o.finalText).toBe("");
  expect(o.toolCalls).toStrictEqual([]);
});

test("a failed spawn reports no result and books no cost", async () => {
  // No `claude` on PATH at all: the `error` handler is the one that settles.
  process.env["PATH"] = mkdtempSync(join(tmpdir(), "empty-path-"));
  temps.push(process.env["PATH"]);

  const o = await run();

  expect(o.exitCode).toBeNull();
  expect(o.subtype).toBe("spawn_error");
  expect(o.isError).toBe(true);
  expect(o.finalText).toBe("");
  expect(o.costUsd).toBe(0);
});

test("an authentication failure surfaces as a failed run", async () => {
  // End to end through the real reader: what an expired login actually put on
  // stdout, verbatim. The exit is clean and the subtype says success, so
  // `isError` is the only field that carries the failure out of the harness.
  const authFailure = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: true,
    result: "Failed to authenticate: OAuth session expired",
    total_cost_usd: 0,
  });
  fakeClaude(`printf '%s\\n' '${authFailure}'`);

  const o = await run();

  expect(o.exitCode).toBe(0);
  expect(o.subtype).toBe("success");
  expect(o.isError).toBe(true);
  expect(o.toolCalls).toStrictEqual([]);
});

test("a run that exceeds its wall clock is killed and settles", async () => {
  fakeClaude("sleep 10");

  const o = await run(SHORT_WALL_CLOCK_MS);

  // A process closed by SIGKILL has no numeric exit code; the timeout flag is
  // what distinguishes this from an ordinary null close status.
  expect(o.exitCode).toBeNull();
  expect(o.timedOut).toBe(true);
});

test("a late close cannot grow an observation already returned", async () => {
  // The losing handler must not keep writing. `toolCalls` is handed out by
  // reference, so parsing a buffered line after `error` won the settle would
  // grow an array the caller is already holding: the same run reports one set
  // of tool calls, then silently another. `resolve` ignoring the second call
  // does not prevent this -- only refusing to do the work does.
  const child = installChild();
  const pendingRun = run();
  await vi.waitFor(() => {
    expect(child.listenerCount("close")).toBe(1);
  });

  // Buffered, deliberately unterminated: it stays in `pending` until a
  // `close` handler flushes it.
  child.stdout.write(toolEvent("Write"));
  await vi.waitFor(() => {
    expect(child.stdout.readableLength).toBe(0);
  });

  child.emit("error", new Error("stream died"));
  const o = await pendingRun;
  const snapshot = structuredClone(o);

  // EventEmitter dispatch is synchronous, so any losing-handler mutation would
  // already be visible when emit returns.
  child.emit("close", null);

  expect(o).toStrictEqual(snapshot);
  expect(o.toolCalls).toStrictEqual([]);
  expect(o.subtype).toBe("spawn_error");
});

test("the first handler to arrive is the one that defines the run", async () => {
  // Mirror image: `close` wins, so a later `error` must not blank the result
  // text and cost that the close path already reported.
  const child = installChild();
  const pendingRun = run();
  await vi.waitFor(() => {
    expect(child.listenerCount("close")).toBe(1);
  });

  child.stdout.write(`${resultEvent("real outcome", COST_CLOSE)}\n`);
  await vi.waitFor(() => {
    expect(child.stdout.readableLength).toBe(0);
  });

  child.emit("close", 0);
  const o = await pendingRun;

  // EventEmitter dispatch is synchronous, so a losing handler would have
  // blanked these fields before emit returns.
  child.emit("error", new Error("late failure"));

  expect(o.subtype).toBe("success");
  expect(o.finalText).toBe("real outcome");
  expect(o.costUsd).toBeCloseTo(COST_CLOSE);
});

test("a nonzero exit is reported rather than masked", async () => {
  fakeClaude(
    `printf '%s\\n' '${resultEvent("partial", COST_NONZERO_EXIT)}'\nexit ${EXIT_CODE}`,
  );

  const o = await run();

  expect(o.exitCode).toBe(EXIT_CODE);
  expect(o.finalText).toBe("partial");
});
