import { expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import { verifiedResume } from "#/cases/review-pull-request-saved-draft-route.ts";
import {
  DRAFT_HASH,
  DRY_RUN,
  REPLACE,
  resumable,
  RESUME,
  REVERIFY,
  RUN,
  success,
  VERIFY,
} from "#/cases/review-pull-request-saved-draft-test-support.ts";
import type { ToolCall } from "#/observation/agent-query.ts";

function verifyRoute(resume = RESUME, payload = REVERIFY, validator = VERIFY) {
  const calls = [resume, payload, validator, REPLACE, DRY_RUN];
  return verifiedResume(
    { ...resumable(calls), toolCalls: calls },
    DRAFT_HASH,
    "unchanged",
    DRY_RUN,
  );
}

it.each([
  `echo validate-output.py verify ${RUN}/verify.txt`,
  `python3 -I /other-project/validate-output.py verify < ${RUN}/verify.txt`,
  `python3 -I /other-project/.claude/skills/review-pull-request/scripts/validate-output.py verify < ${RUN}/verify.txt`,
  `python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify < wrong/verify.txt; echo ${RUN}/verify.txt`,
  `python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify ${RUN}/verify.txt`,
])(
  "rejects a command that does not validate the assigned payload on stdin: %s",
  (command) => {
    expect(() => verifyRoute(RESUME, REVERIFY, success(command))).toThrow(
      /re-verification/,
    );
  },
);

it.each([`VERIFY: PASS\nother-run/verify.txt`, "VERIFY: PASS"])(
  "rejects an uncorroborated verifier result: %s",
  (content) => {
    const payload: ToolCall = {
      ...REVERIFY,
      result: { content, isError: false, truncated: false },
    };
    expect(() => verifyRoute(RESUME, payload)).toThrow(/fresh VERIFY/);
  },
);

it.each([
  `PAYLOAD_FILE=other/verify.txt. Source: ${RUN}/verify.txt`,
  `PAYLOAD_FILE=${RUN}/verify.txt.extra`,
])(
  "does not mistake a path mention for the verifier's assignment: %s",
  (prompt) => {
    expect(() =>
      verifyRoute(RESUME, { ...REVERIFY, input: { prompt } }),
    ).toThrow(/fresh VERIFY/);
  },
);

it("withholds a fresh verifier pass when its inline write failed", () => {
  const payload: ToolCall = {
    name: "Write",
    input: { file_path: `${RUN}/verify.txt`, content: "VERIFY: PASS\n{}" },
    result: { content: "write failed", isError: true, truncated: false },
  };
  const calls = [RESUME, payload, VERIFY, REPLACE, DRY_RUN];
  const preview = resumable(calls);
  const observation = {
    ...preview,
    toolCalls: calls,
    repoFiles: {
      ...preview.repoFiles,
      [`${RUN}/verify.txt`]:
        'VERIFY: PASS\n{"issues":[],"observed_checks":["Checked the old draft."]}\n',
    },
  };
  expect(() =>
    verifiedResume(observation, DRAFT_HASH, "unchanged", DRY_RUN),
  ).toThrow(/fresh VERIFY/);
});

it("accepts an uncaptured inline Write only when the retained bytes prove fresh production", () => {
  const path = `${RUN}/verify.txt`;
  const bytes =
    'VERIFY: PASS\n{"issues":[],"observed_checks":["Rechecked the revised draft."]}\n';
  const payload: ToolCall = {
    name: "Write",
    input: { file_path: path, content: bytes },
  };
  const calls = [RESUME, payload, VERIFY, REPLACE, DRY_RUN];
  const preview = resumable(calls);
  const changed = {
    ...preview,
    toolCalls: calls,
    repoFiles: { ...preview.repoFiles, [path]: bytes },
  };
  expect(() =>
    verifiedResume(changed, DRAFT_HASH, "unchanged", DRY_RUN),
  ).not.toThrow();
  expect(() =>
    verifiedResume(
      { ...preview, toolCalls: calls },
      DRAFT_HASH,
      "unchanged",
      DRY_RUN,
    ),
  ).toThrow(/fresh VERIFY/);
});

it("does not accept a matching verifier filename under an unrelated root", () => {
  const validator = success(
    `python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify < unrelated/${RUN}/verify.txt`,
  );
  expect(() => verifyRoute(RESUME, REVERIFY, validator)).toThrow(
    /re-verification/,
  );
});

it("does not treat a worker's PASS and successful schema validation of FAIL bytes as a verifier pass", () => {
  const calls = [RESUME, REVERIFY, VERIFY, REPLACE, DRY_RUN];
  const preview = resumable(calls);
  const failed = {
    ...preview,
    toolCalls: calls,
    repoFiles: {
      ...preview.repoFiles,
      [`${RUN}/verify.txt`]:
        'VERIFY: FAIL\n{"issues":["stale"],"observed_checks":["Inspected the draft."]}',
    },
  };
  expect(() =>
    verifiedResume(failed, DRAFT_HASH, "unchanged", DRY_RUN),
  ).toThrow(/fresh VERIFY/);
});

it("does not re-review a chunk on unchanged history", () => {
  const chunk: ToolCall = {
    name: "Agent",
    input: { subagent_type: "chunk-reviewer" },
  };
  const calls = [RESUME, chunk, REVERIFY, VERIFY, REPLACE, DRY_RUN];
  const observation = { ...resumable(calls), toolCalls: calls };
  expect(() =>
    verifiedResume(observation, DRAFT_HASH, "unchanged", DRY_RUN),
  ).toThrow(/chunk/);
});

it("resolves literal same-call path bindings for the resume and validator", () => {
  const resume = success(
    `SAVED_REVIEW='${GITHUB_FACTS.report}'\npython3 -I .claude/skills/review-pull-request/scripts/post-review.py --resume "$SAVED_REVIEW"`,
    RESUME.result?.content,
  );
  const validator = success(
    `PAYLOAD_FILE='${RUN}/verify.txt'; python3 -I .claude/skills/review-pull-request/scripts/validate-output.py verify <"$PAYLOAD_FILE"`,
  );
  expect(() => verifyRoute(resume, REVERIFY, validator)).not.toThrow();
});

it("does not credit an unrelated validator at the fixture root", () => {
  expect(() =>
    verifyRoute(
      RESUME,
      REVERIFY,
      success(`python3 -I ./validate-output.py verify <${RUN}/verify.txt`),
    ),
  ).toThrow(/re-verification/);
});

it("rejects a malformed resume result without refreshed", () => {
  const resume = success(
    String(RESUME.input["command"]),
    RESUME.result?.content.replace(/,?"refreshed":false/, ""),
  );
  expect(() => verifyRoute(resume)).toThrow();
});

it("does not validate an old payload through a failed /dev/null read and a subsequent path mention", () => {
  const failed = {
    ...VERIFY,
    input: {
      command: String(VERIFY.input["command"]).replace(
        `${RUN}/verify.txt`,
        "/dev/null",
      ),
    },
    result: { content: "invalid", isError: true, truncated: false },
  };
  const calls = [
    RESUME,
    REVERIFY,
    failed,
    success(`printf '%s' '${RUN}/verify.txt'`),
    REPLACE,
    DRY_RUN,
  ];
  expect(() =>
    verifiedResume(
      { ...resumable(calls), toolCalls: calls },
      DRAFT_HASH,
      "unchanged",
      DRY_RUN,
    ),
  ).toThrow(/re-verification/);
});

it("requires validation after the last production of the retained verifier bytes", () => {
  const bytes =
    'VERIFY: PASS\n{"issues":[],"observed_checks":["Different verification."]}';
  const write = {
    name: "Write",
    input: { file_path: `${RUN}/verify.txt`, content: bytes },
    result: { content: "written", isError: false, truncated: false },
  };
  const calls = [RESUME, REVERIFY, VERIFY, write, REPLACE, DRY_RUN];
  const preview = resumable(calls);
  expect(() =>
    verifiedResume(
      {
        ...preview,
        toolCalls: calls,
        repoFiles: { ...preview.repoFiles, [`${RUN}/verify.txt`]: bytes },
      },
      DRAFT_HASH,
      "unchanged",
      DRY_RUN,
    ),
  ).toThrow(/re-verification/);
});

it("accepts successful tool results whose reserve tail contains the complete resume and worker return", () => {
  const tail = (call: ToolCall): ToolCall => ({
    ...call,
    result: {
      truncated: true,
      isError: false,
      content: `\n[truncated]\n${call.result?.content ?? ""}`,
    },
  });
  expect(() =>
    verifyRoute(tail(RESUME), tail(REVERIFY), tail(VERIFY)),
  ).not.toThrow();
});

it("reads the single resume JSON object line amid status output, not an ambiguous second object", () => {
  const json = RESUME.result?.content ?? "";
  const command = `${String(RESUME.input["command"])}; echo exit=$?`;
  expect(() =>
    verifyRoute(success(command, `Resume result:\n${json}\nexit=0`)),
  ).not.toThrow();
  expect(() =>
    verifyRoute(success(command, `${json}\n${json}\nexit=0`)),
  ).toThrow();
});
