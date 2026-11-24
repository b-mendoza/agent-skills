import { expect, it } from "vitest";

import { assertPushDestination } from "#/cases/pr-creator-checks.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

const bash = (command: string) => ({ name: "Bash", input: { command } });
it("requires corroboration for a redacted Git porcelain URL", () => {
  const url = "github.com:eval-org/cart.git";
  const obs = createObservation({
    toolCalls: [
      {
        ...bash("git remote -v"),
        result: {
          content: `origin\tgit@${url} (push)`,
          isError: false,
          truncated: false,
        },
      },
    ],
  });
  expect(() => {
    assertPushDestination(obs, url);
  }).not.toThrow();
  expect(() => {
    assertPushDestination(createObservation(), url);
  }).toThrow();
  expect(() => {
    assertPushDestination(obs, "elsewhere:eval-org/cart.git");
  }).toThrow();
});
