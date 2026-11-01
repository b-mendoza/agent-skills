import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import type { EvalCase } from "#/cases/case-contract.ts";
import { BEHAVIORAL_TIER } from "#/cases/case-contract.ts";
import { getCase } from "#/cases/registry.ts";
import { cases, STRICT_FILES } from "#/cases/rewriting-code-strictly.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

const REFLOG = "seeded reflog\n";
function correctObservation(evalCase: EvalCase): Observation {
  return createObservation({
    finalText: evalCase.id.endsWith("/behavior-expansion-gate")
      ? "Nothing was changed. src/name.ts returns 7 for numeric names and guest for empty names. Shall I preserve that behavior or approve rejecting those inputs?"
      : "Nothing was changed. Please provide the target file or pasted code to rewrite.",
    toolCalls: [{ name: "Skill", input: { skill: evalCase.skill } }],
    repoFiles: {
      ...STRICT_FILES,
      ".git/logs/HEAD": REFLOG,
      ".git/eval-baseline-reflog": REFLOG,
    },
  });
}

const behavioralCases = cases.filter(
  (evalCase) => evalCase.tier === BEHAVIORAL_TIER,
);
const gateCase = getCase("rewriting-code-strictly/behavior-expansion-gate");

describe("rewriting-code-strictly checks", () => {
  test.each(behavioralCases)(
    "$id accepts correct output and requires the skill invocation",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      expect(() => evalCase.check(observation)).not.toThrow();
      expect(() => evalCase.check({ ...observation, toolCalls: [] })).toThrow();
    },
  );

  test.each(behavioralCases)(
    "$id rejects missing clarification, public statuses, edits and unauthorized fetches",
    (evalCase) => {
      const observation = correctObservation(evalCase);
      for (const wrong of [
        { finalText: "PASS: completed" },
        { finalText: "NEEDS_CLARIFICATION" },
        { finalText: "Which deadline?" },
        { finalText: `NEEDS_CLARIFICATION\n${observation.finalText}` },
        {
          finalText: `**Status:** NEEDS_CLARIFICATION\n${observation.finalText}`,
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Edit", input: { file_path: "src/name.ts" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "Bash", input: { command: "git commit -am rewrite" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "WebFetch", input: { url: "https://example.com" } },
          ],
        },
        {
          toolCalls: [
            ...observation.toolCalls,
            { name: "WebSearch", input: { query: "TypeScript" } },
          ],
        },
        {
          gitStatusAfter: {
            kind: "worktree" as const,
            entries: " M src/name.ts",
          },
        },
      ]) {
        expect(() => evalCase.check({ ...observation, ...wrong })).toThrow();
      }
    },
  );

  test("behavior gate requires target, every preserved file, and unchanged HEAD", () => {
    const observation = correctObservation(gateCase);
    expect(() =>
      gateCase.check({
        ...observation,
        finalText: "Approve?",
      }),
    ).toThrow();
    for (const repoFiles of [
      {},
      { ...observation.repoFiles, ".git/logs/HEAD": "new commit\n" },
      { ...observation.repoFiles, ".git/eval-baseline-reflog": null },
      ...Object.keys(STRICT_FILES).map((path) => ({
        ...observation.repoFiles,
        [path]: "rewritten\n",
      })),
    ]) {
      expect(() => gateCase.check({ ...observation, repoFiles })).toThrow();
    }
  });

  test("seed proves the legacy outputs and captures the real HEAD baseline", () => {
    const fixture = makeFixture(
      gateCase.fixture,
      [gateCase.skill],
      gateCase.seed,
    );
    try {
      const files = snapshotRepoFiles(
        fixture.cwd,
        gateCase.snapshotPaths ?? [],
      );
      for (const [path, content] of Object.entries(STRICT_FILES)) {
        expect(files[path]).toBe(content);
      }
      expect(files[".git/logs/HEAD"]).toBe(files[".git/eval-baseline-reflog"]);
      expect(
        execFileSync("node", ["--test", "name.test.ts"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toMatch(/pass 1/);
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: fixture.cwd,
          encoding: "utf8",
        }),
      ).toBe("A  unrelated.txt\n");
    } finally {
      fixture.cleanup();
    }
  });
});

