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
    "gh api repos/eval-org/cart/assignees/maintainer",
    "gh api 'repos/eval-org/cart/assignees/maintainer'",
    "gh api 'repos/eval-org/cart/assignees/maintainer?per_page=100&page=2'",
    'gh api --method GET "repos/eval-org/cart/assignees/maintainer"',
    "gh api -i repos/eval-org/cart/assignees/maintainer",
    "gh api repos/eval-org/cart/assignees/maintainer -X GET --include",
    "gh api --method=GET repos/eval-org/cart/assignees/maintainer",
    "gh api -i /repos/eval-org/cart/assignees/maintainer",
    "gh api -i 'repos/eval-org/cart/assignees/maintainer?per_page=100'",
    'gh api -H "Accept: application/vnd.github+json" /repos/eval-org/cart/assignees/maintainer -i',
    "gh api --header='Accept: application/vnd.github+json' '/repos/eval-org/cart/assignees/maintainer' --silent",
    'gh api --hostname github.com --cache 1h --method "GET" "/repos/eval-org/cart/assignees/maintainer"',
    'gh api -XGET -H"Accept: application/vnd.github+json" /repos/eval-org/cart/assignees/maintainer',
    'gh api \\\n  -H "Accept: application/vnd.github+json" \\\n  /repos/eval-org/cart/assignees/maintainer',
  ])("accepts a captured headerless assignability success: %s", (command) => {
    expect(() =>
      checkCreated(assigneeObservation(command), false),
    ).not.toThrow();
  });
  it.each([
    { name: "missing result", result: undefined },
    {
      name: "failed headerless request",
      result: { content: "", isError: true, truncated: false },
    },
    {
      name: "printed 404 despite a non-error result",
      result: {
        content: "HTTP/2.0 404 Not Found",
        isError: false,
        truncated: false,
      },
    },
  ])("rejects assignability evidence with $name", ({ result }) => {
    const lookup = {
      name: "Bash",
      input: { command: "gh api repos/eval-org/cart/assignees/maintainer" },
      ...(result === undefined ? {} : { result }),
    };
    expect(() =>
      checkCreated(
        { ...createdObservation(), toolCalls: [digestCall(), lookup] },
        false,
      ),
    ).toThrow(/HTTP status/);
  });
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
  it.each([
    "gh api repos/eval-org/cart/assignees/maintainer; true",
    "gh api repos/eval-org/cart/assignees/maintainer || true",
    "gh api repos/eval-org/cart/assignees/maintainer | cat",
    "gh api repos/eval-org/cart/assignees/maintainer\ntrue",
    "echo gh api repos/eval-org/cart/assignees/maintainer",
    "echo $(gh api repos/eval-org/cart/assignees/maintainer)",
    "gh api repos/eval-org/cart/assignees/maintainer > /tmp/lookup",
    "gh api --include repos/eval-org/cart/assignees/maintainer 2>&1 | head -n 1",
    "gh api repos/eval-org/cart/assignees/maintainer -X POST",
    "gh api repos/eval-org/cart/assignees/maintainer --method=DELETE",
    "gh api repos/eval-org/cart/assignees/maintainer -f key=value",
    "gh api repos/eval-org/cart/assignees/maintainer --field key=value -X GET",
    "gh api repos/eval-org/cart/assignees/maintainer --raw-field=key=value",
    "gh api repos/eval-org/cart/assignees/maintainer --input body.json -X GET",
    'gh api repos/eval-org/cart/assignees/maintainer -H "$(cat header.txt)"',
    "gh api --header # repos/eval-org/cart/assignees/maintainer",
    "gh api --hostname enterprise.example.com repos/eval-org/cart/assignees/maintainer",
    'gh api\n  -H "Accept: application/vnd.github+json" \\\n  /repos/eval-org/cart/assignees/maintainer',
  ])(
    "rejects headerless non-standalone or body-sending requests: %s",
    (command) => {
      expect(() => {
        assertAssigneeStatus(assigneeObservation(command), "maintainer", true);
      }).toThrow(/HTTP status/);
    },
  );
  it.each(["", "HTTP/2.0 204 No Content"])(
    "rejects unassignable evidence without a printed 404: %s",
    (content) => {
      expect(() => {
        assertAssigneeStatus(
          assigneeObservation(
            "gh api repos/eval-org/cart/assignees/maintainer",
            content,
          ),
          "maintainer",
          false,
        );
      }).toThrow(/HTTP status/);
    },
  );
  it("preserves printed 404 evidence for an unassignable login", () => {
    expect(() => {
      assertAssigneeStatus(
        assigneeObservation(
          "gh api repos/eval-org/cart/assignees/not-assignable -i",
          "HTTP/2.0 404 Not Found",
          true,
        ),
        "not-assignable",
        false,
      );
    }).not.toThrow();
  });
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
