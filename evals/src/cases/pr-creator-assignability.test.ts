import { describe, expect, it } from "vitest";

import {
  assertAssigneeStatus,
  checkCreated,
} from "#/cases/pr-creator-behavior-checks.ts";
import {
  createdObservation,
  digestCall,
} from "#/cases/pr-creator-test-support.ts";
import type { Observation } from "#/observation/agent-query.ts";

function assigneeObservation(
  command: string,
  content = "",
  isError = false,
): Observation {
  return {
    ...createdObservation(),
    toolCalls: [
      digestCall(),
      {
        name: "Bash",
        input: { command },
        result: { content, isError, truncated: false },
      },
    ],
  };
}

describe("pr-creator assignability evidence", () => {
  it.each([
    "gh api repos/other-org/cart/assignees/maintainer",
    "gh api repos/eval-org/other-repo/assignees/maintainer",
    "gh api repos/eval-org/cart/assignees/other-login",
    "gh api repos/eval-org/cart/assignees/maintainer-extra",
    "gh api repos/eval-org/cart/assignees/maintainer/extra",
    "gh api 'repos/eval-org/cart/assignees/maintainer-extra?per_page=100'",
    "gh api 'repos/eval-org/cart/assignees/maintainer/extra?per_page=100'",
    "gh api other/repos/eval-org/cart/assignees/maintainer",
  ])("rejects unrelated assignability requests: %s", (command) => {
    for (const content of ["", "HTTP/2.0 204 No Content"]) {
      expect(() =>
        checkCreated(assigneeObservation(command, content), false),
      ).toThrow(/HTTP status/);
    }
  });
  it.each([
    "gh api -i repos/eval-org/cart/assignees/maintainer",
    "gh api -i /repos/eval-org/cart/assignees/maintainer",
    "gh api -i 'repos/eval-org/cart/assignees/maintainer?per_page=100'",
    'gh api -H "Accept: application/vnd.github+json" /repos/eval-org/cart/assignees/maintainer -i',
    "gh api --include repos/eval-org/cart/assignees/maintainer 2>&1 | head -n 1",
    "gh api '/repos/eval-org/cart/assignees/maintainer' -i",
    'gh api "/repos/eval-org/cart/assignees/maintainer" -i',
    "gh api repos/eval-org/cart/assignees/maintainer; true",
    "gh api repos/eval-org/cart/assignees/maintainer || true",
    "gh api repos/eval-org/cart/assignees/maintainer | cat",
    "gh api repos/eval-org/cart/assignees/maintainer\ntrue",
    "echo gh api repos/eval-org/cart/assignees/maintainer",
    "gh api repos/eval-org/cart/assignees/maintainer -i && false",
  ])(
    "accepts printed 204 evidence regardless of shell outcome: %s",
    (command) => {
      for (const isError of [false, true]) {
        expect(() => {
          assertAssigneeStatus(
            assigneeObservation(command, "HTTP/2.0 204 No Content", isError),
            "maintainer",
            true,
          );
        }).not.toThrow();
      }
    },
  );
  it("requires captured assignability status, accepting a retained truncated tail", () => {
    const original = createdObservation();
    expect(() =>
      checkCreated({ ...original, toolCalls: [digestCall()] }, false),
    ).toThrow(/HTTP status/);
    const lookup = {
      name: "Bash",
      input: { command: "gh api repos/eval-org/cart/assignees/maintainer -i" },
      result: {
        content: "earlier output omitted\nHTTP/2.0 204 No Content",
        isError: false,
        truncated: true,
      },
    };
    expect(() =>
      checkCreated({ ...original, toolCalls: [digestCall(), lookup] }, false),
    ).not.toThrow();
    expect(() =>
      checkCreated(
        {
          ...original,
          toolCalls: [
            digestCall(),
            {
              ...lookup,
              result: { ...lookup.result, content: "HTTP/2.0 404 Not Found" },
            },
          ],
        },
        false,
      ),
    ).toThrow(/HTTP status/);
  });
});