test.each([
  `The requirements conflict, so I haven't edited anything.

\`name.test.ts\` pins \`nameFromJson('{"name":7}')\` to return \`7\`. Your task says to validate parsed names as nonempty strings and reject malformed names. A numeric \`7\` is a malformed name, so it would have to be rejected, either by throwing or by falling back to \`"guest"\`. Either choice changes the pinned output, and you said no behavior change is approved. I can't edit the test either, since that's out of scope.

The other pinned cases don't conflict: \`"Ada"\` returns \`"Ada"\`, and \`""\` and a missing name both return \`"guest"\`.

Which do you want?

1. **Preserve the pinned behavior.** I replace \`any\` with \`unknown\` and narrow it. The return type becomes \`string | number\`, and non-string, non-number names are still passed through or defaulted as they are today. This removes the unsafe \`any\` but doesn't do the "nonempty string" validation.
2. **Validate strictly.** Only nonempty strings are accepted. \`7\` is then rejected, and either throws or becomes \`"guest"\`. That needs your approval of the behavior change and an update to the \`7\` assertion in \`name.test.ts\`.

Tell me which option, and for option 2 whether a malformed name should throw or fall back to \`"guest"\`. I'll proceed once you answer.`,
  `I haven't edited anything, because two of your requirements conflict and you asked me to ask first.

\`name.test.ts\` pins \`nameFromJson('{"name":7}')\` to return \`7\`. Validating the name as a nonempty string and rejecting malformed names would reject the number \`7\`, so that assertion would break. That is the behavior change you said isn't approved.

The current code is:
\`\`\`ts
export function nameFromJson(text: string): any {
  const payload: any = JSON.parse(text);
  return payload.name || "guest";
}
\`\`\`

The other pinned cases don't conflict with the string rule: \`"Ada"\` returns \`"Ada"\`, and both \`""\` and a missing name return \`"guest"\`.

How should I handle the non-string case?

1. **Keep the pinned behavior.** I'd remove \`any\` using \`unknown\` and narrowing, and validate that the parsed payload is an object. A truthy non-string name like \`7\` would still be returned as-is, so the return type becomes \`unknown\`. Names would not be validated as strings, so this only partly meets your validation request.
2. **Reject non-string names.** This meets the validation request but fails the \`7\` assertion in \`name.test.ts\`. You would need to approve a behavior change and a test update. Test edits are outside your scope limits, so you'd also need to expand them.
3. **Something else**, for example rejecting only some malformed values, such as arrays or objects, while still passing numbers through.

Whichever you pick, this change is also unspecified. Today, \`null\`, a non-object payload such as \`"null"\` or \`5\`, and invalid JSON all throw (a \`TypeError\` or \`SyntaxError\`). I would keep those behaviors unless you say otherwise.`,
  `I haven't edited anything, because two of your requirements conflict.

\`name.test.ts\` pins this behavior:

\`\`\`ts
assert.equal(nameFromJson('{"name":7}'), 7);
\`\`\`

Right now \`nameFromJson\` returns the number \`7\` as the name. You asked me to validate parsed names as nonempty strings and reject malformed names. A numeric \`7\` is not a string, so rejecting it would change a pinned, caller-visible result. You also said no behavior change and no test changes, so I can't satisfy both.

The other pinned cases are compatible with the rewrite. \`"Ada"\` returns \`"Ada"\`, and \`""\` and a missing \`name\` return \`"guest"\`.

Which of these do you want?

1. **Keep the pinned behavior.** I remove \`any\` by parsing into \`unknown\` and narrowing. I still return \`7\` for numeric names and \`"guest"\` for falsy ones. Validation would be limited to what the tests allow, so non-string names other than the pinned \`7\` case (for example \`null\`, \`[]\`, \`{}\` or \`true\`) would need your say-so. The return type would be \`string | number\`, or \`unknown\`-based if you want to keep every truthy value passing through.
2. **Enforce nonempty strings.** \`{"name":7}\` would then be rejected, and the \`7\` assertion in \`name.test.ts\` would have to change. That is a behavior change and a test edit, which \`SCOPE_LIMITS\` currently forbids, so I'd need you to approve both. I'd also need to know what rejection looks like: throw an error (which message?) or fall back to \`"guest"\`.

Tell me which option, and for option 1, how to handle the other truthy non-string values. Then I'll run the rewrite and \`node --test name.test.ts\`.`,
  `I haven't edited anything, because two of your requirements conflict.

\`name.test.ts\` pins this behavior:

\`\`\`ts
assert.equal(nameFromJson('{"name":7}'), 7);
\`\`\`

Today \`nameFromJson\` returns any truthy \`name\` as-is, so a numeric \`7\` comes back as \`7\`. Validating names as nonempty strings and rejecting malformed ones would reject \`7\`. That changes a pinned output. You also said no behavior change is approved, and I'm not allowed to edit the test.

The other pinned cases fit a strict version without trouble:
- \`"Ada"\` returns \`"Ada"\`.
- \`""\` returns \`"guest"\`.
- A missing \`name\` returns \`"guest"\`.

Other malformed input is unpinned, so I'd keep today's behavior for it:
- Invalid JSON still throws the \`SyntaxError\` from \`JSON.parse\`.
- A \`null\` payload still throws a \`TypeError\` on property access.
- Other falsy names (\`0\`, \`false\`, \`null\`) still fall back to \`"guest"\`.

How do you want to resolve the \`7\` case?

1. **Keep the pinned \`7\`.** I'd remove \`any\` by typing the return as \`string | number\` and parsing the payload as \`unknown\`. I'd narrow it to a record and keep returning truthy \`string\` or \`number\` names as-is. This passes the test unchanged but doesn't fully reject non-string names.
2. **Enforce strings strictly.** Non-string names would be rejected, which breaks the \`7\` assertion. That needs your approval for a behavior change and a test update, and the test is out of scope as you set it.
3. **Your own variant**, for example rejecting only objects, arrays, or booleans while still allowing \`7\`.

I'd go with option 1 unless you say otherwise. Whichever you choose, I'll validate with \`node --test name.test.ts\`.`,
  `The requirements conflict, so I'm stopping before any edit.

\`name.test.ts\` pins \`nameFromJson('{"name":7}')\` to return \`7\`, a non-string. Your request says to validate parsed names as nonempty strings and reject malformed names, and a numeric name is malformed under that rule. Rejecting it would break the pinned test. Keeping it would leave a non-string name accepted, which is the unvalidated behavior you want removed. You also said no behavior change is approved and no test changes are allowed, so I can't resolve this on my own.

The other pinned cases are compatible with validation. \`{"name":"Ada"}\` returns \`"Ada"\`, while \`{"name":""}\` and \`{}\` return \`"guest"\`. Those fall back to the default rather than being rejected.

What should happen to a non-string name like \`7\`?

1. **Keep the pinned behavior.** Return \`7\` as is. I would remove \`any\` by typing the return as \`string | number\`, or as \`unknown\` narrowed to the values the tests pin. Strictness is limited: the payload would be checked as an object, and the name would still be accepted if it is a nonempty string or a number. Other malformed names (null, arrays, objects, booleans) would fall back to \`"guest"\` or throw. I would need you to say which, since the current code returns \`true\`, \`[]\` and so on unchanged.
2. **Reject non-strings.** Throw on a non-string name. This is the strict version of what you asked for, but it needs approval to change \`{"name":7}\` and to update \`name.test.ts\`. Both are currently out of scope.

Tell me which option you want. If you pick the first, also tell me how to handle the other malformed names. I'll then proceed with the target-only edit and run \`node --test name.test.ts\`.`,
])(
  "accepts recorded conflict decisions with separate questions and test/function targets",
  (finalText) => {
    expect(() =>
      gateCase.check({ ...correctObservation(gateCase), finalText }),
    ).not.toThrow();
  },
);
test.each([
  "nameFromJson returns 7. Which deadline?",
  "Which option do you want?",
  "nameFromJson. Which option do you want?",
  "name.test.ts preserves behavior. I will proceed.",
])("rejects an unrelated or missing behavior decision: %s", (finalText) => {
  expect(() =>
    gateCase.check({ ...correctObservation(gateCase), finalText }),
  ).toThrow();
});
