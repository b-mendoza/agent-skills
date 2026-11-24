import { describe, expect, it } from "vitest";

import {
  acceptsOnly,
  change,
  extraWrite,
  gate,
  observation,
  preview,
  shell,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";

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
  it("requires missing-ticket evidence from the drafter", () => {
    const good = observation([]);
    expect(
      acceptsOnly(
        "title-missing-ticket-asks",
        {
          ...good,
          toolCalls: [
            shell(
              "PR_DRAFT: NEEDS_CHOICE\nDecision needed: provide ticket key",
            ),
          ],
        },
        { ...good, toolCalls: [shell("PASS")] },
      ),
    ).not.toThrow();
  });
  it("requires the requested tip without switching HEAD", () => {
    const good = observation([gate("preview", preview)], {
      ".git/HEAD": "ref: refs/heads/main",
    });
    expect(
      acceptsOnly(
        "remote-head-not-checked-out",
        good,
        change(good, { [HEAD_LOG]: "switched branches" }),
      ),
    ).not.toThrow();
  });
});
