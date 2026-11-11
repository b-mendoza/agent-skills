import { describe, expect, it } from "vitest";

import { checkCreated } from "#/cases/pr-creator-behavior-checks.ts";
import {
  createdObservation,
  digestCall,
} from "#/cases/pr-creator-test-support.ts";

describe("pr-creator assignability evidence", () => {
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
