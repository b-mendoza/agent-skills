import { describe, expect, it } from "vitest";

import { READBACK_CAPTURE } from "#/cases/pr-creator-behavior-checks.ts";
import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import {
  acceptsOnly,
  change,
  CLOSING,
  extraWrite,
  finished,
  FIRST_RELATED,
  gate,
  NEXT,
  observation,
  preview,
  shell,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { createdObservation } from "#/cases/pr-creator-test-support.ts";
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
  it.each([false, true])(
    "requires both issue lookups and the correct closure expectation (non-default: %s)",
    (nonDefault) => {
      const values = {
        ...preview,
        closes: [`${facts.repository}#42`],
        related: [`${facts.repository}#43`],
        body: "## Issues\n- Closes #42 — guard\n- Related: #43 — cleanup",
        autoClose: nonDefault ? "no" : "yes",
      };
      const args = [CLOSING, FIRST_RELATED].map((number) => [
        "api",
        `repos/${facts.repository}/issues/${String(number)}`,
      ]);
      const gates = nonDefault
        ? [finished, gate("preview", values, "Keep the closing keywords.")]
        : [gate("preview", values)];
      expect(
        acceptsOnly(
          nonDefault ? "issue-refs-non-default-base" : "issue-refs-explicit",
          observation(gates, {}, args),
          observation(gates, {}, args.slice(NEXT)),
        ),
      ).not.toThrow();
    },
  );
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
describe("confirmed creates", () => {
  it("distinguishes additive automation from a changed title", () => {
    const additive = createdObservation("additions");
    const original = createdObservation();
    const changed = change(original, {
      [READBACK_CAPTURE]:
        original.repoFiles?.[READBACK_CAPTURE]?.replace(
          facts.title,
          "Externally changed title",
        ) ?? null,
    });
    expect(
      acceptsOnly("created-with-additions", additive, changed),
    ).not.toThrow();
    expect(acceptsOnly("created-with-drift", changed, additive)).not.toThrow();
  });
  it("resolves the authenticated identity before assigning", () => {
    const endpoint = `repos/${facts.repository}/assignees/cart-owner`;
    const good = observation(
      [gate("preview", { ...preview, assignees: ["cart-owner"] })],
      {},
      [
        ["api", "user"],
        ["api", endpoint],
      ],
    );
    const observed = {
      ...good,
      toolCalls: [
        ...good.toolCalls,
        {
          ...shell("HTTP/2.0 204 No Content"),
          input: { command: `gh api ${endpoint} -i` },
        },
      ],
    };
    expect(acceptsOnly("assignee-me-alias", observed, good)).not.toThrow();
  });
});
