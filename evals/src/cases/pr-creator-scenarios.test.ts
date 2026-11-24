import { describe, expect, it } from "vitest";

import {
  acceptsOnly,
  extraWrite,
  gate,
  observation,
  preview,
} from "#/cases/pr-creator-scenario-test-support.ts";

describe("preview gates", () => {
  it("does not act on approval given before the preview", () => {
    const good = observation([gate("preview", preview)]);
    expect(
      acceptsOnly("preapproval-ignored", good, extraWrite(good)),
    ).not.toThrow();
  });
  it("returns a newly frozen title after a conditional yes", () => {
    const first = gate("preview", preview);
    const final = gate(
      "preview",
      { ...preview, title: "fix: handle cart division" },
      "Yes, but change the title to fix: handle cart division",
    );
    expect(
      acceptsOnly(
        "conditional-yes-is-revise",
        observation([first, final]),
        observation([first, first]),
      ),
    ).not.toThrow();
  });
});
