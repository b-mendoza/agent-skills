import { expect, it } from "vitest";

import { invokes } from "#/cases/review-pull-request-command.ts";

const RUN = ".handoffs/review-pull-request/run";
const SHA256_LENGTH = 64;
const HASH = "c".repeat(SHA256_LENGTH);
const call = (command: string) => ({ name: "Bash", input: { command } });
const approved = (command: string) =>
  invokes(call(command), "post-review.py", ["--approved", HASH, RUN]);

it("recognizes a dry-run using its literal RUN_DIR from the same call", () => {
  const preview = call(
    `RUN_DIR='${RUN}' && python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run "$RUN_DIR"`,
  );
  expect(invokes(preview, "post-review.py", ["--dry-run", RUN])).toBe(true);
});

it("recognizes equivalent relative run paths and a quoted literal hash binding", () => {
  expect(
    approved(
      `RUN_DIR='./${RUN}/'; HASH=${HASH}; python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved "\${HASH}" "$RUN_DIR"`,
    ),
  ).toBe(true);
});

it.each([
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ./.handoffs/tmp/../review-pull-request/run`,
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} /elsewhere/${RUN}`,
  `RUN_DIR=$(pwd); python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} "$RUN_DIR"`,
  `RUN_DIR=${RUN}; python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} '$RUN_DIR'`,
  `false || python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN}`,
  `python3 -I .claude/skills/review-pull-request/scripts/post-review.py --approved ${HASH} ${RUN}; true`,
])("does not accept an unproven approved invocation: %s", (command) => {
  expect(approved(command)).toBe(false);
});

it("accepts a leading cd only into the trusted fixture", () => {
  for (const cwd of ["/fixture", "/other"]) {
    const command = `cd '${cwd}' && python3 -I .claude/skills/review-pull-request/scripts/post-review.py --dry-run ${RUN}`;
    expect(
      invokes(
        call(command),
        "post-review.py",
        ["--dry-run", RUN],
        ["/fixture"],
      ),
    ).toBe(cwd === "/fixture");
  }
});
